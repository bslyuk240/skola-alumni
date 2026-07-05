import { redirect } from "next/navigation";
import { getPlatformAdminUser } from "@/lib/platform-access";
import { db } from "@/db";
import { EditPlanForm } from "./_components/edit-plan-form";

export default async function PlatformPlansPage() {
  const admin = await getPlatformAdminUser();
  if (!admin) redirect("/");

  const plans = await db.query.subscriptionPlans.findMany({
    orderBy: (table, { asc }) => asc(table.memberLimit),
  });

  return (
    <main className="flex-1 px-6 py-6">
      <h1 className="text-xl font-semibold text-neutral-900">Subscription Plans</h1>
      <p className="text-sm text-neutral-500">
        Configure the member ceilings and pricing tenants see during onboarding.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <EditPlanForm
            key={plan.id}
            plan={{
              id: plan.id,
              name: plan.name,
              memberLimit: plan.memberLimit,
              priceMonthly: Number(plan.priceMonthly),
              priceYearly: Number(plan.priceYearly),
            }}
          />
        ))}
      </div>
    </main>
  );
}
