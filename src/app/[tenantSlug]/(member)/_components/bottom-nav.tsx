"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, Users, Search, UserRound, Radio } from "lucide-react";

export function BottomNav({ tenantSlug }: { tenantSlug: string }) {
  const pathname = usePathname();

  const items = [
    { href: `/${tenantSlug}/home`, label: "Feed", Icon: Home },
    { href: `/${tenantSlug}/live`, label: "Live", Icon: Radio },
    { href: `/${tenantSlug}/dues`, label: "Dues", Icon: Wallet },
    { href: `/${tenantSlug}/groups`, label: "Groups", Icon: Users },
    { href: `/${tenantSlug}/profile/me`, label: "Profile", Icon: UserRound },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-100 bg-white">
      <div className="mx-auto flex w-full max-w-xl">
        {items.map(({ href, label, Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center gap-1 py-3"
            >
              <Icon
                className={`h-5 w-5 ${isActive ? "text-primary-600" : "text-neutral-500"}`}
                strokeWidth={isActive ? 2.25 : 1.75}
              />
              <span
                className={`text-[11px] font-medium ${isActive ? "text-primary-600" : "text-neutral-500"}`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
