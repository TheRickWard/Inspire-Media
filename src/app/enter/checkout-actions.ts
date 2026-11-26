"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { fail, type FormState } from "@/lib/form";
import { paymentsReady, paypalSettings, squareSettings } from "@/lib/payments/config";
import { confirmCheckout } from "@/lib/payments/confirm";
import { startPayPalCheckout } from "@/lib/payments/paypal";
import { startSquareCheckout } from "@/lib/payments/square";
import type { Provider, StartedCheckout } from "@/lib/payments/types";

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") || host?.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Send the competitor to Square's or PayPal's payment page for their cart. */
export async function startCheckout(orderId: string, provider: Provider): Promise<FormState> {
  const user = await requireUser();
  const ready = paymentsReady();
  if (!ready[provider]) return fail("This payment option isn't switched on yet.");

  const supabase = await createSupabase();
  const { data: order } = await supabase
    .from("orders")
    .select("id, user_id, event_id, status, total_cents, events(name), order_items(id, fee_cents, studio_name, created_at, sections(code, name))")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!order || order.status !== "open") return fail("This cart can't be paid. Please refresh the page.");
  if (order.order_items.length === 0 || order.total_cents <= 0) return fail("Your cart is empty.");

  const { data: open } = await supabase.rpc("entries_are_open", { ev: order.event_id });
  if (!open) return fail("Entries for this competition have closed.");

  const items = [...order.order_items].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const origin = await siteOrigin();
  const checkout = {
    orderId: order.id,
    description: `Entries: ${order.events?.name ?? "competition"}`,
    lines: items.map((i) => ({
      name: `Section ${i.sections?.code ?? ""} – ${i.sections?.name ?? "entry"}${i.studio_name ? " (studio entry)" : ""}`,
      amountCents: i.fee_cents,
    })),
    totalCents: order.total_cents,
    returnUrl: `${origin}/checkout/return?order=${order.id}`,
    cancelUrl: `${origin}/enter/${order.event_id}?payment=cancelled`,
  };

  let started: StartedCheckout;
  try {
    started = provider === "square" ? await startSquareCheckout(squareSettings()!, checkout) : await startPayPalCheckout(paypalSettings()!, checkout);
  } catch (e) {
    console.error("Starting checkout failed", e);
    const message = e instanceof Error ? e.message : "";
    return fail(
      /^(Square|PayPal):/.test(message)
        ? `We couldn't start the payment. ${message}`
        : `We couldn't reach ${provider === "square" ? "Square" : "PayPal"}. Please try again in a minute.`,
    );
  }

  const { error } = await createAdminSupabase().rpc("record_checkout", {
    p_order: order.id,
    p_provider: provider,
    p_reference: started.reference,
    p_amount_cents: order.total_cents,
  });
  if (error) return fail(error.message);

  redirect(started.payUrl);
}

/** "I've paid" / page load after returning: ask Square or PayPal again. */
export async function checkPayment(orderId: string): Promise<FormState> {
  const user = await requireUser();
  const supabase = await createSupabase();
  const { data: order } = await supabase.from("orders").select("id").eq("id", orderId).eq("user_id", user.id).maybeSingle();
  if (!order) return fail("We couldn't find that cart.");
  const result = await confirmCheckout(order.id);
  if (!result.paid) return fail(result.reason);
  refresh();
  redirect(`/receipts/${order.id}`);
}
