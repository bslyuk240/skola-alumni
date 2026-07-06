import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { groupMemberships, profiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTenantGroup, getAuthorizedGroupMembership } from "@/lib/group-access";
import { handleApiError } from "@/lib/api-error";

const GROUP_ADMIN_ROLES = ["GROUP_OWNER", "GROUP_ADMIN"];
const ASSIGNABLE_ROLES = ["MEMBER", "GROUP_ADMIN"] as const;

const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  groupRole: z.enum(ASSIGNABLE_ROLES),
});

/** Group Admin/Owner views the approved member roster. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string; groupSlug: string }> }
) {
  try {
    const { tenantSlug, groupSlug } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    const resolved = await getTenantGroup(tenantSlug, groupSlug);
    if (!resolved) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const actorMembership = await getAuthorizedGroupMembership(
      user.id,
      resolved.group.id,
      GROUP_ADMIN_ROLES
    );
    if (!actorMembership) {
      return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
    }

    const members = await db
      .select({
        userId: groupMemberships.userId,
        groupRole: groupMemberships.groupRole,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        graduationYear: profiles.graduationYear,
      })
      .from(groupMemberships)
      .innerJoin(profiles, eq(profiles.userId, groupMemberships.userId))
      .where(and(eq(groupMemberships.groupId, resolved.group.id), eq(groupMemberships.status, "APPROVED")));

    return NextResponse.json(members);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Group Owner promotes/demotes an approved member between MEMBER and GROUP_ADMIN. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string; groupSlug: string }> }
) {
  try {
    const { tenantSlug, groupSlug } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    const resolved = await getTenantGroup(tenantSlug, groupSlug);
    if (!resolved) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const actorMembership = await getAuthorizedGroupMembership(user.id, resolved.group.id, [
      "GROUP_OWNER",
    ]);
    if (!actorMembership) {
      return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
    }

    const body = updateRoleSchema.parse(await req.json());

    if (body.userId === user.id) {
      return NextResponse.json({ error: "You can't change your own role" }, { status: 400 });
    }

    const target = await db.query.groupMemberships.findFirst({
      where: and(
        eq(groupMemberships.groupId, resolved.group.id),
        eq(groupMemberships.userId, body.userId),
        eq(groupMemberships.status, "APPROVED")
      ),
    });
    if (!target || target.groupRole === "GROUP_OWNER") {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(groupMemberships)
      .set({ groupRole: body.groupRole })
      .where(eq(groupMemberships.id, target.id))
      .returning();

    return NextResponse.json({ userId: updated.userId, groupRole: updated.groupRole });
  } catch (error) {
    return handleApiError(error);
  }
}
