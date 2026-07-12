import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  groups,
  liveSessions,
  subscriptionPlans,
  subscriptions,
} from "@/db/schema";
import { getAuthorizedTenantMembership, getApprovedTenantMembership } from "@/lib/tenant-access";
import {
  getApprovedGroupMembership,
  getAuthorizedGroupMembership,
  getTenantGroup,
} from "@/lib/group-access";
import { getBillingLockStatus } from "@/lib/billing-status";

export const LIVE_ELIGIBLE_PLANS = new Set(["Growth", "Association"]);
export const SCHOOL_LIVE_HOST_ROLES = ["President/School Owner", "Announcement Manager"];
export const GROUP_LIVE_HOST_ROLES = ["GROUP_OWNER", "GROUP_ADMIN"];

export type LivePlanGate =
  | { ok: true; planName: string }
  | { ok: false; status: 402 | 403; error: string };

/** Live is a paid-plan feature (Growth / Association) and requires an unlocked subscription. */
export async function getLivePlanGate(tenantId: string): Promise<LivePlanGate> {
  const lockStatus = await getBillingLockStatus(tenantId);
  if (lockStatus.locked) {
    return { ok: false, status: 402, error: lockStatus.message ?? "Billing is locked for this workspace." };
  }

  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.tenantId, tenantId),
  });
  if (!subscription) {
    return { ok: false, status: 403, error: "No subscription found for this workspace." };
  }

  if (subscription.status !== "TRIALING" && subscription.status !== "ACTIVE") {
    return { ok: false, status: 402, error: "Renew your subscription to use Live." };
  }

  const plan = await db.query.subscriptionPlans.findFirst({
    where: eq(subscriptionPlans.id, subscription.planId),
  });
  const planName = plan?.name ?? "Starter";

  if (!LIVE_ELIGIBLE_PLANS.has(planName)) {
    return {
      ok: false,
      status: 403,
      error: "Live streaming is available on Growth and Association plans. Upgrade to go live.",
    };
  }

  return { ok: true, planName };
}

export async function getActiveLiveSession(tenantId: string) {
  return db.query.liveSessions.findFirst({
    where: and(eq(liveSessions.tenantId, tenantId), eq(liveSessions.status, "LIVE")),
  });
}

/** Host authorization for school-wide or group-scoped live. */
export async function assertCanHostLive(options: {
  userId: string;
  tenantSlug: string;
  groupSlug?: string | null;
}) {
  const { userId, tenantSlug, groupSlug } = options;

  if (groupSlug) {
    const resolved = await getTenantGroup(tenantSlug, groupSlug);
    if (!resolved) return { ok: false as const, status: 404 as const, error: "Group not found" };

    const tenantMember = await getApprovedTenantMembership(userId, tenantSlug);
    if (!tenantMember) return { ok: false as const, status: 403 as const, error: "Access Denied" };

    const groupHost = await getAuthorizedGroupMembership(
      userId,
      resolved.group.id,
      GROUP_LIVE_HOST_ROLES
    );
    if (!groupHost) {
      return {
        ok: false as const,
        status: 403 as const,
        error: "Only group owners and admins can go live for this group.",
      };
    }

    return {
      ok: true as const,
      tenant: resolved.tenant,
      group: resolved.group,
    };
  }

  const authorized = await getAuthorizedTenantMembership(userId, tenantSlug, SCHOOL_LIVE_HOST_ROLES);
  if (!authorized) {
    return {
      ok: false as const,
      status: 403 as const,
      error: "Only association admins can start a school-wide live.",
    };
  }

  return { ok: true as const, tenant: authorized.tenant, group: null };
}

/** Viewers must be approved tenant members; group lives also require approved group membership. */
export async function assertCanWatchLive(options: {
  userId: string;
  tenantSlug: string;
  session: typeof liveSessions.$inferSelect;
}) {
  const { userId, tenantSlug, session } = options;

  const tenantMember = await getApprovedTenantMembership(userId, tenantSlug);
  if (!tenantMember) return { ok: false as const, status: 403 as const, error: "Access Denied" };

  if (session.groupId) {
    const groupMember = await getApprovedGroupMembership(userId, session.groupId);
    if (!groupMember) {
      return {
        ok: false as const,
        status: 403 as const,
        error: "Join this group to watch its live stream.",
      };
    }
  }

  return { ok: true as const, tenant: tenantMember.tenant };
}

export async function getGroupSlugForSession(groupId: string | null) {
  if (!groupId) return null;
  const group = await db.query.groups.findFirst({ where: eq(groups.id, groupId) });
  return group?.slug ?? null;
}

export function publicLiveSessionPayload(
  session: typeof liveSessions.$inferSelect,
  extras?: { groupSlug?: string | null; likeCount?: number; likedByMe?: boolean }
) {
  return {
    id: session.id,
    title: session.title,
    status: session.status,
    groupId: session.groupId,
    groupSlug: extras?.groupSlug ?? null,
    hostUserId: session.hostUserId,
    whepPlayUrl: session.whepPlayUrl,
    startedAt: session.startedAt,
    likeCount: extras?.likeCount ?? 0,
    likedByMe: extras?.likedByMe ?? false,
  };
}
