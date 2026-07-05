import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { announcements, tenantMemberships } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { getBillingLockStatus } from "@/lib/billing-status";
import { sendPushToUsers } from "@/lib/firebase-admin";
import { handleApiError } from "@/lib/api-error";

const ANNOUNCEMENT_ROLES = ["President/School Owner", "Announcement Manager"];

const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(5000),
  isPinned: z.boolean().default(false),
});

/** Official announcements — restricted to President/School Owner or Announcement Manager (PRO). */
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

    const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, ANNOUNCEMENT_ROLES);
    if (!authorized) {
      return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
    }

    const lockStatus = await getBillingLockStatus(authorized.tenant.id);
    if (lockStatus.locked) {
      return NextResponse.json({ error: lockStatus.message }, { status: 402 });
    }

    const body = createAnnouncementSchema.parse(await req.json());

    const [announcement] = await db
      .insert(announcements)
      .values({
        tenantId: authorized.tenant.id,
        authorId: user.id,
        title: body.title,
        content: body.content,
        isPinned: body.isPinned,
      })
      .returning();

    // Best-effort push notification — a Firebase misconfiguration shouldn't block publishing.
    try {
      const members = await db
        .select({ userId: tenantMemberships.userId })
        .from(tenantMemberships)
        .where(and(eq(tenantMemberships.tenantId, authorized.tenant.id), eq(tenantMemberships.status, "APPROVED")));

      await sendPushToUsers(
        members.map((m) => m.userId),
        {
          title: `📢 ${body.title}`,
          body: body.content.slice(0, 120),
          link: `/${tenantSlug}/home`,
        }
      );
    } catch (pushError) {
      console.error("[push] Failed to send announcement notification:", pushError);
    }

    return NextResponse.json({ id: announcement.id }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
