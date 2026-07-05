import { getCurrentUser } from "@/lib/auth";

/** Returns the current user if they hold the platform-wide (SaaS owner) admin flag, else null. */
export async function getPlatformAdminUser() {
  const user = await getCurrentUser();
  if (!user?.isPlatformAdmin) return null;
  return user;
}
