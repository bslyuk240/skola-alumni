import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions, subscriptionPlans } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { getBillingLockStatus } from "@/lib/billing-status";
import { finalizePendingSubscriptionPayment } from "@/lib/finalize-pending-payment";
import { PlanSelector } from "./_components/plan-selector";
import { ConfirmPaymentForm } from "./_components/confirm-payment-form";

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

  const lockStatus = await getBillingLockStatus(authorized.tenant.id);

  // If Paystack's browser return missed our callback, finalize any pending successful charge now.
  let autoActivatedPlan: string | null = null;
  try {
    const finalized = await finalizePendingSubscriptionPayment(authorized.tenant.id);
    if (finalized?.status === "activated") {
      autoActivatedPlan = finalized.planName;
    }
  } catch (error) {
    console.error("[billing] Pending payment finalize failed:", error);
  }

  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.tenantId, authorized.tenant.id),
  });
  const currentPlan = subscription
    ? await db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.id, subscription.planId) })
    : null;

  const allPlans = await db.query.subscriptionPlans.findMany({
    orderBy: (table, { asc }) => asc(table.memberLimit),
  });

  return (
    <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
      <h1 className="text-xl font-semibold text-neutral-900">Billing & Subscription</h1>

      {autoActivatedPlan && (
        <div className="mt-4 rounded-lg border border-success-100 bg-success-100 px-4 py-3 text-sm text-success-700">
          Payment confirmed — you&rsquo;re now on the {autoActivatedPlan} plan.
        </div>
      )}

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

      <ConfirmPaymentForm tenantSlug={tenantSlug} />
    </main>
  );
}
