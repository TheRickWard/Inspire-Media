import { NextResponse, type NextRequest } from "next/server";
import { paypalSettings } from "@/lib/payments/config";
import { paypalOrderIdFrom, verifyPayPalWebhook } from "@/lib/payments/webhooks";
import { confirmByProviderReference } from "@/lib/payments/webhook-handler";

// Set this address in PayPal: developer.paypal.com > Apps & Credentials > your app >
// Webhooks, for "Checkout order approved" and "Payment capture completed".
export async function POST(request: NextRequest) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();
  const settings = paypalSettings();
  if (!webhookId || !settings || !process.env.SUPABASE_SECRET_KEY?.trim()) {
    return NextResponse.json({ error: "PayPal notifications aren't set up" }, { status: 503 });
  }

  let event: unknown;
  try {
    event = await request.json();
  } catch {
    return NextResponse.json({ error: "Not JSON" }, { status: 400 });
  }
  let verified: boolean;
  try {
    verified = await verifyPayPalWebhook(settings, webhookId, request.headers, event);
  } catch (e) {
    // Couldn't reach PayPal to check: a non-200 answer makes PayPal try again later.
    console.error("PayPal webhook check failed", e);
    return NextResponse.json({ error: "Couldn't check the signature, try again" }, { status: 503 });
  }
  if (!verified) return NextResponse.json({ error: "Signature check failed" }, { status: 401 });

  const paypalOrderId = paypalOrderIdFrom(event);
  if (!paypalOrderId) return NextResponse.json({ ok: true, ignored: true });

  const result = await confirmByProviderReference("paypal", paypalOrderId);
  return NextResponse.json({ ok: true, ...result });
}
