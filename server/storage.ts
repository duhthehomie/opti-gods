import { db } from "./db";
import { presets, startupApps, optimizations, proAccessCodes, proFriendTokens, siteVisits, emailRequests, announcements, scriptDownloads, proSessions, manualPayments, proIpLogs, type InsertPreset, type Preset, type InsertStartupApp, type StartupApp, type InsertOptimization, type Optimization, type ProAccessCode, type ProFriendToken, type EmailRequest, type Announcement, type InsertAnnouncement, type ProSession, type ManualPayment, type ProIpLog } from "@shared/schema";
import { eq, and, isNotNull, isNull, gte, sql, desc } from "drizzle-orm";
import { randomBytes } from "crypto";

export interface IStorage {
  getPresets(): Promise<Preset[]>;
  createPreset(preset: InsertPreset): Promise<Preset>;
  deletePreset(id: number): Promise<void>;
  getStartupApps(): Promise<StartupApp[]>;
  updateStartupApp(id: number, isEnabled: boolean): Promise<StartupApp>;
  getOptimizations(): Promise<Optimization[]>;
  updateOptimization(id: number, isApplied: boolean): Promise<Optimization>;
  // Access codes
  getAllCodes(): Promise<(ProAccessCode & { lastSessionAt: Date | null; sessionIp: string | null })[]>;
  createCode(code: string, note?: string): Promise<ProAccessCode>;
  redeemCode(code: string, ip?: string): Promise<boolean>;
  resetCode(id: number): Promise<void>;
  deleteCode(id: number): Promise<void>;
  updateCodeNote(id: number, note: string | null): Promise<void>;
  updateCodeAmount(codeId: number, amount: number): Promise<void>;
  deleteUsedCodes(): Promise<number>;
  reviveDeadCodes(): Promise<number>;
  // Friend tokens
  getAllFriendTokens(): Promise<ProFriendToken[]>;
  createFriendToken(token: string, note?: string): Promise<ProFriendToken>;
  redeemFriendToken(token: string, ip?: string): Promise<boolean>;
  deleteFriendToken(id: number): Promise<void>;
  updateFriendTokenNote(id: number, note: string | null): Promise<void>;
  deleteUsedFriendTokens(): Promise<number>;
  // Visit tracking
  recordVisit(referrer?: string): Promise<void>;
  getVisitStats(): Promise<{ total: number; today: number; thisWeek: number }>;
  // Email code requests
  createEmailRequest(email: string, paymentMethod: string, paymentRef: string, discordUsername?: string, amountPaid?: number): Promise<EmailRequest>;
  getEmailRequests(): Promise<EmailRequest[]>;
  updateEmailRequestStatus(id: number, status: string, sentCodeId?: number, note?: string): Promise<EmailRequest>;
  deleteEmailRequest(id: number): Promise<void>;
  // Announcements
  getAnnouncements(): Promise<Announcement[]>;
  createAnnouncement(data: InsertAnnouncement): Promise<Announcement>;
  deleteAnnouncement(id: number): Promise<void>;
  // Pro sessions (server-side validation — blocks localStorage spoofing exploit)
  createProSession(codeRef: string): Promise<string>; // returns session token
  verifyProSession(token: string, ip?: string): Promise<boolean>;
  revokeProSession(token: string): Promise<void>;
  revokeProSessionsByCode(codeRef: string): Promise<number>;
  touchProSession(token: string): Promise<void>;
  getAllProSessions(): Promise<ProSession[]>;
  // Script download tracking
  recordScriptDownload(tweakIds: string[], sessionToken?: string): Promise<void>;
  getCustomerDeployStats(): Promise<{
    sessionToken: string;
    codeRef: string | null;
    totalTweaks: number;
    downloadCount: number;
    lastDownloadAt: string;
    allTweakIds: string[];
  }[]>;
  getDownloadStats(): Promise<{
    totalDownloads: number;
    totalTweaksDeployed: number;
    avgTweaksPerDownload: number;
    last7Days: { date: string; count: number }[];
    topTweaks: { tweakId: string; count: number }[];
    recentDownloads: { id: number; tweakCount: number; tweakIds: string[]; downloadedAt: string }[];
  }>;
  // Manual payment tracking (CashApp / PayPal)
  createManualPayment(amount: number, method: string, note: string | null): Promise<ManualPayment>;
  getManualPayments(): Promise<ManualPayment[]>;
  deleteManualPayment(id: number): Promise<void>;
  getManualPaymentTotal(): Promise<number>;
  // IP access logging
  logProIp(codeRef: string, ip: string): Promise<void>;
  getIpLogs(codeRef?: string): Promise<ProIpLog[]>;
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

