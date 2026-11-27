"use client";

import { useState } from "react";
import { musicDownloadList } from "@/app/music/actions";
import { buildZip } from "@/lib/zip";

/** Organiser: download an event's (or one session's) music as one zip, in running order. */
export function MusicDownload({ eventId, sessionId, label, zipName, className }: { eventId: string; sessionId: string | null; label: string; zipName: string; className: string }) {
  const [status, setStatus] = useState<{ kind: "busy" | "ok" | "error"; text: string } | null>(null);

  async function download() {
    setStatus({ kind: "busy", text: "Getting the list…" });
    try {
      const list = await musicDownloadList(eventId, sessionId);
      if (!list.ok) throw new Error(list.error);
      if (list.files.length === 0) throw new Error("No music has been uploaded yet.");

      const files = [];
      for (const [i, f] of list.files.entries()) {
        setStatus({ kind: "busy", text: `Downloading ${i + 1} of ${list.files.length}…` });
        const res = await fetch(f.url);
        if (!res.ok) throw new Error(`Couldn't download "${f.name}". Please try again.`);
        files.push({ name: f.name, data: new Uint8Array(await res.arrayBuffer()) });
      }

      const blob = new Blob(buildZip(files) as BlobPart[], { type: "application/zip" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = zipName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
      setStatus({
        kind: "ok",
        text: `Saved ${files.length} ${files.length === 1 ? "track" : "tracks"}${list.missing ? `. ${list.missing} ${list.missing === 1 ? "entry has" : "entries have"} no music yet` : ""}.`,
      });
    } catch (e) {
      setStatus({ kind: "error", text: e instanceof Error ? e.message : "Something went wrong. Please try again." });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={className} disabled={status?.kind === "busy"} onClick={download}>
        {label}
      </button>
      {status && (
        <p role={status.kind === "error" ? "alert" : "status"} className={`text-xs font-medium ${status.kind === "error" ? "text-red-700" : status.kind === "ok" ? "text-emerald-700" : "text-slate-600"}`}>
          {status.text}
        </p>
      )}
    </div>
  );
}
