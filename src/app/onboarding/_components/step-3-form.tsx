"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { OnboardingShell } from "./onboarding-shell";

type PlanName = "Starter" | "Growth" | "Association";

const PLANS: { name: PlanName; memberLimit: string; priceMonthly: string }[] = [
  { name: "Starter", memberLimit: "Up to 100 members", priceMonthly: "₦5,000/mo" },
  { name: "Growth", memberLimit: "Up to 300 members", priceMonthly: "₦10,000/mo" },
  { name: "Association", memberLimit: "Up to 1,000 members", priceMonthly: "₦20,000/mo" },
];

export function Step3Form({
  tenantSlug,
  currentPlanName,
  trialEndLabel,
  trialDays,
}: {
  tenantSlug: string;
  currentPlanName: PlanName;
  trialEndLabel: string;
  trialDays: number;
}) {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<PlanName>(currentPlanName);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleFinish() {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      if (selectedPlan !== currentPlanName) {
        await fetchJson(`/api/tenants/${tenantSlug}/subscription`, {
          method: "PATCH",
          body: { planName: selectedPlan },
        });
      }
      router.push(`/${tenantSlug}/admin`);
    } catch {
      setErrorMessage("Couldn't save your plan selection. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <OnboardingShell
      step={3}
      eyebrow="Workspace Setup"
      title="Pick your plan"
      subtitle={`You're on a ${trialDays}-day free trial until ${trialEndLabel} — switch anytime before billing starts.`}
    >
      {errorMessage && (
        <div className="mb-4 rounded-md border-l-4 border-error-600 bg-error-100 px-4 py-3 text-sm text-error-700">
          {errorMessage}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3">
        {PLANS.map((plan) => {
          const isSelected = plan.name === selectedPlan;
          return (
            <button
              key={plan.name}
              type="button"
              onClick={() => setSelectedPlan(plan.name)}
              className={`flex items-center justify-between rounded-lg border p-4 text-left transition-colors ${
                isSelected ? "border-primary-600 bg-primary-100" : "border-neutral-300 bg-white"
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-neutral-900">{plan.name}</p>
                <p className="text-xs text-neutral-500">{plan.memberLimit}</p>
                <p className="mt-1 text-xs font-medium text-neutral-700">{plan.priceMonthly}</p>
              </div>
              {isSelected && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-600">
                  <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={handleFinish}
          disabled={submitting}
          className="w-full rounded-md bg-primary-600 px-4 py-3.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
        >
          {submitting ? "Finishing up..." : "Go to Dashboard"}
        </button>
      </div>
    </OnboardingShell>
  );
}
