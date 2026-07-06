import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { tenants, groups, donationCampaigns } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { getAuthorizedGroupMembership } from "@/lib/group-access";
import { getBillingLockStatus } from "@/lib/billing-status";
import { handleApiError } from "@/lib/api-error";

const FINANCE_ROLES = ["President/School Owner", "Finance Admin"];
const GROUP_ADMIN_ROLES = ["GROUP_OWNER", "GROUP_ADMIN"];

const createCampaignSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  targetAmount: z.number().positive().optional(),
  groupId: z.string().uuid().optional(),
});

/**
 * Creates a donation campaign. Group-scoped campaigns are that group's own affair — its
 * owner/admin creates and runs them, not the tenant's finance roles. Tenant-wide campaigns
 * (no groupId) remain a tenant-level operation. Billing lock applies either way.
 */
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

    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
    if (!tenant || !tenant.isActive) {
      return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
    }

    const body = createCampaignSchema.parse(await req.json());

    if (body.groupId) {
      const group = await db.query.groups.findFirst({
        where: and(eq(groups.id, body.groupId), eq(groups.tenantId, tenant.id)),
      });
      if (!group || group.isArchived) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }

      const groupMembership = await getAuthorizedGroupMembership(user.id, group.id, GROUP_ADMIN_ROLES);
      if (!groupMembership) {
        return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
      }
    } else {
      const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, FINANCE_ROLES);
      if (!authorized) {
        return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
      }
    }

    const lockStatus = await getBillingLockStatus(tenant.id);
    if (lockStatus.locked) {
      return NextResponse.json({ error: lockStatus.message }, { status: 402 });
    }

    const [campaign] = await db
      .insert(donationCampaigns)
      .values({
        tenantId: tenant.id,
        groupId: body.groupId,
        title: body.title,
        description: body.description,
        targetAmount: body.targetAmount?.toFixed(2),
        createdBy: user.id,
      })
      .returning();

    return NextResponse.json({ id: campaign.id }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
