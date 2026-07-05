import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions, subscriptionPlans } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { handleApiError } from "@/lib/api-error";

const updatePlanSchema = z.object({
  planName: z.enum(["Starter", "Growth", "Association"]),
});

/**
 * Onboarding wizard step 3: choose/confirm a tier while still inside the trial window.
 * Does not process payment — actual Paystack billing is wired up in a later phase.
 */
export async function PATCH(
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

    const body = updatePlanSchema.parse(await req.json());

    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.name, body.planName),
    });
    if (!plan) {
      return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
    }

    const [updated] = await db
      .update(subscriptions)
      .set({ planId: plan.id, updatedAt: new Date() })
      .where(eq(subscriptions.tenantId, authorized.tenant.id))
      .returning();

    return NextResponse.json({ tenantId: updated.tenantId, planId: updated.planId, status: updated.status });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(
  _req: NextRequest,
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

    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.tenantId, authorized.tenant.id),
    });
    if (!subscription) {
      return NextResponse.json({ error: "No subscription found" }, { status: 404 });
    }

    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, subscription.planId),
    });

    return NextResponse.json({
      status: subscription.status,
      trialEnd: subscription.trialEnd,
      plan: plan ? { name: plan.name, memberLimit: plan.memberLimit } : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
