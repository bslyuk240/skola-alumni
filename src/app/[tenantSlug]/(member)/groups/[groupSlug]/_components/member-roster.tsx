"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";

export interface RosterMember {
  userId: string;
  groupRole: string;
  fullName: string;
  graduationYear: number | null;
}

const ROLE_LABELS: Record<string, string> = {
  GROUP_OWNER: "Owner",
  GROUP_ADMIN: "Admin",
  MEMBER: "Member",
};

export function MemberRoster({
  tenantSlug,
  groupSlug,
  currentUserId,
  isOwner,
  initialMembers,
}: {
  tenantSlug: string;
  groupSlug: string;
  currentUserId: string;
  isOwner: boolean;
  initialMembers: RosterMember[];
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function handleRoleChange(userId: string, groupRole: "MEMBER" | "GROUP_ADMIN") {
    setUpdatingId(userId);
    try {
      await fetchJson(`/api/tenants/${tenantSlug}/groups/${groupSlug}/members`, {
        method: "PATCH",
        body: { userId, groupRole },
      });
      setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, groupRole } : m)));
      router.refresh();
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleTransferOwnership(userId: string, fullName: string) {
    if (!window.confirm(`Make ${fullName} the group owner? You'll become a Group Admin.`)) return;

    setUpdatingId(userId);
    try {
      await fetchJson(`/api/tenants/${tenantSlug}/groups/${groupSlug}/transfer-ownership`, {
        method: "PATCH",
        body: { userId },
      });
      router.refresh();
    } finally {
      setUpdatingId(null);
    }
  }

  if (members.length === 0) {
    return <p className="text-sm text-neutral-500">No approved members yet.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-neutral-100">
      {members.map((member) => (
        <li key={member.userId} className="flex items-center justify-between py-2.5">
          <div>
            <p className="text-sm font-medium text-neutral-900">{member.fullName}</p>
            {member.graduationYear && (
              <p className="text-xs text-neutral-500">Class of {member.graduationYear}</p>
            )}
          </div>

          {isOwner && member.userId !== currentUserId && member.groupRole !== "GROUP_OWNER" ? (
            <div className="flex items-center gap-2">
              <select
                value={member.groupRole}
                disabled={updatingId === member.userId}
                onChange={(e) => handleRoleChange(member.userId, e.target.value as "MEMBER" | "GROUP_ADMIN")}
                className="input w-auto py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="MEMBER">Member</option>
                <option value="GROUP_ADMIN">Admin</option>
              </select>
              <button
                type="button"
                disabled={updatingId === member.userId}
                onClick={() => handleTransferOwnership(member.userId, member.fullName)}
                className="whitespace-nowrap rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Make Owner
              </button>
            </div>
          ) : (
            <span className="rounded-full bg-secondary-100 px-2.5 py-1 text-xs font-semibold text-secondary-800">
              {ROLE_LABELS[member.groupRole] ?? member.groupRole}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
