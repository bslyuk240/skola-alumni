import Link from "next/link";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { tenants, tenantMemberships, dues, payments, subscriptions } from "@/db/schema";

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-neutral-900">{value}</p>
    </div>
  );
}

async function getWorkspaceMetrics(tenantId: string) {
  const [{ count: liveMembers }] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(tenantMemberships)
    .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.status, "APPROVED")));

  const [{ count: pendingVerification }] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(tenantMemberships)
    .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.status, "PENDING")));

  const [{ total: duesCollected }] = await db
    .select({ total: sql<string>`coalesce(sum(${payments.amountPaid}), 0)` })
    .from(payments)
    .innerJoin(dues, eq(dues.id, payments.dueId))
    .where(and(eq(dues.tenantId, tenantId), eq(payments.status, "PAID")));

  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.tenantId, tenantId),
  });

  return {
    liveMembers,
    pendingVerification,
    duesCollected: Number(duesCollected),
    subscriptionStatus: subscription?.status ?? "—",
  };
}

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default async function TenantAdminOverviewPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
  if (!tenant) return null;

  const setupIncomplete = !tenant.logoUrl || !tenant.bankDetails;
  const metrics = await getWorkspaceMetrics(tenant.id);

  return (
    <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
      <h1 className="text-xl font-semibold text-neutral-900">Workspace Overview</h1>

      {setupIncomplete && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-warning-100 bg-warning-100 px-4 py-3">
          <p className="text-sm text-warning-700">Your workspace setup isn&rsquo;t finished yet.</p>
          <Link
            href={`/onboarding/step-1?tenant=${tenantSlug}`}
            className="text-sm font-medium text-warning-700 underline hover:text-warning-800"
          >
            Finish setup
          </Link>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Live Members" value={String(metrics.liveMembers)} />
        <MetricCard label="Pending Verification" value={String(metrics.pendingVerification)} />
        <MetricCard label="Dues Collected" value={formatNaira(metrics.duesCollected)} />
        <MetricCard label="Subscription Status" value={formatStatus(metrics.subscriptionStatus)} />
      </div>
    </main>
  );
}
