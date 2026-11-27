"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { paymentStatus, startCheckout } from "@/app/enter/checkout-actions";
import { button, buttonSmall } from "@/components/ui";
import type { Provider } from "@/lib/payments/types";

const NAMES: Record<Provider, string> = { square: "Square", paypal: "PayPal" };

/**
 * Pay buttons. The payment page opens in a new tab, and this tab keeps checking
 * until the payment is confirmed, then shows the receipt.
 */
export function CheckoutButtons({ square, paypal }: { square: boolean; paypal: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<{ orderId: string; provider: Provider; payUrl: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function pay(provider: Provider) {
    setError(null);
    setBusy(provider);
    // Open the tab straight away (browsers block tabs opened later), then point it at the payment page.
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    if (tab) tab.document.write(`<p style="font-family:sans-serif;padding:2rem">Opening ${NAMES[provider]}…</p>`);
    const result = await startCheckout(provider);
    setBusy(null);
    if (!result.payUrl || !result.orderId) {
      tab?.close();
      setError(result.error ?? "We couldn't start the payment. Please try again.");
      return;
    }
    if (!tab) {
      // Pop-ups blocked: use this tab instead.
      window.location.href = result.payUrl;
      return;
    }
    tab.location.href = result.payUrl;
    setWaiting({ orderId: result.orderId, provider, payUrl: result.payUrl });
  }

  // While the payment tab is open, check every 5 seconds (for up to 30 minutes).
  useEffect(() => {
    if (!waiting) return;
    let tries = 0;
    let stopped = false;
    const check = async () => {
      if (stopped) return;
      const status = await paymentStatus(waiting.orderId).catch(() => ({ paid: false, receiptOrderId: undefined }));
      if (stopped) return;
      if (status.paid && status.receiptOrderId) {
        router.push(`/receipts/${status.receiptOrderId}?new=1`);
        return;
      }
      if (++tries < 360) timer.current = setTimeout(check, 5000);
    };
    timer.current = setTimeout(check, 5000);
    return () => {
      stopped = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [waiting, router]);

  if (waiting) {
    return (
      <div className="space-y-2 rounded-md border border-brand-purple/30 bg-brand-purple/5 p-3 text-sm" role="status">
        <p className="font-medium text-brand-ink">{NAMES[waiting.provider]} has opened in a new tab.</p>
        <p className="text-slate-700">Finish paying there. This page will show your receipt as soon as the payment is confirmed. You can close the {NAMES[waiting.provider]} tab afterwards.</p>
        <p className="animate-pulse text-xs text-slate-500">Waiting for payment…</p>
        <div className="flex flex-wrap gap-2">
          <a href={waiting.payUrl} target="_blank" rel="noopener" className={buttonSmall}>Open {NAMES[waiting.provider]} again</a>
          <button type="button" className={buttonSmall} onClick={() => setWaiting(null)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {square && (
        <button type="button" className={`${button} w-full`} disabled={busy !== null} onClick={() => pay("square")}>
          {busy === "square" ? "Opening Square…" : "Pay by card with Square"}
        </button>
      )}
      {paypal && (
        <button type="button" className={`${button} w-full`} disabled={busy !== null} onClick={() => pay("paypal")}>
          {busy === "paypal" ? "Opening PayPal…" : "Pay with PayPal"}
        </button>
      )}
      {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
      <p className="text-xs text-slate-500">Payment opens in a new tab.</p>
    </div>
  );
}
