import { pgTable, text, serial, jsonb, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const proAccessCodes = pgTable("pro_access_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  note: text("note"),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const proFriendTokens = pgTable("pro_friend_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  note: text("note"),
  usedAt: timestamp("used_at"),
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
  downloadedAt: timestamp("downloaded_at").defaultNow(),
});
export type ScriptDownload = typeof scriptDownloads.$inferSelect;

export const emailRequests = pgTable("email_requests", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  paymentMethod: text("payment_method").notNull(),
  paymentRef: text("payment_ref").notNull(),
  status: text("status").notNull().default("pending"),
  sentCodeId: integer("sent_code_id"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type EmailRequest = typeof emailRequests.$inferSelect;
export const insertEmailRequestSchema = createInsertSchema(emailRequests).omit({ id: true, createdAt: true, status: true, sentCodeId: true, note: true });
export type InsertEmailRequest = z.infer<typeof insertEmailRequestSchema>;

export const insertPresetSchema = createInsertSchema(presets).omit({ id: true, createdAt: true });
export type InsertPreset = z.infer<typeof insertPresetSchema>;
export type Preset = typeof presets.$inferSelect;

export const insertStartupAppSchema = createInsertSchema(startupApps).omit({ id: true });
export type InsertStartupApp = z.infer<typeof insertStartupAppSchema>;
export type StartupApp = typeof startupApps.$inferSelect;

export const insertOptimizationSchema = createInsertSchema(optimizations).omit({ id: true });
export type InsertOptimization = z.infer<typeof insertOptimizationSchema>;
export type Optimization = typeof optimizations.$inferSelect;
