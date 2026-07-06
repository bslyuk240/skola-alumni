import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { tenants, posts, postReports } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { getAuthorizedGroupMembership } from "@/lib/group-access";
import { handleApiError } from "@/lib/api-error";

const TENANT_MODERATOR_ROLES = ["President/School Owner", "Announcement Manager"];
const GROUP_ADMIN_ROLES = ["GROUP_OWNER", "GROUP_ADMIN"];

/**
 * Restores a flagged post to the public feed and clears its report history. A group's own posts
 * are that group's business — only its owner/admin can restore them. Tenant moderators only
 * handle general (non-group) feed posts.
 */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string; postId: string }> }
) {
  try {
    const { tenantSlug, postId } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
    if (!tenant || !tenant.isActive) {
      return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
    }

    const post = await db.query.posts.findFirst({
      where: and(eq(posts.id, postId), eq(posts.tenantId, tenant.id)),
    });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.groupId) {
      const groupMembership = await getAuthorizedGroupMembership(user.id, post.groupId, GROUP_ADMIN_ROLES);
      if (!groupMembership) {
        return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
      }
    } else {
      const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, TENANT_MODERATOR_ROLES);
      if (!authorized) {
        return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
      }
    }

    await db.transaction(async (tx) => {
      await tx.update(posts).set({ isModerated: false }).where(eq(posts.id, post.id));
      await tx.delete(postReports).where(eq(postReports.postId, post.id));
    });

    return NextResponse.json({ id: post.id, isModerated: false });
  } catch (error) {
    return handleApiError(error);
  }
}
