import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { tenantMemberships, roleAssignments, systemRoles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { handleApiError } from "@/lib/api-error";

// Presidency changes go through the dedicated /transfer-presidency flow, not this general endpoint.
const ASSIGNABLE_ROLES = ["Finance Admin", "Secretary", "Announcement Manager"];

const assignSchema = z.object({
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

    const body = assignSchema.parse(await req.json());

    const targetMembership = await db.query.tenantMemberships.findFirst({
      where: and(
        eq(tenantMemberships.id, body.membershipId),
        eq(tenantMemberships.tenantId, authorized.tenant.id)
      ),
    });
    if (!targetMembership || targetMembership.status !== "APPROVED") {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const role = await db.query.systemRoles.findFirst({ where: eq(systemRoles.name, body.roleName) });
    if (!role || !ASSIGNABLE_ROLES.includes(role.name)) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    await db
      .insert(roleAssignments)
      .values({ tenantMembershipId: targetMembership.id, systemRoleId: role.id, assignedBy: user.id })
      .onConflictDoNothing();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
