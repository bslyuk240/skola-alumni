"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";
import { OnboardingShell } from "./onboarding-shell";

interface BankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export function Step2Form({
  tenantSlug,
  currentBankDetails,
}: {
  tenantSlug: string;
  currentBankDetails: BankDetails | null;
}) {
  const router = useRouter();
  const [bankName, setBankName] = useState(currentBankDetails?.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState(currentBankDetails?.accountNumber ?? "");
  const [accountName, setAccountName] = useState(currentBankDetails?.accountName ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      await fetchJson(`/api/tenants/${tenantSlug}`, {
        method: "PATCH",
        body: { bankDetails: { bankName, accountNumber, accountName } },
      });
      router.push(`/onboarding/step-3?tenant=${tenantSlug}`);
    } catch {
      setErrorMessage("Couldn't save your bank details. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <OnboardingShell
      step={2}
      eyebrow="Workspace Setup"
      title="Where should dues go?"
      subtitle="Members will see these details when paying dues by bank transfer."
    >
      {errorMessage && (
        <div className="mb-4 rounded-md border-l-4 border-error-600 bg-error-100 px-4 py-3 text-sm text-error-700">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-neutral-700">Bank Name</span>
          <input
            required
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="Zenith Bank Plc"
            className="input"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-neutral-700">Account Number</span>
          <input
            required
            inputMode="numeric"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="1012398472"
            className="input"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-neutral-700">Account Name</span>
          <input
            required
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="QC Class 1998 Alumnae Association"
            className="input"
          />
        </label>

        <div className="mt-auto flex flex-col gap-3 pt-6">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary-600 px-4 py-3.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
          >
            {submitting ? "Saving..." : "Continue"}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/onboarding/step-3?tenant=${tenantSlug}`)}
            className="text-center text-xs font-medium text-neutral-500 hover:text-neutral-700"
          >
            Skip for now
          </button>
        </div>
      </form>
    </OnboardingShell>
  );
}
