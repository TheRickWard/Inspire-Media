import Link from "next/link";
import { Suspense } from "react";
import { loadManagedEvent } from "@/lib/access";
import { ActionForm } from "@/components/ActionForm";
import { EventFields } from "@/components/EventFields";
import { EventNav } from "@/components/EventNav";
import { buttonSecondary, card, h2, link, muted } from "@/components/ui";
import { setEventStatus, updateEvent } from "@/app/org/actions";

async function EventDetails({ params }: { params: Promise<{ orgId: string; eventId: string }> }) {
  const { orgId, eventId } = await params;
  const { supabase, org, event } = await loadManagedEvent(orgId, eventId);
  const [{ count: items }, { count: scratched }, { count: sections }] = await Promise.all([
    supabase.from("entries").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    supabase.from("entries").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "scratched"),
    supabase.from("sections").select("id", { count: "exact", head: true }).eq("event_id", eventId),
  ]);
  const published = event.status === "published";

  return (
    <div className="space-y-6">
      <EventNav orgId={orgId} orgName={org.name} event={event} current="details" />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className={card}><p className={muted}>Sections</p><p className="text-2xl font-bold">{sections ?? 0}</p></div>
        <div className={card}><p className={muted}>Items in program</p><p className="text-2xl font-bold">{items ?? 0}</p></div>
        <div className={card}><p className={muted}>Scratched</p><p className="text-2xl font-bold">{scratched ?? 0}</p></div>
      </div>

      <section className={`${card} space-y-3`}>
        <h2 className={h2}>Public page</h2>
        <p className="text-sm text-slate-600">
          {published ? (
            <>Anyone can see the event details and program overview at <Link href={`/events/${eventId}`} className={link}>the public event page</Link>.</>
          ) : (
            <>This event is a draft. Only your organisation can see it.</>
          )}
        </p>
        <div className="flex flex-wrap gap-3">
          <ActionForm
            action={setEventStatus.bind(null, orgId, eventId, published ? "draft" : "published")}
            submitLabel={published ? "Unpublish" : "Publish event"}
            pendingLabel="Saving…"
            className=""
            buttonClassName={buttonSecondary}
          />
          <a href={`/org/${orgId}/events/${eventId}/export`} className={buttonSecondary}>
            Download program CSV (for playback and critiques)
          </a>
        </div>
      </section>

      <section className={card}>
        <h2 className={`${h2} mb-4`}>Event details</h2>
        <ActionForm action={updateEvent.bind(null, orgId, eventId)} submitLabel="Save details">
          <EventFields values={event} />
        </ActionForm>
      </section>
    </div>
  );
}

export default function EventPage({ params }: PageProps<"/org/[orgId]/events/[eventId]">) {
  return (
    <Suspense fallback={<p className={muted}>Loading…</p>}>
      <EventDetails params={params} />
    </Suspense>
  );
}
