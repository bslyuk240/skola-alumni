import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { tenantMemberships, auditLogs } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { handleApiError } from "@/lib/api-error";

const VERIFIER_ROLES = ["President/School Owner", "Secretary"];

const updateSchema = z.object({ action: z.enum(["SUSPEND", "REACTIVATE"]) });

/** Secretary/President suspends an approved member's access, or reactivates a suspended one. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string; membershipId: string }> }
) {
  try {
    const { tenantSlug, membershipId } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, VERIFIER_ROLES);
    if (!authorized) {
      return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
    }

    const target = await db.query.tenantMemberships.findFirst({
      where: and(eq(tenantMemberships.id, membershipId), eq(tenantMemberships.tenantId, authorized.tenant.id)),
    });
    if (!target) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }
    if (target.id === authorized.membership.id) {
      return NextResponse.json({ error: "You can't suspend your own membership" }, { status: 400 });
    }

    const body = updateSchema.parse(await req.json());
    const newStatus = body.action === "SUSPEND" ? "SUSPENDED" : "APPROVED";
    const requiredCurrentStatus = body.action === "SUSPEND" ? "APPROVED" : "SUSPENDED";

    if (target.status !== requiredCurrentStatus) {
      return NextResponse.json(
        { error: `Membership must be ${requiredCurrentStatus} to do that` },
        { status: 409 }
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .update(tenantMemberships)
        .set({ status: newStatus })
        .where(eq(tenantMemberships.id, target.id));

      await tx.insert(auditLogs).values({
        tenantId: authorized.tenant.id,
        actorId: user.id,
        action: body.action === "SUSPEND" ? "MEMBER_SUSPEND" : "MEMBER_REACTIVATE",
        entityType: "tenant_memberships",
        entityId: target.id,
        payload: { targetUserId: target.userId },
      });
    });

    return NextResponse.json({ id: target.id, status: newStatus });
  } catch (error) {
    return handleApiError(error);
  }
}
