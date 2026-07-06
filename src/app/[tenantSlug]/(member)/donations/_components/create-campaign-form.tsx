"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";

export function CreateCampaignForm({ tenantSlug, groupId }: { tenantSlug: string; groupId?: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      await fetchJson(`/api/tenants/${tenantSlug}/donations`, {
        method: "POST",
        body: {
          title,
          description: description || undefined,
          targetAmount: targetAmount ? Number(targetAmount) : undefined,
          groupId,
        },
      });
      setTitle("");
      setDescription("");
      setTargetAmount("");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't create the campaign.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-neutral-100 bg-white p-4 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-neutral-900">Create a Donation Campaign</h2>

      {errorMessage && (
        <div className="rounded-md border-l-4 border-error-600 bg-error-100 px-3 py-2 text-xs text-error-700">
          {errorMessage}
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700">Title</span>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Building Fund"
          className="input"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700">Description</span>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input resize-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700">Target Amount (₦)</span>
        <input
          type="number"
          min="1"
          step="0.01"
          value={targetAmount}
          onChange={(e) => setTargetAmount(e.target.value)}
          placeholder="Leave blank for open-ended giving"
          className="input"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="mt-1 rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
      >
        {submitting ? "Creating..." : "Create Campaign"}
      </button>
    </form>
  );
}
