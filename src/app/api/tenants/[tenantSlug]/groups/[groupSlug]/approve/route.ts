import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { groupMemberships } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTenantGroup, getAuthorizedGroupMembership } from "@/lib/group-access";
import { handleApiError } from "@/lib/api-error";

const GROUP_ADMIN_ROLES = ["GROUP_OWNER", "GROUP_ADMIN"];

const approveSchema = z.object({
  membershipId: z.string().uuid(),
  action: z.enum(["APPROVED", "REJECTED"]),
});

/** Group Admin/Owner approves or rejects a pending join request. */
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

    const actorMembership = await getAuthorizedGroupMembership(
      user.id,
      resolved.group.id,
      GROUP_ADMIN_ROLES
    );
    if (!actorMembership) {
      return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
    }

    const body = approveSchema.parse(await req.json());

    const target = await db.query.groupMemberships.findFirst({
      where: and(eq(groupMemberships.id, body.membershipId), eq(groupMemberships.groupId, resolved.group.id)),
    });
    if (!target) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(groupMemberships)
      .set({ status: body.action, approvedBy: user.id })
      .where(eq(groupMemberships.id, target.id))
      .returning();

    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Group Admin/Owner views pending join requests for this group. */
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

    const pending = await db.query.groupMemberships.findMany({
      where: and(eq(groupMemberships.groupId, resolved.group.id), eq(groupMemberships.status, "PENDING")),
    });

    return NextResponse.json(pending);
  } catch (error) {
    return handleApiError(error);
  }
}
