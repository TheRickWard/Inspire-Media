"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
import { done, fail, type FormState } from "@/lib/form";
import { confirmCheckout } from "@/lib/payments/confirm";

/** Organiser: ask Square/PayPal whether a cart that started paying has actually been paid. */
export async function checkCartPayment(eventId: string, orderId: string): Promise<FormState> {
  await requireUser();
  const supabase = await createSupabase();
  // The security rules only show organisers the carts for their own events.
  const { data: order } = await supabase.from("orders").select("id").eq("id", orderId).eq("event_id", eventId).maybeSingle();
  if (!order) return fail("You don't have access to this cart.");
  const result = await confirmCheckout(order.id);
  if (!result.paid) return fail(result.reason);
  refresh();
  return done(`Paid. Receipt ${result.receipt}; the entries are now in the program.`);
}
