export type Provider = "square" | "paypal";

export type CheckoutLine = { name: string; amountCents: number };

export type StartCheckout = {
  orderId: string;
  description: string;
  lines: CheckoutLine[];
  totalCents: number;
  /** Where Square/PayPal send the competitor back to after paying. */
  returnUrl: string;
  cancelUrl: string;
};

export type StartedCheckout = { reference: string; payUrl: string };

/** What Square/PayPal say actually happened. */
export type VerifiedPayment =
  | { paid: true; reference: string; paymentId: string; amountCents: number; receiptUrl: string }
  | { paid: false; reason: string };

export type FetchFn = typeof fetch;

/** "60.00" → 6000, without floating-point surprises. */
export function toCents(value: string): number {
  const [dollars, cents = ""] = value.split(".");
  return Number(dollars) * 100 + Number((cents + "00").slice(0, 2));
}

/** 6000 → "60.00" */
export function toDollars(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}
