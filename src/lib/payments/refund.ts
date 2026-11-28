import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { paypalSettings, squareSettings } from "./config";
import { refundPayPalPayment } from "./paypal";
import { refundSquarePayment } from "./square";

export type SendResult = { status: "refunded" | "failed" | "pending"; message: string };

/**
 * Ask Square/PayPal to send a pending refund, then record the answer.
 * The refund's own id is the idempotency key, so trying again can never
 * refund twice. If we can't reach Square/PayPal at all, the refund stays
 * pending so it can be tried again.
 */
export async function sendRefund(refundId: string): Promise<SendResult> {
  const admin = createAdminSupabase();
  const { data: refund } = await admin
    .from("refunds")
    .select("id, status, method, amount_cents, reason, orders(payment_reference)")
    .eq("id", refundId)
    .maybeSingle();
  if (!refund) return { status: "failed", message: "We couldn't find that refund." };
  if (refund.status !== "pending") return { status: refund.status as SendResult["status"], message: "" };
  const reference = refund.orders?.payment_reference;

  let result: { ok: true; refundId: string; pending: boolean } | { ok: false; error: string };
  try {
    if (!reference) result = { ok: false, error: "This receipt has no payment reference." };
    else if (refund.method === "square") {
      const s = squareSettings();
      result = s ? await refundSquarePayment(s, reference, refund.amount_cents, refund.id, refund.reason) : { ok: false, error: "Square isn't set up." };
    } else if (refund.method === "paypal") {
      const s = paypalSettings();
      result = s ? await refundPayPalPayment(s, reference, refund.amount_cents, refund.id, refund.reason) : { ok: false, error: "PayPal isn't set up." };
    } else {
      result = { ok: false, error: "Unknown refund method." };
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // "Square: ..." / "PayPal: ..." means they answered and said no. Anything else
    // (no answer) might or might not have gone through, so leave it to try again.
    if (/^(Square|PayPal):/.test(message)) result = { ok: false, error: message };
    else {
      console.error("Refund not sent", refundId, message);
      return { status: "pending", message: "We couldn't reach the payment service. Nothing has been refunded twice; press \"Try again\" in a minute." };
    }
  }

  const { error } = await admin.rpc("finish_refund", {
    p_refund: refundId,
    p_ok: result.ok,
    p_provider_refund_id: result.ok ? result.refundId : "",
    p_error: result.ok ? "" : result.error,
  });
  if (error) console.error("Recording refund failed", refundId, error.message);
  return result.ok
    ? { status: "refunded", message: result.pending ? "it can take a few days to reach the payer's card or account" : "" }
    : { status: "failed", message: result.error };
}
