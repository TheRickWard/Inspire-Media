"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { finishCritiqueUpload, prepareCritiqueUpload } from "@/app/critiques/actions";
import { critiqueFileProblem } from "@/lib/critiques";
import { uploadToSignedUrl } from "@/lib/upload-client";
import { buttonSmall } from "@/components/ui";

/** Organiser: add one critique recording to one entry (e.g. a missing one). */
export function CritiqueUpload({ entryId }: { entryId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function upload(file: File) {
    setMessage(null);
    const problem = critiqueFileProblem(file.name, file.size);
    if (problem) return setMessage({ kind: "error", text: problem });
    setProgress(0);
    try {
      const prep = await prepareCritiqueUpload(entryId, file.name, file.size);
      if (!prep.ok) throw new Error(prep.error);
      await uploadToSignedUrl(prep.uploadUrl, file, prep.contentType, setProgress);
      const result = await finishCritiqueUpload(entryId, prep.path, file.name, "");
      if (!result.ok) throw new Error(result.error);
      setMessage({ kind: "ok", text: result.message });
      router.refresh();
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Something went wrong. Please try again." });
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={inputRef} type="file" accept=".mp3,.m4a,.wav,.webm,audio/*" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <button type="button" className={buttonSmall} disabled={progress !== null} onClick={() => inputRef.current?.click()}>
        {progress !== null ? `Uploading… ${progress}%` : "Add critique"}
      </button>
      {message && <p role={message.kind === "error" ? "alert" : "status"} className={`text-xs font-medium ${message.kind === "error" ? "text-red-700" : "text-emerald-700"}`}>{message.text}</p>}
    </div>
  );
}
