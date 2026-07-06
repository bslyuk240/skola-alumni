"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";

export function JoinButton({
  tenantSlug,
  groupSlug,
  requireJoinApproval,
  securityQuestion,
}: {
  tenantSlug: string;
  groupSlug: string;
  requireJoinApproval: boolean;
  securityQuestion?: string | null;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "answering" | "requested">("idle");
  const [answer, setAnswer] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function submitJoin(securityAnswer?: string) {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await fetchJson(`/api/tenants/${tenantSlug}/groups/${groupSlug}/join`, {
        method: "POST",
        body: securityAnswer ? { securityAnswer } : undefined,
      });
      setStatus("requested");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't submit your request.");
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

  if (status === "answering") {
    return (
      <div className="flex w-full flex-col gap-2 rounded-md border border-neutral-200 p-3">
        <p className="text-xs font-medium text-neutral-700">{securityQuestion}</p>
        {errorMessage && <p className="text-xs text-error-700">{errorMessage}</p>}
        <input
          autoFocus
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Your answer"
          className="input text-xs"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={submitting || !answer.trim()}
            onClick={() => submitJoin(answer.trim())}
            className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
          >
            {submitting ? "..." : "Submit"}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => setStatus("idle")}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => (securityQuestion ? setStatus("answering") : submitJoin())}
      disabled={submitting}
      className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
    >
      {submitting ? "..." : requireJoinApproval ? "Request to Join" : "Join"}
    </button>
  );
}
