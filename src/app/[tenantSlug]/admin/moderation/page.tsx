import { redirect } from "next/navigation";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { posts, profiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { RestoreButton } from "./_components/restore-button";

const MODERATOR_ROLES = ["President/School Owner", "Announcement Manager"];

export default async function ModerationQueuePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, MODERATOR_ROLES);
  if (!authorized) redirect(`/${tenantSlug}/admin`);

  const flaggedPosts = await db
    .select({
      id: posts.id,
      content: posts.content,
      createdAt: posts.createdAt,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    })
    .from(posts)
    .innerJoin(profiles, eq(profiles.userId, posts.authorId))
    .where(and(eq(posts.tenantId, authorized.tenant.id), eq(posts.isModerated, true)))
    .orderBy(desc(posts.createdAt));

  return (
    <main className="flex-1 px-6 py-6">
      <h1 className="text-xl font-semibold text-neutral-900">Moderation Queue</h1>
      <p className="text-sm text-neutral-500">Posts hidden after receiving 3 or more member reports.</p>

      <div className="mt-4 rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
        {flaggedPosts.length === 0 ? (
          <p className="text-sm text-neutral-500">No flagged posts right now.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {flaggedPosts.map((post) => (
              <li key={post.id} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    {post.firstName} {post.lastName}
                  </p>
                  <p className="mt-1 text-sm text-neutral-700">{post.content}</p>
                </div>
                <RestoreButton tenantSlug={tenantSlug} postId={post.id} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
