import { formatDate } from "./format";

export type EntriesOverride = "auto" | "open" | "closed";

type EventDates = {
  entries_open_on: string | null;
  entries_close_on: string | null;
  entries_override: string;
};

/** Whether an event is taking entries today, matching the database's entries_are_open(). */
export function entriesStatus(e: EventDates, today: string): { open: boolean; message: string } {
  if (e.entries_override === "open") return { open: true, message: "Entries are open" };
  if (e.entries_override === "closed") return { open: false, message: "Entries are closed" };
  if (e.entries_open_on && e.entries_close_on && e.entries_open_on <= today && today <= e.entries_close_on) {
    return { open: true, message: `Entries open until ${formatDate(e.entries_close_on)}` };
  }
  if (e.entries_open_on && today < e.entries_open_on) return { open: false, message: `Entries open ${formatDate(e.entries_open_on)}` };
  if (e.entries_close_on && today > e.entries_close_on) return { open: false, message: "Entries have closed" };
  return { open: false, message: "Entry dates to be announced" };
}
