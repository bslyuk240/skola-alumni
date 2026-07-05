"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";

export function VerifyPayment({ tenantSlug, paymentId }: { tenantSlug: string; paymentId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState<"APPROVED" | "REJECTED" | null>(null);

  async function handleDecision(action: "APPROVED" | "REJECTED") {
    setSubmitting(action);
    try {
      await fetchJson(`/api/tenants/${tenantSlug}/payments/${paymentId}/verify`, {
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
          onClick={() => handleDecision("APPROVED")}
          className="rounded-md bg-success-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-success-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting === "APPROVED" ? "Approving..." : "Confirm Valid Payment"}
        </button>
        <button
          type="button"
          disabled={submitting !== null}
          onClick={() => handleDecision("REJECTED")}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting === "REJECTED" ? "Declining..." : "Decline Payment"}
        </button>
      </div>
    </div>
  );
}
