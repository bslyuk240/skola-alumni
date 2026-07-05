import { eq, and, inArray, desc } from "drizzle-orm";
import { db } from "@/db";
import { tenants, posts, profiles, comments, reactions, announcements } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { PushNotificationPrompt } from "@/components/push-notification-prompt";
import { PostComposer } from "./_components/post-composer";
import { PostCard, type PostCardData } from "./_components/post-card";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function getFeedPosts(tenantId: string, currentUserId: string | null): Promise<PostCardData[]> {
  const rows = await db
    .select({
      id: posts.id,
      authorId: posts.authorId,
      type: posts.type,
      content: posts.content,
      mediaUrls: posts.mediaUrls,
      createdAt: posts.createdAt,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      avatarUrl: profiles.avatarUrl,
    })
    .from(posts)
    .innerJoin(profiles, eq(profiles.userId, posts.authorId))
    .where(and(eq(posts.tenantId, tenantId), eq(posts.isModerated, false)))
    .orderBy(desc(posts.createdAt))
    .limit(30);

  if (rows.length === 0) return [];

  const postIds = rows.map((row) => row.id);

  const allReactions = await db
    .select({ postId: reactions.postId, userId: reactions.userId })
    .from(reactions)
    .where(inArray(reactions.postId, postIds));

  const allComments = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      content: comments.content,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    })
    .from(comments)
    .innerJoin(profiles, eq(profiles.userId, comments.authorId))
    .where(inArray(comments.postId, postIds))
    .orderBy(comments.createdAt);

  return rows.map((row) => {
    const postReactions = allReactions.filter((r) => r.postId === row.id);
    const mediaUrls = (row.mediaUrls as string[]) ?? [];

    return {
      id: row.id,
      authorName: `${row.firstName} ${row.lastName}`,
      authorAvatarUrl: row.avatarUrl,
      type: row.type as "POST" | "BUSINESS_ADVERT",
      content: row.content,
      mediaUrl: mediaUrls[0] ?? null,
      createdAtLabel: timeAgo(row.createdAt),
      likeCount: postReactions.length,
      likedByMe: currentUserId ? postReactions.some((r) => r.userId === currentUserId) : false,
      comments: allComments
        .filter((c) => c.postId === row.id)
        .map((c) => ({ id: c.id, authorName: `${c.firstName} ${c.lastName}`, content: c.content })),
    };
  });
}

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
    orderBy: desc(announcements.createdAt),
    limit: 3,
  });

  const feedPosts = await getFeedPosts(tenant.id, user?.id ?? null);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-6">
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
