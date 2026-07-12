"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";

export function ConfirmPaymentForm({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const result = await fetchJson<{ planName: string; alreadyApplied: boolean }>(
        `/api/tenants/${tenantSlug}/billing/confirm`,
        { method: "POST", body: { reference: reference.trim() } }
      );
      setMessage(
        result.alreadyApplied
          ? `${result.planName} was already active for this payment.`
          : `Activated ${result.planName} successfully.`
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't confirm this payment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 rounded-lg border border-neutral-100 bg-white p-4 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-neutral-900">Paid but plan didn&rsquo;t update?</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Paste the Paystack payment reference from your email or Paystack dashboard to activate the
        plan manually.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          required
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Paystack reference"
          className="input flex-1 text-sm"
        />
        <button
          type="submit"
          disabled={submitting || !reference.trim()}
          className="rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {submitting ? "Confirming..." : "Confirm payment"}
        </button>
      </div>
      {message && <p className="mt-2 text-xs text-success-700">{message}</p>}
      {errorMessage && <p className="mt-2 text-xs text-error-700">{errorMessage}</p>}
    </form>
  );
}
