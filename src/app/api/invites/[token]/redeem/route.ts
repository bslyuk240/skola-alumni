import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, roleAssignments, systemRoles, tenantMemberships } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { getActiveInviteByToken } from "@/lib/invites";

/**
 * Redeems an invite link: creates an APPROVED membership (the invite itself is the gate).
 * Callers must already have a Clerk session + profile (set credentials via sign-up first).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) });
    if (!profile) {
      return NextResponse.json(
        { error: "Complete your profile before joining a school" },
        { status: 400 }
      );
    }

    const result = await getActiveInviteByToken(token);
    if (!result) {
      return NextResponse.json({ error: "This invite link is invalid or has been revoked" }, { status: 404 });
    }

    const { tenant } = result;

    const existingMembership = await db.query.tenantMemberships.findFirst({
      where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, user.id)),
    });

    if (existingMembership) {
      if (existingMembership.status === "APPROVED") {
        return NextResponse.json({
          id: existingMembership.id,
          status: existingMembership.status,
          tenantSlug: tenant.slug,
        });
      }

      // Upgrade a prior pending/rejected request if they now have a valid invite.
      const now = new Date();
      const [updated] = await db
        .update(tenantMemberships)
        .set({
          status: "APPROVED",
          approvedBy: user.id,
          approvedAt: now,
        })
        .where(eq(tenantMemberships.id, existingMembership.id))
        .returning();

      return NextResponse.json({
        id: updated.id,
        status: updated.status,
        tenantSlug: tenant.slug,
      });
    }

    const memberRole = await db.query.systemRoles.findFirst({
      where: eq(systemRoles.name, "Member"),
    });

    const now = new Date();
    const membership = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(tenantMemberships)
        .values({
          tenantId: tenant.id,
          userId: user.id,
          status: "APPROVED",
          approvedBy: user.id,
          approvedAt: now,
        })
        .returning();

      if (memberRole) {
        await tx.insert(roleAssignments).values({
          tenantMembershipId: created.id,
          systemRoleId: memberRole.id,
          assignedBy: user.id,
        });
      }

      return created;
    });

    return NextResponse.json(
      { id: membership.id, status: membership.status, tenantSlug: tenant.slug },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
