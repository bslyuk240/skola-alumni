"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";

export function CreateTicketForm({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      await fetchJson(`/api/tenants/${tenantSlug}/support-tickets`, {
        method: "POST",
        body: { subject, message, priority },
      });
      setSubject("");
      setMessage("");
      setPriority("MEDIUM");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't file the ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-neutral-100 bg-white p-4 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-neutral-900">File a Ticket</h2>

      {errorMessage && (
        <div className="rounded-md border-l-4 border-error-600 bg-error-100 px-3 py-2 text-xs text-error-700">
          {errorMessage}
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700">Subject</span>
        <input
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Payment not reflecting"
          className="input"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700">Message</span>
        <textarea
          required
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="input resize-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700">Priority</span>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="input">
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
      >
        {submitting ? "Submitting..." : "Submit Ticket"}
      </button>
    </form>
  );
}
