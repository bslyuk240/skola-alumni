import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { tenants, posts, announcements } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getPostFeed } from "@/lib/post-feed";
import { PushNotificationPrompt } from "@/components/push-notification-prompt";
import { PostComposer } from "./_components/post-composer";
import { PostCard } from "./_components/post-card";

export default async function TenantHomePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
  if (!tenant) return null;

  const user = await getCurrentUser();

  const pinnedAnnouncements = await db.query.announcements.findMany({
    where: and(eq(announcements.tenantId, tenant.id), eq(announcements.isPinned, true)),
    orderBy: (table, { desc }) => desc(table.createdAt),
    limit: 3,
  });

  // General community feed only — group-scoped posts belong to their group's own page.
  const feedPosts = await getPostFeed(
    and(eq(posts.tenantId, tenant.id), isNull(posts.groupId), eq(posts.isModerated, false))!,
    user?.id ?? null
  );

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-3">
      {user && <PushNotificationPrompt />}

      {pinnedAnnouncements.map((announcement) => (
        <div key={announcement.id} className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary-600">
            {announcement.title}
          </p>
          <p className="mt-1 text-sm text-neutral-700">{announcement.content}</p>
        </div>
      ))}

      {user && <PostComposer tenantSlug={tenantSlug} />}

      {feedPosts.length === 0 ? (
        <div className="rounded-lg border border-neutral-100 bg-white p-6 text-center shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">No Posts Yet</h2>
          <p className="mt-1 text-sm text-neutral-700">
            There are no updates in this feed. Click &ldquo;Publish Post&rdquo; to share your first update.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {feedPosts.map((post) => (
            <PostCard key={post.id} tenantSlug={tenantSlug} post={post} />
          ))}
        </div>
      )}
    </main>
  );
}
