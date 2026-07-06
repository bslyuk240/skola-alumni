import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { supportTickets } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { CreateTicketForm } from "./_components/create-ticket-form";

const ADMIN_ROLES = ["President/School Owner", "Finance Admin", "Secretary", "Announcement Manager"];

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-error-100 text-error-700",
  IN_PROGRESS: "bg-warning-100 text-warning-700",
  RESOLVED: "bg-success-100 text-success-700",
};

export default async function TenantSupportPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, ADMIN_ROLES);
  if (!authorized) redirect(`/${tenantSlug}/admin`);

  const tickets = await db.query.supportTickets.findMany({
    where: eq(supportTickets.tenantId, authorized.tenant.id),
    orderBy: desc(supportTickets.createdAt),
  });

  return (
    <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
      <h1 className="text-xl font-semibold text-neutral-900">Support</h1>
      <p className="text-sm text-neutral-500">Reach the Skola Alumni platform team with an issue or request.</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <CreateTicketForm tenantSlug={tenantSlug} />

        <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Your Tickets</h2>
          {tickets.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">No tickets filed yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-neutral-100">
              {tickets.map((ticket) => (
                <li key={ticket.id} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-neutral-900">{ticket.subject}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[ticket.status]}`}
                    >
                      {ticket.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{ticket.message}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
