import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { groupMemberships } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTenantGroup } from "@/lib/group-access";
import { handleApiError } from "@/lib/api-error";

/** Leaves a group. The owner must transfer ownership to someone else first. */
export async function DELETE(
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

    const membership = await db.query.groupMemberships.findFirst({
      where: and(eq(groupMemberships.groupId, resolved.group.id), eq(groupMemberships.userId, user.id)),
    });
    if (!membership) {
      return NextResponse.json({ error: "You're not a member of this group" }, { status: 404 });
    }

    if (membership.groupRole === "GROUP_OWNER") {
      return NextResponse.json(
        { error: "Transfer ownership to another member before leaving the group" },
        { status: 400 }
      );
    }

    await db.delete(groupMemberships).where(eq(groupMemberships.id, membership.id));

    return NextResponse.json({ left: true });
  } catch (error) {
    return handleApiError(error);
  }
}
