import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { groupMemberships, liveReactions, liveSessions, tenantMemberships } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { createCloudflareLiveInput } from "@/lib/cloudflare-stream";
import { sendPushToUsers } from "@/lib/firebase-admin";
import { getApprovedTenantMembership } from "@/lib/tenant-access";
import {
  assertCanHostLive,
  assertCanWatchLive,
  getActiveLiveSession,
  getGroupSlugForSession,
  getLivePlanGate,
  publicLiveSessionPayload,
} from "@/lib/live-access";

const startLiveSchema = z.object({
  title: z.string().min(2).max(255),
  groupSlug: z.string().min(1).max(255).optional(),
});

/** Returns the tenant's single active LIVE session (if any), with playback URL for eligible viewers. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  try {
    const { tenantSlug } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    // Resolve tenant via a lightweight approved-membership check on any live lookup path.
    const membership = await getApprovedTenantMembership(user.id, tenantSlug);
    if (!membership) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    const session = await getActiveLiveSession(membership.tenant.id);
    if (!session) {
      return NextResponse.json({ session: null });
    }

    const canWatch = await assertCanWatchLive({ userId: user.id, tenantSlug, session });
    if (!canWatch.ok) {
      // Session exists but this member can't watch (e.g. group live they're not in).
      return NextResponse.json({
        session: null,
        blocked: {
          reason: canWatch.error,
          groupSlug: await getGroupSlugForSession(session.groupId),
          title: session.title,
        },
      });
    }

    const groupSlug = await getGroupSlugForSession(session.groupId);
    const [{ count: likeCount }] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(liveReactions)
      .where(and(eq(liveReactions.sessionId, session.id), eq(liveReactions.type, "LIKE")));

    const likedByMe = Boolean(
      await db.query.liveReactions.findFirst({
        where: and(
          eq(liveReactions.sessionId, session.id),
          eq(liveReactions.userId, user.id),
          eq(liveReactions.type, "LIKE")
        ),
      })
    );

    const isHost = session.hostUserId === user.id;

    return NextResponse.json({
      session: {
        ...publicLiveSessionPayload(session, { groupSlug, likeCount, likedByMe }),
        ...(isHost ? { whipPublishUrl: session.whipPublishUrl } : {}),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Start a school-wide or group live (one LIVE per tenant). Returns WHIP URL to the host. */
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

    const body = startLiveSchema.parse(await req.json());
    const hostAuth = await assertCanHostLive({
      userId: user.id,
      tenantSlug,
      groupSlug: body.groupSlug,
    });
    if (!hostAuth.ok) {
      return NextResponse.json({ error: hostAuth.error }, { status: hostAuth.status });
    }

    const planGate = await getLivePlanGate(hostAuth.tenant.id);
    if (!planGate.ok) {
      return NextResponse.json({ error: planGate.error }, { status: planGate.status });
    }

    const existing = await getActiveLiveSession(hostAuth.tenant.id);
    if (existing) {
      const existingGroupSlug = await getGroupSlugForSession(existing.groupId);
      return NextResponse.json(
        {
          error: "There's already a live session in this association. End it before starting another.",
          activeSessionId: existing.id,
          activeGroupSlug: existingGroupSlug,
        },
        { status: 409 }
      );
    }

    const scopeLabel = hostAuth.group?.name ?? hostAuth.tenant.name;
    const cf = await createCloudflareLiveInput(`${scopeLabel} — ${body.title}`.slice(0, 120));

    const [session] = await db
      .insert(liveSessions)
      .values({
        tenantId: hostAuth.tenant.id,
        groupId: hostAuth.group?.id ?? null,
        hostUserId: user.id,
        title: body.title,
        status: "LIVE",
        cfLiveInputId: cf.liveInputId,
        whipPublishUrl: cf.whipPublishUrl,
        whepPlayUrl: cf.whepPlayUrl,
      })
      .returning();

    // Best-effort push — never block go-live.
    try {
      let recipientIds: string[] = [];
      if (hostAuth.group) {
        const members = await db
          .select({ userId: groupMemberships.userId })
          .from(groupMemberships)
          .where(
            and(
              eq(groupMemberships.groupId, hostAuth.group.id),
              eq(groupMemberships.status, "APPROVED")
            )
          );
        recipientIds = members.map((m) => m.userId);
      } else {
        const members = await db
          .select({ userId: tenantMemberships.userId })
          .from(tenantMemberships)
          .where(
            and(
              eq(tenantMemberships.tenantId, hostAuth.tenant.id),
              eq(tenantMemberships.status, "APPROVED")
            )
          );
        recipientIds = members.map((m) => m.userId);
      }

      const watchPath = hostAuth.group
        ? `/${tenantSlug}/groups/${hostAuth.group.slug}/live`
        : `/${tenantSlug}/live`;

      await sendPushToUsers(recipientIds, {
        title: `🔴 ${body.title}`,
        body: `${scopeLabel} is live — tap to watch`,
        link: watchPath,
      });
    } catch (pushError) {
      console.error("[push] Failed to send live notification:", pushError);
    }

    return NextResponse.json(
      {
        session: {
          ...publicLiveSessionPayload(session, {
            groupSlug: hostAuth.group?.slug ?? null,
          }),
          whipPublishUrl: session.whipPublishUrl,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
