import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { ProfileForm } from "./_components/profile-form";

const DEFAULT_PRIVACY_SETTINGS = {
  show_phone: false,
  show_email: false,
  show_whatsapp: true,
  show_city: true,
  show_business: true,
  show_groups: true,
  allow_messages: true,
};

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) });

  return (
    <ProfileForm
      initial={{
        email: user.email,
        firstName: profile?.firstName ?? "",
        lastName: profile?.lastName ?? "",
        avatarUrl: profile?.avatarUrl ?? null,
        graduationYear: profile?.graduationYear ?? null,
        bio: profile?.bio ?? "",
        locationCity: profile?.locationCity ?? "",
        locationCountry: profile?.locationCountry ?? "",
        industry: profile?.industry ?? "",
        occupation: profile?.occupation ?? "",
        businessName: profile?.businessName ?? "",
        businessDesc: profile?.businessDesc ?? "",
        phoneNumber: profile?.phoneNumber ?? "",
        privacySettings: {
          ...DEFAULT_PRIVACY_SETTINGS,
          ...((profile?.privacySettings as Record<string, boolean>) ?? {}),
        },
      }}
    />
  );
}
