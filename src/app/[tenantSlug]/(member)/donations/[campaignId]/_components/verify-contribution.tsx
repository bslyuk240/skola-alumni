"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";

export function VerifyContribution({ tenantSlug, contributionId }: { tenantSlug: string; contributionId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState<"CONFIRMED" | "REJECTED" | null>(null);

  async function handleDecision(action: "CONFIRMED" | "REJECTED") {
    setSubmitting(action);
    try {
      await fetchJson(`/api/tenants/${tenantSlug}/donation-contributions/${contributionId}/verify`, {
        method: "PATCH",
        body: { action, adminNotes: notes || undefined },
      });
      router.refresh();
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="input"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={submitting !== null}
          onClick={() => handleDecision("CONFIRMED")}
          className="rounded-md bg-success-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-success-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting === "CONFIRMED" ? "Confirming..." : "Confirm Valid Payment"}
        </button>
        <button
          type="button"
          disabled={submitting !== null}
          onClick={() => handleDecision("REJECTED")}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting === "REJECTED" ? "Declining..." : "Decline"}
        </button>
      </div>
    </div>
  );
}
