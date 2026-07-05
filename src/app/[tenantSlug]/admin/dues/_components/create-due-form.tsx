"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";

interface GroupOption {
  id: string;
  name: string;
}

export function CreateDueForm({ tenantSlug, groups }: { tenantSlug: string; groups: GroupOption[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isMandatory, setIsMandatory] = useState(true);
  const [groupId, setGroupId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      await fetchJson(`/api/tenants/${tenantSlug}/dues`, {
        method: "POST",
        body: {
          title,
          amount: Number(amount),
          dueDate: new Date(dueDate).toISOString(),
          isMandatory,
          groupId: groupId || undefined,
        },
      });
      setTitle("");
      setAmount("");
      setDueDate("");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't create the due.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-neutral-100 bg-white p-4 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-neutral-900">Create a Due</h2>

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
          placeholder="2025 Annual Welfare Levy"
          className="input"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">Amount (₦)</span>
          <input
            required
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">Due Date</span>
          <input
            required
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="input"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700">Scope</span>
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="input">
          <option value="">Entire Tenant</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={isMandatory}
          onChange={(e) => setIsMandatory(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-300"
        />
        Mandatory payment
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="mt-1 rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
      >
        {submitting ? "Creating..." : "Create Due"}
      </button>
    </form>
  );
}
