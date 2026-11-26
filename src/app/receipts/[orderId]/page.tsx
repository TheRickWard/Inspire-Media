import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { formatDateRange, formatDateTime, formatMoney } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";
import { card, link, muted } from "@/components/ui";

const providerName = { square: "Square", paypal: "PayPal" } as const;

async function Receipt({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ new?: string }> }) {
  const { orderId } = await params;
  const { new: isNew } = await searchParams;
  const user = await requireUser();
  const supabase = await createSupabase();

  const { data: order } = await supabase
    .from("orders")
    .select("id, user_id, status, receipt_number, paid_at, total_cents, payment_provider, payment_reference, provider_receipt_url, profiles(full_name, email), events(name, starts_on, ends_on, venue_name), order_items(id, fee_cents, dancer_ids, studio_name, created_at, sections(code, name))")
    .eq("id", orderId)
    .eq("status", "paid")
    .maybeSingle();
  if (!order) notFound();

  const allDancerIds = order.order_items.flatMap((i) => i.dancer_ids);
  const { data: dancers } = allDancerIds.length
    ? await supabase.from("dancers").select("id, full_name").in("id", allDancerIds)
    : { data: [] };
  // Organisers viewing a competitor's receipt can't read their profile directly.
  let payer: { full_name: string; email: string } | null = order.profiles;
  if (!payer && process.env.SUPABASE_SECRET_KEY?.trim()) {
    payer = (await createAdminSupabase().from("profiles").select("full_name, email").eq("id", order.user_id).maybeSingle()).data;
  }
  const dancerName = new Map((dancers ?? []).map((d) => [d.id, d.full_name]));
  const items = [...order.order_items].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const abn = process.env.RECEIPT_ABN?.trim();
  const business = process.env.RECEIPT_BUSINESS_NAME?.trim() || "Inspire Dance & Fitness";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className={muted}>
          <Link href={order.user_id === user.id ? "/receipts" : "/dashboard"} className={link}>{order.user_id === user.id ? "My receipts" : "Dashboard"}</Link> /
        </p>
        <PrintButton />
      </div>

      {isNew && (
        <div className={`${card} border-emerald-200 bg-emerald-50 print:hidden`}>
          <p className="text-sm font-medium text-emerald-800">Payment received, thank you! Your entries are now in the program.</p>
        </div>
      )}

      <article className={`${card} space-y-6 print:border-0 print:shadow-none`}>
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Image src="/inspire-logo.png" alt="Inspire Dance & Fitness" width={480} height={352} className="h-20 w-auto" />
            <p className="mt-2 text-sm font-medium">{business}</p>
            {abn && <p className="text-sm text-slate-600">ABN {abn}</p>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-brand-purple">Receipt</p>
            <p className="font-semibold">{order.receipt_number}</p>
            <p className="text-sm text-slate-600">Paid {formatDateTime(order.paid_at)}</p>
          </div>
        </header>
        <div className="brand-rainbow h-1 rounded" />

        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className={muted}>Paid by</p>
            <p className="font-medium">{payer?.full_name || payer?.email}</p>
            {payer?.full_name && <p className="text-slate-600">{payer.email}</p>}
          </div>
          <div>
            <p className={muted}>Competition</p>
            <p className="font-medium">{order.events?.name}</p>
            {order.events && <p className="text-slate-600">{formatDateRange(order.events.starts_on, order.events.ends_on)}{order.events.venue_name && ` · ${order.events.venue_name}`}</p>}
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 font-medium">Entry</th>
              <th className="py-2 text-right font-medium">Fee</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((i) => (
              <tr key={i.id}>
                <td className="py-2">
                  <p className="font-medium">Section {i.sections?.code} – {i.sections?.name}</p>
                  <p className="text-slate-600">
                    {i.studio_name ? `Studio entry: ${i.studio_name}` : i.dancer_ids.map((id) => dancerName.get(id) ?? "Dancer").join(" & ")}
                  </p>
                </td>
                <td className="py-2 text-right align-top">{formatMoney(i.fee_cents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-300 font-semibold">
              <td className="py-2">Total paid (AUD)</td>
              <td className="py-2 text-right">{formatMoney(order.total_cents)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="space-y-1 text-sm text-slate-600">
          {order.payment_provider && (
            <p>Paid with {providerName[order.payment_provider as keyof typeof providerName] ?? order.payment_provider}. Reference: {order.payment_reference}</p>
          )}
          {order.provider_receipt_url && (
            <p className="print:hidden"><a href={order.provider_receipt_url} className={link} target="_blank" rel="noreferrer">View Square&apos;s receipt</a></p>
          )}
          <p>Item numbers are given when the organiser finalises the program.</p>
        </div>
      </article>
    </div>
  );
}

export default function ReceiptPage({ params, searchParams }: PageProps<"/receipts/[orderId]">) {
  return (
    <Suspense fallback={<p className={muted}>Loading…</p>}>
      <Receipt params={params} searchParams={searchParams as Promise<{ new?: string }>} />
    </Suspense>
  );
}
