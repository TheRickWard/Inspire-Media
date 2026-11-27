import Link from "next/link";
import { Suspense } from "react";
import { createPublicSupabase } from "@/lib/supabase/server";
import { formatDateRange } from "@/lib/format";
import { card, h1, h2, link, muted } from "@/components/ui";

async function PublishedEvents() {
  const supabase = await createPublicSupabase();
  const { data: events } = await supabase
    .from("events")
    .select("id, name, venue_name, starts_on, ends_on, organisations(name)")
    .eq("status", "published")
    .order("starts_on");

  if (!events || events.length === 0) {
    return <p className={muted}>No competitions are published yet.</p>;
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {events.map((e) => (
        <li key={e.id} className={card}>
          <Link href={`/events/${e.id}`} className={`${link} text-lg font-semibold`}>
            {e.name}
          </Link>
          <p className="mt-1 text-sm text-slate-700">{formatDateRange(e.starts_on, e.ends_on)}</p>
          {e.venue_name && <p className={muted}>{e.venue_name}</p>}
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className={h1}>Dance competitions and eisteddfods</h1>
        <p className="max-w-2xl text-slate-600">
          Find a competition, view the program, enter and pay online, and upload your music.
        </p>
      </section>
      <section className="space-y-4">
        <h2 className={h2}>Upcoming competitions</h2>
        <Suspense fallback={<p className={muted}>Loading competitions…</p>}>
          <PublishedEvents />
        </Suspense>
      </section>
    </div>
  );
}
