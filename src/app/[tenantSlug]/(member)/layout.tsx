import { BottomNav } from "./_components/bottom-nav";

export default async function MemberLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  return (
    <div className="flex flex-1 flex-col bg-neutral-50 pb-16">
      {children}
      <BottomNav tenantSlug={tenantSlug} />
    </div>
  );
}
