import { notFound } from "next/navigation";
import { eq, and, or, isNull, inArray } from "drizzle-orm";
import { FileText, Users, MapPin, Mail } from "lucide-react";
import { db } from "@/db";
import { tenants, tenantMemberships, profiles, users, posts, groups, groupMemberships } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getPostFeed } from "@/lib/post-feed";
import { PostCard } from "../../home/_components/post-card";

interface PrivacySettings {
  show_phone: boolean;
  show_email: boolean;
  show_whatsapp: boolean;
  show_city: boolean;
  show_business: boolean;
  show_groups: boolean;
  allow_messages: boolean;
}

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ tenantSlug: string; userId: string }>;
}) {
  const { tenantSlug, userId } = await params;

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
  if (!tenant) notFound();

  const row = await db
    .select({
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      avatarUrl: profiles.avatarUrl,
      graduationYear: profiles.graduationYear,
      bio: profiles.bio,
      locationCity: profiles.locationCity,
      locationCountry: profiles.locationCountry,
      industry: profiles.industry,
      occupation: profiles.occupation,
      businessName: profiles.businessName,
      businessDesc: profiles.businessDesc,
      phoneNumber: profiles.phoneNumber,
      privacySettings: profiles.privacySettings,
      email: users.email,
    })
    .from(tenantMemberships)
    .innerJoin(profiles, eq(profiles.userId, tenantMemberships.userId))
    .innerJoin(users, eq(users.id, tenantMemberships.userId))
    .where(
      and(
        eq(tenantMemberships.tenantId, tenant.id),
        eq(tenantMemberships.userId, userId),
        eq(tenantMemberships.status, "APPROVED")
      )
    )
    .then((rows) => rows[0]);

  if (!row) notFound();

  const privacy = row.privacySettings as PrivacySettings;
  const fullName = `${row.firstName} ${row.lastName}`;

  // Group posts are only visible to viewers who are also an approved member of that same group —
  // general community posts (groupId null) are visible to anyone viewing the profile.
  const viewer = await getCurrentUser();

  const viewerGroups = viewer
    ? await db
        .select({ groupId: groupMemberships.groupId })
        .from(groupMemberships)
        .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
        .where(
          and(
            eq(groupMemberships.userId, viewer.id),
            eq(groupMemberships.status, "APPROVED"),
            eq(groups.tenantId, tenant.id)
          )
        )
    : [];
  const viewerGroupIds = viewerGroups.map((g) => g.groupId);

  const visibilityCondition =
    viewerGroupIds.length > 0 ? or(isNull(posts.groupId), inArray(posts.groupId, viewerGroupIds)) : isNull(posts.groupId);

  const authorPosts = await getPostFeed(
    and(
      eq(posts.tenantId, tenant.id),
      eq(posts.authorId, userId),
      eq(posts.isModerated, false),
      visibilityCondition
    )!,
    viewer?.id ?? null
  );

  const ownerGroups = await db
    .select({ groupId: groupMemberships.groupId })
    .from(groupMemberships)
    .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
    .where(
      and(
        eq(groupMemberships.userId, userId),
        eq(groupMemberships.status, "APPROVED"),
        eq(groups.tenantId, tenant.id)
      )
    );
  const groupCount = ownerGroups.length;

  const showStats = authorPosts.length > 0 || (privacy.show_groups && groupCount > 0);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 pb-3">
      <div className="relative mb-12">
        <div className="h-24 bg-gradient-to-br from-primary-700 to-primary-900" />
        <div className="absolute inset-x-0 -bottom-10 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-lg font-semibold text-primary-700 ring-4 ring-white">
            {row.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.avatarUrl} alt={fullName} className="h-full w-full object-cover" />
            ) : (
              fullName
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 px-4 text-center">
        <h1 className="text-lg font-semibold text-neutral-900">{fullName}</h1>
        {row.graduationYear && <p className="text-sm text-neutral-500">Class of {row.graduationYear}</p>}
        {row.bio && <p className="mt-1 text-sm text-neutral-700">{row.bio}</p>}
      </div>

      <div className="px-4">
        {showStats && (
          <div className="flex justify-center gap-3">
            <div className="flex flex-1 flex-col items-center gap-1 rounded-lg border border-neutral-100 bg-white py-3 shadow-sm">
              <FileText className="h-4 w-4 text-primary-600" strokeWidth={1.75} />
              <p className="text-base font-semibold text-neutral-900">{authorPosts.length}</p>
              <p className="text-xs text-neutral-500">Posts</p>
            </div>
            {privacy.show_groups && (
              <div className="flex flex-1 flex-col items-center gap-1 rounded-lg border border-neutral-100 bg-white py-3 shadow-sm">
                <Users className="h-4 w-4 text-primary-600" strokeWidth={1.75} />
                <p className="text-base font-semibold text-neutral-900">{groupCount}</p>
                <p className="text-xs text-neutral-500">Groups</p>
              </div>
            )}
          </div>
        )}

        {privacy.show_whatsapp && row.phoneNumber && (
          <a
            href={`https://wa.me/${row.phoneNumber.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-center gap-2 rounded-lg bg-success-100 py-2.5 text-sm font-medium text-success-700 hover:bg-success-100/70 ${showStats ? "mt-3" : ""}`}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M12.04 2c-5.52 0-10 4.48-10 10 0 1.77.46 3.45 1.27 4.9L2 22l5.25-1.38a9.96 9.96 0 0 0 4.79 1.22h.01c5.52 0 10-4.48 10-10s-4.48-10-10-10Zm0 18.15h-.01a8.2 8.2 0 0 1-4.17-1.14l-.3-.18-3.12.82.83-3.04-.2-.31a8.17 8.17 0 0 1-1.25-4.35c0-4.52 3.68-8.2 8.21-8.2 2.19 0 4.25.85 5.8 2.4a8.15 8.15 0 0 1 2.4 5.8c0 4.52-3.68 8.2-8.19 8.2Zm4.5-6.15c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.24-.42.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.39 1.01 2.56.12.17 1.75 2.67 4.25 3.74.59.26 1.06.41 1.42.52.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.23-.16-.48-.28Z" />
            </svg>
            WhatsApp
          </a>
        )}
      </div>

      {privacy.show_business && (row.industry || row.occupation || row.businessName) && (
        <section className="mx-4 rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Professional</h2>
          {(row.occupation || row.industry) && (
            <p className="mt-1 text-sm text-neutral-700">
              {[row.occupation, row.industry].filter(Boolean).join(" · ")}
            </p>
          )}
          {row.businessName && (
            <p className="mt-2 text-sm font-medium text-neutral-900">{row.businessName}</p>
          )}
          {row.businessDesc && <p className="mt-1 text-xs text-neutral-500">{row.businessDesc}</p>}
        </section>
      )}

      {(privacy.show_city || privacy.show_email) && (
        <section className="mx-4 flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-100 bg-white shadow-sm">
          {privacy.show_city && row.locationCity && (
            <div className="flex items-center gap-3 px-4 py-3">
              <MapPin className="h-4 w-4 shrink-0 text-primary-600" strokeWidth={1.75} />
              <p className="text-sm text-neutral-700">
                {[row.locationCity, row.locationCountry].filter(Boolean).join(", ")}
              </p>
            </div>
          )}
          {privacy.show_email && (
            <a href={`mailto:${row.email}`} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50">
              <Mail className="h-4 w-4 shrink-0 text-primary-600" strokeWidth={1.75} />
              <p className="text-sm text-primary-600">{row.email}</p>
            </a>
          )}
        </section>
      )}

      {authorPosts.length > 0 && (
        <div className="flex flex-col gap-3 px-4">
          {authorPosts.map((post) => (
            <PostCard key={post.id} tenantSlug={tenantSlug} post={post} />
          ))}
        </div>
      )}
    </main>
  );
}
