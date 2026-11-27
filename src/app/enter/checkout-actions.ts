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

/** Send the competitor to Square's or PayPal's payment page for everything in their cart (all competitions). */
export async function startCheckout(provider: Provider): Promise<FormState> {
  const user = await requireUser();
  const ready = paymentsReady();
  if (!ready[provider]) return fail("This payment option isn't switched on yet.");

  const supabase = await createSupabase();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, event_id, total_cents, created_at, events(name), order_items(id, fee_cents, studio_name, created_at, sections(code, name))")
    .eq("user_id", user.id)
    .eq("status", "open")
    .order("created_at");
  const carts = (orders ?? []).filter((o) => o.order_items.length > 0);
  if (carts.length === 0) return fail("Your cart is empty.");

  const closed: string[] = [];
  for (const o of carts) {
    const { data: open } = await supabase.rpc("entries_are_open", { ev: o.event_id });
    if (!open) closed.push(o.events?.name ?? "a competition");
  }
  if (closed.length) return fail(`Entries have closed for ${closed.join(", ")}. Please remove those items, then pay for the rest.`);

  const lead = carts[0].id;
  const totalCents = carts.reduce((sum, o) => sum + o.total_cents, 0);
  const origin = await siteOrigin();
  const several = carts.length > 1;
  const checkout = {
    orderId: lead,
    description: several ? `Entries: ${carts.length} competitions` : `Entries: ${carts[0].events?.name ?? "competition"}`,
    lines: carts.flatMap((o) =>
      [...o.order_items]
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((i) => ({
          name: `${several ? `${o.events?.name ?? "Competition"}: ` : ""}Section ${i.sections?.code ?? ""} – ${i.sections?.name ?? "entry"}${i.studio_name ? " (studio entry)" : ""}`,
          amountCents: i.fee_cents,
        })),
    ),
    totalCents,
    returnUrl: `${origin}/checkout/return?order=${lead}`,
    cancelUrl: `${origin}/cart?payment=cancelled`,
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

  const { error } = await createAdminSupabase().rpc("record_checkout_group", {
    p_orders: carts.map((o) => o.id),
    p_provider: provider,
    p_reference: started.reference,
    p_amount_cents: totalCents,
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
