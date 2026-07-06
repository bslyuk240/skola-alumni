"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Users,
  Contact,
  UserCheck,
  Megaphone,
  ShieldAlert,
  Wallet,
  HeartHandshake,
  CreditCard,
  ShieldCheck,
  ScrollText,
  Settings,
  Headphones,
  LogOut,
  Menu,
  X,
  ArrowLeftRight,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  Icon: typeof LayoutDashboard;
  disabled?: boolean;
}

function NavLinks({
  navItems,
  pathname,
  onNavigate,
}: {
  navItems: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {navItems.map(({ href, label, Icon, disabled }) => {
        const isActive = pathname === href;

        if (disabled) {
          return (
            <span
              key={href}
              className="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm text-neutral-500"
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                {label}
              </span>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium">Soon</span>
            </span>
          );
        }

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive ? "bg-primary-100 text-primary-700" : "text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={isActive ? 2.25 : 1.75} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminSidebar({
  tenantSlug,
  tenantName,
  logoUrl,
  planLabel,
}: {
  tenantSlug: string;
  tenantName: string;
  logoUrl: string | null;
  planLabel: string;
}) {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const [isOpen, setIsOpen] = useState(false);

  // Close the drawer on navigation. Adjusting state during render (rather than in an effect)
  // avoids an extra render pass — this is React's recommended pattern for state that should
  // reset when a prop changes.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setIsOpen(false);
  }

  const navItems: NavItem[] = [
    { href: `/${tenantSlug}/admin`, label: "Overview", Icon: LayoutDashboard },
    { href: `/${tenantSlug}/admin/roster`, label: "Members", Icon: Contact },
    { href: `/${tenantSlug}/admin/members`, label: "Member Verification", Icon: UserCheck },
    { href: `/${tenantSlug}/admin/management`, label: "Groups Management", Icon: Users },
    { href: `/${tenantSlug}/admin/announcements`, label: "Announcements", Icon: Megaphone },
    { href: `/${tenantSlug}/admin/moderation`, label: "Moderation", Icon: ShieldAlert },
    { href: `/${tenantSlug}/admin/dues`, label: "Dues & Payments", Icon: Wallet },
    { href: `/${tenantSlug}/admin/donations`, label: "Donations", Icon: HeartHandshake },
    { href: `/${tenantSlug}/admin/roles`, label: "Roles & Governance", Icon: ShieldCheck },
    { href: `/${tenantSlug}/admin/billing`, label: "Billing & Subscription", Icon: CreditCard },
    { href: `/${tenantSlug}/admin/audit-logs`, label: "Audit Logs", Icon: ScrollText },
    { href: `/${tenantSlug}/admin/support`, label: "Support", Icon: Headphones },
    { href: `/${tenantSlug}/admin/settings`, label: "Settings", Icon: Settings, disabled: true },
  ];

  const identity = (
    <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-4">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={tenantName} className="h-8 w-8 rounded-full object-cover" />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
          {tenantName.slice(0, 2).toUpperCase()}
        </div>
      )}
      <span className="truncate text-sm font-semibold text-neutral-900">{tenantName}</span>
    </div>
  );

  const footer = (
    <div className="border-t border-neutral-100 p-3">
      <span className="mb-2 flex w-fit items-center rounded-full bg-secondary-100 px-2.5 py-1 text-xs font-semibold text-secondary-800">
        {planLabel}
      </span>
      <Link
        href={`/${tenantSlug}/home`}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
      >
        <ArrowLeftRight className="h-4 w-4" strokeWidth={1.75} />
        Switch to Member View
      </Link>
      <button
        type="button"
        onClick={() => signOut({ redirectUrl: "/" })}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
      >
        <LogOut className="h-4 w-4" strokeWidth={1.75} />
        Log Out
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-neutral-100 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2 min-w-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={tenantName} className="h-7 w-7 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
              {tenantName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <span className="truncate text-sm font-semibold text-neutral-900">{tenantName}</span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open admin menu"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </header>

      {/* Mobile drawer overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-neutral-900/50" onClick={() => setIsOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-4">
              <span className="truncate text-sm font-semibold text-neutral-900">{tenantName}</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close admin menu"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
            <div className="flex flex-1 flex-col overflow-y-auto">
              <NavLinks navItems={navItems} pathname={pathname} onNavigate={() => setIsOpen(false)} />
              {footer}
            </div>
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-[260px] shrink-0 flex-col border-r border-neutral-100 bg-white lg:flex">
        {identity}
        <NavLinks navItems={navItems} pathname={pathname} />
        {footer}
      </aside>
    </>
  );
}
