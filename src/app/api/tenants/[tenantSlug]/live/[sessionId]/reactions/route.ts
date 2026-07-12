import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { liveReactions, liveSessions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { assertCanWatchLive } from "@/lib/live-access";
import { getApprovedTenantMembership } from "@/lib/tenant-access";

/** Toggle a LIKE on the live session (one per user). */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string; sessionId: string }> }
) {
  try {
    const { tenantSlug, sessionId } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Access Denied" }, { status: 401 });

    const membership = await getApprovedTenantMembership(user.id, tenantSlug);
    if (!membership) return NextResponse.json({ error: "Access Denied" }, { status: 403 });

    const session = await db.query.liveSessions.findFirst({
      where: and(eq(liveSessions.id, sessionId), eq(liveSessions.tenantId, membership.tenant.id)),
    });
    if (!session || session.status !== "LIVE") {
      return NextResponse.json({ error: "Live session not found" }, { status: 404 });
    }

    const canWatch = await assertCanWatchLive({ userId: user.id, tenantSlug, session });
    if (!canWatch.ok) {
      return NextResponse.json({ error: canWatch.error }, { status: canWatch.status });
    }

    const existing = await db.query.liveReactions.findFirst({
      where: and(
        eq(liveReactions.sessionId, sessionId),
        eq(liveReactions.userId, user.id),
        eq(liveReactions.type, "LIKE")
      ),
    });

    if (existing) {
      await db.delete(liveReactions).where(eq(liveReactions.id, existing.id));
    } else {
      await db.insert(liveReactions).values({
        sessionId,
        userId: user.id,
        type: "LIKE",
      });
    }

    const [{ count: likeCount }] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(liveReactions)
      .where(and(eq(liveReactions.sessionId, sessionId), eq(liveReactions.type, "LIKE")));

    return NextResponse.json({ likedByMe: !existing, likeCount });
  } catch (error) {
    return handleApiError(error);
  }
}
