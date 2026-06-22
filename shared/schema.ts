import { pgTable, text, serial, jsonb, boolean, timestamp, integer, varchar, pgEnum, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const proAccessCodes = pgTable("pro_access_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  note: text("note"),
  usedAt: timestamp("used_at"),
  usedByIp: text("used_by_ip"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const proFriendTokens = pgTable("pro_friend_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  note: text("note"),
  usedAt: timestamp("used_at"),
  usedByIp: text("used_by_ip"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ProAccessCode = typeof proAccessCodes.$inferSelect;
export type ProFriendToken = typeof proFriendTokens.$inferSelect;

export const presets = pgTable("presets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  config: jsonb("config").notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  ownerId: text("owner_id"),
});

export const startupApps = pgTable("startup_apps", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  path: text("path").notNull(),
  isEnabled: boolean("is_enabled").default(true),
});

export const optimizations = pgTable("optimizations", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  command: text("command").notNull(),
  isApplied: boolean("is_applied").default(false),
});

export const siteVisits = pgTable("site_visits", {
  id: serial("id").primaryKey(),
  visitedAt: timestamp("visited_at").defaultNow(),
  referrer: text("referrer"),
});

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  tag: text("tag").default("update"),
  tweakIds: text("tweak_ids").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});
export type Announcement = typeof announcements.$inferSelect;
export const insertAnnouncementSchema = createInsertSchema(announcements).omit({ id: true, createdAt: true });
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;

export const scriptDownloads = pgTable("script_downloads", {
  id: serial("id").primaryKey(),
  tweakCount: integer("tweak_count").notNull().default(0),
  tweakIds: text("tweak_ids").array().default([]),
  sessionToken: varchar("session_token", { length: 64 }),
  downloadedAt: timestamp("downloaded_at").defaultNow(),
});
export type ScriptDownload = typeof scriptDownloads.$inferSelect;

// Manual payment log — for CashApp / PayPal payments logged by admin
export const manualPayments = pgTable("manual_payments", {
  id: serial("id").primaryKey(),
  amount: integer("amount").notNull(), // dollars
  method: text("method").notNull(),    // "cashapp" | "paypal"
  note: text("note"),                  // customer name / $cashtag / PayPal ref
  paidAt: timestamp("paid_at").defaultNow(),
});
export type ManualPayment = typeof manualPayments.$inferSelect;
export const insertManualPaymentSchema = createInsertSchema(manualPayments).omit({ id: true, paidAt: true });
export type InsertManualPayment = z.infer<typeof insertManualPaymentSchema>;

// IP access log — tracks every unique IP per pro code for sharing detection
export const proIpLogs = pgTable("pro_ip_logs", {
  id: serial("id").primaryKey(),
  codeRef: text("code_ref").notNull(),
  ipAddress: text("ip_address").notNull(),
  city: text("city"),
  region: text("region"),
  country: text("country"),
  isp: text("isp"),
  lat: text("lat"),
  lon: text("lon"),
  seenAt: timestamp("seen_at").defaultNow(),
});
export type ProIpLog = typeof proIpLogs.$inferSelect;

// Pro session tokens — server-side validation prevents localStorage spoofing exploit
export const proSessions = pgTable("pro_sessions", {
  id: serial("id").primaryKey(),
  sessionToken: varchar("session_token", { length: 64 }).notNull().unique(),
  codeRef: text("code_ref"), // the code or friend token that was redeemed
  createdAt: timestamp("created_at").defaultNow(),
  lastCheckedAt: timestamp("last_checked_at").defaultNow(),
  ipAddress: text("ip_address"), // last seen IP address
  discordUserId: text("discord_user_id"), // stamped on verify when Discord session is active
});
export type ProSession = typeof proSessions.$inferSelect;

