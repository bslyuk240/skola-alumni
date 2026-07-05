import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
  bigserial,
  unique,
  index,
} from "drizzle-orm/pg-core";

// --- 1. users ---
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  isPlatformAdmin: boolean("is_platform_admin").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- 2. profiles ---
export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 30 }),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  graduationYear: integer("graduation_year"),
  locationCity: varchar("location_city", { length: 100 }),
  locationCountry: varchar("location_country", { length: 100 }),
  industry: varchar("industry", { length: 120 }),
  occupation: varchar("occupation", { length: 150 }),
  businessName: varchar("business_name", { length: 200 }),
  businessDesc: text("business_desc"),
  socialLinks: jsonb("social_links").default({}).notNull(),
  privacySettings: jsonb("privacy_settings")
    .default({
      show_phone: false,
      show_email: false,
      show_whatsapp: true,
      show_city: true,
      show_business: true,
      show_groups: true,
      allow_messages: true,
    })
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_profiles_user_id").on(table.userId),
]);

// --- 3. tenants ---
export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  logoUrl: text("logo_url"),
  bankDetails: jsonb("bank_details"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- 4. tenant_memberships ---
export const tenantMemberships = pgTable("tenant_memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).notNull().default("PENDING"),
  verificationDocs: jsonb("verification_docs").default({}).notNull(),
  approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("unique_user_tenant_membership").on(table.tenantId, table.userId),
  index("idx_t_memberships_tenant_status").on(table.tenantId, table.status),
]);

// --- 5. system_roles ---
export const systemRoles = pgTable("system_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  scope: varchar("scope", { length: 50 }).notNull(), // PLATFORM | TENANT | GROUP
  permissions: jsonb("permissions").notNull(),
});

// --- 6. role_assignments ---
export const roleAssignments = pgTable("role_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantMembershipId: uuid("tenant_membership_id").notNull().references(() => tenantMemberships.id, { onDelete: "cascade" }),
  systemRoleId: uuid("system_role_id").notNull().references(() => systemRoles.id, { onDelete: "cascade" }),
  assignedBy: uuid("assigned_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("unique_membership_role").on(table.tenantMembershipId, table.systemRoleId),
]);

// --- 7. executive_positions ---
export const executivePositions = pgTable("executive_positions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantMembershipId: uuid("tenant_membership_id").notNull().references(() => tenantMemberships.id, { onDelete: "cascade" }),
  titleTag: varchar("title_tag", { length: 100 }).notNull(),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- 8. groups ---
export const groups = pgTable("groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // CLASS_SET | CHAPTER | COMMITTEE
  description: text("description"),
  requireJoinApproval: boolean("require_join_approval").default(true).notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("unique_tenant_group_slug").on(table.tenantId, table.slug),
  index("idx_groups_tenant_lookup").on(table.tenantId, table.isArchived),
]);

// --- 9. group_memberships ---
export const groupMemberships = pgTable("group_memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).notNull(), // PENDING | APPROVED | REJECTED | BANNED
  groupRole: varchar("group_role", { length: 50 }).default("MEMBER").notNull(),
  approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("unique_user_group_membership").on(table.groupId, table.userId),
  index("idx_group_mem_lookup").on(table.groupId, table.status),
]);

// --- 10. posts ---
export const posts = pgTable("posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).default("POST").notNull(), // POST | BUSINESS_ADVERT
  content: text("content").notNull(),
  mediaUrls: jsonb("media_urls").default([]).notNull(),
  isModerated: boolean("is_moderated").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_posts_feed_lookup").on(table.tenantId, table.groupId, table.createdAt),
]);

// --- 11. comments ---
export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- 12. reactions ---
export const reactions = pgTable("reactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(), // LIKE | CELEBRATE | LOVE | INSIGHTFUL
}, (table) => [
  unique("unique_user_post_reaction").on(table.postId, table.userId),
]);

