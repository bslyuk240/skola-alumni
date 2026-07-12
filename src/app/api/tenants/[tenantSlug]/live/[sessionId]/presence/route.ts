import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { liveSessions, liveViewers } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { assertCanWatchLive } from "@/lib/live-access";
import { getApprovedTenantMembership } from "@/lib/tenant-access";

const VIEWER_TTL_MS = 45_000;

async function loadLiveSession(userId: string, tenantSlug: string, sessionId: string) {
  const membership = await getApprovedTenantMembership(userId, tenantSlug);
  if (!membership) return { error: "Access Denied", status: 403 as const };

  const session = await db.query.liveSessions.findFirst({
    where: and(eq(liveSessions.id, sessionId), eq(liveSessions.tenantId, membership.tenant.id)),
  });
  if (!session || session.status !== "LIVE") {
    return { error: "Live session not found", status: 404 as const };
  }

  const canWatch = await assertCanWatchLive({ userId, tenantSlug, session });
  if (!canWatch.ok) return { error: canWatch.error, status: canWatch.status };

  return { session };
}

async function countActiveViewers(sessionId: string) {
  const cutoff = new Date(Date.now() - VIEWER_TTL_MS);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(liveViewers)
    .where(and(eq(liveViewers.sessionId, sessionId), gt(liveViewers.lastSeenAt, cutoff)));
  return count;
}

/** Heartbeat while watching/hosting — returns current viewer count. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string; sessionId: string }> }
) {
  try {
    const { tenantSlug, sessionId } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Access Denied" }, { status: 401 });

    const loaded = await loadLiveSession(user.id, tenantSlug, sessionId);
    if ("error" in loaded) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    const now = new Date();
    await db
      .insert(liveViewers)
      .values({ sessionId, userId: user.id, lastSeenAt: now })
      .onConflictDoUpdate({
        target: [liveViewers.sessionId, liveViewers.userId],
        set: { lastSeenAt: now },
      });

    // Best-effort cleanup of stale rows for this session.
    await db
      .delete(liveViewers)
      .where(
        and(
          eq(liveViewers.sessionId, sessionId),
          sql`${liveViewers.lastSeenAt} < ${new Date(Date.now() - VIEWER_TTL_MS * 2)}`
        )
      )
      .catch(() => undefined);

    const viewerCount = await countActiveViewers(sessionId);
    return NextResponse.json({ viewerCount });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Leave the live — remove this viewer's presence. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string; sessionId: string }> }
) {
  try {
    const { tenantSlug, sessionId } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Access Denied" }, { status: 401 });

    const membership = await getApprovedTenantMembership(user.id, tenantSlug);
    if (!membership) return NextResponse.json({ error: "Access Denied" }, { status: 403 });

    await db
      .delete(liveViewers)
      .where(and(eq(liveViewers.sessionId, sessionId), eq(liveViewers.userId, user.id)));

    const viewerCount = await countActiveViewers(sessionId);
    return NextResponse.json({ viewerCount });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Read-only viewer count for lobby / polling. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string; sessionId: string }> }
) {
  try {
    const { tenantSlug, sessionId } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Access Denied" }, { status: 401 });

    const loaded = await loadLiveSession(user.id, tenantSlug, sessionId);
    if ("error" in loaded) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    const viewerCount = await countActiveViewers(sessionId);
    return NextResponse.json({ viewerCount });
  } catch (error) {
    return handleApiError(error);
  }
}
