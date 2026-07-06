import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { posts, groupMemberships } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTenantGroup, getApprovedGroupMembership } from "@/lib/group-access";
import { sendPushToUsers } from "@/lib/firebase-admin";
import { verifyPostMedia } from "@/lib/cloudinary";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";

const createPostSchema = z
  .object({
    content: z.string().min(1).max(5000),
    type: z.enum(["POST", "BUSINESS_ADVERT"]).default("POST"),
    mediaUrl: z.string().url().optional(),
    mediaPublicId: z.string().optional(),
    mediaResourceType: z.enum(["image", "video"]).optional(),
  })
  .refine((data) => !data.mediaUrl || (data.mediaPublicId && data.mediaResourceType), {
    message: "mediaPublicId and mediaResourceType are required alongside mediaUrl",
  });

/** Group-scoped post — only visible within this group's page and to fellow group members
 * (via the profile page's visibility filter). Restricted to APPROVED group members. */
export async function POST(
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

    const membership = await getApprovedGroupMembership(user.id, resolved.group.id);
    if (!membership) {
      return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
    }

    const allowed = await checkRateLimit(`post-create:${user.id}`, 10, 60);
    if (!allowed) {
      return NextResponse.json({ error: "You're posting too quickly. Please wait a moment." }, { status: 429 });
    }

    const body = createPostSchema.parse(await req.json());

    if (body.mediaUrl && body.mediaPublicId && body.mediaResourceType) {
      try {
        await verifyPostMedia(body.mediaUrl, body.mediaPublicId, body.mediaResourceType);
      } catch (mediaError) {
        return NextResponse.json(
          { error: mediaError instanceof Error ? mediaError.message : "Invalid media" },
          { status: 400 }
        );
      }
    }

    const [post] = await db
      .insert(posts)
      .values({
        tenantId: resolved.tenant.id,
        groupId: resolved.group.id,
        authorId: user.id,
        type: body.type,
        content: body.content,
        mediaUrls: body.mediaUrl ? [body.mediaUrl] : [],
      })
      .returning();

    // Best-effort push notification to fellow group members — a Firebase misconfiguration
    // shouldn't block publishing.
    try {
      const members = await db
        .select({ userId: groupMemberships.userId })
        .from(groupMemberships)
        .where(and(eq(groupMemberships.groupId, resolved.group.id), eq(groupMemberships.status, "APPROVED")));

      await sendPushToUsers(
        members.map((m) => m.userId).filter((id) => id !== user.id),
        {
          title: `New post in ${resolved.group.name}`,
          body: body.content.slice(0, 120),
          link: `/${tenantSlug}/groups/${groupSlug}`,
        }
      );
    } catch (pushError) {
      console.error("[push] Failed to send group post notification:", pushError);
    }

    return NextResponse.json({ id: post.id }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
