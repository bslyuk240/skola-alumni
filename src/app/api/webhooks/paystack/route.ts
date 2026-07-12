import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { getPaystackEnv } from "@/config/env";
import { applySubscriptionPayment } from "@/lib/apply-subscription-payment";
import { parsePaystackMetadata } from "@/lib/paystack-metadata";

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
 * Backup path for activating a subscription — the checkout callback page is the primary path in
 * local dev (Paystack can't reach localhost without a tunnel). Both call applySubscriptionPayment.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!isValidPaystackSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === "charge.success") {
    const metadata = parsePaystackMetadata(event.data?.metadata);
    let tenantId = metadata.tenantId;

    if (!tenantId && metadata.tenantSlug) {
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.slug, metadata.tenantSlug),
      });
      tenantId = tenant?.id;
    }

    if (tenantId && metadata.planName && metadata.billingCycle) {
      try {
        await applySubscriptionPayment({
          tenantId,
          planName: metadata.planName,
          billingCycle: metadata.billingCycle,
          paystackReference: event.data.reference,
        });
      } catch (error) {
        console.error("[paystack webhook] Failed to apply subscription payment:", error);
        return NextResponse.json({ error: "Failed to apply payment" }, { status: 500 });
      }
    } else {
      console.error("[paystack webhook] charge.success missing metadata", {
        reference: event.data?.reference,
        metadata: event.data?.metadata,
        parsed: metadata,
      });
    }
  }

  return NextResponse.json({ received: true });
}
