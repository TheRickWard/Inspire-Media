import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
import { ActionForm } from "@/components/ActionForm";
import { ageOn, formatDate, todayInSydney } from "@/lib/format";
import { buttonSmall, card, h1, h2, input, label, link, muted } from "@/components/ui";
import { addDancer, deleteDancer, updateDancer } from "./actions";

function DancerFields({ values }: { values?: { full_name: string; date_of_birth: string; studio_name: string } }) {
  return (
    <>
      <label className="block sm:col-span-2">
        <span className={label}>Dancer&apos;s full name</span>
        <input name="full_name" required defaultValue={values?.full_name} className={input} />
      </label>
      <label className="block">
        <span className={label}>Date of birth</span>
        <input name="date_of_birth" type="date" required defaultValue={values?.date_of_birth} max={todayInSydney()} className={input} />
      </label>
      <label className="block">
        <span className={label}>Studio (leave blank if they dance independently)</span>
        <input name="studio_name" defaultValue={values?.studio_name} className={input} />
      </label>
    </>
  );
}

async function Dancers() {
  await requireUser();
  const supabase = await createSupabase();
  const { data: dancers } = await supabase.from("dancers").select("id, full_name, date_of_birth, studio_name").order("full_name");
  const today = todayInSydney();

  return (
    <div className="space-y-8">
      <div>
        <p className={muted}><Link href="/dashboard" className={link}>Dashboard</Link> /</p>
        <h1 className={h1}>My dancers</h1>
        <p className={`${muted} mt-1 max-w-2xl`}>
          Add each dancer once, then choose them when entering a competition. Parents add their own children here. Studios don&apos;t need to: they can make a studio entry with just the studio name.
          We only keep the name, date of birth (to check age groups) and studio. You are the contact for every dancer you add.
        </p>
      </div>

      <section className="space-y-3">
        {(dancers ?? []).length === 0 && <p className={muted}>No dancers yet. Add your first one below.</p>}
        {(dancers ?? []).map((d) => (
          <details key={d.id} className={`${card} p-0`}>
            <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2 px-5 py-3">
              <span className="font-medium">{d.full_name}</span>
              <span className={muted}>
                Born {formatDate(d.date_of_birth)} · {ageOn(d.date_of_birth, today)} years old{d.studio_name && ` · ${d.studio_name}`}
              </span>
            </summary>
            <div className="space-y-3 border-t border-slate-100 px-5 py-4">
              <ActionForm action={updateDancer.bind(null, d.id)} submitLabel="Save" className="grid gap-3 sm:grid-cols-4 sm:items-end">
                <DancerFields values={d} />
              </ActionForm>
              <ActionForm action={deleteDancer.bind(null, d.id)} submitLabel="Remove dancer" pendingLabel="Removing…" className="" buttonClassName={buttonSmall} confirmText={`Remove ${d.full_name}?`} />
            </div>
          </details>
        ))}
      </section>

      <section className={card}>
        <h2 className={`${h2} mb-3`}>Add a dancer</h2>
        <ActionForm action={addDancer} submitLabel="Add dancer" className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <DancerFields />
        </ActionForm>
      </section>

      <p>
        <Link href="/enter" className={link}>Enter a competition →</Link>
      </p>
    </div>
  );
}

export default function DancersPage() {
  return (
    <Suspense fallback={<p className={muted}>Loading…</p>}>
      <Dancers />
    </Suspense>
  );
}
