"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "./bottom-nav";
import { TopHeader } from "./top-header";
import { LiveImmersiveProvider, useLiveImmersive } from "./live-immersive";

function MemberChromeInner({
  tenantSlug,
  tenantName,
  tenantLogoUrl,
  children,
}: {
  tenantSlug: string;
  tenantName: string;
  tenantLogoUrl: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const immersive = useLiveImmersive()?.immersive ?? false;
  const hideChrome = immersive || pathname.includes("/live/host");

  return (
    <div className={`flex flex-1 flex-col bg-neutral-50 ${hideChrome ? "" : "pb-16"}`}>
      {!hideChrome && (
        <TopHeader
          tenantSlug={tenantSlug}
          tenantName={tenantName}
          tenantLogoUrl={tenantLogoUrl}
        />
      )}
      {children}
      {!hideChrome && <BottomNav tenantSlug={tenantSlug} />}
    </div>
  );
}

export function MemberChrome({
  tenantSlug,
  tenantName,
  tenantLogoUrl,
  children,
}: {
  tenantSlug: string;
  tenantName: string;
  tenantLogoUrl: string | null;
  children: React.ReactNode;
}) {
  return (
    <LiveImmersiveProvider>
      <MemberChromeInner
        tenantSlug={tenantSlug}
        tenantName={tenantName}
        tenantLogoUrl={tenantLogoUrl}
      >
        {children}
      </MemberChromeInner>
    </LiveImmersiveProvider>
  );
}
