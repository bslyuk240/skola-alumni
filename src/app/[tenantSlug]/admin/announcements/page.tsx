import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { announcements } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { CreateAnnouncementForm } from "./_components/create-announcement-form";

const ANNOUNCEMENT_ROLES = ["President/School Owner", "Announcement Manager"];

export default async function TenantAnnouncementsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, ANNOUNCEMENT_ROLES);
  if (!authorized) redirect(`/${tenantSlug}/admin`);

  const tenantAnnouncements = await db.query.announcements.findMany({
    where: eq(announcements.tenantId, authorized.tenant.id),
    orderBy: desc(announcements.createdAt),
  });

  return (
    <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
      <h1 className="text-xl font-semibold text-neutral-900">Announcements</h1>
      <p className="text-sm text-neutral-500">Official updates pinned above the member feed.</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <CreateAnnouncementForm tenantSlug={tenantSlug} />

        <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Published</h2>
          {tenantAnnouncements.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">No announcements published yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-neutral-100">
              {tenantAnnouncements.map((announcement) => (
                <li key={announcement.id} className="py-2.5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-neutral-900">{announcement.title}</p>
                    {announcement.isPinned && (
                      <span className="rounded-full bg-secondary-100 px-2 py-0.5 text-[10px] font-semibold text-secondary-800">
                        Pinned
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{announcement.content}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
