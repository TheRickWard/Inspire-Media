import "server-only";
import type { PayPalSettings } from "./paypal";
import type { SquareSettings } from "./square";

/** Square settings from Vercel's environment variables, or null if not set up. */
export function squareSettings(): SquareSettings | null {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN?.trim();
  if (!accessToken) return null;
  return {
    accessToken,
    sandbox: process.env.SQUARE_ENVIRONMENT?.trim().toLowerCase() !== "production",
    locationId: process.env.SQUARE_LOCATION_ID?.trim() || undefined,
  };
}

/** PayPal settings from Vercel's environment variables, or null if not set up. */
export function paypalSettings(): PayPalSettings | null {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, sandbox: process.env.PAYPAL_ENVIRONMENT?.trim().toLowerCase() !== "live" };
}

/** Payments also need the server key, so the website can mark carts paid. */
export function paymentsReady() {
  const server = !!process.env.SUPABASE_SECRET_KEY?.trim();
  const square = squareSettings();
  const paypal = paypalSettings();
  return {
    square: server && !!square,
    paypal: server && !!paypal,
    testMode: (square?.sandbox ?? true) && (paypal?.sandbox ?? true),
  };
}
