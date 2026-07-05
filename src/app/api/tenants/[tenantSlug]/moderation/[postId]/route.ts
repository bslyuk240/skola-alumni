import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { posts, postReports } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { handleApiError } from "@/lib/api-error";

const MODERATOR_ROLES = ["President/School Owner", "Announcement Manager"];

/** Restores a flagged post to the public feed and clears its report history. */
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

    const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, MODERATOR_ROLES);
    if (!authorized) {
      return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
    }

    const post = await db.query.posts.findFirst({
      where: and(eq(posts.id, postId), eq(posts.tenantId, authorized.tenant.id)),
    });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
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
