// PayPal: Orders v2 with PayPal's own approval page. The payer logs in to
// PayPal (or pays by card there), then comes back and we "capture" the money.
// API docs: https://developer.paypal.com/docs/api/orders/v2/
import { toCents, toDollars, type FetchFn, type StartCheckout, type StartedCheckout, type VerifiedPayment } from "./types.ts";

export type PayPalSettings = { clientId: string; clientSecret: string; sandbox: boolean };

function baseUrl(s: PayPalSettings) {
  return s.sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
}

async function accessToken(s: PayPalSettings, fetchFn: FetchFn): Promise<string> {
  const res = await fetchFn(`${baseUrl(s)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${s.clientId}:${s.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (!res.ok || !body.access_token) throw new Error(`PayPal: couldn't sign in (${body.error_description ?? `HTTP ${res.status}`})`);
  return body.access_token;
}

type PayPalError = { name?: string; message?: string; details?: { issue?: string; description?: string }[] };

async function call<T>(s: PayPalSettings, path: string, init: RequestInit & { requestId?: string }, fetchFn: FetchFn): Promise<{ ok: boolean; body: T & PayPalError }> {
  const token = await accessToken(s, fetchFn);
  const res = await fetchFn(`${baseUrl(s)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.requestId ? { "PayPal-Request-Id": init.requestId } : {}),
    },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as T & PayPalError;
  return { ok: res.ok, body };
}

function describe(e: PayPalError) {
  return e.details?.map((d) => d.description ?? d.issue).join("; ") || e.message || e.name || "unknown error";
}

export async function startPayPalCheckout(s: PayPalSettings, c: StartCheckout, fetchFn: FetchFn = fetch): Promise<StartedCheckout> {
  const { ok, body } = await call<{ id: string; links?: { rel: string; href: string }[] }>(
    s,
    "/v2/checkout/orders",
    {
      method: "POST",
      requestId: crypto.randomUUID(),
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: c.orderId,
            custom_id: c.orderId,
            description: c.description.slice(0, 127),
            amount: {
              currency_code: "AUD",
              value: toDollars(c.totalCents),
              breakdown: { item_total: { currency_code: "AUD", value: toDollars(c.totalCents) } },
            },
            items: c.lines.map((l) => ({
              name: l.name.slice(0, 127),
              quantity: "1",
              category: "DIGITAL_GOODS",
              unit_amount: { currency_code: "AUD", value: toDollars(l.amountCents) },
            })),
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "Inspire Media",
              shipping_preference: "NO_SHIPPING",
              user_action: "PAY_NOW",
              return_url: c.returnUrl,
              cancel_url: c.cancelUrl,
            },
          },
        },
      }),
    },
    fetchFn,
  );
  if (!ok) throw new Error(`PayPal: ${describe(body)}`);
  const payUrl = body.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
  if (!payUrl) throw new Error("PayPal: no payment page link was returned");
  return { reference: body.id, payUrl };
}

type Capture = { id: string; status: string; amount: { currency_code: string; value: string } };
type PayPalOrder = {
  id: string;
  status: string;
  purchase_units?: { reference_id?: string; custom_id?: string; payments?: { captures?: Capture[] } }[];
};

function readOrder(order: PayPalOrder, ourOrderId: string): VerifiedPayment {
  const unit = order.purchase_units?.[0];
  if (!unit || (unit.reference_id !== ourOrderId && unit.custom_id !== ourOrderId)) {
    return { paid: false, reason: "This PayPal payment belongs to a different cart." };
  }
  const captures = (unit.payments?.captures ?? []).filter((c) => c.status === "COMPLETED" && c.amount.currency_code === "AUD");
  if (captures.length === 0) return { paid: false, reason: "PayPal hasn't completed the payment yet." };
  const amountCents = captures.reduce((sum, c) => sum + toCents(c.amount.value), 0);
  return { paid: true, reference: order.id, paymentId: captures[0].id, amountCents, receiptUrl: "" };
}

/** Take the money for an approved PayPal order (safe to repeat), then report what was paid. */
export async function capturePayPalPayment(
  s: PayPalSettings,
  paypalOrderId: string,
  ourOrderId: string,
  fetchFn: FetchFn = fetch,
): Promise<VerifiedPayment> {
  const id = encodeURIComponent(paypalOrderId);
  const capture = await call<PayPalOrder>(s, `/v2/checkout/orders/${id}/capture`, { method: "POST", requestId: `capture-${paypalOrderId}`, body: "{}" }, fetchFn);
  if (capture.ok) return readOrder(capture.body, ourOrderId);

  // Already captured (for example, the page was refreshed), or not approved yet:
  // look the order up to see where it stands.
  const lookup = await call<PayPalOrder>(s, `/v2/checkout/orders/${id}`, { method: "GET" }, fetchFn);
  if (!lookup.ok) return { paid: false, reason: `PayPal: ${describe(lookup.body)}` };
  const result = readOrder(lookup.body, ourOrderId);
  if (!result.paid && lookup.body.status !== "COMPLETED") {
    return { paid: false, reason: lookup.body.status === "APPROVED" ? `PayPal couldn't take the payment: ${describe(capture.body)}` : "The PayPal payment wasn't finished." };
  }
  return result;
}

export type RefundResult = { ok: true; refundId: string; pending: boolean } | { ok: false; error: string };

/**
 * Send money back for a PayPal order (to the payer's PayPal account or card).
 * Safe to repeat with the same key (PayPal won't refund twice).
 */
export async function refundPayPalPayment(
  s: PayPalSettings,
  paypalOrderId: string,
  amountCents: number,
  key: string,
  reason: string,
  fetchFn: FetchFn = fetch,
): Promise<RefundResult> {
  const lookup = await call<PayPalOrder>(s, `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, { method: "GET" }, fetchFn);
  if (!lookup.ok) return { ok: false, error: `PayPal: ${describe(lookup.body)}` };
  const capture = (lookup.body.purchase_units?.[0]?.payments?.captures ?? []).find((c) => c.status === "COMPLETED" || c.status === "PARTIALLY_REFUNDED");
  if (!capture) return { ok: false, error: "PayPal has no completed payment for this receipt." };
  const res = await call<{ id: string; status: string }>(
    s,
    `/v2/payments/captures/${encodeURIComponent(capture.id)}/refund`,
    {
      method: "POST",
      requestId: `refund-${key}`,
      body: JSON.stringify({ amount: { currency_code: "AUD", value: toDollars(amountCents) }, note_to_payer: reason.slice(0, 255) || undefined }),
    },
    fetchFn,
  );
  if (!res.ok) return { ok: false, error: `PayPal: ${describe(res.body)}` };
  if (res.body.status === "CANCELLED" || res.body.status === "FAILED") return { ok: false, error: `PayPal ${res.body.status.toLowerCase()} the refund.` };
  return { ok: true, refundId: res.body.id, pending: res.body.status !== "COMPLETED" };
}
