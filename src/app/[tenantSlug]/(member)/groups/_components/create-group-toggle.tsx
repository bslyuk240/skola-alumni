"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CreateGroupForm } from "../../../admin/management/_components/create-group-form";

export function CreateGroupToggle({ tenantSlug }: { tenantSlug: string }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
      >
        <Plus className="h-4 w-4" strokeWidth={1.75} />
        Create Group
      </button>
    );
  }

  return (
    <CreateGroupForm tenantSlug={tenantSlug} onSuccess={() => setIsOpen(false)} onCancel={() => setIsOpen(false)} />
  );
}
