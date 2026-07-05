"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";

const ASSIGNABLE_ROLES = ["Finance Admin", "Secretary", "Announcement Manager"] as const;

export interface MemberRow {
  membershipId: string;
  fullName: string;
  roles: string[];
}

export function RoleManager({ tenantSlug, members }: { tenantSlug: string; members: MemberRow[] }) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  async function handleAssign(membershipId: string, roleName: string) {
    const key = `${membershipId}-${roleName}`;
    setPendingKey(key);
    try {
      await fetchJson(`/api/tenants/${tenantSlug}/roles/assign`, {
        method: "POST",
        body: { membershipId, roleName },
      });
      router.refresh();
    } finally {
      setPendingKey(null);
    }
  }

  async function handleRevoke(membershipId: string, roleName: string) {
    const key = `${membershipId}-${roleName}`;
    setPendingKey(key);
    try {
      await fetchJson(`/api/tenants/${tenantSlug}/roles/revoke`, {
        method: "POST",
        body: { membershipId, roleName },
      });
      router.refresh();
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <ul className="flex flex-col divide-y divide-neutral-100">
      {members.map((member) => {
        const availableRoles = ASSIGNABLE_ROLES.filter((role) => !member.roles.includes(role));
        return (
          <li key={member.membershipId} className="flex flex-col gap-2 py-3">
            <p className="text-sm font-medium text-neutral-900">{member.fullName}</p>
            <div className="flex flex-wrap items-center gap-2">
              {member.roles.map((role) => (
                <span
                  key={role}
                  className="flex items-center gap-1.5 rounded-full bg-primary-100 px-2.5 py-1 text-xs font-semibold text-primary-700"
                >
                  {role}
                  {role !== "President/School Owner" && (
                    <button
                      type="button"
                      disabled={pendingKey === `${member.membershipId}-${role}`}
                      onClick={() => handleRevoke(member.membershipId, role)}
                      className="text-primary-700 hover:text-primary-900"
                      aria-label={`Remove ${role}`}
                    >
                      &times;
                    </button>
                  )}
                </span>
              ))}
              {availableRoles.length > 0 && (
                <select
                  value=""
                  disabled={pendingKey !== null}
                  onChange={(e) => {
                    if (e.target.value) handleAssign(member.membershipId, e.target.value);
                  }}
                  className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-700"
                >
                  <option value="">+ Assign role</option>
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
