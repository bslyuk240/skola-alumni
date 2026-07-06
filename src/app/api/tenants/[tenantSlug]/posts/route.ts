import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getApprovedTenantMembership } from "@/lib/tenant-access";
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

/** Tenant-level feed post (groupId null). Any approved member may post. */
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

    const authorized = await getApprovedTenantMembership(user.id, tenantSlug);
    if (!authorized) {
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
        tenantId: authorized.tenant.id,
        authorId: user.id,
        type: body.type,
        content: body.content,
        mediaUrls: body.mediaUrl ? [body.mediaUrl] : [],
      })
      .returning();

    return NextResponse.json({ id: post.id }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
