import "server-only";
import type { createSupabase } from "@/lib/supabase/server";
import { contactsFor } from "@/lib/contacts";
import { toCsv } from "@/lib/reports";

type Supabase = Awaited<ReturnType<typeof createSupabase>>;

const providerName: Record<string, string> = { square: "Square", paypal: "PayPal" };
const money = (cents: number) => (cents / 100).toFixed(2);

/**
 * Everything the Reports tab and its downloads need, for an event the signed-in
 * person organises (check that first). Dates of birth are deliberately left out.
 */
export async function loadReportData(supabase: Supabase, eventId: string) {
  const [{ data: entries }, { data: orders }] = await Promise.all([
    supabase
      .from("entries")
      .select(
        "id, item_number, performer_name, studio_name, status, is_late_entry, position, entered_by, sections(code, name, genre, age_group, position, event_sessions(name)), entry_music(entry_id), entry_critiques(id)",
      )
      .eq("event_id", eventId)
      .order("position"),
    supabase
      .from("orders")
      .select("id, user_id, receipt_number, paid_at, paid_amount_cents, total_cents, payment_provider, payment_reference, order_items(entry_id, fee_cents)")
      .eq("event_id", eventId)
      .eq("status", "paid")
      .order("paid_at"),
  ]);

  const paid = orders ?? [];
  const { data: refundRows } = await supabase.from("refunds").select("order_id, amount_cents").eq("event_id", eventId).eq("status", "refunded");
  const refundedBy = new Map<string, number>();
  for (const r of refundRows ?? []) refundedBy.set(r.order_id, (refundedBy.get(r.order_id) ?? 0) + r.amount_cents);
  const contacts = await contactsFor([...(entries ?? []).map((e) => e.entered_by ?? ""), ...paid.map((o) => o.user_id)]);
  const paidFor = new Map<string, { receipt: string; fee: number }>();
  for (const o of paid) for (const i of o.order_items) if (i.entry_id) paidFor.set(i.entry_id, { receipt: o.receipt_number ?? "", fee: i.fee_cents });

  const rows = (entries ?? []).map((e) => {
    const who = e.entered_by ? contacts.get(e.entered_by) : undefined;
    const pay = paidFor.get(e.id);
    return {
      id: e.id,
      item: e.item_number ?? "",
      session: e.sections?.event_sessions?.name ?? "",
      sectionCode: e.sections?.code ?? "",
      sectionName: e.sections?.name ?? "",
      sectionPosition: e.sections?.position ?? 0,
      genre: e.sections?.genre ?? "",
      ageGroup: e.sections?.age_group ?? "",
      performer: e.performer_name,
      studio: e.studio_name.trim(),
      scratched: e.status === "scratched",
      late: e.is_late_entry,
      online: !!e.entered_by,
      accountName: who?.name ?? "",
      accountEmail: who?.email ?? "",
      receipt: pay?.receipt ?? "",
      feeCents: pay?.fee ?? 0,
      music: !!e.entry_music,
      critiques: e.entry_critiques.length,
    };
  });

  const payments = paid.map((o) => {
    const who = contacts.get(o.user_id);
    return {
      receipt: o.receipt_number ?? "",
      paidAt: o.paid_at ?? "",
      name: who?.name ?? "",
      email: who?.email ?? "",
      method: providerName[o.payment_provider ?? ""] ?? o.payment_provider ?? "",
      reference: o.payment_reference ?? "",
      entries: o.order_items.length,
      amountCents: o.paid_amount_cents ?? o.total_cents,
      refundedCents: refundedBy.get(o.id) ?? 0,
    };
  });

  return { rows, payments };
}

export type ReportData = Awaited<ReturnType<typeof loadReportData>>;

/** Entries and fees per studio ("No studio" for entries without one), busiest first. */
export function studioTotals(rows: ReportData["rows"]) {
  const map = new Map<string, { studio: string; entries: number; scratched: number; feesCents: number }>();
  for (const r of rows) {
    const key = r.studio || "No studio";
    const t = map.get(key) ?? { studio: key, entries: 0, scratched: 0, feesCents: 0 };
    if (r.scratched) t.scratched += 1;
    else t.entries += 1;
    t.feesCents += r.feeCents;
    map.set(key, t);
  }
  return [...map.values()].sort((a, b) => b.entries - a.entries || a.studio.localeCompare(b.studio));
}

/** Entries, music and critiques per section, in program order. */
export function sectionTotals(rows: ReportData["rows"]) {
  const map = new Map<string, { code: string; name: string; session: string; position: number; entries: number; music: number; critiques: number }>();
  for (const r of rows) {
    if (r.scratched) continue;
    const t = map.get(r.sectionCode) ?? { code: r.sectionCode, name: r.sectionName, session: r.session, position: r.sectionPosition, entries: 0, music: 0, critiques: 0 };
    t.entries += 1;
    if (r.music) t.music += 1;
    if (r.critiques > 0) t.critiques += 1;
    map.set(r.sectionCode, t);
  }
  return [...map.values()];
}

export const REPORTS = {
  entries: "Every entry, with who entered it, receipt, fee, and whether music and a critique are in",
  studios: "Entries and fees paid per studio",
  payments: "Every payment with its receipt number",
} as const;
export type ReportKey = keyof typeof REPORTS;

export function reportCsv(report: ReportKey, data: ReportData): string {
  if (report === "studios") {
    return toCsv(
      ["Studio", "Entries", "Scratched", "Fees paid ($)"],
      studioTotals(data.rows).map((t) => [t.studio, t.entries, t.scratched, money(t.feesCents)]),
    );
  }
  if (report === "payments") {
    return toCsv(
      ["Receipt", "Paid at", "Paid by", "Email", "Method", "Reference", "Entries", "Amount ($)", "Refunded ($)", "Net ($)"],
      data.payments.map((p) => [p.receipt, p.paidAt ? new Date(p.paidAt).toLocaleString("en-AU", { timeZone: "Australia/Sydney" }) : "", p.name, p.email, p.method, p.reference, p.entries, money(p.amountCents), p.refundedCents ? money(p.refundedCents) : "", money(p.amountCents - p.refundedCents)]),
    );
  }
  return toCsv(
    ["Item", "Session", "Section", "Section name", "Genre", "Age group", "Performer", "Studio", "Status", "Late entry", "Entered by", "Email", "Receipt", "Fee ($)", "Music", "Critiques"],
    data.rows.map((r) => [
      r.item, r.session, r.sectionCode, r.sectionName, r.genre, r.ageGroup, r.performer, r.studio,
      r.scratched ? "Scratched" : "Entered", r.late ? "Yes" : "", r.online ? r.accountName || r.accountEmail : "Organiser (imported)", r.accountEmail,
      r.receipt, r.feeCents ? money(r.feeCents) : "", r.music ? "Yes" : "Missing", r.critiques || "",
    ]),
  );
}
