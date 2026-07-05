import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants, subscriptions, subscriptionPlans } from "@/db/schema";
import { getPlatformAdminUser } from "@/lib/platform-access";

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const STATUS_STYLES: Record<string, string> = {
  TRIALING: "bg-neutral-100 text-neutral-700",
  ACTIVE: "bg-success-100 text-success-700",
  PAST_DUE: "bg-warning-100 text-warning-700",
  CANCELED: "bg-error-100 text-error-700",
};

export default async function PlatformBillingPage() {
  const admin = await getPlatformAdminUser();
  if (!admin) redirect("/");

  const rows = await db
    .select({
      tenantId: tenants.id,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      planName: subscriptionPlans.name,
      status: subscriptions.status,
      billingCycle: subscriptions.billingCycle,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      priceMonthly: subscriptionPlans.priceMonthly,
      priceYearly: subscriptionPlans.priceYearly,
    })
    .from(tenants)
    .leftJoin(subscriptions, eq(subscriptions.tenantId, tenants.id))
    .leftJoin(subscriptionPlans, eq(subscriptionPlans.id, subscriptions.planId))
    .orderBy(tenants.name);

  return (
    <main className="flex-1 px-6 py-6">
      <h1 className="text-xl font-semibold text-neutral-900">Billing & Invoices</h1>
      <p className="text-sm text-neutral-500">
        Current plan, status, and billing cycle per tenant, derived from live subscription state.
      </p>

      <div className="mt-4 overflow-hidden rounded-lg border border-neutral-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-300 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-900">
              <th className="px-4 py-3">Association</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Cycle</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Current Period Ends</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const amount =
                row.status === "TRIALING" || !row.priceMonthly
                  ? null
                  : row.billingCycle === "YEARLY"
                    ? Number(row.priceYearly)
                    : Number(row.priceMonthly);

              return (
                <tr key={row.tenantId} className="border-b border-neutral-100">
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-900">{row.tenantName}</p>
                    <p className="text-xs text-neutral-500">/{row.tenantSlug}</p>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{row.planName ?? "—"}</td>
                  <td className="px-4 py-3">
                    {row.status ? (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[row.status] ?? "bg-neutral-100 text-neutral-700"}`}
                      >
                        {formatStatus(row.status)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {row.billingCycle ? formatStatus(row.billingCycle) : "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {amount !== null ? `₦${amount.toLocaleString("en-NG")}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {row.currentPeriodEnd ? new Date(row.currentPeriodEnd).toLocaleDateString("en-NG") : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-500">No tenants yet.</p>
        )}
      </div>
    </main>
  );
}
