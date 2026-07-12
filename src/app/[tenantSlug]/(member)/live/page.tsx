import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { liveReactions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getApprovedTenantMembership, getAuthorizedTenantMembership } from "@/lib/tenant-access";
import {
  SCHOOL_LIVE_HOST_ROLES,
  assertCanWatchLive,
  getActiveLiveSession,
  getGroupSlugForSession,
  getLivePlanGate,
  publicLiveSessionPayload,
} from "@/lib/live-access";
import { LiveEmptyState, LiveWatchPanel } from "./_components/live-panels";

export default async function TenantLivePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const membership = await getApprovedTenantMembership(user.id, tenantSlug);
  if (!membership) redirect("/select-workspace");

  const session = await getActiveLiveSession(membership.tenant.id);
  const canHost = Boolean(
    await getAuthorizedTenantMembership(user.id, tenantSlug, SCHOOL_LIVE_HOST_ROLES)
  );
  const planGate = await getLivePlanGate(membership.tenant.id);

  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-4">
        <h1 className="text-lg font-semibold text-neutral-900">Live</h1>
        <LiveEmptyState
          tenantSlug={tenantSlug}
          canHost={canHost}
          planBlockedMessage={planGate.ok ? null : planGate.error}
        />
      </main>
    );
  }

  if (session.groupId) {
    const groupSlug = await getGroupSlugForSession(session.groupId);
    if (groupSlug) {
      redirect(`/${tenantSlug}/groups/${groupSlug}/live`);
    }
  }

  const canWatch = await assertCanWatchLive({ userId: user.id, tenantSlug, session });
  if (!canWatch.ok) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-4">
        <h1 className="text-lg font-semibold text-neutral-900">Live</h1>
        <div className="rounded-lg border border-neutral-100 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-neutral-700">{canWatch.error}</p>
        </div>
      </main>
    );
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

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">Live</h1>
        {canHost && (
          <Link href={`/${tenantSlug}/live/host`} className="text-sm font-medium text-primary-600">
            Host
          </Link>
        )}
      </div>
      <LiveWatchPanel
        tenantSlug={tenantSlug}
        scopeLabel={membership.tenant.name}
        initialSession={{
          ...publicLiveSessionPayload(session, { groupSlug, likeCount, likedByMe }),
          startedAt: session.startedAt.toISOString(),
        }}
      />
    </main>
  );
}
