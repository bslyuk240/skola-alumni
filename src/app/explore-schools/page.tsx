import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tenants, tenantMemberships } from "@/db/schema";

// No auth/cookies/searchParams here to signal dynamic rendering, so Next.js would otherwise
// prerender this once at build time and never show schools registered after that build.
export const dynamic = "force-dynamic";

async function getActiveTenants() {
  return db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      logoUrl: tenants.logoUrl,
      memberCount: sql<number>`count(${tenantMemberships.id}) filter (where ${tenantMemberships.status} = 'APPROVED')`.mapWith(Number),
    })
    .from(tenants)
    .leftJoin(tenantMemberships, eq(tenantMemberships.tenantId, tenants.id))
    .where(eq(tenants.isActive, true))
    .groupBy(tenants.id)
    .orderBy(tenants.name);
}

export default async function ExploreSchoolsPage() {
  const schools = await getActiveTenants();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-10">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Find your alumni association</h1>
        <p className="mt-1 text-sm text-neutral-700">
          Search the directory of registered schools and associations, then request to join.
        </p>
      </div>

      {schools.length === 0 ? (
        <div className="rounded-lg border border-neutral-100 bg-white p-6 text-center shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">No Schools Found</h2>
          <p className="mt-1 text-sm text-neutral-700">
            No associations have registered yet.{" "}
            <Link href="/sign-up?type=tenant" className="text-primary-600 hover:underline">
              Register yours
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {schools.map((school) => (
            <li
              key={school.id}
              className="flex items-center justify-between rounded-lg border border-neutral-100 bg-white p-4 shadow-sm"
            >
              <div>
                <p className="text-sm font-semibold text-neutral-900">{school.name}</p>
                <p className="text-xs text-neutral-500">{school.memberCount} verified members</p>
              </div>
              <Link
                href={`/sign-up?type=member&school=${school.slug}`}
                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
              >
                Request to Join
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
