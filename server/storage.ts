import { db } from "./db";
import { presets, startupApps, type InsertPreset, type Preset, type InsertStartupApp, type StartupApp } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getPresets(): Promise<Preset[]>;
  createPreset(preset: InsertPreset): Promise<Preset>;
  deletePreset(id: number): Promise<void>;
  getStartupApps(): Promise<StartupApp[]>;
  updateStartupApp(id: number, isEnabled: boolean): Promise<StartupApp>;
}

export class DatabaseStorage implements IStorage {
  async getPresets(): Promise<Preset[]> {
    return await db.select().from(presets);
  }

  async createPreset(insertPreset: InsertPreset): Promise<Preset> {
    const [preset] = await db.insert(presets).values(insertPreset).returning();
    return preset;
  }

  async deletePreset(id: number): Promise<void> {
    await db.delete(presets).where(eq(presets.id, id));
  }

  async getStartupApps(): Promise<StartupApp[]> {
    return await db.select().from(startupApps);
  }

  async updateStartupApp(id: number, isEnabled: boolean): Promise<StartupApp> {
    const [app] = await db.update(startupApps)
      .set({ isEnabled })
      .where(eq(startupApps.id, id))
      .returning();
    return app;
  }
}

export const storage = new DatabaseStorage();
