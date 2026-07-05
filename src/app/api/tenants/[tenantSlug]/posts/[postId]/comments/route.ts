import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { posts, comments } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getApprovedTenantMembership } from "@/lib/tenant-access";
import { handleApiError } from "@/lib/api-error";

const createCommentSchema = z.object({ content: z.string().min(1).max(2000) });

export async function POST(
  req: NextRequest,
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

    const body = createCommentSchema.parse(await req.json());

    const [comment] = await db
      .insert(comments)
      .values({ postId: post.id, authorId: user.id, content: body.content })
      .returning();

    return NextResponse.json({ id: comment.id }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
