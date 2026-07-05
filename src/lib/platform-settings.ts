import { db } from "@/db";

/** Reads the single platform_settings row, seeded with defaults (14-day trial, 3-day grace). */
export async function getPlatformSettings() {
  const settings = await db.query.platformSettings.findFirst();
  return settings ?? { trialDays: 14, gracePeriodDays: 3 };
}
