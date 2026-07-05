"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";

export function FreezeToggle({ tenantId, isActive }: { tenantId: string; isActive: boolean }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleToggle() {
    setSubmitting(true);
    try {
      await fetchJson(`/api/platform/tenants/${tenantId}`, {
        method: "PATCH",
        body: { isActive: !isActive },
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
        isActive
          ? "border border-error-600 text-error-600 hover:bg-error-100"
          : "bg-success-600 text-white hover:bg-success-700"
      }`}
    >
      {submitting ? "..." : isActive ? "Freeze" : "Unfreeze"}
    </button>
  );
}
