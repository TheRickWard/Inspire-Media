import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { createSupabase } from "@/lib/supabase/server";
import { formatDate, formatDateRange } from "@/lib/format";
import { formatTime, groupProgram } from "@/lib/reports";
import { PrintButton } from "@/components/PrintButton";
import { link, muted } from "@/components/ui";

// The printable program. Anyone can see a published competition's program;
// its organisers can also print a draft (the security rules decide).
async function PrintableProgram({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createSupabase();
  const { data: event } = await supabase
    .from("events")
    .select("id, name, status, starts_on, ends_on, venue_name, venue_address")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) notFound();

  const { data: entries } = await supabase
    .from("entries")
    .select("item_number, performer_name, studio_name, status, position, sections(code, name, position, event_sessions(id, name, session_date, starts_at, position))")
    .eq("event_id", eventId)
    .order("position");
  const sessions = groupProgram(entries ?? []);
  const count = sessions.reduce((n, s) => n + s.sections.reduce((m, x) => m + x.entries.length, 0), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6 bg-white print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className={muted}><Link href={`/events/${event.id}`} className={link}>Back to the competition</Link></p>
        <PrintButton />
      </div>
      {event.status !== "published" && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 print:hidden">
          This competition is a draft. Only your organisation can see this program until you publish it.
        </p>
      )}

      <header className="border-b-2 border-brand-ink pb-3 text-center">
        <h1 className="text-2xl font-bold text-brand-ink">{event.name}</h1>
        <p className="text-slate-700">{formatDateRange(event.starts_on, event.ends_on)}</p>
        {event.venue_name && <p className="text-sm text-slate-600">{event.venue_name}{event.venue_address && `, ${event.venue_address}`}</p>}
        <p className="mt-1 text-xs text-slate-500">Program · {count} {count === 1 ? "item" : "items"} · subject to change</p>
      </header>

      {sessions.length === 0 && <p className={muted}>The program hasn&apos;t been set yet.</p>}

      {sessions.map((s) => (
        <section key={s.key} className="space-y-4 break-inside-auto">
          <h2 className="break-after-avoid rounded bg-brand-purple/10 px-3 py-1.5 text-lg font-semibold text-brand-ink print:bg-slate-100">
            {s.name}
            {(s.date || s.startsAt) && (
              <span className="ml-2 text-sm font-normal text-slate-600">
                {[formatDate(s.date), s.startsAt ? `from ${formatTime(s.startsAt)}` : ""].filter(Boolean).join(", ")}
              </span>
            )}
          </h2>
          {s.sections.map((sec, i) => (
            <div key={`${sec.code}-${i}`} className="break-inside-avoid">
              <h3 className="border-b border-slate-300 pb-1 text-sm font-semibold">
                Section {sec.code} – {sec.name}
              </h3>
              <table className="w-full table-fixed text-sm">
                <tbody>
                  {sec.entries.map((e, j) => (
                    <tr key={j} className="border-b border-slate-100 last:border-0">
                      <td className="w-16 py-1 pr-2 align-top font-semibold tabular-nums">{e.item_number ?? "–"}</td>
                      <td className="w-[55%] py-1 pr-2 align-top">{e.performer_name}</td>
                      <td className="py-1 align-top text-slate-600">{e.studio_name !== e.performer_name ? e.studio_name : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

export default function PrintableProgramPage({ params }: PageProps<"/events/[eventId]/program">) {
  return (
    <Suspense fallback={<p className={muted}>Loading…</p>}>
      <PrintableProgram params={params} />
    </Suspense>
  );
}
