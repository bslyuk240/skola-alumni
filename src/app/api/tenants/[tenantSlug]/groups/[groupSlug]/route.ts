import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { groups } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTenantGroup, getAuthorizedGroupMembership } from "@/lib/group-access";
import { handleApiError } from "@/lib/api-error";

const GROUP_ADMIN_ROLES = ["GROUP_OWNER", "GROUP_ADMIN"];

const updateGroupSchema = z.object({
  avatarUrl: z.string().url().nullable(),
});

/** Group Admin/Owner updates the group's avatar. */
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

    const body = updateGroupSchema.parse(await req.json());

    const [updated] = await db
      .update(groups)
      .set({ avatarUrl: body.avatarUrl })
      .where(eq(groups.id, resolved.group.id))
      .returning();

    return NextResponse.json({ id: updated.id, avatarUrl: updated.avatarUrl });
  } catch (error) {
    return handleApiError(error);
  }
}
