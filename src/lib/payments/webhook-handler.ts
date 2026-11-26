import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { confirmCheckout } from "./confirm";
import type { Provider } from "./types";

/** Find the cart a Square/PayPal payment belongs to and confirm it (if it's still waiting). */
export async function confirmByProviderReference(provider: Provider, reference: string) {
  const { data: order } = await createAdminSupabase()
    .from("orders")
    .select("id, status")
    .eq("checkout_provider", provider)
    .eq("checkout_reference", reference)
    .maybeSingle();
  if (!order) {
    // Not one of ours (or the cart changed after this payment was started).
    return { handled: false, reason: "no cart for this payment" };
  }
  const result = await confirmCheckout(order.id);
  if (!result.paid) console.warn(`${provider} notification for cart ${order.id}: ${result.reason}`);
  return { handled: result.paid, reason: result.paid ? `paid, receipt ${result.receipt}` : result.reason };
}
