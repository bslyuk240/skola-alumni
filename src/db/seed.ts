import { config } from "dotenv";
config({ path: ".env.local" });

// Deliberately bypasses `@/config/env` (and its full-app Zod validation) since this script
// only ever needs DATABASE_URL and shouldn't block on unrelated third-party keys mid-setup.
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { systemRoles, subscriptionPlans } from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run the seed script.");
}

const db = drizzle(neon(process.env.DATABASE_URL), { schema });

const SYSTEM_ROLES = [
  { name: "Platform Admin", scope: "PLATFORM", permissions: { manageAllTenants: true } },
  { name: "President/School Owner", scope: "TENANT", permissions: { manageTenant: true, manageBilling: true, transferPresidency: true } },
  { name: "Finance Admin", scope: "TENANT", permissions: { manageDues: true, verifyPayments: true } },
  { name: "Secretary", scope: "TENANT", permissions: { verifyMembers: true } },
  { name: "Announcement Manager", scope: "TENANT", permissions: { publishAnnouncements: true } },
  { name: "Member", scope: "TENANT", permissions: {} },
  { name: "Group Owner", scope: "GROUP", permissions: { manageGroup: true } },
  { name: "Group Admin", scope: "GROUP", permissions: { approveGroupMembers: true, manageGroupDues: true } },
  { name: "Group Member", scope: "GROUP", permissions: {} },
] as const;

const SUBSCRIPTION_PLANS = [
  { name: "Starter", memberLimit: 100, priceMonthly: "5000.00", priceYearly: "50000.00" },
  { name: "Growth", memberLimit: 300, priceMonthly: "10000.00", priceYearly: "100000.00" },
  { name: "Association", memberLimit: 1000, priceMonthly: "20000.00", priceYearly: "200000.00" },
] as const;

async function main() {
  console.log("[seed] Seeding system_roles...");
  for (const role of SYSTEM_ROLES) {
    await db.insert(systemRoles).values(role).onConflictDoNothing({ target: systemRoles.name });
  }

  console.log("[seed] Seeding subscription_plans...");
  for (const plan of SUBSCRIPTION_PLANS) {
    await db.insert(subscriptionPlans).values(plan).onConflictDoNothing({ target: subscriptionPlans.name });
  }

  console.log("[seed] Done.");
}

main().catch((error) => {
  console.error("[seed] Failed:", error);
  process.exit(1);
});
