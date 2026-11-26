import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { paypalSettings, squareSettings } from "./config";
import { capturePayPalPayment } from "./paypal";
import { verifySquarePayment } from "./square";
import type { VerifiedPayment } from "./types";

export type ConfirmResult = { paid: true; receipt: string } | { paid: false; reason: string };

/**
 * Check with Square or PayPal whether a cart's checkout has been paid, and if
 * so mark the cart paid (which also puts the entries into the program).
 * Safe to call any number of times: it only ever trusts Square or PayPal.
 */
export async function confirmCheckout(orderId: string): Promise<ConfirmResult> {
  const admin = createAdminSupabase();
  const { data: order } = await admin
    .from("orders")
    .select("id, status, receipt_number, checkout_provider, checkout_reference")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { paid: false, reason: "We couldn't find that cart." };
  if (order.status === "paid" && order.receipt_number) return { paid: true, receipt: order.receipt_number };
  if (order.status !== "open" || !order.checkout_provider || !order.checkout_reference) {
    return { paid: false, reason: "No payment has been started for this cart." };
  }

  let result: VerifiedPayment;
  try {
    if (order.checkout_provider === "square") {
      const s = squareSettings();
      if (!s) return { paid: false, reason: "Square isn't set up." };
      result = await verifySquarePayment(s, order.checkout_reference, order.id);
    } else {
      const s = paypalSettings();
      if (!s) return { paid: false, reason: "PayPal isn't set up." };
      result = await capturePayPalPayment(s, order.checkout_reference, order.id);
    }
  } catch (e) {
    console.error("Payment check failed", e);
    return { paid: false, reason: "We couldn't reach the payment service. Please try again in a minute." };
  }
  if (!result.paid) return result;

  const { data: receipt, error } = await admin.rpc("complete_order", {
    p_order: order.id,
    p_provider: order.checkout_provider,
    p_reference: result.reference,
    p_paid_cents: result.amountCents,
    p_receipt_url: result.receiptUrl,
  });
  if (error) {
    console.error("complete_order failed", order.id, error.message);
    return { paid: false, reason: `Your payment was received, but we couldn't finish your entries (${error.message}). Please contact the organiser with this cart number: ${order.id.slice(0, 8)}.` };
  }
  return { paid: true, receipt: receipt as string };
}
