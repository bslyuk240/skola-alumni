import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { tenantMemberships, profiles, roleAssignments, systemRoles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { RoleManager, type MemberRow } from "./_components/role-manager";
import { PresidencyTransferForm } from "./_components/presidency-transfer-form";

export default async function RolesGovernancePage({
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

  const approvedMembers = await db
    .select({
      membershipId: tenantMemberships.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    })
    .from(tenantMemberships)
    .innerJoin(profiles, eq(profiles.userId, tenantMemberships.userId))
    .where(and(eq(tenantMemberships.tenantId, authorized.tenant.id), eq(tenantMemberships.status, "APPROVED")));

  const allRoleAssignments = await db
    .select({ membershipId: roleAssignments.tenantMembershipId, roleName: systemRoles.name })
    .from(roleAssignments)
    .innerJoin(systemRoles, eq(roleAssignments.systemRoleId, systemRoles.id));

  const rolesByMembership = new Map<string, string[]>();
  for (const row of allRoleAssignments) {
    const list = rolesByMembership.get(row.membershipId) ?? [];
    list.push(row.roleName);
    rolesByMembership.set(row.membershipId, list);
  }

  const memberRows: MemberRow[] = approvedMembers.map((member) => ({
    membershipId: member.membershipId,
    fullName: `${member.firstName} ${member.lastName}`,
    roles: rolesByMembership.get(member.membershipId) ?? [],
  }));

  const transferCandidates = memberRows
    .filter((member) => member.membershipId !== authorized.membership.id)
    .map((member) => ({ membershipId: member.membershipId, fullName: member.fullName }));

  return (
    <main className="flex-1 px-6 py-6">
      <h1 className="text-xl font-semibold text-neutral-900">Roles & Governance</h1>
      <p className="text-sm text-neutral-500">
        Assign executive roles and manage presidency succession.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Executive Roles</h2>
          <RoleManager tenantSlug={tenantSlug} members={memberRows} />
        </div>

        <PresidencyTransferForm tenantSlug={tenantSlug} candidates={transferCandidates} />
      </div>
    </main>
  );
}
