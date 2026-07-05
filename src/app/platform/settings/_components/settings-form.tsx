"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";

export function SettingsForm({
  trialDays,
  gracePeriodDays,
}: {
  trialDays: number;
  gracePeriodDays: number;
}) {
  const router = useRouter();
  const [trial, setTrial] = useState(String(trialDays));
  const [grace, setGrace] = useState(String(gracePeriodDays));
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setSavedAt(null);

    try {
      await fetchJson("/api/platform/settings", {
        method: "PATCH",
        body: { trialDays: Number(trial), gracePeriodDays: Number(grace) },
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
      className="flex flex-col gap-4 rounded-lg border border-neutral-100 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">Trial & Billing Defaults</h2>
        {savedAt && <span className="text-xs font-medium text-success-700">Saved</span>}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700">Free trial length (days)</span>
        <input
          type="number"
          min="1"
          max="365"
          value={trial}
          onChange={(e) => setTrial(e.target.value)}
          className="input"
        />
        <span className="text-xs text-neutral-500">Applied to new tenant signups only.</span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700">Billing grace period (days)</span>
        <input
          type="number"
          min="0"
          max="90"
          value={grace}
          onChange={(e) => setGrace(e.target.value)}
          className="input"
        />
        <span className="text-xs text-neutral-500">
          Days an active tenant keeps access after their billing period lapses before locking.
        </span>
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="w-fit rounded-md bg-primary-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
      >
        {submitting ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}
