import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { BottomNav } from "./_components/bottom-nav";
import { TopHeader } from "./_components/top-header";

export default async function MemberLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });

  return (
    <div className="flex flex-1 flex-col bg-neutral-50 pb-16">
      <TopHeader
        tenantSlug={tenantSlug}
        tenantName={tenant?.name ?? "Skola Alumni"}
        tenantLogoUrl={tenant?.logoUrl ?? null}
      />
      {children}
      <BottomNav tenantSlug={tenantSlug} />
    </div>
  );
}
