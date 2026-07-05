import { redirect } from "next/navigation";
import { eq, sql, or, ilike } from "drizzle-orm";
import { db } from "@/db";
import { tenants, tenantMemberships, subscriptions } from "@/db/schema";
import { getPlatformAdminUser } from "@/lib/platform-access";
import { TenantSearch } from "./_components/tenant-search";
import { FreezeToggle } from "./_components/freeze-toggle";

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default async function PlatformTenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const admin = await getPlatformAdminUser();
  if (!admin) redirect("/");

  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      isActive: tenants.isActive,
      createdAt: tenants.createdAt,
      memberCount: sql<number>`count(distinct ${tenantMemberships.id}) filter (where ${tenantMemberships.status} = 'APPROVED')`.mapWith(
        Number
      ),
      subscriptionStatus: sql<string>`max(${subscriptions.status})`,
    })
    .from(tenants)
    .leftJoin(tenantMemberships, eq(tenantMemberships.tenantId, tenants.id))
    .leftJoin(subscriptions, eq(subscriptions.tenantId, tenants.id))
    .where(query ? or(ilike(tenants.name, `%${query}%`), ilike(tenants.slug, `%${query}%`)) : undefined)
    .groupBy(tenants.id)
    .orderBy(tenants.createdAt);

  return (
    <main className="flex-1 px-6 py-6">
      <h1 className="text-xl font-semibold text-neutral-900">Tenant Management</h1>
      <p className="text-sm text-neutral-500">Search, review, and enforce policy across all tenants.</p>

      <div className="mt-4">
        <TenantSearch initialQuery={query} />
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-neutral-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-300 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-900">
              <th className="px-4 py-3">Association</th>
              <th className="px-4 py-3">Members</th>
              <th className="px-4 py-3">Subscription</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-neutral-100">
                <td className="px-4 py-3">
                  <p className="font-medium text-neutral-900">{row.name}</p>
                  <p className="text-xs text-neutral-500">/{row.slug}</p>
                </td>
                <td className="px-4 py-3 text-neutral-700">{row.memberCount}</td>
                <td className="px-4 py-3 text-neutral-700">
                  {row.subscriptionStatus ? formatStatus(row.subscriptionStatus) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      row.isActive ? "bg-success-100 text-success-700" : "bg-error-100 text-error-700"
                    }`}
                  >
                    {row.isActive ? "Active" : "Frozen"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <FreezeToggle tenantId={row.id} isActive={row.isActive} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-500">No tenants match your search.</p>
        )}
      </div>
    </main>
  );
}
