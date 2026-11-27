// Square and PayPal tell us about payments automatically ("webhooks"). This is
// the backup for when a competitor pays but closes the page before coming back.
// We check each notification really came from Square/PayPal, then ask them
// directly what was paid (confirmCheckout); nothing in the notification is trusted.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PayPalSettings } from "./paypal";
import type { FetchFn } from "./types";

/** Square signs: base64(HMAC-SHA256(signature key, notification URL + raw body)). */
export function verifySquareSignature(rawBody: string, signature: string | null, notificationUrl: string, signatureKey: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", signatureKey).update(notificationUrl + rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The Square order id a payment notification is about, if any. */
export function squareOrderIdFrom(event: unknown): string | null {
  const e = event as { data?: { object?: { payment?: { order_id?: string } } } };
  return e?.data?.object?.payment?.order_id ?? null;
}

/** The PayPal order id a notification is about (order approved, or payment captured). */
export function paypalOrderIdFrom(event: unknown): string | null {
  const e = event as {
    event_type?: string;
    resource?: { id?: string; supplementary_data?: { related_ids?: { order_id?: string } } };
  };
  if (e?.event_type?.startsWith("CHECKOUT.ORDER.")) return e.resource?.id ?? null;
  return e?.resource?.supplementary_data?.related_ids?.order_id ?? null;
}

/** Ask PayPal whether a notification really came from PayPal. */
export async function verifyPayPalWebhook(
  s: PayPalSettings,
  webhookId: string,
  headers: Headers,
  event: unknown,
  fetchFn: FetchFn = fetch,
): Promise<boolean> {
  const base = s.sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
  const tokenRes = await fetchFn(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${s.clientId}:${s.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const token = ((await tokenRes.json().catch(() => ({}))) as { access_token?: string }).access_token;
  if (!token) return false;

  const res = await fetchFn(`${base}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: event,
    }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { verification_status?: string };
  return res.ok && body.verification_status === "SUCCESS";
}
