// Checks how the website talks to Square and PayPal, using pretend replies
// (no real accounts or money involved). Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { refundSquarePayment, startSquareCheckout, verifySquarePayment } from "../src/lib/payments/square.ts";
import { capturePayPalPayment, refundPayPalPayment, startPayPalCheckout } from "../src/lib/payments/paypal.ts";
import { toCents, toDollars, type StartCheckout } from "../src/lib/payments/types.ts";

type Call = { url: string; method: string; body: unknown; headers: Record<string, string> };

/** A pretend fetch that answers by "METHOD path" and records every call. */
function fakeFetch(routes: Record<string, (body: unknown) => [number, unknown]>) {
  const calls: Call[] = [];
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const raw = init?.body ? String(init.body) : "";
    const body = raw.startsWith("{") ? JSON.parse(raw) : raw;
    calls.push({ url: url.toString(), method, body, headers: (init?.headers ?? {}) as Record<string, string> });
    const handler = routes[`${method} ${url.pathname}`];
    if (!handler) return new Response(JSON.stringify({ message: "not found" }), { status: 404 });
    const [status, reply] = handler(body);
    return new Response(JSON.stringify(reply), { status });
  }) as typeof fetch;
  return { fn, calls };
}

const ORDER = "11111111-1111-4111-8111-111111111111";
const checkout: StartCheckout = {
  orderId: ORDER,
  description: "Entries: Inspire Sydney Dance Eisteddfod 2027",
  lines: [
    { name: "Section 12 – Jazz Solo 10 Years & Under", amountCents: 2500 },
    { name: "Section 21 – Tap Duo/Trio Open (studio entry)", amountCents: 3500 },
  ],
  totalCents: 6000,
  returnUrl: "https://example.test/checkout/return?order=" + ORDER,
  cancelUrl: "https://example.test/enter/x?payment=cancelled",
};

test("money is converted without rounding errors", () => {
  assert.equal(toCents("60.00"), 6000);
  assert.equal(toCents("0.1"), 10);
  assert.equal(toCents("19.99"), 1999);
  assert.equal(toDollars(6000), "60.00");
  assert.equal(toDollars(5), "0.05");
});

const square = { accessToken: "test-token", sandbox: true };

test("Square: a checkout uses the sandbox, Australian dollars and our cart number", async () => {
  const { fn, calls } = fakeFetch({
    "GET /v2/locations": () => [200, { locations: [{ id: "L1", status: "ACTIVE", currency: "AUD" }] }],
    "POST /v2/online-checkout/payment-links": () => [200, { payment_link: { url: "https://square.test/pay/abc", order_id: "SQ-ORDER-1" } }],
  });
  const started = await startSquareCheckout(square, checkout, fn);
  assert.deepEqual(started, { reference: "SQ-ORDER-1", payUrl: "https://square.test/pay/abc" });
  assert.ok(calls.every((c) => c.url.startsWith("https://connect.squareupsandbox.com/")));
  const sent = calls[1].body as { order: { location_id: string; reference_id: string; line_items: { base_price_money: { amount: number; currency: string } }[] } };
  assert.equal(sent.order.location_id, "L1");
  assert.equal(sent.order.reference_id, ORDER);
  assert.deepEqual(sent.order.line_items.map((l) => l.base_price_money), [{ amount: 2500, currency: "AUD" }, { amount: 3500, currency: "AUD" }]);
});

test("Square: refuses an account that isn't in Australian dollars", async () => {
  const { fn } = fakeFetch({ "GET /v2/locations": () => [200, { locations: [{ id: "L1", status: "ACTIVE", currency: "USD" }] }] });
  await assert.rejects(startSquareCheckout(square, checkout, fn), /USD/);
});

test("Square: a completed payment is reported with its amount", async () => {
  const { fn } = fakeFetch({
    "GET /v2/orders/SQ-ORDER-1": () => [200, { order: { id: "SQ-ORDER-1", reference_id: ORDER, tenders: [{ id: "T1", payment_id: "PAY1" }] } }],
    "GET /v2/payments/PAY1": () => [200, { payment: { id: "PAY1", status: "COMPLETED", amount_money: { amount: 6000, currency: "AUD" }, receipt_url: "https://square.test/r/1" } }],
  });
  assert.deepEqual(await verifySquarePayment(square, "SQ-ORDER-1", ORDER, fn), {
    paid: true, reference: "SQ-ORDER-1", paymentId: "PAY1", amountCents: 6000, receiptUrl: "https://square.test/r/1",
  });
});

