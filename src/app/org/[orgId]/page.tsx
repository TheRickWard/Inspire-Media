import Link from "next/link";
import { Suspense } from "react";
import { loadOrganisation } from "@/lib/access";
import { ActionForm } from "@/components/ActionForm";
import { formatDateRange } from "@/lib/format";
import { button, buttonSmall, card, h1, h2, input, label, link, muted } from "@/components/ui";
import { addMember, removeMember } from "@/app/org/actions";

async function Organisation({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { supabase, org, isOwner, user } = await loadOrganisation(orgId);

  const [{ data: events }, { data: members }] = await Promise.all([
    supabase.from("events").select("id, name, status, starts_on, ends_on, venue_name, entries(count)").eq("organisation_id", orgId).order("starts_on", { ascending: false }),
    supabase.from("organisation_members").select("user_id, role, profiles(email, full_name)").eq("organisation_id", orgId),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={muted}><Link href="/dashboard" className={link}>Dashboard</Link> /</p>
          <h1 className={h1}>{org.name}</h1>
        </div>
        <Link href={`/org/${orgId}/events/new`} className={button}>New event</Link>
      </div>

      <section className="space-y-3">
        <h2 className={h2}>Events</h2>
        {(events ?? []).length === 0 && <p className={muted}>No events yet. Create your first one.</p>}
        <ul className="grid gap-4 sm:grid-cols-2">
          {(events ?? []).map((e) => (
            <li key={e.id} className={card}>
              <div className="flex items-start justify-between gap-2">
                <Link href={`/org/${orgId}/events/${e.id}`} className={`${link} text-lg font-semibold`}>{e.name}</Link>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${e.status === "published" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                  {e.status === "published" ? "Published" : "Draft"}
                </span>
              </div>
              <p className="mt-1 text-sm">{formatDateRange(e.starts_on, e.ends_on)}</p>
              <p className={muted}>{e.venue_name} · {e.entries?.[0]?.count ?? 0} items in program</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={card}>
        <h2 className={h2}>People with access</h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {(members ?? []).map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                {m.profiles?.full_name || m.profiles?.email} <span className="text-slate-500">· {m.profiles?.email} · {m.role === "owner" ? "Owner" : "Staff"}</span>
              </span>
              {isOwner && m.user_id !== user.id && (
                <ActionForm action={removeMember.bind(null, orgId, m.user_id)} submitLabel="Remove" pendingLabel="Removing…" className="" buttonClassName={buttonSmall} confirmText="Remove this person's access?" />
              )}
            </li>
          ))}
        </ul>
        {isOwner && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <h3 className="mb-2 font-medium">Add someone</h3>
            <p className={`${muted} mb-3`}>They need to create an account first. Staff can manage events; owners can also add and remove people.</p>
            <ActionForm action={addMember.bind(null, orgId)} submitLabel="Add" className="flex flex-wrap items-end gap-3">
              <div className="min-w-64 flex-1">
                <label htmlFor="email" className={label}>Their account email</label>
                <input id="email" name="email" type="email" required className={input} />
              </div>
              <div>
                <label htmlFor="role" className={label}>Role</label>
                <select id="role" name="role" className={input} defaultValue="staff">
                  <option value="staff">Staff</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
            </ActionForm>
          </div>
        )}
      </section>
    </div>
  );
}

export default function OrganisationPage({ params }: PageProps<"/org/[orgId]">) {
  return (
    <Suspense fallback={<p className={muted}>Loading…</p>}>
      <Organisation params={params} />
    </Suspense>
  );
}
