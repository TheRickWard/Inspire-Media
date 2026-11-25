"use client";

import { useState, useTransition } from "react";
import { moveEntry, setEntryStatus } from "@/app/org/program-actions";
import { buttonSmall } from "@/components/ui";

/** Up / down / scratch buttons for one item in the program. */
export function EntryControls({
  entryId,
  status,
  isFirst,
  isLast,
}: {
  entryId: string;
  status: "entered" | "scratched";
  isFirst: boolean;
  isLast: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error?: string } | null>) =>
    startTransition(async () => {
      const result = await fn();
      setError(result?.error ?? null);
    });

  return (
    <div className="flex items-center gap-1">
      <button type="button" className={buttonSmall} disabled={pending || isFirst} onClick={() => run(() => moveEntry(entryId, "up"))} aria-label="Move up" title="Move up">
        ↑
      </button>
      <button type="button" className={buttonSmall} disabled={pending || isLast} onClick={() => run(() => moveEntry(entryId, "down"))} aria-label="Move down" title="Move down">
        ↓
      </button>
      <button
        type="button"
        className={buttonSmall}
        disabled={pending}
        onClick={() => run(() => setEntryStatus(entryId, status === "scratched" ? "entered" : "scratched"))}
      >
        {status === "scratched" ? "Reinstate" : "Scratch"}
      </button>
      {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
