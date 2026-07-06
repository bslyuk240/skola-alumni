import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { tenants, donationCampaigns, donationContributions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { getAuthorizedGroupMembership } from "@/lib/group-access";
import { handleApiError } from "@/lib/api-error";

const FINANCE_ROLES = ["President/School Owner", "Finance Admin"];
const GROUP_ADMIN_ROLES = ["GROUP_OWNER", "GROUP_ADMIN"];

const verifySchema = z.object({
  action: z.enum(["CONFIRMED", "REJECTED"]),
  adminNotes: z.string().max(2000).optional(),
});

/**
 * Confirms or rejects a contribution. A contribution to a group's own campaign is verified by
 * that group's owner/admin; tenant-wide campaigns are verified by tenant finance roles.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string; contributionId: string }> }
) {
  try {
    const { tenantSlug, contributionId } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
    if (!tenant || !tenant.isActive) {
      return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
    }

    const contribution = await db.query.donationContributions.findFirst({
      where: eq(donationContributions.id, contributionId),
    });
    if (!contribution) {
      return NextResponse.json({ error: "Contribution not found" }, { status: 404 });
    }

    const campaign = await db.query.donationCampaigns.findFirst({
      where: and(eq(donationCampaigns.id, contribution.campaignId), eq(donationCampaigns.tenantId, tenant.id)),
    });
    if (!campaign) {
      return NextResponse.json({ error: "Contribution not found" }, { status: 404 });
    }

    if (campaign.groupId) {
      const groupMembership = await getAuthorizedGroupMembership(user.id, campaign.groupId, GROUP_ADMIN_ROLES);
      if (!groupMembership) {
        return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
      }
    } else {
      const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, FINANCE_ROLES);
      if (!authorized) {
        return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
      }
    }

    if (contribution.status !== "PENDING_CONFIRMATION") {
      return NextResponse.json({ error: "Contribution is not awaiting review" }, { status: 409 });
    }

    const body = verifySchema.parse(await req.json());

    const [updated] = await db
      .update(donationContributions)
      .set({
        status: body.action,
        adminNotes: body.adminNotes ?? contribution.adminNotes,
        reviewedBy: user.id,
        reviewedAt: new Date(),
      })
      .where(eq(donationContributions.id, contribution.id))
      .returning();

    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (error) {
    return handleApiError(error);
  }
}
