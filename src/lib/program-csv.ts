import Papa from "papaparse";
import { z } from "zod";

/**
 * The program CSV format. Column names are matched loosely
 * ("Item No", "item_number" and "Item" all work).
 */
export const PROGRAM_COLUMNS = [
  { key: "item_number", label: "Item", required: true, aliases: ["item", "item no", "item number", "item #", "itemno"] },
  { key: "section_code", label: "Section", required: true, aliases: ["section", "section no", "section number", "section code", "sec"] },
  { key: "section_name", label: "Section Name", required: false, aliases: ["section name", "section title", "category"] },
  { key: "session", label: "Session", required: false, aliases: ["session", "day", "session name"] },
  { key: "performer_name", label: "Performer", required: true, aliases: ["performer", "name", "competitor", "dancer", "performer name", "competitor name"] },
  { key: "studio_name", label: "Studio", required: false, aliases: ["studio", "school", "studio name", "dance school"] },
  { key: "routine_title", label: "Routine Title", required: false, aliases: ["routine", "title", "routine title", "song", "dance title"] },
  { key: "genre", label: "Genre", required: false, aliases: ["genre", "style", "dance genre"] },
  { key: "age_group", label: "Age Group", required: false, aliases: ["age", "age group", "age division"] },
] as const;

export type ProgramColumnKey = (typeof PROGRAM_COLUMNS)[number]["key"];

const text = z.string().trim();

export const programRowSchema = z.object({
  item_number: text.min(1, "Item number is missing").max(20, "Item number is too long"),
  section_code: text.min(1, "Section is missing").max(20, "Section is too long"),
  section_name: text.max(200).default(""),
  session: text.max(100).default(""),
  performer_name: text.min(1, "Performer name is missing").max(200),
  studio_name: text.max(200).default(""),
  routine_title: text.max(200).default(""),
  genre: text.max(100).default(""),
  age_group: text.max(100).default(""),
});

export type ProgramRow = z.infer<typeof programRowSchema>;

export type ParsedProgram = {
  rows: ProgramRow[];
  /** Problems that stop the import, with the spreadsheet row number. */
  errors: { line: number; message: string }[];
  missingColumns: string[];
};

function normalise(header: string) {
  return header.toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Work out which CSV column holds which piece of information. */
export function mapHeaders(headers: string[]): Partial<Record<ProgramColumnKey, string>> {
  const map: Partial<Record<ProgramColumnKey, string>> = {};
  for (const col of PROGRAM_COLUMNS) {
    const found = headers.find((h) => {
      const n = normalise(h);
      return n === normalise(col.key) || (col.aliases as readonly string[]).includes(n);
    });
    if (found) map[col.key] = found;
  }
  return map;
}

/** Read program CSV text and check every row. */
export function parseProgramCsv(csvText: string): ParsedProgram {
  const parsed = Papa.parse<Record<string, string>>(csvText.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
  });

  const headers = parsed.meta.fields ?? [];
  const map = mapHeaders(headers);
  const missingColumns = PROGRAM_COLUMNS.filter((c) => c.required && !map[c.key]).map((c) => c.label);
  if (missingColumns.length > 0) {
    return { rows: [], errors: [], missingColumns };
  }

  const rows: ProgramRow[] = [];
  const errors: ParsedProgram["errors"] = [];
  const seenItems = new Map<string, number>();

  parsed.data.forEach((raw, index) => {
    const line = index + 2; // +1 for the header row, +1 because spreadsheets count from 1
    const candidate: Record<string, string> = {};
    for (const col of PROGRAM_COLUMNS) {
      const header = map[col.key];
      candidate[col.key] = header ? (raw[header] ?? "") : "";
    }
    const result = programRowSchema.safeParse(candidate);
    if (!result.success) {
      errors.push({ line, message: result.error.issues.map((i) => i.message).join("; ") });
      return;
    }
    const itemKey = result.data.item_number.toLowerCase();
    const firstLine = seenItems.get(itemKey);
    if (firstLine) {
      errors.push({ line, message: `Item ${result.data.item_number} is also on row ${firstLine}` });
      return;
    }
    seenItems.set(itemKey, line);
    rows.push(result.data);
  });

  return { rows, errors, missingColumns: [] };
}

/** Program export used by the venue tools (music playback and voice critique). */
export function programToCsv(
  rows: {
    position: number;
    item_number: string;
    section_code: string;
    section_name: string;
    session: string;
    performer_name: string;
    studio_name: string;
    routine_title: string;
    genre: string;
    age_group: string;
    status: string;
    is_late_entry: boolean;
  }[],
): string {
  return Papa.unparse(
    rows.map((r) => ({
      "Running Order": r.position,
      Item: r.item_number,
      Section: r.section_code,
      "Section Name": r.section_name,
      Session: r.session,
      Performer: r.performer_name,
      Studio: r.studio_name,
      "Routine Title": r.routine_title,
      Genre: r.genre,
      "Age Group": r.age_group,
      Status: r.status,
      "Late Entry": r.is_late_entry ? "Yes" : "No",
    })),
  );
}