test("Square: not paid yet, or someone else's order, is not treated as paid", async () => {
  const unpaid = fakeFetch({ "GET /v2/orders/SQ-ORDER-1": () => [200, { order: { id: "SQ-ORDER-1", reference_id: ORDER } }] });
  assert.equal((await verifySquarePayment(square, "SQ-ORDER-1", ORDER, unpaid.fn)).paid, false);
  const other = fakeFetch({ "GET /v2/orders/SQ-ORDER-1": () => [200, { order: { id: "SQ-ORDER-1", reference_id: "someone-else", tenders: [{ id: "T1", payment_id: "PAY1" }] } }] });
  const result = await verifySquarePayment(square, "SQ-ORDER-1", ORDER, other.fn);
  assert.equal(result.paid, false);
  const failed = fakeFetch({
    "GET /v2/orders/SQ-ORDER-1": () => [200, { order: { id: "SQ-ORDER-1", reference_id: ORDER, tenders: [{ id: "T1", payment_id: "PAY1" }] } }],
    "GET /v2/payments/PAY1": () => [200, { payment: { id: "PAY1", status: "FAILED", amount_money: { amount: 6000, currency: "AUD" } } }],
  });
  assert.equal((await verifySquarePayment(square, "SQ-ORDER-1", ORDER, failed.fn)).paid, false);
});

const paypal = { clientId: "id", clientSecret: "secret", sandbox: true };
const token = () => [200, { access_token: "tok" }] as [number, unknown];

test("PayPal: a checkout uses the sandbox, AUD amounts and our cart number", async () => {
  const { fn, calls } = fakeFetch({
    "POST /v1/oauth2/token": token,
    "POST /v2/checkout/orders": () => [200, { id: "PP-1", links: [{ rel: "payer-action", href: "https://paypal.test/approve/PP-1" }] }],
  });
  assert.deepEqual(await startPayPalCheckout(paypal, checkout, fn), { reference: "PP-1", payUrl: "https://paypal.test/approve/PP-1" });
  assert.ok(calls.every((c) => c.url.startsWith("https://api-m.sandbox.paypal.com/")));
  const unit = (calls[1].body as { purchase_units: { reference_id: string; amount: { value: string; currency_code: string }; items: { unit_amount: { value: string } }[] }[] }).purchase_units[0];
  assert.equal(unit.reference_id, ORDER);
  assert.deepEqual(unit.amount.currency_code, "AUD");
  assert.equal(unit.amount.value, "60.00");
  assert.deepEqual(unit.items.map((i) => i.unit_amount.value), ["25.00", "35.00"]);
});

const capturedOrder = { id: "PP-1", status: "COMPLETED", purchase_units: [{ reference_id: ORDER, payments: { captures: [{ id: "CAP1", status: "COMPLETED", amount: { currency_code: "AUD", value: "60.00" } }] } }] };

test("PayPal: capturing an approved payment reports what was paid", async () => {
  const { fn } = fakeFetch({ "POST /v1/oauth2/token": token, "POST /v2/checkout/orders/PP-1/capture": () => [201, capturedOrder] });
  assert.deepEqual(await capturePayPalPayment(paypal, "PP-1", ORDER, fn), { paid: true, reference: "PP-1", paymentId: "CAP1", amountCents: 6000, receiptUrl: "" });
});

