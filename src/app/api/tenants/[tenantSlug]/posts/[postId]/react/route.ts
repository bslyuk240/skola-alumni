import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { posts, reactions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getApprovedTenantMembership } from "@/lib/tenant-access";
import { handleApiError } from "@/lib/api-error";

/** Toggles a LIKE reaction on a post for the current user. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string; postId: string }> }
) {
  try {
    const { tenantSlug, postId } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    const authorized = await getApprovedTenantMembership(user.id, tenantSlug);
    if (!authorized) {
      return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
    }

    const post = await db.query.posts.findFirst({
      where: and(eq(posts.id, postId), eq(posts.tenantId, authorized.tenant.id)),
    });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const existing = await db.query.reactions.findFirst({
      where: and(eq(reactions.postId, post.id), eq(reactions.userId, user.id)),
    });

    if (existing) {
      await db.delete(reactions).where(eq(reactions.id, existing.id));
      return NextResponse.json({ liked: false });
    }

    await db.insert(reactions).values({ postId: post.id, userId: user.id, type: "LIKE" });
    return NextResponse.json({ liked: true });
  } catch (error) {
    return handleApiError(error);
  }
}
