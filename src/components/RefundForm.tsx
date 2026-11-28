"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { buttonSecondary, input, label } from "@/components/ui";
import type { FormState } from "@/lib/form";

type Item = { id: string; label: string; feeCents: number; refunded: boolean };

const dollars = (cents: number) => (cents / 100).toFixed(2);

/** Organiser: choose entries to refund (the amount fills in), or type a part amount. */
export function RefundForm({
  action,
  items,
  remainingCents,
  providerName,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  items: Item[];
  remainingCents: number;
  providerName: string | null;
}) {
  const [chosen, setChosen] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(providerName ? "provider" : "manual");
  // After a refund goes through, start the form afresh (the success message stays).
  const [seenRemaining, setSeenRemaining] = useState(remainingCents);
  if (seenRemaining !== remainingCents) {
    setSeenRemaining(remainingCents);
    setChosen([]);
    setAmount("");
  }

  function toggle(id: string, on: boolean) {
    const next = on ? [...chosen, id] : chosen.filter((x) => x !== id);
    setChosen(next);
    const total = items.filter((i) => next.includes(i.id)).reduce((n, i) => n + i.feeCents, 0);
    setAmount(total ? dollars(Math.min(total, remainingCents)) : "");
  }

  const how = method === "manual" ? "recorded (no money will be sent)" : `sent back through ${providerName}`;
  return (
    <ActionForm
      action={action}
      submitLabel="Refund"
      pendingLabel="Refunding…"
      buttonClassName={buttonSecondary}
      confirmText={`Refund $${amount || "0.00"}? It will be ${how}. This can't be undone.`}
      className="space-y-3"
    >
      <fieldset className="space-y-1">
        <legend className={label}>Entries being refunded</legend>
        {items.map((i) => (
          <label key={i.id} className={`flex items-start gap-2 text-sm ${i.refunded ? "text-slate-400" : ""}`}>
            <input type="checkbox" name="item" value={i.id} disabled={i.refunded} checked={chosen.includes(i.id)} onChange={(e) => toggle(i.id, e.target.checked)} className="mt-1" />
            <span>
              {i.label} · ${dollars(i.feeCents)}
              {i.refunded && " (already refunded)"}
            </span>
          </label>
        ))}
        <p className="text-xs text-slate-500">Tick none for a part refund that isn&apos;t for a particular entry.</p>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="amount" className={label}>Amount (AUD)</label>
          <input id="amount" name="amount" inputMode="decimal" required className={input} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          <p className="mt-1 text-xs text-slate-500">Up to ${dollars(remainingCents)} left to refund. Lower it to keep an admin fee.</p>
        </div>
        <div>
          <label htmlFor="reason" className={label}>Reason (optional)</label>
          <input id="reason" name="reason" maxLength={200} className={input} placeholder="e.g. Injury, medical certificate supplied" />
          <p className="mt-1 text-xs text-slate-500">{providerName ? `${providerName} shows this to the payer.` : "Kept with the receipt."}</p>
        </div>
      </div>
      <fieldset className="space-y-1 text-sm">
        <legend className={label}>How</legend>
        {providerName && (
          <label className="flex items-center gap-2">
            <input type="radio" name="method" value="provider" checked={method === "provider"} onChange={() => setMethod("provider")} />
            Send the money back through {providerName} (to the card or account they paid with)
          </label>
        )}
        <label className="flex items-center gap-2">
          <input type="radio" name="method" value="manual" checked={method === "manual"} onChange={() => setMethod("manual")} />
          I&apos;ve already refunded it another way (cash or bank transfer). Just record it
        </label>
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="scratch" defaultChecked />
        Scratch the ticked entries from the program
      </label>
    </ActionForm>
  );
}
