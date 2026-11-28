import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTime, groupProgram, reportFileName, toCsv, type ProgramEntry } from "../src/lib/reports.ts";

const morning = { id: "s1", name: "Saturday Morning", session_date: "2027-03-13", starts_at: "08:30:00", position: 0 };
const afternoon = { id: "s2", name: "Saturday Afternoon", session_date: "2027-03-13", starts_at: "13:00:00", position: 1 };
const entry = (position: number, item: string, code: string, session: typeof morning | null, status = "entered"): ProgramEntry => ({
  item_number: item,
  performer_name: `Dancer ${item}`,
  studio_name: "Studio",
  status,
  position,
  sections: { code, name: `Section ${code}`, position: Number(code), event_sessions: session },
});

test("the program is grouped by session then section, in running order, without scratched entries", () => {
  const groups = groupProgram([
    entry(4, "4", "15", afternoon),
    entry(1, "1", "12", morning),
    entry(3, "3", "12", morning, "scratched"),
    entry(2, "2", "12", morning),
    entry(5, "5", "30", null),
  ]);
  assert.deepEqual(groups.map((g) => g.name), ["Saturday Morning", "Saturday Afternoon", "Other sections"]);
  assert.deepEqual(groups[0].sections.map((s) => [s.code, s.entries.map((e) => e.item_number)]), [["12", ["1", "2"]]]);
  assert.equal(groups[1].startsAt, "13:00:00");
});

test("times read like a program", () => {
  assert.equal(formatTime("08:30:00"), "8:30 am");
  assert.equal(formatTime("13:05:00"), "1:05 pm");
  assert.equal(formatTime("12:00:00"), "12:00 pm");
  assert.equal(formatTime(null), "");
});

test("CSV files are safe to open in Excel", () => {
  const csv = toCsv(["Name", "Note"], [["Jane, Jones", 'Said "hi"'], ["=SUM(A1)", null], ["Zoë", 12]]);
  assert.equal(csv, '﻿Name,Note\r\n"Jane, Jones","Said ""hi"""\r\n\'=SUM(A1),\r\nZoë,12\r\n');
  assert.equal(reportFileName("Inspire Sydney Dance Eisteddfod 2027", "entries"), "Inspire-Sydney-Dance-Eisteddfod-2027-entries.csv");
});
