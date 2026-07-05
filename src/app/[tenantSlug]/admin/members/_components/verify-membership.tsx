"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";

export function VerifyMembership({ tenantSlug, membershipId }: { tenantSlug: string; membershipId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<"APPROVED" | "REJECTED" | null>(null);

  async function handleDecision(action: "APPROVED" | "REJECTED") {
    setSubmitting(action);
    try {
      await fetchJson(`/api/tenants/${tenantSlug}/members/${membershipId}/verify`, {
        method: "PATCH",
        body: { action },
      });
      router.refresh();
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={submitting !== null}
        onClick={() => handleDecision("APPROVED")}
        className="rounded-md bg-success-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-success-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting === "APPROVED" ? "Approving..." : "Approve and Verify"}
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
  );
}
