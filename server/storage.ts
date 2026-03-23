import { db } from "./db";
import { presets, startupApps, optimizations, proAccessCodes, proFriendTokens, siteVisits, emailRequests, announcements, type InsertPreset, type Preset, type InsertStartupApp, type StartupApp, type InsertOptimization, type Optimization, type ProAccessCode, type ProFriendToken, type EmailRequest, type Announcement, type InsertAnnouncement } from "@shared/schema";
import { eq, isNotNull, gte, sql, desc } from "drizzle-orm";

export interface IStorage {
  getPresets(): Promise<Preset[]>;
  createPreset(preset: InsertPreset): Promise<Preset>;
  deletePreset(id: number): Promise<void>;
  getStartupApps(): Promise<StartupApp[]>;
  updateStartupApp(id: number, isEnabled: boolean): Promise<StartupApp>;
  getOptimizations(): Promise<Optimization[]>;
  updateOptimization(id: number, isApplied: boolean): Promise<Optimization>;
  // Access codes
  getAllCodes(): Promise<ProAccessCode[]>;
  createCode(code: string, note?: string): Promise<ProAccessCode>;
  redeemCode(code: string): Promise<boolean>;
  deleteCode(id: number): Promise<void>;
  deleteUsedCodes(): Promise<number>;
  // Friend tokens
  getAllFriendTokens(): Promise<ProFriendToken[]>;
  createFriendToken(token: string, note?: string): Promise<ProFriendToken>;
  redeemFriendToken(token: string): Promise<boolean>;
  deleteFriendToken(id: number): Promise<void>;
  deleteUsedFriendTokens(): Promise<number>;
  // Visit tracking
  recordVisit(referrer?: string): Promise<void>;
  getVisitStats(): Promise<{ total: number; today: number; thisWeek: number }>;
  // Email code requests
  createEmailRequest(email: string, paymentMethod: string, paymentRef: string): Promise<EmailRequest>;
  getEmailRequests(): Promise<EmailRequest[]>;
  updateEmailRequestStatus(id: number, status: string, sentCodeId?: number, note?: string): Promise<EmailRequest>;
  deleteEmailRequest(id: number): Promise<void>;
  // Announcements
  getAnnouncements(): Promise<Announcement[]>;
  createAnnouncement(data: InsertAnnouncement): Promise<Announcement>;
  deleteAnnouncement(id: number): Promise<void>;
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

  async getOptimizations(): Promise<Optimization[]> {
    return await db.select().from(optimizations);
  }

  async updateOptimization(id: number, isApplied: boolean): Promise<Optimization> {
    const [opt] = await db.update(optimizations)
      .set({ isApplied })
      .where(eq(optimizations.id, id))
      .returning();
    return opt;
  }

  async getAllCodes(): Promise<ProAccessCode[]> {
    return await db.select().from(proAccessCodes).orderBy(proAccessCodes.createdAt);
  }

  async createCode(code: string, note?: string): Promise<ProAccessCode> {
    const [row] = await db.insert(proAccessCodes).values({ code, note }).returning();
    return row;
  }

  async redeemCode(code: string): Promise<boolean> {
    const rows = await db.select().from(proAccessCodes)
      .where(eq(proAccessCodes.code, code.toUpperCase().trim()));
    if (!rows.length) return false;
    const row = rows[0];
    if (row.usedAt) return false;
    await db.update(proAccessCodes)
      .set({ usedAt: new Date() })
      .where(eq(proAccessCodes.id, row.id));
    return true;
  }

  async deleteCode(id: number): Promise<void> {
    await db.delete(proAccessCodes).where(eq(proAccessCodes.id, id));
  }

  async deleteUsedCodes(): Promise<number> {
    const rows = await db.delete(proAccessCodes).where(isNotNull(proAccessCodes.usedAt)).returning();
    return rows.length;
  }

  async getAllFriendTokens(): Promise<ProFriendToken[]> {
    return await db.select().from(proFriendTokens).orderBy(proFriendTokens.createdAt);
  }

  async createFriendToken(token: string, note?: string): Promise<ProFriendToken> {
    const [row] = await db.insert(proFriendTokens).values({ token, note }).returning();
    return row;
  }

  async redeemFriendToken(token: string): Promise<boolean> {
    const rows = await db.select().from(proFriendTokens)
      .where(eq(proFriendTokens.token, token.trim()));
    if (!rows.length) return false;
    const row = rows[0];
    if (row.usedAt) return false;
    await db.update(proFriendTokens)
      .set({ usedAt: new Date() })
      .where(eq(proFriendTokens.id, row.id));
    return true;
  }

  async deleteFriendToken(id: number): Promise<void> {
    await db.delete(proFriendTokens).where(eq(proFriendTokens.id, id));
  }

  async deleteUsedFriendTokens(): Promise<number> {
    const rows = await db.delete(proFriendTokens).where(isNotNull(proFriendTokens.usedAt)).returning();
    return rows.length;
  }

  async recordVisit(referrer?: string): Promise<void> {
    await db.insert(siteVisits).values({ referrer: referrer || null });
  }

  async getVisitStats(): Promise<{ total: number; today: number; thisWeek: number }> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - 7);

    const [totalRow] = await db.select({ count: sql<number>`count(*)::int` }).from(siteVisits);
    const [todayRow] = await db.select({ count: sql<number>`count(*)::int` }).from(siteVisits).where(gte(siteVisits.visitedAt, startOfToday));
    const [weekRow] = await db.select({ count: sql<number>`count(*)::int` }).from(siteVisits).where(gte(siteVisits.visitedAt, startOfWeek));

    return {
      total: totalRow?.count ?? 0,
      today: todayRow?.count ?? 0,
      thisWeek: weekRow?.count ?? 0,
    };
  }

  async createEmailRequest(email: string, paymentMethod: string, paymentRef: string): Promise<EmailRequest> {
    const [row] = await db.insert(emailRequests).values({ email, paymentMethod, paymentRef }).returning();
    return row;
  }

  async getEmailRequests(): Promise<EmailRequest[]> {
    return await db.select().from(emailRequests).orderBy(emailRequests.createdAt);
  }

  async updateEmailRequestStatus(id: number, status: string, sentCodeId?: number, note?: string): Promise<EmailRequest> {
    const [row] = await db.update(emailRequests)
      .set({ status, ...(sentCodeId !== undefined ? { sentCodeId } : {}), ...(note !== undefined ? { note } : {}) })
      .where(eq(emailRequests.id, id))
      .returning();
    return row;
  }

  async deleteEmailRequest(id: number): Promise<void> {
    await db.delete(emailRequests).where(eq(emailRequests.id, id));
  }

  async getAnnouncements(): Promise<Announcement[]> {
    return await db.select().from(announcements).orderBy(desc(announcements.createdAt));
  }

  async createAnnouncement(data: InsertAnnouncement): Promise<Announcement> {
    const [row] = await db.insert(announcements).values(data).returning();
    return row;
  }

  async deleteAnnouncement(id: number): Promise<void> {
    await db.delete(announcements).where(eq(announcements.id, id));
  }
}

export const storage = new DatabaseStorage();
