import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
import { ActionForm } from "@/components/ActionForm";
import { ageOn, describeAges, formatDate, formatDateRange, formatMoney, todayInSydney } from "@/lib/format";
import { button, buttonSmall, card, h1, h2, input, label, link, muted } from "@/components/ui";
import { entriesStatus } from "@/lib/entries";
import { addStudioEntryToCart, addToCart, removeFromCart } from "../actions";

function dancerRule(min: number, max: number | null) {
  if (max === 1) return "Solo";
  if (max != null && min === max) return `${min} dancers`;
  if (max != null) return `${min}–${max} dancers`;
  return min > 1 ? `${min}+ dancers` : "";
}

async function EnterEvent({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await requireUser();
  const supabase = await createSupabase();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, venue_name, starts_on, ends_on, entries_open_on, entries_close_on, entries_override, age_as_at, status")
    .eq("id", eventId)
    .eq("status", "published")
    .maybeSingle();
  if (!event) notFound();

  const today = todayInSydney();
  const { open, message } = entriesStatus(event, today);
  const ageDate = event.age_as_at ?? event.starts_on;

  const [{ data: sections }, { data: dancers }, { data: order }] = await Promise.all([
    supabase.from("sections").select("id, code, name, entry_fee_cents, min_age, max_age, min_dancers, max_dancers").eq("event_id", eventId).order("position"),
    supabase.from("dancers").select("id, full_name, date_of_birth").eq("owner_id", user.id).order("full_name"),
    supabase.from("orders").select("id, total_cents, order_items(id, section_id, dancer_ids, studio_name, fee_cents)").eq("event_id", eventId).eq("user_id", user.id).eq("status", "open").maybeSingle(),
  ]);

  const sectionById = new Map((sections ?? []).map((s) => [s.id, s]));
  const dancerById = new Map((dancers ?? []).map((d) => [d.id, d]));
  const items = order?.order_items ?? [];
  const lastStudio = [...items].reverse().find((i) => i.studio_name)?.studio_name ?? "";

  const sectionPicker = (
    <label className="block">
      <span className={label}>Section</span>
      <select name="section_id" required className={input}>
        {(sections ?? []).map((s) => (
          <option key={s.id} value={s.id}>
            {s.code} – {s.name} ({formatMoney(s.entry_fee_cents)})
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-6">
      <div>
        <p className={muted}><Link href="/enter" className={link}>Enter a competition</Link> /</p>
        <h1 className={h1}>{event.name}</h1>
        <p className="text-sm text-slate-700">{formatDateRange(event.starts_on, event.ends_on)}{event.venue_name && ` · ${event.venue_name}`}</p>
        <p className={muted}>Ages are worked out as at {formatDate(ageDate)}.</p>
      </div>

      {!open && (
        <div className={`${card} border-amber-200 bg-amber-50`}>
          <p className="text-sm text-amber-900">
            {message}.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {open && (
            <section className={card}>
              <h2 className={`${h2} mb-1`}>Enter your dancers</h2>
              <p className={`${muted} mb-3`}>For parents, and studios who want ages checked for each dancer.</p>
              {(dancers ?? []).length === 0 ? (
                <p className="text-sm">First, <Link href="/dancers" className={link}>add your dancers</Link>. Then come back here to enter them.</p>
              ) : (
                <ActionForm action={addToCart} submitLabel="Add to cart" pendingLabel="Adding…">
                  {sectionPicker}
                  <fieldset>
                    <legend className={label}>Dancer(s)</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(dancers ?? []).map((d) => (
                        <label key={d.id} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
                          <input type="checkbox" name="dancer_ids" value={d.id} className="h-4 w-4 accent-brand-purple" />
                          <span>{d.full_name} <span className="text-slate-500">(age {ageOn(d.date_of_birth, ageDate)})</span></span>
                        </label>
                      ))}
                    </div>
                    <p className={`${muted} mt-1`}><Link href="/dancers" className={link}>Add another dancer</Link></p>
                  </fieldset>
                </ActionForm>
              )}
            </section>
          )}

          {open && (
            <section className={card}>
              <h2 className={`${h2} mb-1`}>Studio entry</h2>
              <p className={`${muted} mb-3`}>For dance studios: only the studio name is needed. No dancer details are stored.</p>
              <ActionForm action={addStudioEntryToCart} submitLabel="Add to cart" pendingLabel="Adding…">
                {sectionPicker}
                <label className="block">
                  <span className={label}>Studio name</span>
                  <input name="studio_name" required maxLength={200} defaultValue={lastStudio} className={input} />
                </label>
              </ActionForm>
            </section>
          )}

          <section className={card}>
            <h2 className={`${h2} mb-2`}>Sections</h2>
            <ul className="divide-y divide-slate-100 text-sm">
              {(sections ?? []).map((s) => (
                <li key={s.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>{s.code} – {s.name}</span>
                  <span className="text-slate-500">
                    {[describeAges(s.min_age, s.max_age), dancerRule(s.min_dancers, s.max_dancers), formatMoney(s.entry_fee_cents)].filter(Boolean).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className={`${card} h-fit space-y-3`}>
          <h2 className={h2}>Your cart</h2>
          {items.length === 0 && <p className={muted}>Nothing in your cart yet.</p>}
          <ul className="divide-y divide-slate-100 text-sm">
            {items.map((i) => {
              const s = sectionById.get(i.section_id);
              return (
                <li key={i.id} className="space-y-1 py-2">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{s ? `${s.code} – ${s.name}` : "Section"}</span>
                    <span>{formatMoney(i.fee_cents)}</span>
                  </div>
                  <p className="text-slate-600">
                    {i.studio_name ? `Studio entry: ${i.studio_name}` : i.dancer_ids.map((id) => dancerById.get(id)?.full_name ?? "Dancer").join(" & ")}
                  </p>
                  <ActionForm action={removeFromCart.bind(null, i.id)} submitLabel="Remove" pendingLabel="…" className="" buttonClassName={buttonSmall} />
                </li>
              );
            })}
          </ul>
          {items.length > 0 && (
            <>
              <div className="flex justify-between border-t border-slate-200 pt-3 font-semibold">
                <span>Total</span>
                <span>{formatMoney(order?.total_cents ?? 0)}</span>
              </div>
              <button type="button" className={`${button} w-full`} disabled>
                Pay with Square
              </button>
              <p className={muted}>Online payment: coming soon. Your cart is saved, and entries are confirmed once paid.</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function EnterEventPage({ params }: PageProps<"/enter/[eventId]">) {
  return (
    <Suspense fallback={<p className={muted}>Loading…</p>}>
      <EnterEvent params={params} />
    </Suspense>
  );
}
