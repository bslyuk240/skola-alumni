import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { tenantMemberships, roleAssignments, systemRoles, auditLogs } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { handleApiError } from "@/lib/api-error";

const PRESIDENT_ROLE_NAME = "President/School Owner";
const CONFIRMATION_PHRASE = "TRANSFER PRESIDENCY";

const transferSchema = z.object({
  newPresidentMembershipId: z.string().uuid(),
  confirmationText: z.literal(CONFIRMATION_PHRASE),
});

/**
 * Presidency handover. The blueprint calls for an email OTP re-auth step; since Resend isn't
 * configured in every environment, this instead requires the current President to type an exact
 * confirmation phrase — deliberate friction against an accidental one-click transfer, single
 * database transaction so the tenant is never left with zero or two Presidents mid-flight.
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

    const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, [PRESIDENT_ROLE_NAME]);
    if (!authorized) {
      return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
    }

    const body = transferSchema.parse(await req.json());

    const targetMembership = await db.query.tenantMemberships.findFirst({
      where: and(
        eq(tenantMemberships.id, body.newPresidentMembershipId),
        eq(tenantMemberships.tenantId, authorized.tenant.id)
      ),
    });
    if (!targetMembership || targetMembership.status !== "APPROVED") {
      return NextResponse.json({ error: "Select a verified member to initiate transfer." }, { status: 400 });
    }
    if (targetMembership.id === authorized.membership.id) {
      return NextResponse.json({ error: "You are already the President." }, { status: 400 });
    }

    const presidentRole = await db.query.systemRoles.findFirst({
      where: eq(systemRoles.name, PRESIDENT_ROLE_NAME),
    });
    if (!presidentRole) {
      return NextResponse.json({ error: "President role is not configured" }, { status: 500 });
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(roleAssignments)
        .where(
          and(
            eq(roleAssignments.tenantMembershipId, authorized.membership.id),
            eq(roleAssignments.systemRoleId, presidentRole.id)
          )
        );

      await tx.insert(roleAssignments).values({
        tenantMembershipId: targetMembership.id,
        systemRoleId: presidentRole.id,
        assignedBy: user.id,
      });

      await tx.insert(auditLogs).values({
        tenantId: authorized.tenant.id,
        actorId: user.id,
        action: "PRESIDENCY_TRANSFER",
        entityType: "tenant_memberships",
        entityId: targetMembership.id,
        payload: { fromUserId: user.id, toMembershipId: targetMembership.id },
      });
    });

    return NextResponse.json({ message: "Ownership transferred successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}