  async getAllCodes(): Promise<(ProAccessCode & { lastSessionAt: Date | null; sessionIp: string | null })[]> {
    const codes = await db.select().from(proAccessCodes).orderBy(desc(proAccessCodes.createdAt));
    const sessions = await db.select({
      codeRef: proSessions.codeRef,
      lastCheckedAt: sql<Date>`MAX(last_checked_at)`.as("last_checked_at"),
      ipAddress: sql<string>`(array_agg(ip_address ORDER BY last_checked_at DESC))[1]`.as("ip_address"),
    }).from(proSessions).groupBy(proSessions.codeRef);
    const sessionMap = new Map(sessions.map(s => [s.codeRef, { lastCheckedAt: s.lastCheckedAt, ip: s.ipAddress }]));
    return codes.map(c => {
      const sess = sessionMap.get(c.code) ?? null;
      return {
        ...c,
        lastSessionAt: sess?.lastCheckedAt ?? null,
        sessionIp: c.usedByIp ?? sess?.ip ?? null,
      };
    });
  }

  async createCode(code: string, note?: string): Promise<ProAccessCode> {
    const [row] = await db.insert(proAccessCodes).values({ code, note }).returning();
    return row;
  }

  async redeemCode(code: string, ip?: string): Promise<boolean> {
    const rows = await db.select().from(proAccessCodes)
      .where(eq(proAccessCodes.code, code.toUpperCase().trim()));
    if (!rows.length) return false;
    const row = rows[0];
    if (row.usedAt) return false;
    await db.update(proAccessCodes)
      .set({ usedAt: new Date(), ...(ip ? { usedByIp: ip } : {}) })
      .where(eq(proAccessCodes.id, row.id));
    return true;
  }

  async resetCode(id: number): Promise<void> {
    await db.update(proAccessCodes).set({ usedAt: null }).where(eq(proAccessCodes.id, id));
  }

  async reviveDeadCodes(): Promise<number> {
    // Find codes that are marked used but have no pro_session linked to them
    // These are "dead" — customer burned the code but has no active session
    const allUsed = await db.select().from(proAccessCodes).where(isNotNull(proAccessCodes.usedAt));
    const sessions = await db.select({ codeRef: proSessions.codeRef }).from(proSessions);
    const activeCodes = new Set(sessions.map(s => s.codeRef));
    const deadIds = allUsed.filter(c => !activeCodes.has(c.code)).map(c => c.id);
    if (!deadIds.length) return 0;
    for (const id of deadIds) {
      await db.update(proAccessCodes).set({ usedAt: null }).where(eq(proAccessCodes.id, id));
    }
    return deadIds.length;
  }

  async deleteCode(id: number): Promise<void> {
    await db.delete(proAccessCodes).where(eq(proAccessCodes.id, id));
  }

  async updateCodeNote(id: number, note: string | null): Promise<void> {
    await db.update(proAccessCodes).set({ note }).where(eq(proAccessCodes.id, id));
  }

