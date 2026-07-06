import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { tenants, donationCampaigns, donationContributions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getApprovedTenantMembership } from "@/lib/tenant-access";
import { getApprovedGroupMembership } from "@/lib/group-access";
import { handleApiError } from "@/lib/api-error";

const contributeSchema = z.object({
  amount: z.number().positive(),
  receiptUrl: z.string().url(),
  transactionDate: z.string().min(1),
  senderReference: z.string().max(255).optional(),
});

/**
 * A member gives to a campaign. Giving to a group's campaign is limited to that group's own
 * approved members — donations, like the rest of a group's finances, are kept within the group.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string; campaignId: string }> }
) {
  try {
    const { tenantSlug, campaignId } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
    if (!tenant || !tenant.isActive) {
      return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
    }

    const campaign = await db.query.donationCampaigns.findFirst({
      where: and(eq(donationCampaigns.id, campaignId), eq(donationCampaigns.tenantId, tenant.id)),
    });
    if (!campaign || !campaign.isActive) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.groupId) {
      const groupMembership = await getApprovedGroupMembership(user.id, campaign.groupId);
      if (!groupMembership) {
        return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
      }
    } else {
      const authorized = await getApprovedTenantMembership(user.id, tenantSlug);
      if (!authorized) {
        return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
      }
    }

    const body = contributeSchema.parse(await req.json());

    const [contribution] = await db
      .insert(donationContributions)
      .values({
        campaignId: campaign.id,
        donorId: user.id,
        amount: body.amount.toFixed(2),
        receiptUrl: body.receiptUrl,
        transactionDate: new Date(body.transactionDate),
        adminNotes: body.senderReference ? `Sender reference: ${body.senderReference}` : undefined,
      })
      .returning();

    return NextResponse.json({ id: contribution.id, status: contribution.status }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
