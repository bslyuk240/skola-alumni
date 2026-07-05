import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tenants, tenantMemberships, subscriptions, subscriptionPlans } from "@/db/schema";

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-neutral-900">{value}</p>
    </div>
  );
}

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

async function getPlatformMetrics() {
  const totalTenants = await db.$count(tenants);

  const activeSubscriptions = await db.$count(
    subscriptions,
    sql`${subscriptions.status} in ('ACTIVE', 'TRIALING')`
  );

  const totalMembers = await db.$count(tenantMemberships, eq(tenantMemberships.status, "APPROVED"));

  const activeBilledSubs = await db
    .select({
      billingCycle: subscriptions.billingCycle,
      priceMonthly: subscriptionPlans.priceMonthly,
      priceYearly: subscriptionPlans.priceYearly,
    })
    .from(subscriptions)
    .innerJoin(subscriptionPlans, eq(subscriptionPlans.id, subscriptions.planId))
    .where(eq(subscriptions.status, "ACTIVE"));

  const monthlyRevenue = activeBilledSubs.reduce((total, sub) => {
    const monthlyEquivalent =
      sub.billingCycle === "YEARLY" ? Number(sub.priceYearly) / 12 : Number(sub.priceMonthly);
    return total + monthlyEquivalent;
  }, 0);

  return { totalTenants, activeSubscriptions, totalMembers, monthlyRevenue };
}

export default async function PlatformOverviewPage() {
  const metrics = await getPlatformMetrics();

  return (
    <main className="flex-1 px-6 py-6">
      <h1 className="text-xl font-semibold text-neutral-900">Platform Overview</h1>
      <p className="text-sm text-neutral-500">Real-time overview of your Skola platform.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Tenants" value={String(metrics.totalTenants)} />
        <MetricCard label="Active Subscriptions" value={String(metrics.activeSubscriptions)} />
        <MetricCard label="Total Members" value={String(metrics.totalMembers)} />
        <MetricCard label="Monthly Revenue" value={formatNaira(metrics.monthlyRevenue)} />
      </div>
    </main>
  );
}
