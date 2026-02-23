import { pgTable, text, serial, jsonb, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

export const insertPresetSchema = createInsertSchema(presets).omit({ id: true, createdAt: true });
export type InsertPreset = z.infer<typeof insertPresetSchema>;
export type Preset = typeof presets.$inferSelect;

export const insertStartupAppSchema = createInsertSchema(startupApps).omit({ id: true });
export type InsertStartupApp = z.infer<typeof insertStartupAppSchema>;
export type StartupApp = typeof startupApps.$inferSelect;
