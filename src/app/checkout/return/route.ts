import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { confirmCheckout } from "@/lib/payments/confirm";

// Square and PayPal send the competitor here after they pay. We don't trust
// anything in the address: we ask Square or PayPal directly what happened.
export async function GET(request: NextRequest) {
  const orderId = z.uuid().safeParse(request.nextUrl.searchParams.get("order")).data;
  const home = new URL("/dashboard", request.url);
  if (!orderId) return NextResponse.redirect(home);

  const result = await confirmCheckout(orderId);
  if (result.paid) return NextResponse.redirect(new URL(`/receipts/${orderId}?new=1`, request.url));

  const back = new URL("/cart", request.url);
  back.searchParams.set("payment", "pending");
  return NextResponse.redirect(back);
}
