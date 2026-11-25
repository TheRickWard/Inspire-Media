import Link from "next/link";
import { Suspense } from "react";
import { loadOrganisation } from "@/lib/access";
import { ActionForm } from "@/components/ActionForm";
import { EventFields } from "@/components/EventFields";
import { card, h1, link, muted } from "@/components/ui";
import { createEvent } from "@/app/org/actions";

async function NewEvent({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { org } = await loadOrganisation(orgId);
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className={muted}><Link href={`/org/${orgId}`} className={link}>{org.name}</Link> /</p>
        <h1 className={h1}>New event</h1>
      </div>
      <div className={card}>
        <ActionForm action={createEvent.bind(null, orgId)} submitLabel="Create event" pendingLabel="Creating…">
          <EventFields values={{ contact_email: org.contact_email ?? "" }} />
        </ActionForm>
      </div>
    </div>
  );
}

export default function NewEventPage({ params }: PageProps<"/org/[orgId]/events/new">) {
  return (
    <Suspense fallback={<p className={muted}>Loading…</p>}>
      <NewEvent params={params} />
    </Suspense>
  );
}