// --- 12b. post_reports (abuse flagging; not in the original 19-table blueprint schema — added in
// Phase 5 since `posts.isModerated` already existed to hold the hidden-state but nothing tracked who
// flagged what) ---
export const postReports = pgTable("post_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  reporterId: uuid("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("unique_user_post_report").on(table.postId, table.reporterId),
]);

// --- 13. announcements ---
export const announcements = pgTable("announcements", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  isPinned: boolean("is_pinned").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_announcements_tenant").on(table.tenantId, table.isPinned, table.createdAt),
]);

// --- 14. dues ---
export const dues = pgTable("dues", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  isMandatory: boolean("is_mandatory").default(true).notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- 15. payments ---
export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  dueId: uuid("due_id").notNull().references(() => dues.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).default("UNPAID").notNull(), // UNPAID | PENDING_CONFIRMATION | PAID | REJECTED
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).default("0.00").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("unique_user_due_payment").on(table.dueId, table.userId),
  index("idx_payments_lookup").on(table.dueId, table.status),
]);

// --- 16. payment_receipts ---
export const paymentReceipts = pgTable("payment_receipts", {
  id: uuid("id").defaultRandom().primaryKey(),
  paymentId: uuid("payment_id").notNull().references(() => payments.id, { onDelete: "cascade" }),
  uploadedBy: uuid("uploaded_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  receiptUrl: text("receipt_url").notNull(),
  transactionDate: timestamp("transaction_date", { withTimezone: true }).notNull(),
  adminNotes: text("admin_notes"),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_receipts_payment").on(table.paymentId),
]);

// --- 17. audit_logs (append-only, non-deletable by convention) ---
export const auditLogs = pgTable("audit_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  // Nullable: platform-level actions (e.g. subscription plan edits) aren't scoped to one tenant.
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 150 }).notNull(), // e.g. PRESIDENCY_TRANSFER, PAYMENT_APPROVE
  entityType: varchar("entity_type", { length: 100 }).notNull(), // e.g. payments, role_assignments, tenants
  entityId: uuid("entity_id").notNull(),
  payload: jsonb("payload"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_audit_logs_query").on(table.tenantId, table.entityType, table.entityId),
]);

// --- 17b. push_subscriptions (FCM device tokens; not in the original 19-table blueprint schema —
// added in Phase 11 for push notifications, mirrors how post_reports was added in Phase 5) ---
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fcmToken: text("fcm_token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- 17c. support_tickets (not in the original 19-table blueprint schema — added when building out
// the Platform Admin portal's Support & Tickets tab) ---
export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  subject: varchar("subject", { length: 255 }).notNull(),
  message: text("message").notNull(),
  status: varchar("status", { length: 20 }).default("OPEN").notNull(), // OPEN | IN_PROGRESS | RESOLVED
  priority: varchar("priority", { length: 20 }).default("MEDIUM").notNull(), // LOW | MEDIUM | HIGH
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_support_tickets_tenant").on(table.tenantId, table.status),
]);

// --- 17d. platform_settings (single-row config table; added alongside support_tickets) ---
export const platformSettings = pgTable("platform_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  trialDays: integer("trial_days").default(14).notNull(),
  gracePeriodDays: integer("grace_period_days").default(3).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- 18. subscription_plans ---
export const subscriptionPlans = pgTable("subscription_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  memberLimit: integer("member_limit").notNull(),
  priceMonthly: numeric("price_monthly", { precision: 12, scale: 2 }).notNull(),
  priceYearly: numeric("price_yearly", { precision: 12, scale: 2 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

// --- 19. subscriptions ---
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").notNull().references(() => subscriptionPlans.id),
  status: varchar("status", { length: 50 }).notNull(), // TRIALING | ACTIVE | PAST_DUE | CANCELED
  billingCycle: varchar("billing_cycle", { length: 20 }).notNull(), // MONTHLY | YEARLY | TRIAL
  trialStart: timestamp("trial_start", { withTimezone: true }).defaultNow().notNull(),
  trialEnd: timestamp("trial_end", { withTimezone: true }).notNull(),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).defaultNow().notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
  paystackReference: varchar("paystack_reference", { length: 255 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_subs_tenant").on(table.tenantId, table.status),
]);
