/** Shared helpers for the printable program and the organiser's reports. */

export type ProgramEntry = {
  item_number: string | null;
  performer_name: string;
  studio_name: string;
  status: string;
  position: number;
  sections: {
    code: string;
    name: string;
    position: number;
    event_sessions: { id: string; name: string; session_date: string | null; starts_at: string | null; position: number } | null;
  } | null;
};

export type ProgramSection = { code: string; name: string; entries: ProgramEntry[] };
export type ProgramSession = { key: string; name: string; date: string | null; startsAt: string | null; sections: ProgramSection[] };

/**
 * Group the running order into sessions, then sections, for printing.
 * Scratched entries are left out. Sessions follow their set order (sections
 * without a session go last); within a session everything keeps running order.
 */
export function groupProgram(entries: ProgramEntry[]): ProgramSession[] {
  const live = entries.filter((e) => e.status !== "scratched" && e.sections).sort((a, b) => a.position - b.position);
  const sessions = new Map<string, ProgramSession>();
  const order = new Map<string, number>();
  for (const e of live) {
    const s = e.sections!.event_sessions;
    const key = s?.id ?? "none";
    let session = sessions.get(key);
    if (!session) {
      session = { key, name: s?.name ?? "Other sections", date: s?.session_date ?? null, startsAt: s?.starts_at ?? null, sections: [] };
      sessions.set(key, session);
      order.set(key, s ? s.position : Number.MAX_SAFE_INTEGER);
    }
    const last = session.sections.at(-1);
    if (last && last.code === e.sections!.code) last.entries.push(e);
    else session.sections.push({ code: e.sections!.code, name: e.sections!.name, entries: [e] });
  }
  return [...sessions.values()].sort((a, b) => order.get(a.key)! - order.get(b.key)!);
}

/** "09:30:00" -> "9:30 am" */
export function formatTime(value: string | null): string {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/**
 * A CSV file that opens cleanly in Excel: quoted where needed, Windows line
 * endings, a byte-order mark so accents survive, and cells that start with
 * = + - @ made safe so a spreadsheet won't run them as formulas.
 */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    let s = v == null ? "" : String(v);
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** "Inspire Sydney Dance Eisteddfod 2027" + "entries" -> "Inspire-Sydney-Dance-Eisteddfod-2027-entries.csv" */
export function reportFileName(eventName: string, report: string): string {
  return `${eventName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "event"}-${report}.csv`;
}
