import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { groupMemberships, profiles, posts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTenantGroup, getAuthorizedGroupMembership } from "@/lib/group-access";
import { getPostFeed } from "@/lib/post-feed";
import { JoinButton } from "../_components/join-button";
import { PendingRequests, type PendingRequest } from "./_components/pending-requests";
import { MemberRoster, type RosterMember } from "./_components/member-roster";
import { LeaveGroupButton } from "./_components/leave-group-button";
import { PostComposer } from "../../home/_components/post-composer";
import { PostCard } from "../../home/_components/post-card";

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

  let members: RosterMember[] = [];
  if (isGroupAdmin) {
    const rows = await db
      .select({
        userId: groupMemberships.userId,
        groupRole: groupMemberships.groupRole,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        graduationYear: profiles.graduationYear,
      })
      .from(groupMemberships)
      .innerJoin(profiles, eq(profiles.userId, groupMemberships.userId))
      .where(and(eq(groupMemberships.groupId, resolved.group.id), eq(groupMemberships.status, "APPROVED")));

    members = rows.map((row) => ({
      userId: row.userId,
      groupRole: row.groupRole,
      fullName: `${row.firstName} ${row.lastName}`,
      graduationYear: row.graduationYear,
    }));
  }

  // Group posts are only visible to approved members of this group — not to visitors browsing
  // the group page before joining.
  const isApprovedMember = myMembership?.status === "APPROVED";
  const groupPosts = isApprovedMember
    ? await getPostFeed(and(eq(posts.groupId, resolved.group.id), eq(posts.isModerated, false))!, user?.id ?? null)
    : [];

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-3">
      <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium text-neutral-500">{TYPE_LABELS[resolved.group.type] ?? resolved.group.type}</p>
        <h1 className="text-lg font-semibold text-neutral-900">{resolved.group.name}</h1>
        {resolved.group.description && (
          <p className="mt-2 text-sm text-neutral-700">{resolved.group.description}</p>
        )}
        <p className="mt-2 text-xs text-neutral-500">{memberCount} members</p>

        <div className="mt-3 flex items-center justify-between gap-2">
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

          {isApprovedMember && myMembership?.groupRole !== "GROUP_OWNER" && (
            <LeaveGroupButton tenantSlug={tenantSlug} groupSlug={groupSlug} />
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

      {isGroupAdmin && (
        <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Members</h2>
          <div className="mt-2">
            <MemberRoster
              tenantSlug={tenantSlug}
              groupSlug={groupSlug}
              currentUserId={user?.id ?? ""}
              isOwner={myMembership?.groupRole === "GROUP_OWNER"}
              initialMembers={members}
            />
          </div>
        </div>
      )}

      {isApprovedMember && (
        <>
          <PostComposer tenantSlug={tenantSlug} groupSlug={groupSlug} />

          {groupPosts.length === 0 ? (
            <div className="rounded-lg border border-neutral-100 bg-white p-6 text-center shadow-sm">
              <h2 className="text-base font-semibold text-neutral-900">No Posts Yet</h2>
              <p className="mt-1 text-sm text-neutral-700">Be the first to share something with this group.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {groupPosts.map((post) => (
                <PostCard key={post.id} tenantSlug={tenantSlug} post={post} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
