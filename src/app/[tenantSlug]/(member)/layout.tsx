import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { MemberChrome } from "./_components/member-chrome";

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
    <MemberChrome
      tenantSlug={tenantSlug}
      tenantName={tenant?.name ?? "Skola Alumni"}
      tenantLogoUrl={tenant?.logoUrl ?? null}
    >
      {children}
    </MemberChrome>
  );
}
