import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPaystackEnv } from "@/config/env";
import { applySubscriptionPayment } from "@/lib/apply-subscription-payment";

function isValidPaystackSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;

  const expected = createHmac("sha512", getPaystackEnv().PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf-8");
  const signatureBuffer = Buffer.from(signature, "utf-8");

  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}

/**
 * Backup path for activating a subscription — the checkout callback page (src/app/[tenantSlug]/admin
 * /billing/callback) is the primary path in local dev, since Paystack can't reach localhost without a
 * public tunnel. Both call the same idempotent `applySubscriptionPayment` helper.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!isValidPaystackSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === "charge.success") {
    const metadata = event.data.metadata ?? {};

    if (metadata.tenantId && metadata.planName && metadata.billingCycle) {
      await applySubscriptionPayment({
        tenantId: metadata.tenantId,
        planName: metadata.planName,
        billingCycle: metadata.billingCycle,
        paystackReference: event.data.reference,
      });
    }
  }

  return NextResponse.json({ received: true });
}
