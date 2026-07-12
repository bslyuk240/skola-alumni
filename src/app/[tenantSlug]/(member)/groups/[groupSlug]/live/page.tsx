import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { liveReactions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  getApprovedGroupMembership,
  getAuthorizedGroupMembership,
  getTenantGroup,
} from "@/lib/group-access";
import { getApprovedTenantMembership } from "@/lib/tenant-access";
import {
  GROUP_LIVE_HOST_ROLES,
  assertCanWatchLive,
  getActiveLiveSession,
  getLivePlanGate,
  publicLiveSessionPayload,
} from "@/lib/live-access";
import {
  LiveEmptyState,
  LiveWatchPanel,
} from "../../../live/_components/live-panels";

export default async function GroupLivePage({
  params,
}: {
  params: Promise<{ tenantSlug: string; groupSlug: string }>;
}) {
  const { tenantSlug, groupSlug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const resolved = await getTenantGroup(tenantSlug, groupSlug);
  if (!resolved) notFound();

  const tenantMember = await getApprovedTenantMembership(user.id, tenantSlug);
  if (!tenantMember) redirect("/select-workspace");

  const groupMember = await getApprovedGroupMembership(user.id, resolved.group.id);
  const canHost = Boolean(
    await getAuthorizedGroupMembership(user.id, resolved.group.id, GROUP_LIVE_HOST_ROLES)
  );
  const planGate = await getLivePlanGate(resolved.tenant.id);
  const session = await getActiveLiveSession(resolved.tenant.id);

  if (!session || session.groupId !== resolved.group.id) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-4">
        <Link href={`/${tenantSlug}/groups/${groupSlug}`} className="text-sm text-primary-600">
          ← Back to group
        </Link>
        <h1 className="text-lg font-semibold text-neutral-900">{resolved.group.name} Live</h1>
        {!groupMember ? (
          <div className="rounded-lg border border-neutral-100 bg-white p-6 text-sm text-neutral-700 shadow-sm">
            Join this group to watch or host its live streams.
          </div>
        ) : (
          <LiveEmptyState
            tenantSlug={tenantSlug}
            groupSlug={groupSlug}
            canHost={canHost}
            planBlockedMessage={planGate.ok ? null : planGate.error}
          />
        )}
        {session && session.groupId !== resolved.group.id && (
          <p className="text-center text-xs text-neutral-500">
            Another live is active in this association right now.
            <Link href={`/${tenantSlug}/live`} className="ml-1 text-primary-600">
              Open Live
            </Link>
          </p>
        )}
      </main>
    );
  }

  const canWatch = await assertCanWatchLive({ userId: user.id, tenantSlug, session });
  if (!canWatch.ok) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-4">
        <p className="text-sm text-neutral-700">{canWatch.error}</p>
      </main>
    );
  }

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
      <Link href={`/${tenantSlug}/groups/${groupSlug}`} className="text-sm text-primary-600">
        ← Back to group
      </Link>
      <h1 className="text-lg font-semibold text-neutral-900">{resolved.group.name} Live</h1>
      <LiveWatchPanel
        tenantSlug={tenantSlug}
        scopeLabel={resolved.group.name}
        initialSession={{
          ...publicLiveSessionPayload(session, { groupSlug, likeCount, likedByMe }),
          startedAt: session.startedAt.toISOString(),
        }}
      />
    </main>
  );
}
