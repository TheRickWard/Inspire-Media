"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { importProgram } from "@/app/org/program-actions";
import { parseProgramCsv, PROGRAM_COLUMNS, type ParsedProgram } from "@/lib/program-csv";
import { button, input, link, muted } from "@/components/ui";

export function ProgramImporter({ eventId, programHref }: { eventId: string; programHref: string }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ParsedProgram | null>(null);
  const [message, setMessage] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [inputKey, setInputKey] = useState(0);

  async function onFile(file: File | undefined) {
    setMessage(null);
    if (!file) return;
    setFileName(file.name);
    setResult(parseProgramCsv(await file.text()));
  }

  function onImport() {
    if (!result) return;
    startTransition(async () => {
      const res = await importProgram(eventId, result.rows);
      setMessage(res ?? null);
      if (res?.ok) {
        setResult(null);
        setInputKey((k) => k + 1); // clear the file picker
      }
    });
  }

  const canImport = result && result.missingColumns.length === 0 && result.errors.length === 0 && result.rows.length > 0;
  const sections = result ? new Set(result.rows.map((r) => r.section_code)).size : 0;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="csv" className="mb-1 block text-sm font-medium text-slate-700">Program CSV file</label>
        <input key={inputKey} id="csv" type="file" accept=".csv,text/csv" className={input} onChange={(e) => onFile(e.target.files?.[0])} />
      </div>

      {result && result.missingColumns.length > 0 && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {fileName} is missing these columns: {result.missingColumns.join(", ")}.
        </p>
      )}

      {result && result.errors.length > 0 && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">Fix these rows in the spreadsheet, then choose the file again:</p>
          <ul className="mt-1 list-disc pl-5">
            {result.errors.slice(0, 20).map((e) => <li key={e.line}>Row {e.line}: {e.message}</li>)}
          </ul>
          {result.errors.length > 20 && <p className="mt-1">…and {result.errors.length - 20} more.</p>}
        </div>
      )}

      {result && result.rows.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm">
            Ready to import <strong>{result.rows.length} items</strong> in <strong>{sections} sections</strong>. First rows:
          </p>
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>{PROGRAM_COLUMNS.map((c) => <th key={c.key} className="px-2 py-1 font-medium">{c.label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.rows.slice(0, 8).map((r) => (
                  <tr key={r.item_number}>{PROGRAM_COLUMNS.map((c) => <td key={c.key} className="px-2 py-1">{r[c.key]}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={button} disabled={!canImport || pending} onClick={onImport}>
          {pending ? "Importing…" : "Import program"}
        </button>
        {message?.error && <p role="alert" className="text-sm font-medium text-red-700">{message.error}</p>}
        {message?.ok && (
          <p role="status" className="text-sm font-medium text-emerald-700">
            {message.ok} <Link href={programHref} className={link}>View the program</Link>
          </p>
        )}
      </div>
      <p className={muted}>Items are added after anything already in the program. Item numbers that already exist are refused, so nothing is doubled up.</p>
    </div>
  );
}
