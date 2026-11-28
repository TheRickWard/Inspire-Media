import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { createPublicSupabase } from "@/lib/supabase/server";
import { formatDate, formatDateRange, todayInSydney } from "@/lib/format";
import { entriesStatus } from "@/lib/entries";
import { button, card, h1, h2, muted } from "@/components/ui";

async function PublicEvent({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createPublicSupabase();
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .eq("status", "published")
    .maybeSingle();
  if (!event) notFound();

  const [{ data: sessions }, { data: sections }] = await Promise.all([
    supabase.from("event_sessions").select("id, name, session_date, starts_at").eq("event_id", eventId).order("position"),
    supabase.from("sections").select("id, code, name, session_id, entries(count)").eq("event_id", eventId).order("position"),
  ]);

  const status = entriesStatus(event, todayInSydney());
  const groups = [
    ...(sessions ?? []).map((s) => ({ key: s.id, title: s.name, date: s.session_date, sections: (sections ?? []).filter((x) => x.session_id === s.id) })),
    { key: "none", title: "Other sections", date: null, sections: (sections ?? []).filter((x) => !x.session_id) },
  ].filter((g) => g.sections.length > 0);

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className={h1}>{event.name}</h1>
        <p className="text-slate-700">{formatDateRange(event.starts_on, event.ends_on)}</p>
        {event.venue_name && <p className="text-slate-700">{event.venue_name}{event.venue_address && `, ${event.venue_address}`}</p>}
        {event.description && <p className="max-w-2xl whitespace-pre-line text-slate-600">{event.description}</p>}
        <p className="font-medium text-brand-purple">{status.message}</p>
        {status.open && (
          <div className="pt-2">
            <Link href={`/enter/${event.id}`} className={button}>Enter this competition</Link>
            <p className={`${muted} mt-1`}>You&apos;ll be asked to sign in or create a free account first.</p>
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className={card}>
          <p className={muted}>Entries open</p>
          <p className="font-semibold">{formatDate(event.entries_open_on) || "To be announced"}</p>
        </div>
        <div className={card}>
          <p className={muted}>Entries close</p>
          <p className="font-semibold">{formatDate(event.entries_close_on) || "To be announced"}</p>
        </div>
        <div className={card}>
          <p className={muted}>Music due</p>
          <p className="font-semibold">{formatDate(event.music_due_on) || "To be announced"}</p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className={h2}>Program overview</h2>
        {groups.length === 0 && <p className={muted}>The program hasn&apos;t been published yet.</p>}
        {groups.map((g) => (
          <div key={g.key} className={card}>
            <h3 className="font-semibold">
              {g.title} {g.date && <span className="font-normal text-slate-500">· {formatDate(g.date)}</span>}
            </h3>
            <ul className="mt-2 divide-y divide-slate-100">
              {g.sections.map((s) => (
                <li key={s.id} className="flex justify-between gap-4 py-2 text-sm">
                  <span>Section {s.code} – {s.name}</span>
                  <span className="shrink-0 text-slate-500">{s.entries?.[0]?.count ?? 0} items</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {(event.contact_email || event.contact_phone) && (
        <section className={card}>
          <h2 className={h2}>Contact</h2>
          <p className="mt-1 text-sm">
            {event.contact_email && <><a className="text-brand-purple" href={`mailto:${event.contact_email}`}>{event.contact_email}</a></>}
            {event.contact_email && event.contact_phone && " · "}{event.contact_phone}
          </p>
        </section>
      )}

    </div>
  );
}

export default function PublicEventPage({ params }: PageProps<"/events/[eventId]">) {
  return (
    <Suspense fallback={<p className={muted}>Loading…</p>}>
      <PublicEvent params={params} />
    </Suspense>
  );
}
