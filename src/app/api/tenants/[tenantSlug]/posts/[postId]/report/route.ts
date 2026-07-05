import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { posts, postReports } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getApprovedTenantMembership } from "@/lib/tenant-access";
import { handleApiError } from "@/lib/api-error";

const AUTO_HIDE_THRESHOLD = 3;

/** Flags a post for moderation. After 3 unique flags, the post is auto-hidden (posts.isModerated). */
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

    const existingReport = await db.query.postReports.findFirst({
      where: and(eq(postReports.postId, post.id), eq(postReports.reporterId, user.id)),
    });
    if (existingReport) {
      return NextResponse.json({ reported: true, alreadyFlagged: true });
    }

    await db.insert(postReports).values({ postId: post.id, reporterId: user.id });

    const reportCount = await db.$count(postReports, eq(postReports.postId, post.id));

    if (reportCount >= AUTO_HIDE_THRESHOLD && !post.isModerated) {
      await db.update(posts).set({ isModerated: true }).where(eq(posts.id, post.id));
    }

    return NextResponse.json({ reported: true, reportCount });
  } catch (error) {
    return handleApiError(error);
  }
}
