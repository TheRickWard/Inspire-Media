"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { finishMusicUpload, prepareMusicUpload } from "@/app/music/actions";
import { musicFileProblem } from "@/lib/music";
import { buttonSmall } from "@/components/ui";

/** Upload or replace the music for one entry. The file goes straight to storage, with a progress bar. */
export function MusicUpload({ entryId, hasMusic }: { entryId: string; hasMusic: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function upload(file: File) {
    setMessage(null);
    const problem = musicFileProblem(file.name, file.size);
    if (problem) return setMessage({ kind: "error", text: problem });

    setProgress(0);
    try {
      const prep = await prepareMusicUpload(entryId, file.name, file.size);
      if (!prep.ok) throw new Error(prep.error);

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", prep.uploadUrl);
        xhr.setRequestHeader("content-type", prep.contentType);
        xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("The upload was refused. Please check it's an MP3, M4A or WAV file under 20 MB.")));
        xhr.onerror = () => reject(new Error("The upload stopped. Please check your internet connection and try again."));
        xhr.send(file);
      });

      const result = await finishMusicUpload(entryId, prep.path, file.name);
      if (!result.ok) throw new Error(result.error);
      setMessage({ kind: "ok", text: `${result.message} Press play to check it's the right track.` });
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
      <input
        ref={inputRef}
        type="file"
        accept=".mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav"
        className="sr-only"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <button type="button" className={buttonSmall} disabled={progress !== null} onClick={() => inputRef.current?.click()}>
        {progress !== null ? `Uploading… ${progress}%` : hasMusic ? "Replace music" : "Upload music"}
      </button>
      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={`text-xs font-medium ${message.kind === "error" ? "text-red-700" : "text-emerald-700"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
