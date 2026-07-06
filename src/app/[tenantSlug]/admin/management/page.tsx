import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { groups, groupMemberships } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { CreateGroupForm } from "./_components/create-group-form";

const TYPE_LABELS: Record<string, string> = {
  CLASS_SET: "Class Set",
  CHAPTER: "Chapter",
  COMMITTEE: "Committee",
};

export default async function TenantGroupManagementPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, [
    "President/School Owner",
  ]);
  if (!authorized) redirect(`/${tenantSlug}/admin`);

  const tenantGroups = await db
    .select({
      id: groups.id,
      name: groups.name,
      slug: groups.slug,
      type: groups.type,
      requireJoinApproval: groups.requireJoinApproval,
      memberCount: sql<number>`count(${groupMemberships.id}) filter (where ${groupMemberships.status} = 'APPROVED')`.mapWith(
        Number
      ),
      pendingCount: sql<number>`count(${groupMemberships.id}) filter (where ${groupMemberships.status} = 'PENDING')`.mapWith(
        Number
      ),
    })
    .from(groups)
    .leftJoin(groupMemberships, eq(groupMemberships.groupId, groups.id))
    .where(eq(groups.tenantId, authorized.tenant.id))
    .groupBy(groups.id)
    .orderBy(groups.name);

  return (
    <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
      <h1 className="text-xl font-semibold text-neutral-900">Groups Management</h1>
      <p className="text-sm text-neutral-500">Class sets, regional chapters, and committees.</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <CreateGroupForm tenantSlug={tenantSlug} />

        <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Existing Groups</h2>
          {tenantGroups.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">No groups yet — create one to get started.</p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-neutral-100">
              {tenantGroups.map((group) => (
                <li key={group.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{group.name}</p>
                    <p className="text-xs text-neutral-500">
                      {TYPE_LABELS[group.type] ?? group.type} · {group.memberCount} members
                      {group.pendingCount > 0 ? ` · ${group.pendingCount} pending` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-secondary-100 px-2.5 py-1 text-xs font-semibold text-secondary-800">
                    {group.requireJoinApproval ? "Manual Review" : "Open Join"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
