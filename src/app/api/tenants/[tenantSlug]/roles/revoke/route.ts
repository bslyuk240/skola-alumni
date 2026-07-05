import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { tenantMemberships, roleAssignments, systemRoles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { handleApiError } from "@/lib/api-error";

const REVOCABLE_ROLES = ["Finance Admin", "Secretary", "Announcement Manager"];

const revokeSchema = z.object({
  membershipId: z.string().uuid(),
  roleName: z.enum(["Finance Admin", "Secretary", "Announcement Manager"]),
});

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

    const body = revokeSchema.parse(await req.json());

    const targetMembership = await db.query.tenantMemberships.findFirst({
      where: and(
        eq(tenantMemberships.id, body.membershipId),
        eq(tenantMemberships.tenantId, authorized.tenant.id)
      ),
    });
    if (!targetMembership) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const role = await db.query.systemRoles.findFirst({ where: eq(systemRoles.name, body.roleName) });
    if (!role || !REVOCABLE_ROLES.includes(role.name)) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    await db
      .delete(roleAssignments)
      .where(
        and(
          eq(roleAssignments.tenantMembershipId, targetMembership.id),
          eq(roleAssignments.systemRoleId, role.id)
        )
      );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
