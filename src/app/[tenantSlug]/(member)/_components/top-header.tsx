"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell } from "lucide-react";

export function TopHeader({
  tenantSlug,
  tenantName,
  tenantLogoUrl,
}: {
  tenantSlug: string;
  tenantName: string;
  tenantLogoUrl: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    router.push(`/${tenantSlug}/directory?${params.toString()}`);
  }

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-100 bg-white">
      <div className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 py-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
          {tenantLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenantLogoUrl} alt={tenantName} className="h-full w-full object-cover" />
          ) : (
            tenantName.slice(0, 2).toUpperCase()
          )}
        </div>

        <form onSubmit={handleSubmit} className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members..."
            className="input py-2 pl-9"
          />
        </form>

        <button
          type="button"
          aria-label="Notifications"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100"
        >
          <Bell className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
