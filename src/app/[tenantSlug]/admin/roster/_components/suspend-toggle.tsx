"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";

export function SuspendToggle({
  tenantSlug,
  membershipId,
  isSuspended,
}: {
  tenantSlug: string;
  membershipId: string;
  isSuspended: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleToggle() {
    setSubmitting(true);
    try {
      await fetchJson(`/api/tenants/${tenantSlug}/members/${membershipId}`, {
        method: "PATCH",
        body: { action: isSuspended ? "REACTIVATE" : "SUSPEND" },
      });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={submitting}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        isSuspended
          ? "bg-success-600 text-white hover:bg-success-700"
          : "border border-error-600 text-error-600 hover:bg-error-100"
      }`}
    >
      {submitting ? "..." : isSuspended ? "Reactivate" : "Suspend"}
    </button>
  );
}
