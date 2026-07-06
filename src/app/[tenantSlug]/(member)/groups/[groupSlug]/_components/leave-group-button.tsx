"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";

export function LeaveGroupButton({ tenantSlug, groupSlug }: { tenantSlug: string; groupSlug: string }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLeave() {
    if (!window.confirm("Leave this group? You'll need to request to join again to come back.")) return;

    setLeaving(true);
    setErrorMessage(null);
    try {
      await fetchJson(`/api/tenants/${tenantSlug}/groups/${groupSlug}/leave`, { method: "DELETE" });
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't leave the group.");
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={leaving}
        onClick={handleLeave}
        className="rounded-md border border-error-200 px-3 py-1.5 text-xs font-medium text-error-700 hover:bg-error-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {leaving ? "Leaving..." : "Leave Group"}
      </button>
      {errorMessage && <p className="text-xs text-error-700">{errorMessage}</p>}
    </div>
  );
}
