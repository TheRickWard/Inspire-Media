import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
import { card, h1, h2, link, muted } from "@/components/ui";

async function Dashboard() {
  const user = await requireUser();
  const supabase = await createSupabase();
  const { data: memberships } = await supabase
    .from("organisation_members")
    .select("role, organisations(id, name)")
    .eq("user_id", user.id);

  const orgs = (memberships ?? []).flatMap((m) => (m.organisations ? [{ ...m.organisations, role: m.role }] : []));

  return (
    <div className="space-y-8">
      <div>
        <h1 className={h1}>Welcome{user.fullName ? `, ${user.fullName}` : ""}</h1>
        <p className={muted}>{user.email}</p>
      </div>

      {user.isPlatformAdmin && (
        <section className={card}>
          <h2 className={h2}>Inspire Media admin</h2>
          <p className="mt-1 text-sm text-slate-600">Set up organisers and give people access.</p>
          <Link href="/admin" className={`${link} mt-2 inline-block text-sm font-medium`}>Open admin →</Link>
        </section>
      )}

      {orgs.length > 0 && (
        <section className="space-y-3">
          <h2 className={h2}>Your organisations</h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {orgs.map((o) => (
              <li key={o.id} className={card}>
                <Link href={`/org/${o.id}`} className={`${link} text-lg font-semibold`}>{o.name}</Link>
                <p className={muted}>{o.role === "owner" ? "Owner" : "Staff"}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className={card}>
          <h2 className={h2}>My dancers</h2>
          <p className="mt-1 text-sm text-slate-600">Add your dancers once, then enter them in any competition.</p>
          <Link href="/dancers" className={`${link} mt-2 inline-block text-sm font-medium`}>Manage dancers →</Link>
        </div>
        <div className={card}>
          <h2 className={h2}>Enter a competition</h2>
          <p className="mt-1 text-sm text-slate-600">See which competitions are taking entries and fill your cart.</p>
          <Link href="/enter" className={`${link} mt-2 inline-block text-sm font-medium`}>Enter now →</Link>
        </div>
      </section>

      <section className={card}>
        <h2 className={h2}>My entries and receipts</h2>
        <p className="mt-1 text-sm text-slate-600">Upload music for each paid entry, and print receipts. Downloading critiques: coming soon.</p>
        <div className="mt-2 flex flex-wrap gap-4 text-sm font-medium">
          <Link href="/my-entries" className={link}>My entries and music →</Link>
          <Link href="/receipts" className={link}>My receipts →</Link>
        </div>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className={muted}>Loading…</p>}>
      <Dashboard />
    </Suspense>
  );
}
