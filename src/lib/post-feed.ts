import { desc, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { posts, profiles, comments, reactions } from "@/db/schema";
import type { PostCardData } from "@/app/[tenantSlug]/(member)/home/_components/post-card";

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

/** Shared post-fetching logic (with reactions + comments joined) for the general feed, group
 * feeds, and profile post lists — callers supply the scoping `where` clause. */
export async function getPostFeed(
  whereClause: SQL,
  currentUserId: string | null,
  limit = 30
): Promise<PostCardData[]> {
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
    .where(whereClause)
    .orderBy(desc(posts.createdAt))
    .limit(limit);

  if (rows.length === 0) return [];

  const postIds = rows.map((row) => row.id);

  // Reactions and comments are both scoped only by postIds — independent of each other, so
  // there's no reason to wait for one before starting the other.
  const [allReactions, allComments] = await Promise.all([
    db
      .select({ postId: reactions.postId, userId: reactions.userId })
      .from(reactions)
      .where(inArray(reactions.postId, postIds)),
    db
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
      .orderBy(comments.createdAt),
  ]);

  return rows.map((row) => {
    const postReactions = allReactions.filter((r) => r.postId === row.id);
    const mediaUrls = (row.mediaUrls as string[]) ?? [];

    return {
      id: row.id,
      authorId: row.authorId,
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
