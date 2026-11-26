// Square: hosted checkout ("payment links"). Card details are entered on
// Square's own page, never on ours. Square emails the payer its own receipt.
// API docs: https://developer.squareup.com/reference/square
import type { FetchFn, StartCheckout, StartedCheckout, VerifiedPayment } from "./types";

export type SquareSettings = { accessToken: string; sandbox: boolean; locationId?: string };

const SQUARE_VERSION = "2025-01-23";

function baseUrl(s: SquareSettings) {
  return s.sandbox ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
}

async function call<T>(s: SquareSettings, path: string, init: RequestInit, fetchFn: FetchFn): Promise<T> {
  const res = await fetchFn(`${baseUrl(s)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${s.accessToken}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as T & { errors?: { detail?: string; code?: string }[] };
  if (!res.ok) {
    const detail = body.errors?.map((e) => e.detail ?? e.code).join("; ") || `HTTP ${res.status}`;
    throw new Error(`Square: ${detail}`);
  }
  return body;
}

type Location = { id: string; status: string; currency?: string };

async function pickLocation(s: SquareSettings, fetchFn: FetchFn): Promise<Location> {
  const { locations = [] } = await call<{ locations?: Location[] }>(s, "/v2/locations", { method: "GET" }, fetchFn);
  const location = s.locationId ? locations.find((l) => l.id === s.locationId) : locations.find((l) => l.status === "ACTIVE");
  if (!location) throw new Error("Square: no active location found on the Square account");
  if (location.currency && location.currency !== "AUD") {
    throw new Error(`Square: the account's location uses ${location.currency}, not Australian dollars`);
  }
  return location;
}

export async function startSquareCheckout(s: SquareSettings, c: StartCheckout, fetchFn: FetchFn = fetch): Promise<StartedCheckout> {
  const location = await pickLocation(s, fetchFn);
  const { payment_link } = await call<{ payment_link: { url: string; order_id: string } }>(
    s,
    "/v2/online-checkout/payment-links",
    {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        description: c.description,
        order: {
          location_id: location.id,
          reference_id: c.orderId,
          line_items: c.lines.map((l) => ({
            name: l.name,
            quantity: "1",
            base_price_money: { amount: l.amountCents, currency: "AUD" },
          })),
        },
        checkout_options: { redirect_url: c.returnUrl, ask_for_shipping_address: false },
      }),
    },
    fetchFn,
  );
  return { reference: payment_link.order_id, payUrl: payment_link.url };
}

type SquareOrder = { id: string; reference_id?: string; tenders?: { payment_id?: string; id: string }[] };
type SquarePayment = { id: string; status: string; order_id?: string; amount_money: { amount: number; currency: string }; receipt_url?: string };

/** Ask Square whether the order for this cart has been paid, and how much. */
export async function verifySquarePayment(
  s: SquareSettings,
  squareOrderId: string,
  ourOrderId: string,
  fetchFn: FetchFn = fetch,
): Promise<VerifiedPayment> {
  const { order } = await call<{ order: SquareOrder }>(s, `/v2/orders/${encodeURIComponent(squareOrderId)}`, { method: "GET" }, fetchFn);
  if (order.reference_id !== ourOrderId) return { paid: false, reason: "This Square payment belongs to a different cart." };
  const paymentIds = (order.tenders ?? []).map((t) => t.payment_id ?? t.id);
  if (paymentIds.length === 0) return { paid: false, reason: "Square hasn't received the payment yet." };

  let total = 0;
  let first: SquarePayment | null = null;
  for (const id of paymentIds) {
    const { payment } = await call<{ payment: SquarePayment }>(s, `/v2/payments/${encodeURIComponent(id)}`, { method: "GET" }, fetchFn);
    if (payment.status !== "COMPLETED" || payment.amount_money.currency !== "AUD") continue;
    total += payment.amount_money.amount;
    first ??= payment;
  }
  if (!first) return { paid: false, reason: "Square hasn't completed the payment yet." };
  return { paid: true, reference: squareOrderId, paymentId: first.id, amountCents: total, receiptUrl: first.receipt_url ?? "" };
}
