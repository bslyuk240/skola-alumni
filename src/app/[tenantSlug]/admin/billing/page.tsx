import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions, subscriptionPlans } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { getBillingLockStatus } from "@/lib/billing-status";
import { PlanSelector } from "./_components/plan-selector";

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default async function TenantBillingPage({
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

  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.tenantId, authorized.tenant.id),
  });
  const currentPlan = subscription
    ? await db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.id, subscription.planId) })
    : null;

  const allPlans = await db.query.subscriptionPlans.findMany({
    orderBy: (table, { asc }) => asc(table.memberLimit),
  });

  const lockStatus = await getBillingLockStatus(authorized.tenant.id);

  return (
    <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
      <h1 className="text-xl font-semibold text-neutral-900">Billing & Subscription</h1>

      {subscription && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
          <div>
            <p className="text-sm text-neutral-500">Current Status</p>
            <p className="text-base font-semibold text-neutral-900">
              {formatStatus(subscription.status)}
              {currentPlan ? ` — ${currentPlan.name}` : ""}
            </p>
          </div>
          {subscription.status === "TRIALING" && (
            <p className="text-xs text-neutral-500">
              Trial ends {new Date(subscription.trialEnd).toLocaleDateString("en-NG")}
            </p>
          )}
          {subscription.status === "ACTIVE" && (
            <p className="text-xs text-neutral-500">
              Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-NG")}
            </p>
          )}
        </div>
      )}

      {lockStatus.message && (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            lockStatus.locked
              ? "border-error-100 bg-error-100 text-error-700"
              : "border-warning-100 bg-warning-100 text-warning-700"
          }`}
        >
          {lockStatus.message}
        </div>
      )}

      <div className="mt-6">
        <PlanSelector
          tenantSlug={tenantSlug}
          currentPlanName={currentPlan?.name ?? null}
          plans={allPlans.map((plan) => ({
            name: plan.name as "Starter" | "Growth" | "Association",
            memberLimit: plan.memberLimit,
            priceMonthly: Number(plan.priceMonthly),
            priceYearly: Number(plan.priceYearly),
          }))}
        />
      </div>
    </main>
  );
}
