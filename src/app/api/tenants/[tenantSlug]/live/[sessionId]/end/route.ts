import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { liveSessions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { disableCloudflareLiveInput } from "@/lib/cloudflare-stream";
import {
  SCHOOL_LIVE_HOST_ROLES,
  GROUP_LIVE_HOST_ROLES,
} from "@/lib/live-access";
import { getAuthorizedGroupMembership } from "@/lib/group-access";
import { getAuthorizedTenantMembership, getApprovedTenantMembership } from "@/lib/tenant-access";

/** End the live session. Host, school admins, or group admins (for group lives) can end. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string; sessionId: string }> }
) {
  try {
    const { tenantSlug, sessionId } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    const membership = await getApprovedTenantMembership(user.id, tenantSlug);
    if (!membership) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    const session = await db.query.liveSessions.findFirst({
      where: and(eq(liveSessions.id, sessionId), eq(liveSessions.tenantId, membership.tenant.id)),
    });
    if (!session || session.status !== "LIVE") {
      return NextResponse.json({ error: "Live session not found" }, { status: 404 });
    }

    const isHost = session.hostUserId === user.id;
    const schoolAdmin = await getAuthorizedTenantMembership(user.id, tenantSlug, SCHOOL_LIVE_HOST_ROLES);
    let groupAdmin = false;
    if (session.groupId) {
      const authorized = await getAuthorizedGroupMembership(
        user.id,
        session.groupId,
        GROUP_LIVE_HOST_ROLES
      );
      groupAdmin = Boolean(authorized);
    }

    if (!isHost && !schoolAdmin && !groupAdmin) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    try {
      await disableCloudflareLiveInput(session.cfLiveInputId);
    } catch (cfError) {
      console.error("[live] Failed to disable Cloudflare live input:", cfError);
    }

    const [updated] = await db
      .update(liveSessions)
      .set({ status: "ENDED", endedAt: new Date() })
      .where(eq(liveSessions.id, session.id))
      .returning();

    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (error) {
    return handleApiError(error);
  }
}