export const emailRequests = pgTable("email_requests", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  paymentMethod: text("payment_method").notNull(),
  paymentRef: text("payment_ref").notNull(),
  discordUsername: text("discord_username"),
  // Task #41: capture the buyer's Discord user ID so admin "Send Code"
  // can also call grantPro() and bind the manual CashApp/PayPal purchase
  // to a lifetime entitlement.
  discordUserId: text("discord_user_id"),
  amountPaid: integer("amount_paid"),
  status: text("status").notNull().default("pending"),
  sentCodeId: integer("sent_code_id"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type EmailRequest = typeof emailRequests.$inferSelect;
export const insertEmailRequestSchema = createInsertSchema(emailRequests).omit({ id: true, createdAt: true, status: true, sentCodeId: true, note: true });
export type InsertEmailRequest = z.infer<typeof insertEmailRequestSchema>;

// Security events — Aether Intelligence Center persisted threat log
export type SecurityEventType = "code_sharing" | "vpn_detected" | "rate_block" | "multi_ip" | "manual_flag";
export type SecuritySeverity = "low" | "medium" | "high" | "critical";

export const securityEvents = pgTable("security_events", {
  id: serial("id").primaryKey(),
  type: text("type").$type<SecurityEventType>().notNull(),
  codeRef: text("code_ref"),
  ip: text("ip").notNull(),
  country: text("country"),
  isp: text("isp"),
  details: text("details").notNull(),
  severity: text("severity").$type<SecuritySeverity>().notNull().default("medium"),
  resolvedAt: timestamp("resolved_at"),
  alertSentAt: timestamp("alert_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
export type SecurityEvent = typeof securityEvents.$inferSelect;

// Auto-resolve run history — one row per job execution
export const autoResolveRuns = pgTable("auto_resolve_runs", {
  id: serial("id").primaryKey(),
  resolvedCount: integer("resolved_count").notNull().default(0),
  windowDays: integer("window_days").notNull().default(30),
  ranAt: timestamp("ran_at").defaultNow(),
});
export type AutoResolveRun = typeof autoResolveRuns.$inferSelect;

// Admin settings — single-row config table (id always = 1)
export const adminSettings = pgTable("admin_settings", {
  id: serial("id").primaryKey(),
  discordWebhookUrl: text("discord_webhook_url"),
  alertEmail: text("alert_email"),
  autoResolveDays: integer("auto_resolve_days").default(30),
  lastAutoResolvedCount: integer("last_auto_resolved_count").default(0),
  lastAutoResolvedAt: timestamp("last_auto_resolved_at"),
  // App version + auto-update config (Task #27)
  currentVersion: text("current_version").default("2.00"),
  latestVersion: text("latest_version").default("2.00"),
  updaterCmdUrl: text("updater_cmd_url"),
  updatePageUrl: text("update_page_url"),
  // Aether Intelligence alert toggles (Task #36)
  alertOnNewRig: boolean("alert_on_new_rig").notNull().default(true),
  alertOnNewNvidiaDriver: boolean("alert_on_new_nvidia_driver").notNull().default(true),
  // Audit log toggle (Task #39) — when enabled, every applied/undone tweak posts
  // to auditWebhookUrl (separate Discord channel from security alerts).
  auditLogEnabled: boolean("audit_log_enabled").notNull().default(false),
  auditWebhookUrl: text("audit_webhook_url"),
});
export type AdminSettings = typeof adminSettings.$inferSelect;

// Pro entitlements (Task #41) — Discord-user-keyed lifetime Pro grants.
// Replaces localStorage-only Pro status. One row per Discord user; once a
// user is in this table (and revokedAt is null), they are Pro on every
// device they sign into. Legacy localStorage tokens still work for guests
// but are auto-migrated to an entitlement on first authenticated visit.
// Constrained provenance values — enforced at the DB level so admin tooling
// and webhooks can only record one of the documented sources.
export const PRO_SOURCES = ["stripe", "cashapp", "paypal", "code", "friend", "legacy", "admin"] as const;
export type ProSource = (typeof PRO_SOURCES)[number];
export const proSourceEnum = pgEnum("pro_source", PRO_SOURCES);
export const proEntitlements = pgTable("pro_entitlements", {
  discordUserId: text("discord_user_id").primaryKey(),
  source: proSourceEnum("source").notNull(),
  grantedAt: timestamp("granted_at").defaultNow(),
  grantedBy: text("granted_by"),    // admin discord ID (manual grants), null otherwise
  notes: text("notes"),             // free-form context: stripe session id, code value, etc.
  revokedAt: timestamp("revoked_at"),
});
export type ProEntitlement = typeof proEntitlements.$inferSelect;
export const insertProEntitlementSchema = createInsertSchema(proEntitlements).omit({ grantedAt: true, revokedAt: true });
export type InsertProEntitlement = z.infer<typeof insertProEntitlementSchema>;

// Discord-authenticated users — drives the login wall (Task #27)
export const users = pgTable("users", {
  discordId: text("discord_id").primaryKey(),
  username: text("username").notNull(),
  globalName: text("global_name"),
  avatarUrl: text("avatar_url"),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow(),
  lastLoginAt: timestamp("last_login_at").defaultNow(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// IP bans — persistent bans that survive server restarts
export const ipBans = pgTable("ip_bans", {
  id: serial("id").primaryKey(),
  ip: text("ip").notNull().unique(),
  reason: text("reason").notNull(),
  permanent: boolean("permanent").default(false),
  bannedAt: timestamp("banned_at").defaultNow(),
});
export type IpBan = typeof ipBans.$inferSelect;

// AI chat sessions — persists Opti Gods AI conversations per browser session
export type AiChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export const aiChatSessions = pgTable("ai_chat_sessions", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 64 }).notNull().unique(),
  messages: jsonb("messages").$type<AiChatMessage[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type AiChatSession = typeof aiChatSessions.$inferSelect;

// Customer hardware snapshots — stored when a Pro user uploads their scan file
export const customerHardware = pgTable("customer_hardware", {
  codeRef: text("code_ref").primaryKey(),
  gpuVendor: varchar("gpu_vendor", { length: 20 }),
  gpuName: varchar("gpu_name", { length: 200 }),
  cpuModel: varchar("cpu_model", { length: 200 }),
  cpuCores: integer("cpu_cores"),
  cpuThreads: integer("cpu_threads"),
  ramGb: integer("ram_gb"),
  osVersion: varchar("os_version", { length: 20 }),
  isLaptop: boolean("is_laptop").default(false),
  savedAt: timestamp("saved_at").defaultNow(),
});
export type CustomerHardware = typeof customerHardware.$inferSelect;

// User-submitted issue reports — triaged by Aether, reviewed by admin
export type ReportCategory = "script_not_working" | "tweak_problem" | "crash" | "other";
export type ReportStatus = "open" | "acknowledged" | "resolved";

export const userReports = pgTable("user_reports", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id"),
  category: text("category").$type<ReportCategory>().notNull(),
  description: text("description").notNull(),
  systemInfo: jsonb("system_info").$type<Record<string, unknown>>(),
  status: text("status").$type<ReportStatus>().notNull().default("open"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});
export type UserReport = typeof userReports.$inferSelect;
export const insertUserReportSchema = createInsertSchema(userReports).omit({ id: true, createdAt: true, resolvedAt: true, adminNote: true, status: true });
export type InsertUserReport = z.infer<typeof insertUserReportSchema>;

// Hardware rigs — deduplicated by stable hash, ingested by the desktop scanner
export const hardwareRigs = pgTable("hardware_rigs", {
  id: serial("id").primaryKey(),
  hash: varchar("hash", { length: 64 }).notNull().unique(),
  discordUserId: text("discord_user_id"),
  proCode: text("pro_code"),
  cpu: text("cpu").notNull(),
  gpu: text("gpu").notNull(),
  vramMb: integer("vram_mb"),
  ramGb: integer("ram_gb"),
  ramMhz: integer("ram_mhz"),
  motherboard: text("motherboard"),
  chassis: text("chassis"),
  coolingType: text("cooling_type"),
  refreshHz: integer("refresh_hz"),
  nicVendor: text("nic_vendor"),
  storageSummary: jsonb("storage_summary").$type<Record<string, unknown>>(),
  anticheats: text("anticheats").array().default([]),
  firstSeenAt: timestamp("first_seen_at").defaultNow(),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  seenCount: integer("seen_count").notNull().default(1),
  alertSentAt: timestamp("alert_sent_at"),
});
export type HardwareRig = typeof hardwareRigs.$inferSelect;
export const insertHardwareRigSchema = createInsertSchema(hardwareRigs).omit({
  id: true, hash: true, firstSeenAt: true, lastSeenAt: true, seenCount: true,
});
export type InsertHardwareRig = z.infer<typeof insertHardwareRigSchema>;

// Hardware scan payload submitted by the desktop client
export const hardwareScanPayloadSchema = z.object({
  cpu: z.string().min(1).max(200),
  gpu: z.string().min(1).max(200),
  vramMb: z.number().int().nonnegative().optional(),
  ramGb: z.number().int().nonnegative().optional(),
  ramMhz: z.number().int().nonnegative().optional(),
  motherboard: z.string().max(200).optional(),
  chassis: z.string().max(50).optional(),
  coolingType: z.string().max(50).optional(),
  refreshHz: z.number().int().nonnegative().optional(),
  nicVendor: z.string().max(100).optional(),
  storageSummary: z.record(z.unknown()).optional(),
  anticheats: z.array(z.string().max(50)).optional(),
  sessionToken: z.string().max(128).optional(),
});
export type HardwareScanPayload = z.infer<typeof hardwareScanPayloadSchema>;

// Tweak suggestions — community/AI-generated tweak ideas tied to a rig
export const SUGGESTION_STATUSES = ["open", "triaged", "written", "declined"] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];
export const suggestionStatusEnum = pgEnum("suggestion_status", SUGGESTION_STATUSES);
export const tweakSuggestions = pgTable("tweak_suggestions", {
  id: serial("id").primaryKey(),
  rigHash: varchar("rig_hash", { length: 64 }).notNull().references(() => hardwareRigs.hash, { onDelete: "cascade" }),
  suggestion: text("suggestion").notNull(),
  category: text("category").notNull(),
  status: suggestionStatusEnum("status").notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow(),
});
export type TweakSuggestion = typeof tweakSuggestions.$inferSelect;
export const insertTweakSuggestionSchema = createInsertSchema(tweakSuggestions).omit({
  id: true, status: true, createdAt: true,
});
export type InsertTweakSuggestion = z.infer<typeof insertTweakSuggestionSchema>;

// NVIDIA drivers — version registry with adoption tracking
export const nvidiaDrivers = pgTable("nvidia_drivers", {
  version: text("version").primaryKey(),
  releasedAt: timestamp("released_at"),
  branch: text("branch"),
  detectedOnRigsCount: integer("detected_on_rigs_count").notNull().default(0),
  tweaksValidated: boolean("tweaks_validated").notNull().default(false),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  alertSentAt: timestamp("alert_sent_at"),
});
export type NvidiaDriver = typeof nvidiaDrivers.$inferSelect;
export const insertNvidiaDriverSchema = createInsertSchema(nvidiaDrivers).omit({
  detectedOnRigsCount: true, lastSeenAt: true, alertSentAt: true,
});
export type InsertNvidiaDriver = z.infer<typeof insertNvidiaDriverSchema>;

export const insertPresetSchema = createInsertSchema(presets).omit({ id: true, createdAt: true });
export type InsertPreset = z.infer<typeof insertPresetSchema>;
export type Preset = typeof presets.$inferSelect;

export const insertStartupAppSchema = createInsertSchema(startupApps).omit({ id: true });
export type InsertStartupApp = z.infer<typeof insertStartupAppSchema>;
export type StartupApp = typeof startupApps.$inferSelect;

export const insertOptimizationSchema = createInsertSchema(optimizations).omit({ id: true });
export type InsertOptimization = z.infer<typeof insertOptimizationSchema>;
export type Optimization = typeof optimizations.$inferSelect;

// Discount codes — created by admin, applied at Stripe checkout for a % off the Pro price
export const discountCodes = pgTable("discount_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  percentOff: integer("percent_off").notNull(),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  expiresAt: timestamp("expires_at"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});
export type DiscountCode = typeof discountCodes.$inferSelect;

// Persistent native bearer tokens — issued by /api/auth/discord/exchange and
// /api/auth/discord/callback (native flow). Stored here so the server can
// validate them after a restart (in-memory map alone would log out .exe users
// on every Replit dyno cycle).
export const nativeTokensTable = pgTable("native_tokens", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type NativeToken = typeof nativeTokensTable.$inferSelect;

// Graphics Studio per-user grants — Discord-ID-locked, granted manually by admin
export const graphicsStudioGrants = pgTable("graphics_studio_grants", {
  discordUserId: text("discord_user_id").primaryKey(),
  grantedAt: timestamp("granted_at").defaultNow(),
  grantedBy: text("granted_by"),
  notes: text("notes"),
});
export type GraphicsStudioGrant = typeof graphicsStudioGrants.$inferSelect;
