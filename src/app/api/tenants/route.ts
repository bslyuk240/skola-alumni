import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  tenants,
  tenantMemberships,
  roleAssignments,
  systemRoles,
  subscriptions,
  subscriptionPlans,
  tenantInvites,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getPlatformSettings } from "@/lib/platform-settings";
import { handleApiError } from "@/lib/api-error";
import { generateInviteToken, inviteUrl } from "@/lib/invites";

const onboardTenantSchema = z.object({
  name: z.string().min(2).max(255),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens only"),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    const body = onboardTenantSchema.parse(await req.json());

    const existingSlug = await db.query.tenants.findFirst({ where: eq(tenants.slug, body.slug) });
    if (existingSlug) {
      return NextResponse.json({ error: "That workspace URL is already taken" }, { status: 409 });
    }

    const [presidentRole, starterPlan] = await Promise.all([
      db.query.systemRoles.findFirst({ where: eq(systemRoles.name, "President/School Owner") }),
      db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.name, "Starter") }),
    ]);

    if (!presidentRole || !starterPlan) {
      return NextResponse.json(
        { error: "Platform not fully configured. Run the database seed script." },
        { status: 500 }
      );
    }

    const platformSettings = await getPlatformSettings();
    const now = new Date();
    const trialEnd = new Date(now.getTime() + platformSettings.trialDays * 24 * 60 * 60 * 1000);

    const result = await db.transaction(async (tx) => {
      const [tenant] = await tx
        .insert(tenants)
        .values({ name: body.name, slug: body.slug, createdBy: user.id })
        .returning();

      const [membership] = await tx
        .insert(tenantMemberships)
        .values({
          tenantId: tenant.id,
          userId: user.id,
          status: "APPROVED",
          approvedBy: user.id,
          approvedAt: now,
        })
        .returning();

      await tx.insert(roleAssignments).values({
        tenantMembershipId: membership.id,
        systemRoleId: presidentRole.id,
        assignedBy: user.id,
      });

      await tx.insert(subscriptions).values({
        tenantId: tenant.id,
        planId: starterPlan.id,
        status: "TRIALING",
        billingCycle: "TRIAL",
        trialEnd,
        currentPeriodEnd: trialEnd,
      });

      const [invite] = await tx
        .insert(tenantInvites)
        .values({
          tenantId: tenant.id,
          token: generateInviteToken(),
          createdBy: user.id,
          isActive: true,
        })
        .returning();

      return { tenant, invite };
    });

    return NextResponse.json(
      {
        id: result.tenant.id,
        slug: result.tenant.slug,
        status: "TRIALING",
        inviteToken: result.invite.token,
        inviteUrl: inviteUrl(result.invite.token),
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
