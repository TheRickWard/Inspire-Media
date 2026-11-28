import Link from "next/link";
import { Suspense } from "react";
import { loadManagedEvent } from "@/lib/access";
import { EventNav } from "@/components/EventNav";
import { formatMoney } from "@/lib/format";
import { loadReportData, REPORTS, sectionTotals, studioTotals } from "@/lib/report-data";
import { buttonSecondary, card, h2, link, muted } from "@/components/ui";

async function Reports({ params }: { params: Promise<{ orgId: string; eventId: string }> }) {
  const { orgId, eventId } = await params;
  const { supabase, org, event } = await loadManagedEvent(orgId, eventId);
  const data = await loadReportData(supabase, eventId);

  const live = data.rows.filter((r) => !r.scratched);
  const studios = studioTotals(data.rows);
  const sections = sectionTotals(data.rows);
  const received = data.payments.reduce((n, p) => n + p.amountCents - p.refundedCents, 0);
  const noMusic = live.filter((r) => !r.music).length;
  const noCritique = live.filter((r) => r.critiques === 0).length;
  const base = `/org/${orgId}/events/${eventId}/reports`;

  return (
    <div className="space-y-6">
      <EventNav orgId={orgId} orgName={org.name} event={event} current="reports" />

      <div className="grid gap-4 sm:grid-cols-4">
        <div className={card}><p className={muted}>Entries</p><p className="text-2xl font-bold">{live.length}</p><p className={muted}>{data.rows.length - live.length} scratched</p></div>
        <div className={card}><p className={muted}>Studios</p><p className="text-2xl font-bold">{studios.filter((s) => s.entries > 0).length}</p></div>
        <div className={card}><p className={muted}>Received online (after refunds)</p><p className="text-2xl font-bold">{formatMoney(received)}</p><p className={muted}>{data.payments.length} {data.payments.length === 1 ? "payment" : "payments"}</p></div>
        <div className={card}><p className={muted}>Still missing</p><p className="text-sm font-medium">{noMusic} without music</p><p className="text-sm font-medium">{noCritique} without a critique</p></div>
      </div>

      <section className={`${card} space-y-3`}>
        <h2 className={h2}>Download</h2>
        <p className={muted}>Spreadsheet files (CSV) that open in Excel, Numbers or Google Sheets. Dates of birth are never included.</p>
        <ul className="space-y-2">
          {(Object.keys(REPORTS) as (keyof typeof REPORTS)[]).map((key) => (
            <li key={key} className="flex flex-wrap items-center gap-3">
              <a href={`${base}/${key}`} className={buttonSecondary}>Download {key}</a>
              <span className="text-sm text-slate-600">{REPORTS[key]}</span>
            </li>
          ))}
          <li className="flex flex-wrap items-center gap-3">
            <Link href={`/events/${eventId}/program`} className={buttonSecondary}>Printable program</Link>
            <span className="text-sm text-slate-600">Running order by session and section, to print or save as PDF</span>
          </li>
        </ul>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="p-5 pb-2"><h2 className={h2}>By section</h2></div>
        {sections.length === 0 ? (
          <p className={`${muted} px-5 pb-5`}>No entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-5 py-2 font-medium">Section</th>
                  <th className="px-3 py-2 font-medium">Session</th>
                  <th className="px-3 py-2 text-right font-medium">Entries</th>
                  <th className="px-3 py-2 text-right font-medium">Music</th>
                  <th className="px-5 py-2 text-right font-medium">Critiques</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sections.map((s) => (
                  <tr key={s.code}>
                    <td className="px-5 py-2">{s.code} – {s.name}</td>
                    <td className="px-3 py-2 text-slate-600">{s.session}</td>
                    <td className="px-3 py-2 text-right">{s.entries}</td>
                    <td className={`px-3 py-2 text-right ${s.music < s.entries ? "text-amber-700" : "text-emerald-700"}`}>{s.music} of {s.entries}</td>
                    <td className={`px-5 py-2 text-right ${s.critiques < s.entries ? "text-amber-700" : "text-emerald-700"}`}>{s.critiques} of {s.entries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="p-5 pb-2">
          <h2 className={h2}>By studio</h2>
          <p className={muted}>Fees are what was paid online; imported entries show $0.00. <Link href={`/org/${orgId}/events/${eventId}/payments`} className={link}>See payments</Link></p>
        </div>
        {studios.length === 0 ? (
          <p className={`${muted} px-5 pb-5`}>No entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-5 py-2 font-medium">Studio</th>
                  <th className="px-3 py-2 text-right font-medium">Entries</th>
                  <th className="px-3 py-2 text-right font-medium">Scratched</th>
                  <th className="px-5 py-2 text-right font-medium">Fees paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studios.map((s) => (
                  <tr key={s.studio}>
                    <td className="px-5 py-2">{s.studio}</td>
                    <td className="px-3 py-2 text-right">{s.entries}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{s.scratched || ""}</td>
                    <td className="px-5 py-2 text-right font-medium">{formatMoney(s.feesCents)}</td>
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

export default function ReportsPage({ params }: PageProps<"/org/[orgId]/events/[eventId]/reports">) {
  return (
    <Suspense fallback={<p className={muted}>Loading…</p>}>
      <Reports params={params} />
    </Suspense>
  );
}
