import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Wallet } from "lucide-react";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { groupMemberships, profiles, posts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTenantGroup, getAuthorizedGroupMembership } from "@/lib/group-access";
import { JoinButton } from "../../_components/join-button";
import { LeaveGroupButton } from "../_components/leave-group-button";
import { PendingRequests, type PendingRequest } from "../_components/pending-requests";
import { MemberRoster, type RosterMember } from "../_components/member-roster";
import { GroupAvatar } from "../_components/group-avatar";
import { RestoreButton } from "../../../../admin/moderation/_components/restore-button";

const TYPE_LABELS: Record<string, string> = {
  CLASS_SET: "Class Set",
  CHAPTER: "Chapter",
  COMMITTEE: "Committee",
};

const GROUP_ADMIN_ROLES = ["GROUP_OWNER", "GROUP_ADMIN"];

export default async function GroupInfoPage({
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

  const isApprovedMember = myMembership?.status === "APPROVED";

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
        securityAnswer: groupMemberships.securityAnswer,
      })
      .from(groupMemberships)
      .innerJoin(profiles, eq(profiles.userId, groupMemberships.userId))
      .where(and(eq(groupMemberships.groupId, resolved.group.id), eq(groupMemberships.status, "PENDING")));

    pendingRequests = rows.map((row) => ({
      membershipId: row.membershipId,
      fullName: `${row.firstName} ${row.lastName}`,
      graduationYear: row.graduationYear,
      securityAnswer: row.securityAnswer,
    }));
  }

  // Visible to every approved member, like WhatsApp's participant list — only the owner gets
  // the promote/demote/transfer controls, handled inside MemberRoster itself.
  let members: RosterMember[] = [];
  if (isApprovedMember) {
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

  // Flagged posts within this group are the group's own business — its owner/admin reviews and
  // restores them here, rather than the tenant's moderation queue.
  let flaggedPosts: { id: string; content: string; authorName: string }[] = [];
  if (isGroupAdmin) {
    const rows = await db
      .select({
        id: posts.id,
        content: posts.content,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
      })
      .from(posts)
      .innerJoin(profiles, eq(profiles.userId, posts.authorId))
      .where(and(eq(posts.groupId, resolved.group.id), eq(posts.isModerated, true)));

    flaggedPosts = rows.map((row) => ({
      id: row.id,
      content: row.content,
      authorName: `${row.firstName} ${row.lastName}`,
    }));
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-3">
      <Link
        href={`/${tenantSlug}/groups/${groupSlug}`}
        className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        Back to group
      </Link>

      <div className="flex flex-col items-center gap-1.5 rounded-lg border border-neutral-100 bg-white p-6 text-center shadow-sm">
        <GroupAvatar
          tenantSlug={tenantSlug}
          groupSlug={groupSlug}
          groupName={resolved.group.name}
          avatarUrl={resolved.group.avatarUrl}
          editable={isGroupAdmin}
        />
        <p className="mt-1 text-xs font-medium text-neutral-500">{TYPE_LABELS[resolved.group.type] ?? resolved.group.type}</p>
        <h1 className="text-lg font-semibold text-neutral-900">{resolved.group.name}</h1>
        {resolved.group.description && (
          <p className="text-sm text-neutral-700">{resolved.group.description}</p>
        )}
        <p className="text-xs text-neutral-500">{memberCount} members</p>

        <div className="mt-2">
          {myMembership?.status === "APPROVED" ? (
            myMembership.groupRole === "GROUP_OWNER" ? (
              <span className="w-fit rounded-full bg-success-100 px-3 py-1 text-xs font-semibold text-success-700">
                Joined · Owner
              </span>
            ) : (
              <LeaveGroupButton tenantSlug={tenantSlug} groupSlug={groupSlug} />
            )
          ) : myMembership?.status === "PENDING" ? (
            <span className="w-fit rounded-full bg-warning-100 px-3 py-1 text-xs font-semibold text-warning-700">
              Pending Approval
            </span>
          ) : (
            <JoinButton
              tenantSlug={tenantSlug}
              groupSlug={groupSlug}
              requireJoinApproval={resolved.group.requireJoinApproval}
              securityQuestion={resolved.group.securityQuestion}
            />
          )}
        </div>
      </div>

      {isGroupAdmin && (
        <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Pending Requests</h2>
          {resolved.group.securityQuestion && (
            <p className="mt-1 text-xs text-neutral-500">
              Security question: <span className="italic">&ldquo;{resolved.group.securityQuestion}&rdquo;</span>
            </p>
          )}
          <div className="mt-2">
            <PendingRequests tenantSlug={tenantSlug} groupSlug={groupSlug} initialRequests={pendingRequests} />
          </div>
        </div>
      )}

      {isApprovedMember && (
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

      {isGroupAdmin && flaggedPosts.length > 0 && (
        <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Flagged Posts ({flaggedPosts.length})</h2>
          <p className="mt-1 text-xs text-neutral-500">Hidden after 3 or more member reports.</p>
          <ul className="mt-2 flex flex-col gap-3 divide-y divide-neutral-100">
            {flaggedPosts.map((post) => (
              <li key={post.id} className="flex items-start justify-between gap-3 pt-3 first:pt-0">
                <div>
                  <p className="text-sm font-medium text-neutral-900">{post.authorName}</p>
                  <p className="mt-1 text-sm text-neutral-700">{post.content}</p>
                </div>
                <RestoreButton tenantSlug={tenantSlug} postId={post.id} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {isGroupAdmin && (
        <Link
          href={`/${tenantSlug}/groups/${groupSlug}/dues`}
          className="flex items-center gap-3 rounded-lg border border-neutral-100 bg-white p-4 shadow-sm hover:bg-neutral-50"
        >
          <Wallet className="h-4 w-4 shrink-0 text-neutral-500" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-neutral-900">Group Dues</p>
            <p className="text-xs text-neutral-500">Create dues and verify payments for this group</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" strokeWidth={1.75} />
        </Link>
      )}
    </main>
  );
}
