"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";
import { Toggle } from "@/components/ui/toggle";

const GROUP_TYPES = [
  { value: "CLASS_SET", label: "Class Set" },
  { value: "CHAPTER", label: "Chapter" },
  { value: "COMMITTEE", label: "Committee" },
] as const;

export function CreateGroupForm({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof GROUP_TYPES)[number]["value"]>("CLASS_SET");
  const [description, setDescription] = useState("");
  const [requireJoinApproval, setRequireJoinApproval] = useState(true);
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      await fetchJson(`/api/tenants/${tenantSlug}/groups`, {
        method: "POST",
        body: {
          name,
          type,
          description: description || undefined,
          requireJoinApproval,
          securityQuestion: securityQuestion.trim() || undefined,
        },
      });
      setName("");
      setDescription("");
      setSecurityQuestion("");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't create the group.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-neutral-100 bg-white p-4 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-neutral-900">Create a Group</h2>

      {errorMessage && (
        <div className="rounded-md border-l-4 border-error-600 bg-error-100 px-3 py-2 text-xs text-error-700">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Class of 2012"
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="input"
          >
            {GROUP_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

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
        <span className="font-medium text-neutral-700">Security question (optional)</span>
        <input
          value={securityQuestion}
          onChange={(e) => setSecurityQuestion(e.target.value)}
          placeholder="e.g. Who was our JSS3 form teacher?"
          className="input"
        />
        <span className="text-xs text-neutral-500">
          Shown to anyone requesting to join; you review the answer yourself before approving —
          it&apos;s not auto-checked. Setting this forces manual approval.
        </span>
      </label>

      <div className="flex items-center justify-between py-1">
        <div>
          <p className="text-sm text-neutral-900">Require approval to join</p>
          <p className="text-xs text-neutral-500">Off lets any tenant member join instantly</p>
        </div>
        <Toggle
          checked={Boolean(securityQuestion.trim()) || requireJoinApproval}
          onChange={setRequireJoinApproval}
          disabled={Boolean(securityQuestion.trim())}
          label="Require approval to join"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="mt-1 rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
      >
        {submitting ? "Creating..." : "Create Group"}
      </button>
    </form>
  );
}
