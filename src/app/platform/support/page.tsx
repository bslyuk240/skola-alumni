import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { supportTickets, tenants } from "@/db/schema";
import { getPlatformAdminUser } from "@/lib/platform-access";
import { TicketActions } from "./_components/ticket-actions";

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: "bg-error-100 text-error-700",
  MEDIUM: "bg-warning-100 text-warning-700",
  LOW: "bg-neutral-100 text-neutral-700",
};

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-error-100 text-error-700",
  IN_PROGRESS: "bg-warning-100 text-warning-700",
  RESOLVED: "bg-success-100 text-success-700",
};

export default async function PlatformSupportPage() {
  const admin = await getPlatformAdminUser();
  if (!admin) redirect("/");

  const rows = await db
    .select({
      id: supportTickets.id,
      subject: supportTickets.subject,
      message: supportTickets.message,
      status: supportTickets.status,
      priority: supportTickets.priority,
      createdAt: supportTickets.createdAt,
      tenantName: tenants.name,
    })
    .from(supportTickets)
    .innerJoin(tenants, eq(tenants.id, supportTickets.tenantId))
    .orderBy(desc(supportTickets.createdAt))
    .limit(100);

  return (
    <main className="flex-1 px-6 py-6">
      <h1 className="text-xl font-semibold text-neutral-900">Support Tickets</h1>
      <p className="text-sm text-neutral-500">Requests filed by tenant admins across all associations.</p>

      <div className="mt-4 overflow-hidden rounded-lg border border-neutral-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-300 bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-900">
              <th className="px-4 py-3">Association</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Filed</th>
              <th className="px-4 py-3">Update</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-neutral-100 align-top">
                <td className="px-4 py-3 font-medium text-neutral-900">{row.tenantName}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-neutral-900">{row.subject}</p>
                  <p className="mt-0.5 max-w-md truncate text-xs text-neutral-500">{row.message}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[row.status]}`}>
                    {row.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PRIORITY_STYLES[row.priority]}`}>
                    {row.priority}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-700">
                  {new Date(row.createdAt).toLocaleDateString("en-NG")}
                </td>
                <td className="px-4 py-3">
                  <TicketActions ticketId={row.id} status={row.status} priority={row.priority} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-500">No support tickets have been filed yet.</p>
        )}
      </div>
    </main>
  );
}
