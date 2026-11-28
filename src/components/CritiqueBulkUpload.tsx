"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { finishCritiqueUpload, prepareCritiqueUpload } from "@/app/critiques/actions";
import { critiqueFileProblem, itemNumberFromFileName, normaliseItemNumber } from "@/lib/critiques";
import { uploadToSignedUrl } from "@/lib/upload-client";
import { button, buttonSecondary, input, label } from "@/components/ui";

type Entry = { id: string; item_number: string | null; performer_name: string };
type Row = { file: File; entry: Entry | null; problem: string | null; status: "waiting" | "uploading" | "done" | "error"; note?: string };

/** Organiser: choose many recordings at once; each is matched to an entry by the item number in its file name. */
export function CritiqueBulkUpload({ entries }: { entries: Entry[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [adjudicator, setAdjudicator] = useState("");
  const [running, setRunning] = useState(false);

  const byNumber = useMemo(() => {
    const m = new Map<string, Entry>();
    for (const e of entries) if (e.item_number) m.set(normaliseItemNumber(e.item_number), e);
    return m;
  }, [entries]);

  function choose(files: FileList) {
    const list = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    setRows(
      list.map((file) => {
        const bad = critiqueFileProblem(file.name, file.size);
        const num = itemNumberFromFileName(file.name);
        const entry = num ? byNumber.get(num) ?? null : null;
        return {
          file,
          entry,
          problem: bad ?? (num ? (entry ? null : `No entry with item number ${num}`) : "No item number in the file name"),
          status: "waiting",
        };
      }),
    );
  }

  async function uploadAll() {
    setRunning(true);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.problem || !r.entry || r.status === "done") continue;
      setRows((prev) => prev.map((x, j) => (j === i ? { ...x, status: "uploading" } : x)));
      try {
        const prep = await prepareCritiqueUpload(r.entry.id, r.file.name, r.file.size);
        if (!prep.ok) throw new Error(prep.error);
        await uploadToSignedUrl(prep.uploadUrl, r.file, prep.contentType);
        const result = await finishCritiqueUpload(r.entry.id, prep.path, r.file.name, adjudicator);
        if (!result.ok) throw new Error(result.error);
        setRows((prev) => prev.map((x, j) => (j === i ? { ...x, status: "done" } : x)));
      } catch (e) {
        setRows((prev) => prev.map((x, j) => (j === i ? { ...x, status: "error", note: e instanceof Error ? e.message : "Failed" } : x)));
      }
    }
    setRunning(false);
    router.refresh();
  }

  const ready = rows.filter((r) => !r.problem && r.status !== "done").length;
  const doneCount = rows.filter((r) => r.status === "done").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className={label}>Adjudicator (optional)</span>
          <input className={input} value={adjudicator} onChange={(e) => setAdjudicator(e.target.value)} placeholder="e.g. Ms Smith" disabled={running} />
        </label>
        <input ref={inputRef} type="file" multiple accept=".mp3,.m4a,.wav,.webm,audio/*" className="sr-only" onChange={(e) => e.target.files && choose(e.target.files)} />
        <button type="button" className={buttonSecondary} disabled={running} onClick={() => inputRef.current?.click()}>Choose recordings…</button>
      </div>

      {rows.length > 0 && (
        <>
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200 text-sm">
            {rows.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0 truncate" title={r.file.name}>{r.file.name}</span>
                <span className={`text-xs font-medium ${r.problem || r.status === "error" ? "text-red-700" : r.status === "done" ? "text-emerald-700" : "text-slate-600"}`}>
                  {r.problem
                    ? r.problem
                    : r.status === "done"
                      ? `✓ Item ${r.entry!.item_number} – ${r.entry!.performer_name}`
                      : r.status === "uploading"
                        ? "Uploading…"
                        : r.status === "error"
                          ? r.note
                          : `→ Item ${r.entry!.item_number} – ${r.entry!.performer_name}`}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={button} disabled={running || ready === 0} onClick={uploadAll}>
              {running ? "Uploading…" : `Upload ${ready} ${ready === 1 ? "critique" : "critiques"}`}
            </button>
            {doneCount > 0 && !running && <p role="status" className="text-sm font-medium text-emerald-700">{doneCount} uploaded.</p>}
            {rows.some((r) => r.problem) && <p className="text-xs text-slate-500">Files marked in red are skipped. Rename them to start with the item number, or add them one at a time below.</p>}
          </div>
        </>
      )}
    </div>
  );
}
