import Link from "next/link";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { tenants, groups, groupMemberships } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getApprovedTenantMembership } from "@/lib/tenant-access";
import { JoinButton } from "./_components/join-button";
import { CreateGroupToggle } from "./_components/create-group-toggle";

const TYPE_LABELS: Record<string, string> = {
  CLASS_SET: "Class Set",
  CHAPTER: "Chapter",
  COMMITTEE: "Committee",
};

export default async function GroupsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
  if (!tenant) return null;

  const user = await getCurrentUser();

  const canCreateGroup = user ? Boolean(await getApprovedTenantMembership(user.id, tenantSlug)) : false;

  const tenantGroups = await db.query.groups.findMany({
    where: and(eq(groups.tenantId, tenant.id), eq(groups.isArchived, false)),
  });

  const myMemberships = user
    ? await db.query.groupMemberships.findMany({ where: eq(groupMemberships.userId, user.id) })
    : [];
  const membershipByGroupId = new Map(myMemberships.map((m) => [m.groupId, m]));

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-3">
      <h1 className="text-lg font-semibold text-neutral-900">Groups</h1>

      {canCreateGroup && <CreateGroupToggle tenantSlug={tenantSlug} />}

      {tenantGroups.length === 0 ? (
        <div className="rounded-lg border border-neutral-100 bg-white p-6 text-center shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">No Groups Found</h2>
          <p className="mt-1 text-sm text-neutral-700">
            No class sets or chapters have been created for this association yet.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {tenantGroups.map((group) => {
            const membership = membershipByGroupId.get(group.id);
            return (
              <li
                key={group.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-neutral-100 bg-white p-3 shadow-sm"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                  {group.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={group.avatarUrl} alt={group.name} className="h-full w-full object-cover" />
                  ) : (
                    group.name.slice(0, 2).toUpperCase()
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/${tenantSlug}/groups/${group.slug}`}
                    className="block truncate text-sm font-semibold text-neutral-900 hover:underline"
                  >
                    {group.name}
                  </Link>
                  <p className="truncate text-xs text-neutral-500">{TYPE_LABELS[group.type] ?? group.type}</p>
                </div>

                {membership?.status === "APPROVED" ? (
                  <span className="shrink-0 rounded-full bg-success-100 px-3 py-1 text-xs font-semibold text-success-700">
                    Joined
                  </span>
                ) : membership?.status === "PENDING" ? (
                  <span className="shrink-0 rounded-full bg-warning-100 px-3 py-1 text-xs font-semibold text-warning-700">
                    Pending Approval
                  </span>
                ) : (
                  <JoinButton
                    tenantSlug={tenantSlug}
                    groupSlug={group.slug}
                    requireJoinApproval={group.requireJoinApproval}
                    securityQuestion={group.securityQuestion}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
