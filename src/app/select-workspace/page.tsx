import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenantMemberships, tenants, roleAssignments, systemRoles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

async function getWorkspaces(userId: string) {
  const memberships = await db
    .select({
      membershipId: tenantMemberships.id,
      status: tenantMemberships.status,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
    })
    .from(tenantMemberships)
    .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
    .where(eq(tenantMemberships.userId, userId));

  const roleRows = await db
    .select({ membershipId: roleAssignments.tenantMembershipId, roleName: systemRoles.name })
    .from(roleAssignments)
    .innerJoin(systemRoles, eq(roleAssignments.systemRoleId, systemRoles.id));

  const rolesByMembership = new Map<string, string[]>();
  for (const row of roleRows) {
    const list = rolesByMembership.get(row.membershipId) ?? [];
    list.push(row.roleName);
    rolesByMembership.set(row.membershipId, list);
  }

  // Admins are members first — they land in the same home feed as everyone else and reach the
  // admin dashboard from there (Profile → Admin Dashboard), rather than skipping the member
  // experience entirely on login.
  return memberships.map((membership) => {
    const roles = rolesByMembership.get(membership.membershipId) ?? [];
    return {
      ...membership,
      roles,
      destination: `/${membership.tenantSlug}/home`,
    };
  });
}

export default async function SelectWorkspacePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const workspaces = await getWorkspaces(user.id);

  if (workspaces.length === 1) {
    redirect(workspaces[0].destination);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-lg font-semibold text-neutral-900">Welcome back. Select your workspace</h1>

      {workspaces.length === 0 ? (
        <div className="rounded-lg border border-neutral-100 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-neutral-700">You&rsquo;re not part of any association yet.</p>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/sign-up?type=tenant"
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Register a New Alumni Space
            </Link>
            <Link
              href="/explore-schools"
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Join Your School Alumni Space
            </Link>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {workspaces.map((workspace) => (
            <li key={workspace.membershipId}>
              <Link
                href={workspace.destination}
                className="flex items-center justify-between rounded-lg border border-neutral-100 bg-white p-4 shadow-sm hover:border-neutral-500 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{workspace.tenantName}</p>
                  <p className="text-xs text-neutral-500">
                    {workspace.roles[0] ?? "Member"}
                    {workspace.status !== "APPROVED" ? ` — ${workspace.status.toLowerCase()}` : ""}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
