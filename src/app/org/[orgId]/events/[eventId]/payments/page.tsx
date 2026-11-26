import Link from "next/link";
import { Suspense } from "react";
import { loadManagedEvent } from "@/lib/access";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { EventNav } from "@/components/EventNav";
import { formatDateTime, formatMoney } from "@/lib/format";
import { card, h2, link, muted } from "@/components/ui";

const providerName: Record<string, string> = { square: "Square", paypal: "PayPal" };

/** Names and emails of the account holders, who are the contacts for their entries. */
async function contactsFor(userIds: string[]) {
  const contacts = new Map<string, { name: string; email: string }>();
  if (userIds.length === 0 || !process.env.SUPABASE_SECRET_KEY?.trim()) return contacts;
  const { data } = await createAdminSupabase().from("profiles").select("id, full_name, email").in("id", userIds);
  for (const p of data ?? []) contacts.set(p.id, { name: p.full_name, email: p.email });
  return contacts;
}

function Contact({ c }: { c?: { name: string; email: string } }) {
  if (!c) return <span className="text-slate-400">Unknown</span>;
  return (
    <>
      <span className="block font-medium">{c.name || c.email}</span>
      {c.name && <a href={`mailto:${c.email}`} className={`${link} text-xs`}>{c.email}</a>}
    </>
  );
}

async function Payments({ params }: { params: Promise<{ orgId: string; eventId: string }> }) {
  const { orgId, eventId } = await params;
  const { supabase, org, event } = await loadManagedEvent(orgId, eventId);

  const { data: orders } = await supabase
    .from("orders")
    .select("id, user_id, status, total_cents, paid_amount_cents, paid_at, created_at, receipt_number, payment_provider, payment_reference, checkout_provider, order_items(id)")
    .eq("event_id", eventId)
    .neq("status", "cancelled");

  const paid = (orders ?? []).filter((o) => o.status === "paid").sort((a, b) => (b.paid_at ?? "").localeCompare(a.paid_at ?? ""));
  const unpaid = (orders ?? []).filter((o) => o.status === "open" && o.order_items.length > 0).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const contacts = await contactsFor([...new Set([...paid, ...unpaid].map((o) => o.user_id))]);

  const received = paid.reduce((sum, o) => sum + (o.paid_amount_cents ?? o.total_cents), 0);
  const paidEntries = paid.reduce((sum, o) => sum + o.order_items.length, 0);
  const waiting = unpaid.reduce((sum, o) => sum + o.total_cents, 0);
  const byProvider = (p: string) => paid.filter((o) => o.payment_provider === p).reduce((sum, o) => sum + (o.paid_amount_cents ?? o.total_cents), 0);

  return (
    <div className="space-y-6">
      <EventNav orgId={orgId} orgName={org.name} event={event} current="payments" />

      <div className="grid gap-4 sm:grid-cols-4">
        <div className={card}><p className={muted}>Received</p><p className="text-2xl font-bold">{formatMoney(received)}</p></div>
        <div className={card}><p className={muted}>Paid carts</p><p className="text-2xl font-bold">{paid.length}</p><p className={muted}>{paidEntries} {paidEntries === 1 ? "entry" : "entries"}</p></div>
        <div className={card}><p className={muted}>By method</p><p className="text-sm font-medium">Square {formatMoney(byProvider("square"))}</p><p className="text-sm font-medium">PayPal {formatMoney(byProvider("paypal"))}</p></div>
        <div className={card}><p className={muted}>Unpaid carts</p><p className="text-2xl font-bold">{unpaid.length}</p><p className={muted}>{formatMoney(waiting)} not yet paid</p></div>
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="p-5 pb-2">
          <h2 className={h2}>Paid</h2>
          <p className={muted}>These entries are in your program. Click a receipt number to see what was entered.</p>
        </div>
        {paid.length === 0 ? (
          <p className={`${muted} px-5 pb-5`}>No payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-5 py-2 font-medium">Receipt</th>
                  <th className="px-3 py-2 font-medium">Paid by</th>
                  <th className="px-3 py-2 font-medium">Entries</th>
                  <th className="px-3 py-2 font-medium">Method</th>
                  <th className="px-5 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paid.map((o) => (
                  <tr key={o.id}>
                    <td className="px-5 py-2 align-top">
                      <Link href={`/receipts/${o.id}`} className={`${link} font-medium`}>{o.receipt_number}</Link>
                      <span className="block text-xs text-slate-500">{formatDateTime(o.paid_at)}</span>
                    </td>
                    <td className="px-3 py-2 align-top"><Contact c={contacts.get(o.user_id)} /></td>
                    <td className="px-3 py-2 align-top">{o.order_items.length}</td>
                    <td className="px-3 py-2 align-top">
                      {providerName[o.payment_provider ?? ""] ?? o.payment_provider}
                      <span className="block break-all text-xs text-slate-500">{o.payment_reference}</span>
                    </td>
                    <td className="px-5 py-2 text-right align-top font-medium">{formatMoney(o.paid_amount_cents ?? o.total_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="p-5 pb-2">
          <h2 className={h2}>Not paid yet</h2>
          <p className={muted}>Carts with entries that haven&apos;t been paid. These are not in your program. You may want to send a reminder before entries close.</p>
        </div>
        {unpaid.length === 0 ? (
          <p className={`${muted} px-5 pb-5`}>No unpaid carts.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-5 py-2 font-medium">Account</th>
                  <th className="px-3 py-2 font-medium">Entries</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unpaid.map((o) => (
                  <tr key={o.id}>
                    <td className="px-5 py-2 align-top"><Contact c={contacts.get(o.user_id)} /></td>
                    <td className="px-3 py-2 align-top">{o.order_items.length}</td>
                    <td className="px-3 py-2 align-top">
                      {o.checkout_provider ? `Started paying with ${providerName[o.checkout_provider] ?? o.checkout_provider}` : "In cart"}
                      <span className="block text-xs text-slate-500">Cart started {formatDateTime(o.created_at)}</span>
                    </td>
                    <td className="px-5 py-2 text-right align-top font-medium">{formatMoney(o.total_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function PaymentsPage({ params }: PageProps<"/org/[orgId]/events/[eventId]/payments">) {
  return (
    <Suspense fallback={<p className={muted}>Loading…</p>}>
      <Payments params={params} />
    </Suspense>
  );
}
