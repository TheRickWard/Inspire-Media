import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
import { ActionForm } from "@/components/ActionForm";
import { formatDateRange, formatMoney } from "@/lib/format";
import { paymentsReady } from "@/lib/payments/config";
import { button, buttonSmall, card, h1, h2, link, muted } from "@/components/ui";
import { removeFromCart } from "@/app/enter/actions";
import { checkPayment, startCheckout } from "@/app/enter/checkout-actions";

async function Cart({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const { payment } = await searchParams;
  const user = await requireUser("/cart");
  const supabase = await createSupabase();

  const [{ data: orders }, { data: dancers }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, event_id, total_cents, checkout_provider, created_at, events(id, name, starts_on, ends_on), order_items(id, dancer_ids, studio_name, fee_cents, created_at, sections(code, name))")
      .eq("user_id", user.id)
      .eq("status", "open")
      .order("created_at"),
    supabase.from("dancers").select("id, full_name").eq("owner_id", user.id),
  ]);

  const carts = (orders ?? []).filter((o) => o.order_items.length > 0);
  const dancerById = new Map((dancers ?? []).map((d) => [d.id, d.full_name]));
  const total = carts.reduce((sum, o) => sum + o.total_cents, 0);
  const itemCount = carts.reduce((sum, o) => sum + o.order_items.length, 0);
  const openFlags = await Promise.all(carts.map(async (o) => (await supabase.rpc("entries_are_open", { ev: o.event_id })).data === true));
  const closed = carts.filter((_, i) => !openFlags[i]);
  const started = carts.find((o) => o.checkout_provider);
  const pay = paymentsReady();

  return (
    <div className="space-y-6">
      <div>
        <p className={muted}><Link href="/dashboard" className={link}>Dashboard</Link> /</p>
        <h1 className={h1}>Your cart</h1>
        <p className="text-sm text-slate-600">Entries for all your competitions, paid together. Each competition gets its own receipt.</p>
      </div>

      {payment === "cancelled" && (
        <div className={`${card} border-amber-200 bg-amber-50`}>
          <p className="text-sm text-amber-900">Payment cancelled. Nothing was charged, and your cart is still here.</p>
        </div>
      )}
      {payment === "pending" && started && (
        <div className={`${card} border-amber-200 bg-amber-50`}>
          <p className="text-sm text-amber-900">We haven&apos;t been able to confirm your payment yet. If you finished paying, check again in a minute.</p>
        </div>
      )}

      {carts.length === 0 ? (
        <div className={card}>
          <p className={muted}>Your cart is empty. <Link href="/enter" className={link}>Enter a competition</Link></p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {carts.map((o, idx) => (
              <section key={o.id} className={card}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className={h2}>{o.events?.name ?? "Competition"}</h2>
                  <Link href={`/enter/${o.event_id}`} className={`${link} text-sm`}>Add more entries</Link>
                </div>
                {o.events && <p className={muted}>{formatDateRange(o.events.starts_on, o.events.ends_on)}</p>}
                {!openFlags[idx] && <p className="mt-1 text-sm font-medium text-red-700">Entries have closed for this competition. Please remove these items to pay for the rest.</p>}
                <ul className="mt-2 divide-y divide-slate-100 text-sm">
                  {[...o.order_items].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div>
                        <p className="font-medium">{i.sections ? `${i.sections.code} – ${i.sections.name}` : "Section"}</p>
                        <p className="text-slate-600">{i.studio_name ? `Studio entry: ${i.studio_name}` : i.dancer_ids.map((id) => dancerById.get(id) ?? "Dancer").join(" & ")}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span>{formatMoney(i.fee_cents)}</span>
                        <ActionForm action={removeFromCart.bind(null, i.id)} submitLabel="Remove" pendingLabel="…" className="" buttonClassName={buttonSmall} />
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-right text-sm font-semibold">Subtotal {formatMoney(o.total_cents)}</p>
              </section>
            ))}
          </div>

          <aside className={`${card} h-fit space-y-3`}>
            <h2 className={h2}>Pay</h2>
            <div className="flex justify-between text-sm"><span>{itemCount} {itemCount === 1 ? "entry" : "entries"}, {carts.length} {carts.length === 1 ? "competition" : "competitions"}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-3 font-semibold">
              <span>Total</span>
              <span>{formatMoney(total)}</span>
            </div>
            {closed.length > 0 ? (
              <p className="text-sm text-red-700">Remove the items for closed competitions first.</p>
            ) : pay.square || pay.paypal ? (
              <div className="space-y-2">
                {pay.square && <ActionForm action={startCheckout.bind(null, "square")} submitLabel="Pay by card with Square" pendingLabel="Opening Square…" className="" buttonClassName={`${button} w-full`} />}
                {pay.paypal && <ActionForm action={startCheckout.bind(null, "paypal")} submitLabel="Pay with PayPal" pendingLabel="Opening PayPal…" className="" buttonClassName={`${button} w-full`} />}
                {pay.testMode && <p className="text-xs font-medium text-amber-700">Test mode: no real money is taken.</p>}
              </div>
            ) : (
              <p className={muted}>Online payment: coming soon. Your cart is saved.</p>
            )}
            {started && (
              <ActionForm action={checkPayment.bind(null, started.id)} submitLabel="Already paid? Check my payment" pendingLabel="Checking…" className="" buttonClassName={buttonSmall} />
            )}
            <p className={muted}>Your entries go into each program once paid. You&apos;ll get a receipt for each competition here, and an email receipt from the payment service.</p>
          </aside>
        </div>
      )}
    </div>
  );
}

export default function CartPage({ searchParams }: PageProps<"/cart">) {
  return (
    <Suspense fallback={<p className={muted}>Loading…</p>}>
      <Cart searchParams={searchParams as Promise<{ payment?: string }>} />
    </Suspense>
  );
}
