"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { Home, Wallet, Users, UserRound, Radio } from "lucide-react";

export function BottomNav({ tenantSlug }: { tenantSlug: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const items = [
    { href: `/${tenantSlug}/home`, label: "Feed", Icon: Home },
    { href: `/${tenantSlug}/live`, label: "Live", Icon: Radio },
    { href: `/${tenantSlug}/dues`, label: "Dues", Icon: Wallet },
    { href: `/${tenantSlug}/groups`, label: "Groups", Icon: Users },
    { href: `/${tenantSlug}/profile/me`, label: "Profile", Icon: UserRound },
  ];

  // Warm the Live route so the first tap feels instant.
  useEffect(() => {
    router.prefetch(`/${tenantSlug}/live`);
  }, [router, tenantSlug]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-100 bg-white">
      <div className="mx-auto flex w-full max-w-xl">
        {items.map(({ href, label, Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              prefetch
              onClick={(event) => {
                if (
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey ||
                  event.button !== 0
                ) {
                  return;
                }
                event.preventDefault();
                startTransition(() => {
                  router.push(href);
                });
              }}
              className={`flex flex-1 flex-col items-center gap-1 py-3 transition-opacity ${
                isPending && !isActive ? "opacity-60" : ""
              }`}
            >
              <Icon
                className={`h-5 w-5 ${isActive ? "text-primary-600" : "text-neutral-500"} ${
                  isPending && href.endsWith("/live") && !isActive ? "animate-pulse" : ""
                }`}
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
