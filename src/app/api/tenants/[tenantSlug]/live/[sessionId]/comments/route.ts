import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, gt, asc } from "drizzle-orm";
import { db } from "@/db";
import { liveComments, liveSessions, profiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { assertCanWatchLive } from "@/lib/live-access";
import { getApprovedTenantMembership } from "@/lib/tenant-access";

const commentSchema = z.object({
  content: z.string().min(1).max(280),
});

async function loadWatchableSession(userId: string, tenantSlug: string, sessionId: string) {
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string; sessionId: string }> }
) {
  try {
    const { tenantSlug, sessionId } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Access Denied" }, { status: 401 });

    const loaded = await loadWatchableSession(user.id, tenantSlug, sessionId);
    if ("error" in loaded) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    const afterParam = req.nextUrl.searchParams.get("after");
    const afterDate = afterParam ? new Date(afterParam) : null;

    const rows = await db
      .select({
        id: liveComments.id,
        content: liveComments.content,
        createdAt: liveComments.createdAt,
        userId: liveComments.userId,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
      })
      .from(liveComments)
      .innerJoin(profiles, eq(profiles.userId, liveComments.userId))
      .where(
        afterDate && !Number.isNaN(afterDate.getTime())
          ? and(eq(liveComments.sessionId, sessionId), gt(liveComments.createdAt, afterDate))
          : eq(liveComments.sessionId, sessionId)
      )
      .orderBy(asc(liveComments.createdAt))
      .limit(100);

    return NextResponse.json({
      comments: rows.map((row) => ({
        id: row.id,
        content: row.content,
        createdAt: row.createdAt,
        authorName: `${row.firstName} ${row.lastName}`.trim(),
        userId: row.userId,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string; sessionId: string }> }
) {
  try {
    const { tenantSlug, sessionId } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Access Denied" }, { status: 401 });

    const loaded = await loadWatchableSession(user.id, tenantSlug, sessionId);
    if ("error" in loaded) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    const body = commentSchema.parse(await req.json());
    const [comment] = await db
      .insert(liveComments)
      .values({
        sessionId,
        userId: user.id,
        content: body.content.trim(),
      })
      .returning();

    const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) });

    return NextResponse.json(
      {
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt,
        authorName: profile ? `${profile.firstName} ${profile.lastName}`.trim() : "Member",
        userId: user.id,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
