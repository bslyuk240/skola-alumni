"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";

export interface PlanData {
  id: string;
  name: string;
  memberLimit: number;
  priceMonthly: number;
  priceYearly: number;
}

export function EditPlanForm({ plan }: { plan: PlanData }) {
  const router = useRouter();
  const [memberLimit, setMemberLimit] = useState(String(plan.memberLimit));
  const [priceMonthly, setPriceMonthly] = useState(String(plan.priceMonthly));
  const [priceYearly, setPriceYearly] = useState(String(plan.priceYearly));
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setSavedAt(null);

    try {
      await fetchJson(`/api/platform/plans/${plan.id}`, {
        method: "PATCH",
        body: {
          memberLimit: Number(memberLimit),
          priceMonthly: Number(priceMonthly),
          priceYearly: Number(priceYearly),
        },
      });
      setSavedAt(Date.now());
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-neutral-100 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">{plan.name}</h2>
        {savedAt && <span className="text-xs font-medium text-success-700">Saved</span>}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700">Member Limit</span>
        <input
          type="number"
          min="1"
          value={memberLimit}
          onChange={(e) => setMemberLimit(e.target.value)}
          className="input"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">Monthly (₦)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={priceMonthly}
            onChange={(e) => setPriceMonthly(e.target.value)}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">Yearly (₦)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={priceYearly}
            onChange={(e) => setPriceYearly(e.target.value)}
            className="input"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-primary-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
      >
        {submitting ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}
