import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptionPlans, auditLogs } from "@/db/schema";
import { getPlatformAdminUser } from "@/lib/platform-access";
import { handleApiError } from "@/lib/api-error";

const updatePlanSchema = z.object({
  memberLimit: z.number().int().positive(),
  priceMonthly: z.number().nonnegative(),
  priceYearly: z.number().nonnegative(),
});

/** Platform admin adjusts a subscription tier's member ceiling and pricing. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const admin = await getPlatformAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    const { planId } = await params;
    const body = updatePlanSchema.parse(await req.json());

    const before = await db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.id, planId) });
    if (!before) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(subscriptionPlans)
      .set({
        memberLimit: body.memberLimit,
        priceMonthly: body.priceMonthly.toFixed(2),
        priceYearly: body.priceYearly.toFixed(2),
      })
      .where(eq(subscriptionPlans.id, planId))
      .returning();

    await db.insert(auditLogs).values({
      actorId: admin.id,
      action: "PLAN_UPDATE",
      entityType: "subscription_plans",
      entityId: updated.id,
      payload: {
        platformAdminEmail: admin.email,
        planName: updated.name,
        before: { memberLimit: before.memberLimit, priceMonthly: before.priceMonthly, priceYearly: before.priceYearly },
        after: { memberLimit: updated.memberLimit, priceMonthly: updated.priceMonthly, priceYearly: updated.priceYearly },
      },
    });

    return NextResponse.json({ id: updated.id });
  } catch (error) {
    return handleApiError(error);
  }
}
