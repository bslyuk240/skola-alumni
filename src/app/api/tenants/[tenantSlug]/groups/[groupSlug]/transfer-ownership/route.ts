import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { groupMemberships } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTenantGroup, getAuthorizedGroupMembership } from "@/lib/group-access";
import { handleApiError } from "@/lib/api-error";

const transferSchema = z.object({
  userId: z.string().uuid(),
});

/**
 * Current Group Owner hands ownership to another approved member. The outgoing owner becomes a
 * GROUP_ADMIN rather than a plain member, so they keep management access instead of losing it.
 */
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

    const ownerMembership = await getAuthorizedGroupMembership(user.id, resolved.group.id, [
      "GROUP_OWNER",
    ]);
    if (!ownerMembership) {
      return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
    }

    const body = transferSchema.parse(await req.json());

    if (body.userId === user.id) {
      return NextResponse.json({ error: "You're already the owner" }, { status: 400 });
    }

    const target = await db.query.groupMemberships.findFirst({
      where: and(
        eq(groupMemberships.groupId, resolved.group.id),
        eq(groupMemberships.userId, body.userId),
        eq(groupMemberships.status, "APPROVED")
      ),
    });
    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(groupMemberships)
        .set({ groupRole: "GROUP_ADMIN" })
        .where(eq(groupMemberships.id, ownerMembership.id));

      await tx
        .update(groupMemberships)
        .set({ groupRole: "GROUP_OWNER" })
        .where(eq(groupMemberships.id, target.id));
    });

    return NextResponse.json({ newOwnerId: target.userId });
  } catch (error) {
    return handleApiError(error);
  }
}
