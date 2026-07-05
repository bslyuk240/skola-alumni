import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptionPlans } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { initializePaystackTransaction } from "@/lib/paystack";
import { env } from "@/config/env";
import { handleApiError } from "@/lib/api-error";

const checkoutSchema = z.object({
  planName: z.enum(["Starter", "Growth", "Association"]),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]),
});

/** Initializes a Paystack Standard Checkout transaction for a tenant's SaaS subscription. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  try {
    const { tenantSlug } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, [
      "President/School Owner",
    ]);
    if (!authorized) {
      return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
    }

    const body = checkoutSchema.parse(await req.json());

    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.name, body.planName),
    });
    if (!plan) {
      return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
    }

    const naira = Number(body.billingCycle === "YEARLY" ? plan.priceYearly : plan.priceMonthly);
    const amountKobo = Math.round(naira * 100);

    const { authorization_url: authorizationUrl } = await initializePaystackTransaction({
      email: user.email,
      amountKobo,
      callbackUrl: `${env.NEXT_PUBLIC_APP_URL}/${tenantSlug}/admin/billing/callback`,
      metadata: {
        tenantId: authorized.tenant.id,
        tenantSlug,
        planName: plan.name,
        billingCycle: body.billingCycle,
      },
    });

    return NextResponse.json({ authorizationUrl });
  } catch (error) {
    return handleApiError(error);
  }
}
