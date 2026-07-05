"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";

export function JoinButton({
  tenantSlug,
  groupSlug,
  requireJoinApproval,
}: {
  tenantSlug: string;
  groupSlug: string;
  requireJoinApproval: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "requested">("idle");

  async function handleJoin() {
    setSubmitting(true);
    try {
      await fetchJson(`/api/tenants/${tenantSlug}/groups/${groupSlug}/join`, { method: "POST" });
      setStatus("requested");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "requested") {
    return (
      <span className="rounded-full bg-warning-100 px-3 py-1 text-xs font-semibold text-warning-700">
        Pending Approval
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleJoin}
      disabled={submitting}
      className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
    >
      {submitting ? "..." : requireJoinApproval ? "Request to Join" : "Join"}
    </button>
  );
}
