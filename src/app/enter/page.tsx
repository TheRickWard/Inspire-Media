import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
import { formatDateRange, todayInSydney } from "@/lib/format";
import { entriesStatus } from "@/lib/entries";
import { card, h1, link, muted } from "@/components/ui";

async function EventsToEnter() {
  await requireUser();
  const supabase = await createSupabase();
  const today = todayInSydney();
  const { data: events } = await supabase
    .from("events")
    .select("id, name, venue_name, starts_on, ends_on, entries_open_on, entries_close_on, entries_override")
    .eq("status", "published")
    .gte("ends_on", today)
    .order("starts_on");

  return (
    <div className="space-y-6">
      <div>
        <p className={muted}><Link href="/dashboard" className={link}>Dashboard</Link> /</p>
        <h1 className={h1}>Enter a competition</h1>
      </div>
      {(events ?? []).length === 0 && <p className={muted}>No competitions are taking entries right now.</p>}
      <ul className="grid gap-4 sm:grid-cols-2">
        {(events ?? []).map((e) => {
          const { open, message } = entriesStatus(e, today);
          return (
            <li key={e.id} className={card}>
              <p className="text-lg font-semibold">{e.name}</p>
              <p className="text-sm">{formatDateRange(e.starts_on, e.ends_on)}{e.venue_name && ` · ${e.venue_name}`}</p>
              {open ? (
                <>
                  <p className="mt-1 text-sm text-emerald-700">{message}</p>
                  <Link href={`/enter/${e.id}`} className={`${link} mt-2 inline-block font-medium`}>Enter now →</Link>
                </>
              ) : (
                <p className={`${muted} mt-1`}>{message}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function EnterPage() {
  return (
    <Suspense fallback={<p className={muted}>Loading…</p>}>
      <EventsToEnter />
    </Suspense>
  );
}
