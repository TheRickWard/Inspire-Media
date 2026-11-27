import { NextResponse, type NextRequest } from "next/server";
import { squareSettings } from "@/lib/payments/config";
import { squareOrderIdFrom, verifySquareSignature } from "@/lib/payments/webhooks";
import { confirmByProviderReference } from "@/lib/payments/webhook-handler";

// Set this address in Square: Developer Console > your app > Webhooks > Subscriptions,
// for the "payment.created" and "payment.updated" events.
export async function POST(request: NextRequest) {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim();
  if (!key || !squareSettings() || !process.env.SUPABASE_SECRET_KEY?.trim()) {
    return NextResponse.json({ error: "Square notifications aren't set up" }, { status: 503 });
  }

  const raw = await request.text();
  // Square signs the exact address it sent to. Behind Vercel, rebuild it from the forwarded host.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const url = process.env.SQUARE_WEBHOOK_URL?.trim() || `${proto}://${host}${request.nextUrl.pathname}`;
  if (!verifySquareSignature(raw, request.headers.get("x-square-hmacsha256-signature"), url, key)) {
    return NextResponse.json({ error: "Signature check failed" }, { status: 401 });
  }

  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Not JSON" }, { status: 400 });
  }
  const squareOrderId = squareOrderIdFrom(event);
  if (!squareOrderId) return NextResponse.json({ ok: true, ignored: true });

  const result = await confirmByProviderReference("square", squareOrderId);
  return NextResponse.json({ ok: true, ...result });
}
