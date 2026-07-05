"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";

const CONFIRMATION_PHRASE = "TRANSFER PRESIDENCY";

interface MemberOption {
  membershipId: string;
  fullName: string;
}

export function PresidencyTransferForm({
  tenantSlug,
  candidates,
}: {
  tenantSlug: string;
  candidates: MemberOption[];
}) {
  const router = useRouter();
  const [membershipId, setMembershipId] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isConfirmed = confirmationText === CONFIRMATION_PHRASE;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!membershipId) {
      setErrorMessage("Select a verified member to initiate transfer.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await fetchJson(`/api/tenants/${tenantSlug}/transfer-presidency`, {
        method: "POST",
        body: { newPresidentMembershipId: membershipId, confirmationText },
      });
      router.push(`/${tenantSlug}/admin`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't complete the transfer.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-error-100 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-error-700">Transfer Presidency</h2>
      <p className="text-xs text-neutral-500">
        This immediately moves full administrative control to the selected member and cannot be undone
        by you alone.
      </p>

      {errorMessage && (
        <div className="rounded-md border-l-4 border-error-600 bg-error-100 px-3 py-2 text-xs text-error-700">
          {errorMessage}
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700">Successor</span>
        <select
          value={membershipId}
          onChange={(e) => setMembershipId(e.target.value)}
          className="input"
        >
          <option value="">Select a verified member...</option>
          {candidates.map((candidate) => (
            <option key={candidate.membershipId} value={candidate.membershipId}>
              {candidate.fullName}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700">
          Type <span className="font-mono">{CONFIRMATION_PHRASE}</span> to confirm
        </span>
        <input
          value={confirmationText}
          onChange={(e) => setConfirmationText(e.target.value)}
          className="input"
        />
      </label>

      <button
        type="submit"
        disabled={submitting || !isConfirmed || !membershipId}
        className="rounded-md bg-error-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-error-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
      >
        {submitting ? "Transferring..." : "Transfer Presidency"}
      </button>
    </form>
  );
}