test("PayPal: returning twice (already captured) still reports the payment", async () => {
  const { fn } = fakeFetch({
    "POST /v1/oauth2/token": token,
    "POST /v2/checkout/orders/PP-1/capture": () => [422, { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_ALREADY_CAPTURED" }] }],
    "GET /v2/checkout/orders/PP-1": () => [200, capturedOrder],
  });
  assert.equal((await capturePayPalPayment(paypal, "PP-1", ORDER, fn)).paid, true);
});

test("PayPal: an unfinished or someone else's payment is not treated as paid", async () => {
  const unfinished = fakeFetch({
    "POST /v1/oauth2/token": token,
    "POST /v2/checkout/orders/PP-1/capture": () => [422, { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_NOT_APPROVED" }] }],
    "GET /v2/checkout/orders/PP-1": () => [200, { id: "PP-1", status: "CREATED", purchase_units: [{ reference_id: ORDER }] }],
  });
  assert.equal((await capturePayPalPayment(paypal, "PP-1", ORDER, unfinished.fn)).paid, false);
  const other = fakeFetch({ "POST /v1/oauth2/token": token, "POST /v2/checkout/orders/PP-1/capture": () => [201, { ...capturedOrder, purchase_units: [{ ...capturedOrder.purchase_units[0], reference_id: "x" }] }] });
  assert.equal((await capturePayPalPayment(paypal, "PP-1", ORDER, other.fn)).paid, false);
});

// ---- Notifications (webhooks): the backup for people who close the page before coming back.
import { createHmac } from "node:crypto";
import { paypalOrderIdFrom, squareOrderIdFrom, verifyPayPalWebhook, verifySquareSignature } from "../src/lib/payments/webhooks.ts";

test("Square notifications: only accepted with Square's signature for our address", () => {
  const key = "test-signature-key";
  const url = "https://inspire-media-tau.vercel.app/api/webhooks/square";
  const body = JSON.stringify({ type: "payment.updated", data: { object: { payment: { order_id: "SQ-ORDER-1" } } } });
  const good = createHmac("sha256", key).update(url + body).digest("base64");
  assert.equal(verifySquareSignature(body, good, url, key), true);
  assert.equal(verifySquareSignature(body + " ", good, url, key), false, "changed body");
  assert.equal(verifySquareSignature(body, good, "https://evil.test/api/webhooks/square", key), false, "different address");
  assert.equal(verifySquareSignature(body, null, url, key), false, "no signature");
  assert.equal(squareOrderIdFrom(JSON.parse(body)), "SQ-ORDER-1");
  assert.equal(squareOrderIdFrom({ type: "something.else" }), null);
});

test("PayPal notifications: the order id is found for approvals and captures", () => {
  assert.equal(paypalOrderIdFrom({ event_type: "CHECKOUT.ORDER.APPROVED", resource: { id: "PP-1" } }), "PP-1");
  assert.equal(paypalOrderIdFrom({ event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "CAP1", supplementary_data: { related_ids: { order_id: "PP-1" } } } }), "PP-1");
  assert.equal(paypalOrderIdFrom({ event_type: "BILLING.SUBSCRIPTION.CREATED", resource: { id: "X" } }), null);
});

test("PayPal notifications: PayPal is asked to confirm the signature", async () => {
  const headers = new Headers({ "paypal-transmission-id": "T1", "paypal-transmission-sig": "SIG", "paypal-auth-algo": "SHA256withRSA", "paypal-cert-url": "https://api.sandbox.paypal.com/cert", "paypal-transmission-time": "2026-11-26T00:00:00Z" });
  const ok = fakeFetch({ "POST /v1/oauth2/token": token, "POST /v1/notifications/verify-webhook-signature": () => [200, { verification_status: "SUCCESS" }] });
  assert.equal(await verifyPayPalWebhook(paypal, "WH-1", headers, { id: "E1" }, ok.fn), true);
  const sent = ok.calls[1].body as { webhook_id: string; transmission_sig: string };
  assert.equal(sent.webhook_id, "WH-1");
  assert.equal(sent.transmission_sig, "SIG");
  const bad = fakeFetch({ "POST /v1/oauth2/token": token, "POST /v1/notifications/verify-webhook-signature": () => [200, { verification_status: "FAILURE" }] });
  assert.equal(await verifyPayPalWebhook(paypal, "WH-1", headers, { id: "E1" }, bad.fn), false);
});

test("Square: a refund goes back to the order's payment, in AUD, with our key", async () => {
  const { fn, calls } = fakeFetch({
    "GET /v2/orders/SQ-ORDER": () => [200, { order: { id: "SQ-ORDER", reference_id: ORDER, tenders: [{ id: "T1", payment_id: "PAY1" }] } }],
    "POST /v2/refunds": () => [200, { refund: { id: "RF1", status: "PENDING" } }],
  });
  assert.deepEqual(await refundSquarePayment(square, "SQ-ORDER", 2500, "key-1", "Injured", fn), { ok: true, refundId: "RF1", pending: true });
  const post = calls.find((c) => c.method === "POST")!;
  assert.ok(post.url.startsWith("https://connect.squareupsandbox.com/"));
  assert.deepEqual(post.body, { idempotency_key: "key-1", payment_id: "PAY1", amount_money: { amount: 2500, currency: "AUD" }, reason: "Injured" });
});

test("Square: a rejected refund is reported as failed", async () => {
  const { fn } = fakeFetch({
    "GET /v2/orders/SQ-ORDER": () => [200, { order: { id: "SQ-ORDER", tenders: [{ id: "T1", payment_id: "PAY1" }] } }],
    "POST /v2/refunds": () => [200, { refund: { id: "RF1", status: "REJECTED" } }],
  });
  assert.equal((await refundSquarePayment(square, "SQ-ORDER", 2500, "key-1", "", fn)).ok, false);
});

test("PayPal: a refund goes back against the order's capture, in AUD, with our key", async () => {
  const { fn, calls } = fakeFetch({
    "POST /v1/oauth2/token": token,
    "GET /v2/checkout/orders/PP-1": () => [200, capturedOrder],
    "POST /v2/payments/captures/CAP1/refund": () => [201, { id: "PPR1", status: "COMPLETED" }],
  });
  assert.deepEqual(await refundPayPalPayment(paypal, "PP-1", 2500, "key-2", "Scratched", fn), { ok: true, refundId: "PPR1", pending: false });
  const post = calls.find((c) => c.url.endsWith("/refund"))!;
  assert.deepEqual(post.body, { amount: { currency_code: "AUD", value: "25.00" }, note_to_payer: "Scratched" });
  assert.equal(post.headers["PayPal-Request-Id"], "refund-key-2");
});

test("PayPal: a refund PayPal refuses is reported with PayPal's reason", async () => {
  const { fn } = fakeFetch({
    "POST /v1/oauth2/token": token,
    "GET /v2/checkout/orders/PP-1": () => [200, capturedOrder],
    "POST /v2/payments/captures/CAP1/refund": () => [422, { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "REFUND_AMOUNT_EXCEEDED", description: "The refund amount must be less than or equal to the capture amount" }] }],
  });
  const r = await refundPayPalPayment(paypal, "PP-1", 99999, "key-3", "", fn);
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.error : "", /less than or equal/);
});
