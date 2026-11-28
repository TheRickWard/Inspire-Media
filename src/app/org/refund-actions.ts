"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { done, fail, type FormState } from "@/lib/form";
import { formatMoney } from "@/lib/format";
import { sendRefund } from "@/lib/payments/refund";
import { toCents } from "@/lib/payments/types";

const providerName: Record<string, string> = { square: "Square", paypal: "PayPal" };

/** Find a paid receipt the signed-in person may refund. */
async function refundableOrder(orderId: string) {
  await requireUser();
  const supabase = await createSupabase();
  // The security rules only show organisers the receipts for their own events.
  const { data: order } = await supabase.from("orders").select("id, event_id, status, payment_provider").eq("id", orderId).maybeSingle();
  if (!order || order.status !== "paid") return null;
  const { data: allowed } = await supabase.rpc("can_refund_event", { ev: order.event_id });
  return allowed ? order : null;
}

/** Organisation owner or admin: refund some or all of a paid receipt. */
export async function refundOrder(orderId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const order = await refundableOrder(orderId);
  if (!order) return fail("Only the organisation's owners can give refunds.");

  const amountText = String(formData.get("amount") ?? "").trim().replace(/^\$/, "");
  if (!/^\d+(\.\d{1,2})?$/.test(amountText)) return fail("Enter the amount to refund, like 25.00");
  const amount = toCents(amountText);
  if (amount <= 0) return fail("Enter an amount more than $0.00");
  const itemIds = formData.getAll("item").map(String);
  const method = formData.get("method") === "manual" ? "manual" : (order.payment_provider ?? "manual");
  const reason = String(formData.get("reason") ?? "").trim();
  const scratch = formData.get("scratch") === "on" && itemIds.length > 0;

  const { data: refundId, error } = await createAdminSupabase().rpc("start_refund", {
    p_order: order.id,
    p_item_ids: itemIds,
    p_amount_cents: amount,
    p_method: method,
    p_reason: reason,
    p_scratch: scratch,
    p_user: user.id,
  });
  if (error || !refundId) return fail(error?.message.replace(/ \(\d+ cents\)/, "") ?? "We couldn't start the refund.");

  const scratched = scratch ? ` ${itemIds.length === 1 ? "The entry has" : "The entries have"} been scratched from the program.` : "";
  if (method === "manual") {
    refresh();
    return done(`Recorded a refund of ${formatMoney(amount)}.${scratched}`);
  }
  const sent = await sendRefund(refundId);
  refresh();
  if (sent.status === "failed") return fail(`${providerName[method]} didn't refund it: ${sent.message}`);
  if (sent.status === "pending") return fail(sent.message);
  return done(`Refunded ${formatMoney(amount)} through ${providerName[method]}${sent.message ? `; ${sent.message}` : ""}.${scratched}`);
}

/** Try sending a refund again after Square/PayPal couldn't be reached (never refunds twice). */
export async function retryRefund(orderId: string, refundId: string): Promise<FormState> {
  const order = await refundableOrder(orderId);
  if (!order) return fail("Only the organisation's owners can give refunds.");
  const { data: refund } = await createAdminSupabase().from("refunds").select("id").eq("id", refundId).eq("order_id", order.id).maybeSingle();
  if (!refund) return fail("We couldn't find that refund.");
  const sent = await sendRefund(refund.id);
  refresh();
  if (sent.status === "refunded") return done("Refund sent.");
  return fail(sent.message);
}
