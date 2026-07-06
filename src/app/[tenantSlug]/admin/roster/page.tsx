import { redirect } from "next/navigation";
import { eq, and, or, ilike, inArray } from "drizzle-orm";
import { db } from "@/db";
import { tenantMemberships, profiles, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { RosterSearch } from "./_components/roster-search";
import { SuspendToggle } from "./_components/suspend-toggle";

const VERIFIER_ROLES = ["President/School Owner", "Secretary"];

export default async function MemberRosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { tenantSlug } = await params;
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, VERIFIER_ROLES);
  if (!authorized) redirect(`/${tenantSlug}/admin`);

  const rows = await db
    .select({
      membershipId: tenantMemberships.id,
      status: tenantMemberships.status,
      approvedAt: tenantMemberships.approvedAt,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      graduationYear: profiles.graduationYear,
      email: users.email,
    })
    .from(tenantMemberships)
    .innerJoin(profiles, eq(profiles.userId, tenantMemberships.userId))
    .innerJoin(users, eq(users.id, tenantMemberships.userId))
    .where(
      and(
        eq(tenantMemberships.tenantId, authorized.tenant.id),
        inArray(tenantMemberships.status, ["APPROVED", "SUSPENDED"]),
        query
          ? or(ilike(profiles.firstName, `%${query}%`), ilike(profiles.lastName, `%${query}%`))
          : undefined
      )
    )
    .orderBy(profiles.firstName);

  return (
    <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
      <h1 className="text-xl font-semibold text-neutral-900">Members</h1>
      <p className="text-sm text-neutral-500">Full roster of approved members — search, review, and suspend access.</p>

      <div className="mt-4">
        <RosterSearch initialQuery={query} />
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-neutral-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-300 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-900">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.membershipId} className="border-b border-neutral-100">
                <td className="px-4 py-3">
                  <p className="font-medium text-neutral-900">
                    {row.firstName} {row.lastName}
                  </p>
                  {row.graduationYear && (
                    <p className="text-xs text-neutral-500">Class of {row.graduationYear}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-700">{row.email}</td>
                <td className="px-4 py-3 text-neutral-700">
                  {row.approvedAt ? new Date(row.approvedAt).toLocaleDateString("en-NG") : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      row.status === "APPROVED"
                        ? "bg-success-100 text-success-700"
                        : "bg-error-100 text-error-700"
                    }`}
                  >
                    {row.status === "APPROVED" ? "Active" : "Suspended"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <SuspendToggle
                    tenantSlug={tenantSlug}
                    membershipId={row.membershipId}
                    isSuspended={row.status === "SUSPENDED"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {rows.length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-500">No members match your search.</p>
        )}
      </div>
    </main>
  );
}
