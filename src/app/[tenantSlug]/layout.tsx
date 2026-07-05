import { notFound, redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { tenants, tenantMemberships } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

const STATUS_COPY: Record<string, { title: string; body: string }> = {
  PENDING: {
    title: "Awaiting Verification",
    body: "Your membership request is pending review by an association admin. You'll get access once you're approved.",
  },
  REJECTED: {
    title: "Membership Not Approved",
    body: "Your request to join this association wasn't approved. Contact an admin if you believe this is a mistake.",
  },
  SUSPENDED: {
    title: "Access Suspended",
    body: "Your membership has been suspended. Contact an association admin for details.",
  },
};

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, tenantSlug),
  });

  if (!tenant || !tenant.isActive) {
    notFound();
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const membership = await db.query.tenantMemberships.findFirst({
    where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, user.id)),
  });

  if (!membership) {
    redirect("/select-workspace");
  }

  if (membership.status !== "APPROVED") {
    const copy = STATUS_COPY[membership.status] ?? STATUS_COPY.PENDING;
    return (
      <main className="flex flex-1 items-center justify-center bg-neutral-50 px-6 py-12">
        <div className="w-full max-w-md rounded-lg border border-neutral-100 bg-white p-6 text-center shadow-sm">
          <h1 className="text-base font-semibold text-neutral-900">{copy.title}</h1>
          <p className="mt-2 text-sm text-neutral-700">{copy.body}</p>
        </div>
      </main>
    );
  }

  return <div className="flex flex-1 flex-col">{children}</div>;
}
