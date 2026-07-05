"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";

export function RestoreButton({ tenantSlug, postId }: { tenantSlug: string; postId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleRestore() {
    setSubmitting(true);
    try {
      await fetchJson(`/api/tenants/${tenantSlug}/moderation/${postId}`, { method: "PATCH" });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleRestore}
      disabled={submitting}
      className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {submitting ? "Restoring..." : "Restore to Feed"}
    </button>
  );
}
