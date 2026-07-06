import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, and, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { dues, payments } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { CreateDueForm } from "./_components/create-due-form";

const FINANCE_ROLES = ["President/School Owner", "Finance Admin"];

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

export default async function TenantDuesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, FINANCE_ROLES);
  if (!authorized) redirect(`/${tenantSlug}/admin`);

  // Group-scoped dues are that group's own affair now — created and verified from the group's
  // own page, not here. This page only handles tenant-wide dues.
  const tenantDues = await db
    .select({
      id: dues.id,
      title: dues.title,
      amount: dues.amount,
      dueDate: dues.dueDate,
      totalCount: sql<number>`count(${payments.id})`.mapWith(Number),
      paidCount: sql<number>`count(${payments.id}) filter (where ${payments.status} = 'PAID')`.mapWith(Number),
      pendingCount: sql<number>`count(${payments.id}) filter (where ${payments.status} = 'PENDING_CONFIRMATION')`.mapWith(
        Number
      ),
      collected: sql<string>`coalesce(sum(${payments.amountPaid}) filter (where ${payments.status} = 'PAID'), 0)`,
    })
    .from(dues)
    .leftJoin(payments, eq(payments.dueId, dues.id))
    .where(and(eq(dues.tenantId, authorized.tenant.id), isNull(dues.groupId)))
    .groupBy(dues.id)
    .orderBy(dues.dueDate);

  return (
    <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Dues & Payments</h1>
          <p className="text-sm text-neutral-500">Create dues invoices and reconcile member payments.</p>
        </div>
        <a
          href={`/api/export/active-dues?tenantSlug=${tenantSlug}`}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Export CSV
        </a>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <CreateDueForm tenantSlug={tenantSlug} />

        <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Active Dues</h2>
          {tenantDues.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">No dues created yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-neutral-100">
              {tenantDues.map((due) => (
                <li key={due.id} className="py-2.5">
                  <Link
                    href={`/${tenantSlug}/admin/dues/${due.id}`}
                    className="flex items-center justify-between hover:underline"
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{due.title}</p>
                      <p className="text-xs text-neutral-500">
                        {formatNaira(Number(due.amount))} · Due {new Date(due.dueDate).toLocaleDateString("en-NG")}
                      </p>
                    </div>
                    <div className="text-right text-xs text-neutral-500">
                      <p>
                        {due.paidCount}/{due.totalCount} paid
                      </p>
                      {due.pendingCount > 0 && (
                        <p className="font-medium text-warning-700">{due.pendingCount} pending review</p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
