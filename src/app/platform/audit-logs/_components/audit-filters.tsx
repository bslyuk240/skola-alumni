"use client";

import { useState, type FormEvent } from "react";
import { useRouter, usePathname } from "next/navigation";

const ACTIONS = ["TENANT_FREEZE", "TENANT_UNFREEZE", "PLAN_UPDATE", "SETTINGS_UPDATE"];

export function AuditFilters({
  initialAction,
  initialFrom,
  initialTo,
}: {
  initialAction: string;
  initialFrom: string;
  initialTo: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [action, setAction] = useState(initialAction);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700">Action</span>
        <select value={action} onChange={(e) => setAction(e.target.value)} className="input">
          <option value="">All actions</option>
          {ACTIONS.map((option) => (
            <option key={option} value={option}>
              {option.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700">From</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700">To</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
      </label>

      <button
        type="submit"
        className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
      >
        Filter
      </button>
    </form>
  );
}
