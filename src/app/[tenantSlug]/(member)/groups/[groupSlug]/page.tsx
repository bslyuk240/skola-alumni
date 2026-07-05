import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { groupMemberships, profiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTenantGroup, getAuthorizedGroupMembership } from "@/lib/group-access";
import { JoinButton } from "../_components/join-button";
import { PendingRequests, type PendingRequest } from "./_components/pending-requests";

const TYPE_LABELS: Record<string, string> = {
  CLASS_SET: "Class Set",
  CHAPTER: "Chapter",
  COMMITTEE: "Committee",
};

const GROUP_ADMIN_ROLES = ["GROUP_OWNER", "GROUP_ADMIN"];

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; groupSlug: string }>;
}) {
  const { tenantSlug, groupSlug } = await params;

  const resolved = await getTenantGroup(tenantSlug, groupSlug);
  if (!resolved) notFound();

  const user = await getCurrentUser();

  const memberCount = await db.$count(
    groupMemberships,
    and(eq(groupMemberships.groupId, resolved.group.id), eq(groupMemberships.status, "APPROVED"))
  );

  const myMembership = user
    ? await db.query.groupMemberships.findFirst({
        where: and(eq(groupMemberships.groupId, resolved.group.id), eq(groupMemberships.userId, user.id)),
      })
    : null;

  const isGroupAdmin = user
    ? Boolean(await getAuthorizedGroupMembership(user.id, resolved.group.id, GROUP_ADMIN_ROLES))
    : false;

  let pendingRequests: PendingRequest[] = [];
  if (isGroupAdmin) {
    const rows = await db
      .select({
        membershipId: groupMemberships.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        graduationYear: profiles.graduationYear,
      })
      .from(groupMemberships)
      .innerJoin(profiles, eq(profiles.userId, groupMemberships.userId))
      .where(and(eq(groupMemberships.groupId, resolved.group.id), eq(groupMemberships.status, "PENDING")));

    pendingRequests = rows.map((row) => ({
      membershipId: row.membershipId,
      fullName: `${row.firstName} ${row.lastName}`,
      graduationYear: row.graduationYear,
    }));
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-6">
      <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium text-neutral-500">{TYPE_LABELS[resolved.group.type] ?? resolved.group.type}</p>
        <h1 className="text-lg font-semibold text-neutral-900">{resolved.group.name}</h1>
        {resolved.group.description && (
          <p className="mt-2 text-sm text-neutral-700">{resolved.group.description}</p>
        )}
        <p className="mt-2 text-xs text-neutral-500">{memberCount} members</p>

        <div className="mt-3">
          {myMembership?.status === "APPROVED" ? (
            <span className="w-fit rounded-full bg-success-100 px-3 py-1 text-xs font-semibold text-success-700">
              Joined
            </span>
          ) : myMembership?.status === "PENDING" ? (
            <span className="w-fit rounded-full bg-warning-100 px-3 py-1 text-xs font-semibold text-warning-700">
              Pending Approval
            </span>
          ) : (
            <JoinButton
              tenantSlug={tenantSlug}
              groupSlug={groupSlug}
              requireJoinApproval={resolved.group.requireJoinApproval}
            />
          )}
        </div>
      </div>

      {isGroupAdmin && (
        <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Pending Requests</h2>
          <div className="mt-2">
            <PendingRequests tenantSlug={tenantSlug} groupSlug={groupSlug} initialRequests={pendingRequests} />
          </div>
        </div>
      )}
    </main>
  );
}
