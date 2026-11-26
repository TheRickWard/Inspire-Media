import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
import { formatDateTime, formatMoney } from "@/lib/format";
import { h1, link, muted } from "@/components/ui";

async function Receipts() {
  const user = await requireUser();
  const supabase = await createSupabase();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, receipt_number, paid_at, total_cents, events(name), order_items(id)")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .order("paid_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <p className={muted}><Link href="/dashboard" className={link}>Dashboard</Link> /</p>
        <h1 className={h1}>My receipts</h1>
      </div>
      {(orders ?? []).length === 0 ? (
        <p className={muted}>No payments yet. Once you pay for entries, your receipts appear here.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white shadow-sm">
          {(orders ?? []).map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
              <div>
                <Link href={`/receipts/${o.id}`} className={`${link} font-medium`}>{o.receipt_number}</Link>
                <p className="text-slate-600">{o.events?.name} · {o.order_items.length} {o.order_items.length === 1 ? "entry" : "entries"}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatMoney(o.total_cents)}</p>
                <p className={muted}>{formatDateTime(o.paid_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ReceiptsPage() {
  return (
    <Suspense fallback={<p className={muted}>Loading…</p>}>
      <Receipts />
    </Suspense>
  );
}