  async updateCodeAmount(codeId: number, amount: number): Promise<void> {
    // Find the email request that was sent for this code
    const emailReq = await db.select().from(emailRequests)
      .where(eq(emailRequests.sentCodeId, codeId))
      .limit(1);
    
    if (emailReq.length > 0) {
      // Update the email request's amountPaid
      await db.update(emailRequests)
        .set({ amountPaid: amount })
        .where(eq(emailRequests.id, emailReq[0].id));
    }
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

  async redeemFriendToken(token: string, ip?: string): Promise<boolean> {
    const result = await db.update(proFriendTokens)
      .set({ usedAt: new Date(), ...(ip ? { usedByIp: ip } : {}) })
      .where(and(eq(proFriendTokens.token, token.trim()), isNull(proFriendTokens.usedAt)))
      .returning();
    return result.length > 0;
  }

  async deleteFriendToken(id: number): Promise<void> {
    await db.delete(proFriendTokens).where(eq(proFriendTokens.id, id));
  }

  async updateFriendTokenNote(id: number, note: string | null): Promise<void> {
    await db.update(proFriendTokens).set({ note }).where(eq(proFriendTokens.id, id));
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

  async createEmailRequest(email: string, paymentMethod: string, paymentRef: string, discordUsername?: string, amountPaid?: number): Promise<EmailRequest> {
    const [row] = await db.insert(emailRequests).values({
      email, paymentMethod, paymentRef,
      ...(discordUsername ? { discordUsername } : {}),
      ...(amountPaid !== undefined ? { amountPaid } : {}),
    }).returning();
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

  async recordScriptDownload(tweakIds: string[], sessionToken?: string): Promise<void> {
    await db.insert(scriptDownloads).values({
      tweakCount: tweakIds.length,
      tweakIds,
      sessionToken: sessionToken || null,
    });
  }

  async getCustomerDeployStats(): Promise<{
    sessionToken: string;
    codeRef: string | null;
    totalTweaks: number;
    downloadCount: number;
    lastDownloadAt: string;
    allTweakIds: string[];
  }[]> {
    const rows = await db.execute(sql`
      SELECT
        sd.session_token,
        ps.code_ref,
        COALESCE(SUM(sd.tweak_count), 0)::int AS total_tweaks,
        COUNT(sd.id)::int AS download_count,
        MAX(sd.downloaded_at)::text AS last_download_at,
        array_agg(DISTINCT tids.tid) FILTER (WHERE tids.tid IS NOT NULL) AS all_tweak_ids
      FROM script_downloads sd
      LEFT JOIN pro_sessions ps ON ps.session_token = sd.session_token
      LEFT JOIN LATERAL unnest(sd.tweak_ids) AS tids(tid) ON TRUE
      WHERE sd.session_token IS NOT NULL
      GROUP BY sd.session_token, ps.code_ref
      ORDER BY last_download_at DESC
    `);
    return (rows.rows as any[]).map(r => ({
      sessionToken: r.session_token,
      codeRef: r.code_ref ?? null,
      totalTweaks: r.total_tweaks,
      downloadCount: r.download_count,
      lastDownloadAt: r.last_download_at ?? "",
      allTweakIds: Array.isArray(r.all_tweak_ids) ? r.all_tweak_ids : [],
    }));
  }

  async getDownloadStats(): Promise<{
    totalDownloads: number;
    totalTweaksDeployed: number;
    avgTweaksPerDownload: number;
    last7Days: { date: string; count: number }[];
    topTweaks: { tweakId: string; count: number }[];
    recentDownloads: { id: number; tweakCount: number; tweakIds: string[]; downloadedAt: string }[];
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

    // Recent downloads — last 30
    const recentRows = await db
      .select()
      .from(scriptDownloads)
      .orderBy(sql`downloaded_at DESC`)
      .limit(30);
    const recentDownloads = recentRows.map(r => ({
      id: r.id,
      tweakCount: r.tweakCount,
      tweakIds: r.tweakIds ?? [],
      downloadedAt: r.downloadedAt ? r.downloadedAt.toISOString() : new Date().toISOString(),
    }));

    return { totalDownloads, totalTweaksDeployed, avgTweaksPerDownload, last7Days, topTweaks, recentDownloads };
  }

  async createProSession(codeRef: string): Promise<string> {
    // Enforce 2-session cap per code to prevent shared-code abuse.
    // Admin/friend token refs are exempt (they start with "admin-" or "friend:").
    const isSystemRef = codeRef.startsWith("admin-") || codeRef.startsWith("friend:");
    if (!isSystemRef) {
      const existing = await db.select({ id: proSessions.id, sessionToken: proSessions.sessionToken })
        .from(proSessions)
        .where(eq(proSessions.codeRef, codeRef))
        .orderBy(proSessions.createdAt);
      if (existing.length >= 2) {
        // Evict the oldest session to stay at the cap — keeps the customer's newest device working
        await db.delete(proSessions).where(eq(proSessions.sessionToken, existing[0].sessionToken));
      }
    }
    const token = randomBytes(32).toString("hex"); // 64 char hex — impossible to guess
    await db.insert(proSessions).values({ sessionToken: token, codeRef, lastCheckedAt: new Date() });
    return token;
  }

  async verifyProSession(token: string, ip?: string): Promise<boolean> {
    if (!token || token.length < 16) return false;
    const rows = await db.select().from(proSessions).where(eq(proSessions.sessionToken, token));
    if (!rows.length) return false;
    const update: Partial<typeof proSessions.$inferInsert> = { lastCheckedAt: new Date() };
    if (ip) update.ipAddress = ip;
    await db.update(proSessions).set(update).where(eq(proSessions.sessionToken, token));
    return true;
  }

  async revokeProSession(token: string): Promise<void> {
    await db.delete(proSessions).where(eq(proSessions.sessionToken, token));
  }

  async revokeProSessionsByCode(codeRef: string): Promise<number> {
    const rows = await db.delete(proSessions).where(eq(proSessions.codeRef, codeRef)).returning();
    return rows.length;
  }

  async touchProSession(token: string): Promise<void> {
    await db.update(proSessions).set({ lastCheckedAt: new Date() }).where(eq(proSessions.sessionToken, token));
  }

  async getAllProSessions(): Promise<ProSession[]> {
    return db.select().from(proSessions).orderBy(proSessions.lastCheckedAt);
  }

  async createManualPayment(amount: number, method: string, note: string | null): Promise<ManualPayment> {
    const [row] = await db.insert(manualPayments).values({ amount, method, note }).returning();
    return row;
  }

  async getManualPayments(): Promise<ManualPayment[]> {
    return await db.select().from(manualPayments).orderBy(sql`paid_at DESC`);
  }

  async deleteManualPayment(id: number): Promise<void> {
    await db.delete(manualPayments).where(eq(manualPayments.id, id));
  }

  async getManualPaymentTotal(): Promise<number> {
    const [row] = await db.select({ total: sql<number>`coalesce(sum(amount),0)::int` }).from(manualPayments);
    return row?.total ?? 0;
  }

  async logProIp(codeRef: string, ip: string): Promise<void> {
    if (!ip || ip === "unknown" || ip === "127.0.0.1" || ip === "::1") return;
    // Only insert if this IP hasn't been seen for this codeRef yet
    const existing = await db.select({ id: proIpLogs.id })
      .from(proIpLogs)
      .where(and(eq(proIpLogs.codeRef, codeRef), eq(proIpLogs.ipAddress, ip)));
    if (existing.length > 0) return;
    // Fetch geolocation from ip-api.com (free, no key needed, server-side only)
    let city: string | null = null;
    let region: string | null = null;
    let country: string | null = null;
    let isp: string | null = null;
    let lat: string | null = null;
    let lon: string | null = null;
    try {
      const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp,lat,lon`);
      if (geoRes.ok) {
        const geo = await geoRes.json() as { status: string; country?: string; regionName?: string; city?: string; isp?: string; lat?: number; lon?: number };
        if (geo.status === "success") {
          city = geo.city ?? null;
          region = geo.regionName ?? null;
          country = geo.country ?? null;
          isp = geo.isp ?? null;
          lat = geo.lat != null ? String(geo.lat) : null;
          lon = geo.lon != null ? String(geo.lon) : null;
        }
      }
    } catch {
      // Geolocation is best-effort; don't block logging on failure
    }
    await db.insert(proIpLogs).values({ codeRef, ipAddress: ip, city, region, country, isp, lat, lon });
  }

  async getIpLogs(codeRef?: string): Promise<ProIpLog[]> {
    if (codeRef) {
      return db.select().from(proIpLogs).where(eq(proIpLogs.codeRef, codeRef)).orderBy(proIpLogs.seenAt);
    }
    return db.select().from(proIpLogs).orderBy(proIpLogs.seenAt);
  }
}

export const storage = new DatabaseStorage();
