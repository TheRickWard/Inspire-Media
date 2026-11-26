import { Suspense } from "react";
import { loadManagedEvent } from "@/lib/access";
import { ActionForm } from "@/components/ActionForm";
import { EventNav } from "@/components/EventNav";
import { describeAges, formatDate, formatMoney } from "@/lib/format";
import { buttonSmall, card, h2, input, label, muted } from "@/components/ui";
import { createSection, createSession, deleteSection, deleteSession, updateSection } from "@/app/org/program-actions";

type SessionOption = { id: string; name: string };

function SectionInputs({ sessions, values }: { sessions: SessionOption[]; values?: { code: string; name: string; session_id: string | null; genre: string; age_group: string; entry_fee_cents: number; min_age: number | null; max_age: number | null; min_dancers: number; max_dancers: number | null } }) {
  return (
    <>
      <div className="sm:col-span-1">
        <label className={label}>Section no.</label>
        <input name="code" required defaultValue={values?.code} className={input} />
      </div>
      <div className="sm:col-span-3">
        <label className={label}>Name</label>
        <input name="name" required defaultValue={values?.name} placeholder="e.g. Jazz Solo 10 Years & Under" className={input} />
      </div>
      <div className="sm:col-span-2">
        <label className={label}>Session</label>
        <select name="session_id" defaultValue={values?.session_id ?? ""} className={input}>
          <option value="">(none)</option>
          {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className={label}>Genre</label>
        <input name="genre" defaultValue={values?.genre} placeholder="e.g. Jazz" className={input} />
      </div>
      <div className="sm:col-span-2">
        <label className={label}>Age group</label>
        <input name="age_group" defaultValue={values?.age_group} placeholder="e.g. 10 & Under" className={input} />
      </div>
      <div className="sm:col-span-2">
        <label className={label}>Entry fee ($)</label>
        <input name="entry_fee" inputMode="decimal" defaultValue={values ? (values.entry_fee_cents / 100).toFixed(2) : ""} placeholder="0.00" className={input} />
      </div>
      <div className="sm:col-span-3">
        <span className={label}>Ages allowed (blank = any)</span>
        <div className="flex items-center gap-2">
          <input name="min_age" inputMode="numeric" aria-label="Minimum age" defaultValue={values?.min_age ?? ""} placeholder="from" className={input} />
          <span className="text-slate-500">to</span>
          <input name="max_age" inputMode="numeric" aria-label="Maximum age" defaultValue={values?.max_age ?? ""} placeholder="to" className={input} />
        </div>
      </div>
      <div className="sm:col-span-3">
        <span className={label}>Dancers per entry (blank = any)</span>
        <div className="flex items-center gap-2">
          <input name="min_dancers" inputMode="numeric" aria-label="Minimum dancers" defaultValue={values?.min_dancers ?? 1} placeholder="1" className={input} />
          <span className="text-slate-500">to</span>
          <input name="max_dancers" inputMode="numeric" aria-label="Maximum dancers" defaultValue={values?.max_dancers ?? ""} placeholder="e.g. 1 for solos" className={input} />
        </div>
      </div>
    </>
  );
}

async function Sections({ params }: { params: Promise<{ orgId: string; eventId: string }> }) {
  const { orgId, eventId } = await params;
  const { supabase, org, event } = await loadManagedEvent(orgId, eventId);
  const [{ data: sessions }, { data: sections }] = await Promise.all([
    supabase.from("event_sessions").select("id, name, session_date, starts_at").eq("event_id", eventId).order("position"),
    supabase.from("sections").select("id, code, name, session_id, genre, age_group, entry_fee_cents, min_age, max_age, min_dancers, max_dancers, entries(count)").eq("event_id", eventId).order("position"),
  ]);
  const sessionOptions = (sessions ?? []).map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="space-y-6">
      <EventNav orgId={orgId} orgName={org.name} event={event} current="sections" />

      <section className={card}>
        <h2 className={h2}>Sessions</h2>
        <p className={`${muted} mb-3`}>A session is usually a day, or a morning or afternoon block.</p>
        <ul className="mb-4 divide-y divide-slate-100">
          {(sessions ?? []).map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span>{s.name} <span className="text-slate-500">{s.session_date && `· ${formatDate(s.session_date)}`} {s.starts_at && `· ${s.starts_at.slice(0, 5)}`}</span></span>
              <ActionForm action={deleteSession.bind(null, s.id)} submitLabel="Delete" pendingLabel="…" className="" buttonClassName={buttonSmall} confirmText={`Delete session "${s.name}"? Its sections are kept.`} />
            </li>
          ))}
          {(sessions ?? []).length === 0 && <li className="py-2 text-sm text-slate-500">No sessions yet.</li>}
        </ul>
        <ActionForm action={createSession.bind(null, eventId)} submitLabel="Add session" className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <div className="sm:col-span-2">
            <label htmlFor="session_name" className={label}>Name</label>
            <input id="session_name" name="name" required placeholder="e.g. Saturday Morning" className={input} />
          </div>
          <div>
            <label htmlFor="session_date" className={label}>Date</label>
            <input id="session_date" name="session_date" type="date" className={input} />
          </div>
          <div>
            <label htmlFor="starts_at" className={label}>Start time</label>
            <input id="starts_at" name="starts_at" type="time" className={input} />
          </div>
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h2 className={h2}>Sections</h2>
        {(sections ?? []).map((s) => (
          <details key={s.id} className={`${card} p-0`}>
            <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2 px-5 py-3">
              <span className="font-medium">Section {s.code} – {s.name}</span>
              <span className={muted}>
                {sessionOptions.find((x) => x.id === s.session_id)?.name ?? "No session"} · {s.entries?.[0]?.count ?? 0} items · {formatMoney(s.entry_fee_cents)}{describeAges(s.min_age, s.max_age) && ` · ${describeAges(s.min_age, s.max_age)}`}
              </span>
            </summary>
            <div className="space-y-3 border-t border-slate-100 px-5 py-4">
              <ActionForm action={updateSection.bind(null, s.id)} submitLabel="Save section" className="grid gap-3 sm:grid-cols-6 sm:items-end">
                <SectionInputs sessions={sessionOptions} values={s} />
              </ActionForm>
              <ActionForm action={deleteSection.bind(null, s.id)} submitLabel="Delete section" pendingLabel="Deleting…" className="" buttonClassName={buttonSmall} confirmText={`Delete section ${s.code}?`} />
            </div>
          </details>
        ))}
        {(sections ?? []).length === 0 && <p className={muted}>No sections yet. Add them here, or import a CSV and they&apos;re created for you.</p>}
      </section>

      <section className={card}>
        <h2 className={`${h2} mb-3`}>Add a section</h2>
        <ActionForm action={createSection.bind(null, eventId)} submitLabel="Add section" className="grid gap-3 sm:grid-cols-6 sm:items-end">
          <SectionInputs sessions={sessionOptions} />
        </ActionForm>
      </section>
    </div>
  );
}

export default function SectionsPage({ params }: PageProps<"/org/[orgId]/events/[eventId]/sections">) {
  return (
    <Suspense fallback={<p className={muted}>Loading…</p>}>
      <Sections params={params} />
    </Suspense>
  );
}
