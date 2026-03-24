import { db } from "./db";
import { presets, startupApps, optimizations, proAccessCodes, proFriendTokens, siteVisits, emailRequests, announcements, scriptDownloads, type InsertPreset, type Preset, type InsertStartupApp, type StartupApp, type InsertOptimization, type Optimization, type ProAccessCode, type ProFriendToken, type EmailRequest, type Announcement, type InsertAnnouncement } from "@shared/schema";
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
  // Script download tracking
  recordScriptDownload(tweakIds: string[]): Promise<void>;
  getDownloadStats(): Promise<{
    totalDownloads: number;
    totalTweaksDeployed: number;
    avgTweaksPerDownload: number;
    last7Days: { date: string; count: number }[];
    topTweaks: { tweakId: string; count: number }[];
  }>;
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
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalRow] = await db.select({ count: sql<number>`count(*)::int` }).from(siteVisits);
    const [todayRow] = await db.select({ count: sql<number>`count(*)::int` }).from(siteVisits).where(gte(siteVisits.visitedAt, last24h));
    const [weekRow] = await db.select({ count: sql<number>`count(*)::int` }).from(siteVisits).where(gte(siteVisits.visitedAt, last7d));

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

  async recordScriptDownload(tweakIds: string[]): Promise<void> {
    await db.insert(scriptDownloads).values({
      tweakCount: tweakIds.length,
      tweakIds,
    });
  }

  async getDownloadStats(): Promise<{
    totalDownloads: number;
    totalTweaksDeployed: number;
    avgTweaksPerDownload: number;
    last7Days: { date: string; count: number }[];
    topTweaks: { tweakId: string; count: number }[];
  }> {
    const [totalsRow] = await db
      .select({
        totalDownloads: sql<number>`count(*)::int`,
        totalTweaksDeployed: sql<number>`coalesce(sum(tweak_count), 0)::int`,
      })
      .from(scriptDownloads);

    const totalDownloads = totalsRow?.totalDownloads ?? 0;
    const totalTweaksDeployed = totalsRow?.totalTweaksDeployed ?? 0;
    const avgTweaksPerDownload = totalDownloads > 0 ? Math.round(totalTweaksDeployed / totalDownloads) : 0;

    // Last 7 days daily counts
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dailyRows = await db
      .select({
        date: sql<string>`to_char(downloaded_at, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(scriptDownloads)
      .where(gte(scriptDownloads.downloadedAt, last7d))
      .groupBy(sql`to_char(downloaded_at, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(downloaded_at, 'YYYY-MM-DD')`);

    // Fill in missing days
    const last7Days: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().slice(0, 10);
      const found = dailyRows.find(r => r.date === dateStr);
      last7Days.push({ date: dateStr, count: found?.count ?? 0 });
    }

    // Top tweaks — unnest the array column and count
    const tweakRows = await db.execute(
      sql`SELECT unnested as tweak_id, count(*)::int as cnt FROM script_downloads, unnest(tweak_ids) AS unnested GROUP BY unnested ORDER BY cnt DESC LIMIT 20`
    );
    const topTweaks = (tweakRows.rows as { tweak_id: string; cnt: number }[]).map(r => ({
      tweakId: r.tweak_id,
      count: r.cnt,
    }));

    return { totalDownloads, totalTweaksDeployed, avgTweaksPerDownload, last7Days, topTweaks };
  }
}

export const storage = new DatabaseStorage();
