"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";

export function TicketActions({
  ticketId,
  status,
  priority,
}: {
  ticketId: string;
  status: string;
  priority: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleChange(field: "status" | "priority", value: string) {
    setSubmitting(true);
    try {
      await fetchJson(`/api/platform/support-tickets/${ticketId}`, {
        method: "PATCH",
        body: { [field]: value },
      });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <select
        value={status}
        disabled={submitting}
        onChange={(e) => handleChange("status", e.target.value)}
        className="rounded-md border border-neutral-300 px-2 py-1 text-xs disabled:opacity-50"
      >
        <option value="OPEN">Open</option>
        <option value="IN_PROGRESS">In Progress</option>
        <option value="RESOLVED">Resolved</option>
      </select>
      <select
        value={priority}
        disabled={submitting}
        onChange={(e) => handleChange("priority", e.target.value)}
        className="rounded-md border border-neutral-300 px-2 py-1 text-xs disabled:opacity-50"
      >
        <option value="LOW">Low</option>
        <option value="MEDIUM">Medium</option>
        <option value="HIGH">High</option>
      </select>
    </div>
  );
}
