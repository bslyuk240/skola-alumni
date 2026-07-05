"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Wallet,
  Headphones,
  Plug,
  Settings,
  ScrollText,
  LogOut,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/platform", label: "Overview", Icon: LayoutDashboard },
  { href: "/platform/tenants", label: "Tenant Management", Icon: Building2 },
  { href: "/platform/plans", label: "Subscription Plans", Icon: CreditCard },
  { href: "/platform/billing", label: "Billing & Invoices", Icon: Wallet },
  { href: "/platform/support", label: "Support Tickets", Icon: Headphones },
  { href: "/platform/integrations", label: "Integrations", Icon: Plug },
  { href: "/platform/settings", label: "Settings", Icon: Settings },
  { href: "/platform/audit-logs", label: "Audit Logs", Icon: ScrollText },
];

export function PlatformSidebar() {
  const pathname = usePathname();
  const { signOut } = useClerk();

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-neutral-100 bg-primary-900">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-500 text-xs font-bold text-primary-900">
          SA
        </div>
        <span className="text-sm font-semibold text-white">Skola Platform</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={isActive ? 2.25 : 1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={() => signOut({ redirectUrl: "/" })}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
          Log Out
        </button>
      </div>
    </aside>
  );
}
