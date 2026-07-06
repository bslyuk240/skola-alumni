"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";

export interface PendingRequest {
  membershipId: string;
  fullName: string;
  graduationYear: number | null;
  securityAnswer: string | null;
}

export function PendingRequests({
  tenantSlug,
  groupSlug,
  initialRequests,
}: {
  tenantSlug: string;
  groupSlug: string;
  initialRequests: PendingRequest[];
}) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function handleDecision(membershipId: string, action: "APPROVED" | "REJECTED") {
    setProcessingId(membershipId);
    try {
      await fetchJson(`/api/tenants/${tenantSlug}/groups/${groupSlug}/approve`, {
        method: "PATCH",
        body: { membershipId, action },
      });
      setRequests((prev) => prev.filter((r) => r.membershipId !== membershipId));
      router.refresh();
    } finally {
      setProcessingId(null);
    }
  }

  if (requests.length === 0) {
    return <p className="text-sm text-neutral-500">No pending requests.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-neutral-100">
      {requests.map((request) => (
        <li key={request.membershipId} className="flex items-center justify-between py-2.5">
          <div>
            <p className="text-sm font-medium text-neutral-900">{request.fullName}</p>
            {request.graduationYear && (
              <p className="text-xs text-neutral-500">Class of {request.graduationYear}</p>
            )}
            {request.securityAnswer && (
              <p className="mt-1 text-xs text-neutral-700">
                <span className="font-medium">Answer:</span> {request.securityAnswer}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={processingId === request.membershipId}
              onClick={() => handleDecision(request.membershipId, "APPROVED")}
              className="rounded-md bg-success-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-success-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={processingId === request.membershipId}
              onClick={() => handleDecision(request.membershipId, "REJECTED")}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
