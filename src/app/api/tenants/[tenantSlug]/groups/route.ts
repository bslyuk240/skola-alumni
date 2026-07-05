import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { groups, groupMemberships } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { getBillingLockStatus } from "@/lib/billing-status";
import { handleApiError } from "@/lib/api-error";
import { slugify } from "@/lib/slug";

const createGroupSchema = z.object({
  name: z.string().min(2).max(255),
  type: z.enum(["CLASS_SET", "CHAPTER", "COMMITTEE"]),
  description: z.string().max(2000).optional(),
  requireJoinApproval: z.boolean().default(true),
});

/** Tenant admin creates a group; the creator is auto-joined as GROUP_OWNER. */
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

    const lockStatus = await getBillingLockStatus(authorized.tenant.id);
    if (lockStatus.locked) {
      return NextResponse.json({ error: lockStatus.message }, { status: 402 });
    }

    const body = createGroupSchema.parse(await req.json());
    const slug = slugify(body.name);

    const existing = await db.query.groups.findFirst({
      where: and(eq(groups.tenantId, authorized.tenant.id), eq(groups.slug, slug)),
    });
    if (existing) {
      return NextResponse.json({ error: "A group with that name already exists" }, { status: 409 });
    }

    const result = await db.transaction(async (tx) => {
      const [group] = await tx
        .insert(groups)
        .values({
          tenantId: authorized.tenant.id,
          name: body.name,
          slug,
          type: body.type,
          description: body.description,
          requireJoinApproval: body.requireJoinApproval,
        })
        .returning();

      await tx.insert(groupMemberships).values({
        groupId: group.id,
        userId: user.id,
        status: "APPROVED",
        groupRole: "GROUP_OWNER",
        approvedBy: user.id,
      });

      return group;
    });

    return NextResponse.json({ id: result.id, slug: result.slug }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
