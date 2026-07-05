import { redirect } from "next/navigation";
import { eq, and, gte, lte, desc, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { AuditFilters } from "./_components/audit-filters";

export default async function AuditLogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ action?: string; from?: string; to?: string }>;
}) {
  const { tenantSlug } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, [
    "President/School Owner",
  ]);
  if (!authorized) redirect(`/${tenantSlug}/admin`);

  const { action, from, to } = await searchParams;

  const conditions: SQL[] = [eq(auditLogs.tenantId, authorized.tenant.id)];
  if (action) conditions.push(eq(auditLogs.action, action));
  if (from) conditions.push(gte(auditLogs.createdAt, new Date(from)));
  if (to) conditions.push(lte(auditLogs.createdAt, new Date(`${to}T23:59:59.999Z`)));

  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      payload: auditLogs.payload,
      createdAt: auditLogs.createdAt,
      actorEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);

  return (
    <main className="flex-1 px-6 py-6">
      <h1 className="text-xl font-semibold text-neutral-900">Audit Logs</h1>
      <p className="text-sm text-neutral-500">
        Append-only record of sensitive actions — role changes, presidency handovers, and payment
        decisions.
      </p>

      <div className="mt-4">
        <AuditFilters initialAction={action ?? ""} initialFrom={from ?? ""} initialTo={to ?? ""} />
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-neutral-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-300 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-900">
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Entity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-neutral-100">
                <td className="px-4 py-3 text-neutral-700">
                  {new Date(row.createdAt).toLocaleString("en-NG")}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-primary-100 px-2.5 py-1 text-xs font-semibold text-primary-700">
                    {row.action.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-700">{row.actorEmail ?? "System"}</td>
                <td className="px-4 py-3 text-xs text-neutral-500">
                  {row.entityType}/{row.entityId.slice(0, 8)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-500">No audit log entries match your filters.</p>
        )}
      </div>
    </main>
  );
}
