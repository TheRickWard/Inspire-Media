import Link from "next/link";
import { Suspense } from "react";
import { requirePlatformAdmin } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
import { ActionForm } from "@/components/ActionForm";
import { card, h1, h2, input, label, link, muted } from "@/components/ui";
import { createOrganisation } from "./actions";

async function Admin() {
  await requirePlatformAdmin();
  const supabase = await createSupabase();
  const { data: orgs } = await supabase
    .from("organisations")
    .select("id, name, contact_email, organisation_members(count), events(count)")
    .order("name");

  return (
    <div className="space-y-8">
      <div>
        <h1 className={h1}>Inspire Media admin</h1>
        <p className={muted}>Every organiser using the portal. Each organiser only sees their own competitions.</p>
      </div>

      <section className="space-y-3">
        <h2 className={h2}>Organisers</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Contact</th>
                <th className="px-4 py-2 font-medium">People</th>
                <th className="px-4 py-2 font-medium">Events</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(orgs ?? []).map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2"><Link href={`/org/${o.id}`} className={link}>{o.name}</Link></td>
                  <td className="px-4 py-2">{o.contact_email}</td>
                  <td className="px-4 py-2">{o.organisation_members?.[0]?.count ?? 0}</td>
                  <td className="px-4 py-2">{o.events?.[0]?.count ?? 0}</td>
                </tr>
              ))}
              {(orgs ?? []).length === 0 && (
                <tr><td colSpan={4} className="px-4 py-4 text-slate-500">No organisers yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${card} max-w-xl`}>
        <h2 className={h2}>Add an organiser</h2>
        <p className={`${muted} mb-4`}>The owner must already have created an account with that email.</p>
        <ActionForm action={createOrganisation} submitLabel="Create organiser">
          <div>
            <label htmlFor="name" className={label}>Organisation name</label>
            <input id="name" name="name" required className={input} />
          </div>
          <div>
            <label htmlFor="contact_email" className={label}>Contact email (optional)</label>
            <input id="contact_email" name="contact_email" type="email" className={input} />
          </div>
          <div>
            <label htmlFor="owner_email" className={label}>Owner&apos;s account email (optional)</label>
            <input id="owner_email" name="owner_email" type="email" className={input} />
          </div>
        </ActionForm>
      </section>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<p className={muted}>Loading…</p>}>
      <Admin />
    </Suspense>
  );
}
