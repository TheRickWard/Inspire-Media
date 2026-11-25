import { Suspense } from "react";
import { loadManagedEvent } from "@/lib/access";
import { EventNav } from "@/components/EventNav";
import { ProgramImporter } from "@/components/ProgramImporter";
import { PROGRAM_COLUMNS } from "@/lib/program-csv";
import { card, h2, link, muted } from "@/components/ui";

async function ImportProgram({ params }: { params: Promise<{ orgId: string; eventId: string }> }) {
  const { orgId, eventId } = await params;
  const { org, event } = await loadManagedEvent(orgId, eventId);

  return (
    <div className="space-y-6">
      <EventNav orgId={orgId} orgName={org.name} event={event} current="import" />
      <section className={card}>
        <h2 className={`${h2} mb-3`}>Import a program from CSV</h2>
        <ProgramImporter eventId={eventId} programHref={`/org/${orgId}/events/${eventId}/program`} />
      </section>
      <section className={card}>
        <h2 className={h2}>What the file needs</h2>
        <p className="mt-1 text-sm text-slate-600">
          One row per item, in running order, with a header row. Save from Excel as &quot;CSV UTF-8&quot;.{" "}
          <a href="/samples/sample-program.csv" download className={link}>Download a sample file</a>.
        </p>
        <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          {PROGRAM_COLUMNS.map((c) => (
            <li key={c.key}>
              <strong>{c.label}</strong> {c.required ? "(required)" : <span className="text-slate-500">(optional)</span>}
            </li>
          ))}
        </ul>
        <p className={`${muted} mt-3`}>Sections and sessions that don&apos;t exist yet are created automatically.</p>
      </section>
    </div>
  );
}

export default function ImportPage({ params }: PageProps<"/org/[orgId]/events/[eventId]/import">) {
  return (
    <Suspense fallback={<p className={muted}>Loading…</p>}>
      <ImportProgram params={params} />
    </Suspense>
  );
}
