"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { CheckoutButton } from "./checkout-button";

interface PlanOption {
  name: "Starter" | "Growth" | "Association";
  memberLimit: number;
  priceMonthly: number;
  priceYearly: number;
}

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

export function PlanSelector({ tenantSlug, plans, currentPlanName }: { tenantSlug: string; plans: PlanOption[]; currentPlanName: string | null }) {
  const [cycle, setCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-fit rounded-md border border-neutral-300 p-1 text-sm">
        <button
          type="button"
          onClick={() => setCycle("MONTHLY")}
          className={`rounded px-3 py-1.5 font-medium ${cycle === "MONTHLY" ? "bg-primary-600 text-white" : "text-neutral-700"}`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setCycle("YEARLY")}
          className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-medium ${cycle === "YEARLY" ? "bg-primary-600 text-white" : "text-neutral-700"}`}
        >
          Yearly
          <span className="rounded-full bg-secondary-100 px-2 py-0.5 text-[10px] font-semibold text-secondary-800">
            Save 2 Months
          </span>
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.name === currentPlanName;
          const price = cycle === "YEARLY" ? plan.priceYearly : plan.priceMonthly;

          return (
            <div
              key={plan.name}
              className={`flex flex-col gap-3 rounded-lg border p-4 ${
                isCurrent ? "border-primary-600 bg-primary-100" : "border-neutral-100 bg-white"
              } shadow-sm`}
            >
              <div>
                <p className="text-sm font-semibold text-neutral-900">{plan.name}</p>
                <p className="text-xs text-neutral-500">Up to {plan.memberLimit.toLocaleString()} members</p>
              </div>
              <p className="text-2xl font-bold text-neutral-900">
                {formatNaira(price)}
                <span className="text-xs font-normal text-neutral-500">
                  /{cycle === "YEARLY" ? "yr" : "mo"}
                </span>
              </p>

              {isCurrent ? (
                <span className="flex items-center gap-1.5 rounded-md bg-success-100 px-3 py-2 text-xs font-semibold text-success-700">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  Current Plan
                </span>
              ) : (
                <CheckoutButton
                  tenantSlug={tenantSlug}
                  planName={plan.name}
                  billingCycle={cycle}
                  label={`Switch to ${plan.name}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
