"use client";

import { useState } from "react";
import { fetchJson } from "@/lib/fetch-json";

export function CheckoutButton({
  tenantSlug,
  planName,
  billingCycle,
  label,
}: {
  tenantSlug: string;
  planName: "Starter" | "Growth" | "Association";
  billingCycle: "MONTHLY" | "YEARLY";
  label: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCheckout() {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const { authorizationUrl, reference } = await fetchJson<{
        authorizationUrl: string;
        reference: string;
      }>(`/api/tenants/${tenantSlug}/billing/checkout`, {
        method: "POST",
        body: { planName, billingCycle },
      });

      // Backup if Paystack return URL is missed — billing page can still finalize.
      try {
        sessionStorage.setItem(`paystack-pending:${tenantSlug}`, reference);
      } catch {
        // private browsing may block sessionStorage
      }

      window.location.href = authorizationUrl;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't start checkout.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleCheckout}
        disabled={submitting}
        className="w-full rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
      >
        {submitting ? "Redirecting to Paystack..." : label}
      </button>
      {errorMessage && <p className="text-xs text-error-700">{errorMessage}</p>}
    </div>
  );
}
