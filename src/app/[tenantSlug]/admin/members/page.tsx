import { redirect } from "next/navigation";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { tenantMemberships, profiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { VerifyMembership } from "./_components/verify-membership";

const VERIFIER_ROLES = ["President/School Owner", "Secretary"];

export default async function MemberVerificationPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, VERIFIER_ROLES);
  if (!authorized) redirect(`/${tenantSlug}/admin`);

  const pending = await db
    .select({
      membershipId: tenantMemberships.id,
      createdAt: tenantMemberships.createdAt,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      graduationYear: profiles.graduationYear,
    })
    .from(tenantMemberships)
    .innerJoin(profiles, eq(profiles.userId, tenantMemberships.userId))
    .where(and(eq(tenantMemberships.tenantId, authorized.tenant.id), eq(tenantMemberships.status, "PENDING")))
    .orderBy(desc(tenantMemberships.createdAt));

  return (
    <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
      <h1 className="text-xl font-semibold text-neutral-900">Member Verification</h1>
      <p className="text-sm text-neutral-500">Review and approve new registration requests.</p>

      <div className="mt-4 rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
        {pending.length === 0 ? (
          <p className="text-sm text-neutral-500">No pending registrations.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {pending.map((row) => (
              <li key={row.membershipId} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    {row.firstName} {row.lastName}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {row.graduationYear ? `Class of ${row.graduationYear} · ` : ""}
                    Submitted {new Date(row.createdAt).toLocaleDateString("en-NG")}
                  </p>
                </div>
                <VerifyMembership tenantSlug={tenantSlug} membershipId={row.membershipId} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
