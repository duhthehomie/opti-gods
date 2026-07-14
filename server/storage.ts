import { db } from "./db";
import { presets, startupApps, optimizations, proAccessCodes, proFriendTokens, siteVisits, emailRequests, announcements, scriptDownloads, proSessions, manualPayments, proIpLogs, aiChatSessions, securityEvents, ipBans, customerHardware, userReports, adminSettings, discountCodes, autoResolveRuns, users, hardwareRigs, tweakSuggestions, nvidiaDrivers, proEntitlements, nativeTokensTable, graphicsStudioGrants, fivemServers, type InsertPreset, type Preset, type InsertStartupApp, type StartupApp, type InsertOptimization, type Optimization, type ProAccessCode, type ProFriendToken, type EmailRequest, type Announcement, type InsertAnnouncement, type ProSession, type ManualPayment, type ProIpLog, type AiChatSession, type AiChatMessage, type SecurityEvent, type SecurityEventType, type SecuritySeverity, type IpBan, type CustomerHardware, type UserReport, type ReportCategory, type ReportStatus, type AdminSettings, type DiscountCode, type AutoResolveRun, type User, type InsertUser, type HardwareRig, type HardwareScanPayload, type TweakSuggestion, type InsertTweakSuggestion, type NvidiaDriver, type InsertNvidiaDriver, type SuggestionStatus, type ProEntitlement, type GraphicsStudioGrant, type FivemServer } from "@shared/schema";
import { eq, and, isNotNull, isNull, gte, lt, inArray, sql, desc } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";

export interface IStorage {
  getPresets(ownerId: string): Promise<Preset[]>;
  getPresetById(id: number): Promise<Preset | undefined>;
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
  createEmailRequest(email: string, paymentMethod: string, paymentRef: string, discordUsername?: string, amountPaid?: number, discordUserId?: string | null): Promise<EmailRequest>;
  getEmailRequests(): Promise<EmailRequest[]>;
  updateEmailRequestStatus(id: number, status: string, sentCodeId?: number, note?: string): Promise<EmailRequest>;
  deleteEmailRequest(id: number): Promise<void>;
  // Announcements
  getAnnouncements(): Promise<Announcement[]>;
  createAnnouncement(data: InsertAnnouncement): Promise<Announcement>;
  deleteAnnouncement(id: number): Promise<void>;
  // Pro sessions (server-side validation — blocks localStorage spoofing exploit)
  createProSession(codeRef: string): Promise<string>; // returns session token
  verifyProSession(token: string, ip?: string, discordUserId?: string | null): Promise<boolean>;
  revokeProSession(token: string): Promise<void>;
  revokeProSessionsByCode(codeRef: string): Promise<number>;
  touchProSession(token: string): Promise<void>;
  getAllProSessions(): Promise<ProSession[]>;
  deleteOrphanSessions(): Promise<number>; // delete sessions with no matching code
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
  // AI chat sessions
  getAiSession(sessionId: string): Promise<AiChatSession | null>;
  upsertAiSession(sessionId: string, messages: AiChatMessage[]): Promise<void>;
  // Security events
  logSecurityEvent(event: { type: SecurityEventType; codeRef?: string; ip: string; country?: string; isp?: string; details: string; severity: SecuritySeverity }): Promise<SecurityEvent>;
  getSecurityEvents(limit?: number): Promise<SecurityEvent[]>;
  resolveSecurityEvent(id: number): Promise<void>;
  markSecurityEventAlertSent(id: number): Promise<void>;
  autoResolveOldSecurityEvents(daysOld?: number): Promise<number>;
  previewAutoResolveCount(daysOld?: number): Promise<number>;
  recordAutoResolveRun(count: number, windowDays?: number): Promise<void>;
  getAutoResolveRunHistory(limit?: number): Promise<import("@shared/schema").AutoResolveRun[]>;
  getTotalAutoResolved(): Promise<{ totalResolved: number; runCount: number }>;
  // Admin settings
  getAdminSettings(): Promise<AdminSettings | null>;
  upsertAdminSettings(settings: { discordWebhookUrl?: string | null; alertEmail?: string | null; autoResolveDays?: number | null; currentVersion?: string | null; latestVersion?: string | null; updaterCmdUrl?: string | null; updatePageUrl?: string | null; alertOnNewRig?: boolean; alertOnNewNvidiaDriver?: boolean; auditLogEnabled?: boolean; auditWebhookUrl?: string | null }): Promise<AdminSettings>;
  // Discord-authenticated users
  upsertUser(data: InsertUser): Promise<User>;
  getUser(discordId: string): Promise<User | null>;
  // Stripe purchases — find by stripe session ref stored in note
  findCodeByStripeRef(stripeSessionId: string): Promise<ProAccessCode | null>;
  claimStripeCode(codeValue: string, ip?: string): Promise<void>;
  // Buyer display name — set after payment success
  setCodeDisplayName(sessionToken: string, name: string): Promise<boolean>;
  // Customer hardware snapshots
  saveCustomerHardware(codeRef: string, data: { gpuVendor: string; gpuName: string; cpuModel: string; cpuCores?: number; cpuThreads?: number; ramGb: number; osVersion: string; isLaptop: boolean }): Promise<void>;
  getAllCustomerHardware(): Promise<CustomerHardware[]>;
  // IP bans
  banIp(ip: string, reason: string, permanent?: boolean): Promise<void>;
  unbanIp(ip: string): Promise<void>;
  isIpBanned(ip: string): Promise<boolean>;
  getIpBans(): Promise<IpBan[]>;
  // User reports
  createUserReport(category: ReportCategory, description: string, systemInfo?: Record<string, unknown>, sessionId?: string): Promise<UserReport>;
  getUserReports(status?: ReportStatus): Promise<UserReport[]>;
  updateReportStatus(id: number, status: ReportStatus, adminNote?: string): Promise<UserReport | undefined>;
  // Discount codes
  getAllDiscountCodes(): Promise<DiscountCode[]>;
  createDiscountCode(code: string, percentOff: number, maxUses?: number | null, expiresAt?: Date | null, note?: string | null): Promise<DiscountCode>;
  validateDiscountCode(code: string): Promise<DiscountCode | null>;
  useDiscountCode(code: string): Promise<void>;
  deleteDiscountCode(id: number): Promise<void>;
  // Hardware rigs / tweak suggestions / NVIDIA drivers (V2 Hardware DB)
  getProCodeForToken(sessionToken: string): Promise<string | null>;
  upsertRig(payload: HardwareScanPayload, discordUserId?: string | null, proCode?: string | null): Promise<{ rig: HardwareRig; isNew: boolean }>;
  markRigAlertSent(hash: string): Promise<void>;
  getRigByHash(hash: string): Promise<HardwareRig | null>;
  getRigById(id: number): Promise<HardwareRig | null>;
  getLatestRigForUser(discordUserId: string): Promise<HardwareRig | null>;
  listRigs(opts?: { limit?: number; offset?: number; sort?: "lastSeenAt" | "seenCount" | "firstSeenAt" }): Promise<HardwareRig[]>;
  addTweakSuggestion(data: InsertTweakSuggestion): Promise<TweakSuggestion>;
  listSuggestions(status?: SuggestionStatus): Promise<TweakSuggestion[]>;
  updateSuggestionStatus(id: number, status: SuggestionStatus): Promise<TweakSuggestion | null>;
  upsertNvidiaDriver(data: InsertNvidiaDriver): Promise<NvidiaDriver>;
  markDriverAlertSent(version: string): Promise<void>;
  listNvidiaDrivers(): Promise<NvidiaDriver[]>;
  // Pro entitlements — Discord-user-keyed lifetime Pro (Task #41)
  grantPro(args: { discordUserId: string; source: import("@shared/schema").ProSource; grantedBy?: string | null; notes?: string | null }): Promise<ProEntitlement>;
  revokePro(discordUserId: string): Promise<void>;
  isPro(discordUserId: string): Promise<ProEntitlement | null>;
  // Single-row lookup INCLUDING revoked entitlements — used by hot-path
  // gating (requirePaidPro, GET /api/pro/status) to avoid full-table scans.
  getProEntitlement(discordUserId: string): Promise<ProEntitlement | null>;
  listProUsers(): Promise<(ProEntitlement & { username: string | null; avatarUrl: string | null })[]>;
  listDiscordUsers(): Promise<{ discordId: string; username: string; globalName: string | null; avatarUrl: string | null }[]>;
  // Native bearer tokens — persisted so .exe users survive server restarts
  persistNativeToken(token: string, userId: string, expiresAt: number): Promise<void>;
  lookupNativeToken(token: string): Promise<{ userId: string; expiresAt: number } | null>;
  purgeExpiredNativeTokens(): Promise<void>;
  // Graphics Studio per-user grants (Discord-ID-locked, admin-granted)
  grantGraphicsStudio(discordUserId: string, grantedBy?: string | null, notes?: string | null): Promise<void>;
  revokeGraphicsStudio(discordUserId: string): Promise<void>;
  hasGraphicsStudio(discordUserId: string): Promise<boolean>;
  listGraphicsStudioGrants(): Promise<GraphicsStudioGrant[]>;
  // FiveM community servers
  getAllFivemServers(): Promise<FivemServer[]>;
  upsertFivemServer(connectCode: string, name: string, logoUrl?: string | null): Promise<FivemServer>;
  updateFivemServerLogo(connectCode: string, logoUrl: string | null): Promise<void>;
  // HUD settings (single-row JSON blob in admin_settings)
  getHudSettings(): Promise<{ coverWidth: number; iconSize: number; iconLeft: number; iconTop: number; showServerName: boolean }>;
  saveHudSettings(s: { coverWidth: number; iconSize: number; iconLeft: number; iconTop: number; showServerName: boolean }): Promise<void>;
}

// Deterministic SHA-256 dedup hash for a hardware rig.
// Normalises CPU + GPU + RAM + chassis so trivial casing/whitespace doesn't fork the row.
export function computeRigHash(p: { cpu: string; gpu: string; vramMb?: number | null; ramGb?: number | null; ramMhz?: number | null; chassis?: string | null }): string {
  const norm = (v: unknown) => String(v ?? "").toLowerCase().trim().replace(/\s+/g, " ");
  const parts = [
    norm(p.cpu),
    norm(p.gpu),
    String(p.vramMb ?? ""),
    String(p.ramGb ?? ""),
    String(p.ramMhz ?? ""),
    norm(p.chassis),
  ].join("|");
  return createHash("sha256").update(parts).digest("hex");
}

export class DatabaseStorage implements IStorage {
  async getPresets(ownerId: string): Promise<Preset[]> {
    return await db.select().from(presets).where(eq(presets.ownerId, ownerId));
  }

  async getPresetById(id: number): Promise<Preset | undefined> {
    const [row] = await db.select().from(presets).where(eq(presets.id, id));
    return row;
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

    // Stripe codes are pre-claimed at purchase time by verify-payment
    // (claimStripeCode sets usedAt/usedByIp immediately after checkout).
    // Skip the single-use guards so the buyer can still enter their emailed
    // code on any device. The downstream createProSession call already enforces
    // single active session per code, preventing abuse.
    const isStripeCode = (row.note || '').includes('stripe:');
    if (isStripeCode) return true;

    // Non-Stripe: standard single-use logic
    if (row.usedByIp && ip && row.usedByIp !== ip) return false;
    if (row.usedAt) return false;
    await db.update(proAccessCodes)
      .set({ usedAt: new Date(), ...(ip ? { usedByIp: ip } : {}) })
      .where(eq(proAccessCodes.id, row.id));
    return true;
  }

  async resetCode(id: number): Promise<void> {
    // Look up the code value first so we can also wipe its pro_sessions
    // and revoke any Discord entitlement — without the revoke, the old Discord
    // account stays "orphan-Pro" and blocks the next person from cleanly linking.
    const [row] = await db.select({ code: proAccessCodes.code }).from(proAccessCodes).where(eq(proAccessCodes.id, id));
    if (row?.code) {
      await this._revokeCodeEntitlements(row.code);
      await db.delete(proSessions).where(eq(proSessions.codeRef, row.code));
    }
    await db.update(proAccessCodes).set({ usedAt: null }).where(eq(proAccessCodes.id, id));
  }

  /**
   * Revoke any Discord entitlement whose notes reference the given code value.
   * Called on delete AND revive so orphaned entitlements never block fresh redemptions.
   */
  private async _revokeCodeEntitlements(codeValue: string): Promise<void> {
    const all = await db.select().from(proEntitlements);
    // Match "code:XXXX" at start of notes OR after a pipe/space separator
    const pattern = new RegExp(`(?:^|[\\s|])code:${codeValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    for (const ent of all) {
      if (ent.notes && pattern.test(ent.notes) && !ent.revokedAt) {
        await db.update(proEntitlements)
          .set({ revokedAt: new Date() })
          .where(eq(proEntitlements.discordUserId, ent.discordUserId));
      }
    }
  }

  async reviveDeadCodes(): Promise<number> {
    // Find codes that are marked used but have no pro_session linked to them
    // These are "dead" — customer burned the code but has no active session
    const allUsed = await db.select().from(proAccessCodes).where(isNotNull(proAccessCodes.usedAt));
    const sessions = await db.select({ codeRef: proSessions.codeRef }).from(proSessions);
    const activeCodes = new Set(sessions.map(s => s.codeRef));
    const dead = allUsed.filter(c => !activeCodes.has(c.code));
    if (!dead.length) return 0;
    for (const dc of dead) {
      // Revoke the Discord entitlement tied to this code so the next redeemer
      // starts with a clean slate and can link their own Discord account
      await this._revokeCodeEntitlements(dc.code);
      await db.update(proAccessCodes).set({ usedAt: null }).where(eq(proAccessCodes.id, dc.id));
    }
    return dead.length;
  }

  async deleteCode(id: number): Promise<void> {
    // Cascade: revoke Discord entitlement + sessions tied to this code before deleting
    const [row] = await db.select({ code: proAccessCodes.code }).from(proAccessCodes).where(eq(proAccessCodes.id, id));
    if (row?.code) {
      // Unlink any Discord account that was bound to this code — without this,
      // the entitlement stays "orphan-Pro" and blocks clean linking to the next code
      await this._revokeCodeEntitlements(row.code);
      await db.delete(proSessions).where(eq(proSessions.codeRef, row.code));
    }
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
    // Look up the token string first so we can revoke the associated session.
    const [row] = await db.select({ token: proFriendTokens.token })
      .from(proFriendTokens)
      .where(eq(proFriendTokens.id, id));
    if (row?.token) {
      await db.delete(proSessions).where(eq(proSessions.codeRef, `friend:${row.token}`)).catch(() => {});
    }
    await db.delete(proFriendTokens).where(eq(proFriendTokens.id, id));
  }

  async updateFriendTokenNote(id: number, note: string | null): Promise<void> {
    await db.update(proFriendTokens).set({ note }).where(eq(proFriendTokens.id, id));
  }

  async deleteUsedFriendTokens(): Promise<number> {
    const rows = await db.delete(proFriendTokens).where(isNotNull(proFriendTokens.usedAt)).returning();
    // Revoke every associated session so ghost "friend link" sessions don't linger.
    for (const r of rows) {
      await db.delete(proSessions).where(eq(proSessions.codeRef, `friend:${r.token}`)).catch(() => {});
    }
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

  async createEmailRequest(email: string, paymentMethod: string, paymentRef: string, discordUsername?: string, amountPaid?: number, discordUserId?: string | null): Promise<EmailRequest> {
    const [row] = await db.insert(emailRequests).values({
      email, paymentMethod, paymentRef,
      ...(discordUsername ? { discordUsername } : {}),
      ...(discordUserId ? { discordUserId } : {}),
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
    // Enforce a strict 1-session-per-code cap.
    // Admin/friend token refs are exempt (they start with "admin-" or "friend:").
    // When a new session is created for a code that already has one, the old session
    // is evicted — the code re-entry is treated as intentional device switch.
    // This keeps sessions === codes in the admin panel (no ghost sessions per code).
    const isSystemRef = codeRef.startsWith("admin-") || codeRef.startsWith("friend:");
    if (!isSystemRef) {
      const existing = await db.select({ id: proSessions.id, sessionToken: proSessions.sessionToken })
        .from(proSessions)
        .where(eq(proSessions.codeRef, codeRef))
        .orderBy(proSessions.createdAt);
      if (existing.length >= 1) {
        // Evict ALL existing sessions for this code — new device, new session.
        for (const s of existing) {
          await db.delete(proSessions).where(eq(proSessions.sessionToken, s.sessionToken));
        }
      }
    }
    const token = randomBytes(32).toString("hex"); // 64 char hex — impossible to guess
    await db.insert(proSessions).values({ sessionToken: token, codeRef, lastCheckedAt: new Date() });
    return token;
  }

  async verifyProSession(token: string, ip?: string, discordUserId?: string | null): Promise<boolean> {
    if (!token || token.length < 16) return false;
    const rows = await db.select().from(proSessions).where(eq(proSessions.sessionToken, token));
    if (!rows.length) return false;
    const session = rows[0];

    // Cross-validate the codeRef against the live codes table.
    // Exempt: admin-test sessions and friend tokens — they're admin-controlled.
    // Everything else MUST match a real, existing code in pro_access_codes.
    // This means deleting a code instantly kills all sessions tied to it,
    // and any orphan session (no matching code) is automatically blocked.
    const codeRef = session.codeRef ?? "";
    const isSystemRef = codeRef.startsWith("admin-") || codeRef.startsWith("friend:");
    if (!isSystemRef) {
      const codeRows = await db.select({ id: proAccessCodes.id })
        .from(proAccessCodes)
        .where(eq(proAccessCodes.code, codeRef));
      if (!codeRows.length) {
        // Orphan session — no matching code. Delete it and deny access.
        await db.delete(proSessions).where(eq(proSessions.sessionToken, token));
        return false;
      }
    }

    const update: Partial<typeof proSessions.$inferInsert> = { lastCheckedAt: new Date() };
    if (ip) update.ipAddress = ip;
    if (discordUserId) update.discordUserId = discordUserId;
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

  async deleteOrphanSessions(): Promise<number> {
    // Fetch all sessions and all valid code values.
    // Delete any session whose codeRef is not a real code AND not a system ref (admin-/friend:).
    const [allSessions, allCodes] = await Promise.all([
      db.select({ id: proSessions.id, sessionToken: proSessions.sessionToken, codeRef: proSessions.codeRef })
        .from(proSessions),
      db.select({ code: proAccessCodes.code }).from(proAccessCodes),
    ]);
    const validCodes = new Set(allCodes.map(c => c.code));
    const orphanIds = allSessions
      .filter(s => {
        const ref = s.codeRef ?? "";
        if (ref.startsWith("admin-") || ref.startsWith("friend:")) return false;
        return !validCodes.has(ref);
      })
      .map(s => s.id);
    if (!orphanIds.length) return 0;
    for (const id of orphanIds) {
      await db.delete(proSessions).where(eq(proSessions.id, id));
    }
    return orphanIds.length;
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

  async getAiSession(sessionId: string): Promise<AiChatSession | null> {
    const [row] = await db.select().from(aiChatSessions).where(eq(aiChatSessions.sessionId, sessionId));
    return row ?? null;
  }

  async upsertAiSession(sessionId: string, messages: AiChatMessage[]): Promise<void> {
    const existing = await this.getAiSession(sessionId);
    if (existing) {
      await db.update(aiChatSessions)
        .set({ messages, updatedAt: new Date() })
        .where(eq(aiChatSessions.sessionId, sessionId));
    } else {
      await db.insert(aiChatSessions).values({ sessionId, messages });
    }
  }

  async logSecurityEvent(event: { type: SecurityEventType; codeRef?: string; ip: string; country?: string; isp?: string; details: string; severity: SecuritySeverity }): Promise<SecurityEvent> {
    const [row] = await db.insert(securityEvents).values(event).returning();
    return row;
  }

  async markSecurityEventAlertSent(id: number): Promise<void> {
    await db.update(securityEvents).set({ alertSentAt: new Date() }).where(eq(securityEvents.id, id));
  }

  async getSecurityEvents(limit = 100): Promise<SecurityEvent[]> {
    return await db.select().from(securityEvents).orderBy(desc(securityEvents.createdAt)).limit(limit);
  }

  async resolveSecurityEvent(id: number): Promise<void> {
    await db.update(securityEvents).set({ resolvedAt: new Date() }).where(eq(securityEvents.id, id));
  }

  async autoResolveOldSecurityEvents(daysOld = 30): Promise<number> {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const rows = await db
      .update(securityEvents)
      .set({ resolvedAt: new Date() })
      .where(
        and(
          isNull(securityEvents.resolvedAt),
          lt(securityEvents.createdAt, cutoff),
          inArray(securityEvents.severity, ["low", "medium"])
        )
      )
      .returning({ id: securityEvents.id });
    return rows.length;
  }

  async previewAutoResolveCount(daysOld = 30): Promise<number> {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({ id: securityEvents.id })
      .from(securityEvents)
      .where(
        and(
          isNull(securityEvents.resolvedAt),
          lt(securityEvents.createdAt, cutoff),
          inArray(securityEvents.severity, ["low", "medium"])
        )
      );
    return rows.length;
  }

  async recordAutoResolveRun(count: number, windowDays = 30): Promise<void> {
    const existing = await this.getAdminSettings();
    const updates = { lastAutoResolvedCount: count, lastAutoResolvedAt: new Date() };
    if (existing) {
      await db.update(adminSettings).set(updates).where(eq(adminSettings.id, existing.id));
    } else {
      await db.insert(adminSettings).values(updates);
    }
    await db.insert(autoResolveRuns).values({ resolvedCount: count, windowDays, ranAt: new Date() });

    // Prune older rows so the history table stays lean. Keeps the most recent
    // MAX_AUTO_RESOLVE_RUNS rows (by ran_at desc); older rows are deleted.
    const MAX_AUTO_RESOLVE_RUNS = 1000;
    await db.execute(sql`
      DELETE FROM ${autoResolveRuns}
      WHERE id NOT IN (
        SELECT id FROM ${autoResolveRuns}
        ORDER BY ${autoResolveRuns.ranAt} DESC
        LIMIT ${MAX_AUTO_RESOLVE_RUNS}
      )
    `);
  }

  async getAutoResolveRunHistory(limit = 10): Promise<AutoResolveRun[]> {
    return await db.select().from(autoResolveRuns).orderBy(desc(autoResolveRuns.ranAt)).limit(limit);
  }

  async getTotalAutoResolved(): Promise<{ totalResolved: number; runCount: number }> {
    const rows = await db
      .select({
        totalResolved: sql<number>`COALESCE(SUM(${autoResolveRuns.resolvedCount}), 0)::int`,
        runCount: sql<number>`COUNT(*)::int`,
      })
      .from(autoResolveRuns);
    const row = rows[0];
    if (!row) {
      throw new Error("getTotalAutoResolved: aggregate query returned no rows");
    }
    return {
      totalResolved: Number(row.totalResolved ?? 0),
      runCount: Number(row.runCount ?? 0),
    };
  }

  async findCodeByStripeRef(stripeSessionId: string): Promise<ProAccessCode | null> {
    const rows = await db.select().from(proAccessCodes)
      .where(sql`note LIKE ${'%stripe:' + stripeSessionId + '%'}`);
    return rows[0] ?? null;
  }

  async claimStripeCode(codeValue: string, ip?: string): Promise<void> {
    await db.update(proAccessCodes)
      .set({ usedAt: new Date(), ...(ip ? { usedByIp: ip } : {}) })
      .where(eq(proAccessCodes.code, codeValue));
  }

  async setCodeDisplayName(sessionToken: string, name: string): Promise<boolean> {
    const sessionRows = await db.select({ codeRef: proSessions.codeRef })
      .from(proSessions).where(eq(proSessions.sessionToken, sessionToken));
    if (!sessionRows.length) return false;
    const codeRef = sessionRows[0].codeRef ?? "";
    if (!codeRef || codeRef.startsWith("admin-") || codeRef.startsWith("friend:")) return false;
    const codeRows = await db.select().from(proAccessCodes)
      .where(eq(proAccessCodes.code, codeRef));
    if (!codeRows.length) return false;
    const existing = codeRows[0];
    const existingNote = existing.note ?? "";
    // Strip any prior display-name prefix (format: "Name | rest")
    const baseNote = /^[^|]+\|/.test(existingNote)
      ? existingNote.replace(/^[^|]+\|\s*/, "").trim()
      : existingNote;
    const newNote = baseNote ? `${name} | ${baseNote}` : name;
    await db.update(proAccessCodes).set({ note: newNote }).where(eq(proAccessCodes.id, existing.id));
    return true;
  }

  async saveCustomerHardware(codeRef: string, data: { gpuVendor: string; gpuName: string; cpuModel: string; cpuCores?: number; cpuThreads?: number; ramGb: number; osVersion: string; isLaptop: boolean }): Promise<void> {
    await db.insert(customerHardware)
      .values({ codeRef, ...data, savedAt: new Date() })
      .onConflictDoUpdate({ target: customerHardware.codeRef, set: { ...data, savedAt: new Date() } });
  }

  async getAllCustomerHardware(): Promise<CustomerHardware[]> {
    return await db.select().from(customerHardware).orderBy(desc(customerHardware.savedAt));
  }

  async banIp(ip: string, reason: string, permanent = false): Promise<void> {
    await db.insert(ipBans).values({ ip, reason, permanent })
      .onConflictDoUpdate({ target: ipBans.ip, set: { reason, permanent, bannedAt: new Date() } });
  }

  async unbanIp(ip: string): Promise<void> {
    await db.delete(ipBans).where(eq(ipBans.ip, ip));
  }

  async isIpBanned(ip: string): Promise<boolean> {
    const [row] = await db.select().from(ipBans).where(eq(ipBans.ip, ip));
    return !!row;
  }

  async getIpBans(): Promise<IpBan[]> {
    return await db.select().from(ipBans).orderBy(desc(ipBans.bannedAt));
  }

  async createUserReport(category: ReportCategory, description: string, systemInfo?: Record<string, unknown>, sessionId?: string): Promise<UserReport> {
    const [report] = await db.insert(userReports).values({ category, description, systemInfo: systemInfo ?? null, sessionId: sessionId ?? null }).returning();
    return report;
  }

  async getUserReports(status?: ReportStatus): Promise<UserReport[]> {
    if (status) {
      return await db.select().from(userReports).where(eq(userReports.status, status)).orderBy(desc(userReports.createdAt));
    }
    return await db.select().from(userReports).orderBy(desc(userReports.createdAt));
  }

  async updateReportStatus(id: number, status: ReportStatus, adminNote?: string): Promise<UserReport | undefined> {
    const updates: Partial<UserReport> = { status };
    if (adminNote !== undefined) updates.adminNote = adminNote;
    if (status === "resolved") {
      updates.resolvedAt = new Date();
    } else {
      updates.resolvedAt = null;
    }
    const [report] = await db.update(userReports).set(updates).where(eq(userReports.id, id)).returning();
    return report;
  }

  async getAdminSettings(): Promise<AdminSettings | null> {
    const [row] = await db.select().from(adminSettings).limit(1);
    return row ?? null;
  }

  async upsertUser(data: InsertUser): Promise<User> {
    const [row] = await db.insert(users)
      .values({ ...data, lastLoginAt: new Date() })
      .onConflictDoUpdate({
        target: users.discordId,
        set: {
          username: data.username,
          globalName: data.globalName ?? null,
          avatarUrl: data.avatarUrl ?? null,
          email: data.email ?? null,
          lastLoginAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async getUser(discordId: string): Promise<User | null> {
    const [row] = await db.select().from(users).where(eq(users.discordId, discordId)).limit(1);
    return row ?? null;
  }

  async upsertAdminSettings(settings: { discordWebhookUrl?: string | null; alertEmail?: string | null; autoResolveDays?: number | null; currentVersion?: string | null; latestVersion?: string | null; updaterCmdUrl?: string | null; updatePageUrl?: string | null; alertOnNewRig?: boolean; alertOnNewNvidiaDriver?: boolean; auditLogEnabled?: boolean; auditWebhookUrl?: string | null }): Promise<AdminSettings> {
    const existing = await this.getAdminSettings();
    if (existing) {
      const [row] = await db.update(adminSettings)
        .set(settings)
        .where(eq(adminSettings.id, existing.id))
        .returning();
      return row;
    } else {
      const [row] = await db.insert(adminSettings).values(settings).returning();
      return row;
    }
  }

  async getAllDiscountCodes(): Promise<DiscountCode[]> {
    return db.select().from(discountCodes).orderBy(desc(discountCodes.createdAt));
  }

  async createDiscountCode(code: string, percentOff: number, maxUses?: number | null, expiresAt?: Date | null, note?: string | null): Promise<DiscountCode> {
    const [row] = await db.insert(discountCodes).values({
      code: code.toUpperCase().trim(),
      percentOff,
      ...(maxUses != null ? { maxUses } : {}),
      ...(expiresAt != null ? { expiresAt } : {}),
      ...(note != null ? { note } : {}),
    }).returning();
    return row;
  }

  async validateDiscountCode(code: string): Promise<DiscountCode | null> {
    const rows = await db.select().from(discountCodes)
      .where(eq(discountCodes.code, code.toUpperCase().trim()));
    if (!rows.length) return null;
    const dc = rows[0];
    if (dc.expiresAt && new Date(dc.expiresAt) < new Date()) return null;
    if (dc.maxUses != null && dc.usedCount >= dc.maxUses) return null;
    return dc;
  }

  async useDiscountCode(code: string): Promise<void> {
    await db.update(discountCodes)
      .set({ usedCount: sql`${discountCodes.usedCount} + 1` })
      .where(eq(discountCodes.code, code.toUpperCase().trim()));
  }

  async deleteDiscountCode(id: number): Promise<void> {
    await db.delete(discountCodes).where(eq(discountCodes.id, id));
  }

  async getProCodeForToken(sessionToken: string): Promise<string | null> {
    try {
      const rows = await db.select({ codeRef: proSessions.codeRef })
        .from(proSessions)
        .where(eq(proSessions.sessionToken, sessionToken))
        .limit(1);
      return rows[0]?.codeRef ?? null;
    } catch { return null; }
  }

  async upsertRig(payload: HardwareScanPayload, discordUserId?: string | null, proCode?: string | null): Promise<{ rig: HardwareRig; isNew: boolean }> {
    const hash = computeRigHash(payload);
    const existing = await db.select().from(hardwareRigs).where(eq(hardwareRigs.hash, hash)).limit(1);
    if (existing.length) {
      const [updated] = await db.update(hardwareRigs)
        .set({
          lastSeenAt: new Date(),
          seenCount: sql`${hardwareRigs.seenCount} + 1`,
          ...(discordUserId !== undefined ? { discordUserId: discordUserId ?? null } : {}),
          ...(proCode ? { proCode } : {}),
          cpu: payload.cpu,
          gpu: payload.gpu,
          vramMb: payload.vramMb ?? null,
          ramGb: payload.ramGb ?? null,
          ramMhz: payload.ramMhz ?? null,
          motherboard: payload.motherboard ?? null,
          chassis: payload.chassis ?? null,
          coolingType: payload.coolingType ?? null,
          refreshHz: payload.refreshHz ?? null,
          nicVendor: payload.nicVendor ?? null,
          storageSummary: payload.storageSummary ?? null,
          anticheats: payload.anticheats ?? [],
        })
        .where(eq(hardwareRigs.hash, hash))
        .returning();
      return { rig: updated, isNew: false };
    }
    const [rig] = await db.insert(hardwareRigs).values({
      hash,
      discordUserId: discordUserId ?? null,
      proCode: proCode ?? null,
      cpu: payload.cpu,
      gpu: payload.gpu,
      vramMb: payload.vramMb ?? null,
      ramGb: payload.ramGb ?? null,
      ramMhz: payload.ramMhz ?? null,
      motherboard: payload.motherboard ?? null,
      chassis: payload.chassis ?? null,
      coolingType: payload.coolingType ?? null,
      refreshHz: payload.refreshHz ?? null,
      nicVendor: payload.nicVendor ?? null,
      storageSummary: payload.storageSummary ?? null,
      anticheats: payload.anticheats ?? [],
    }).returning();
    return { rig, isNew: true };
  }

  async markRigAlertSent(hash: string): Promise<void> {
    await db.update(hardwareRigs).set({ alertSentAt: new Date() }).where(eq(hardwareRigs.hash, hash));
  }

  async getRigByHash(hash: string): Promise<HardwareRig | null> {
    const [row] = await db.select().from(hardwareRigs).where(eq(hardwareRigs.hash, hash)).limit(1);
    return row ?? null;
  }

  async getRigById(id: number): Promise<HardwareRig | null> {
    const [row] = await db.select().from(hardwareRigs).where(eq(hardwareRigs.id, id)).limit(1);
    return row ?? null;
  }

  async getLatestRigForUser(discordUserId: string): Promise<HardwareRig | null> {
    const [row] = await db.select().from(hardwareRigs)
      .where(eq(hardwareRigs.discordUserId, discordUserId))
      .orderBy(desc(hardwareRigs.lastSeenAt))
      .limit(1);
    return row ?? null;
  }

  async listRigs(opts?: { limit?: number; offset?: number; sort?: "lastSeenAt" | "seenCount" | "firstSeenAt" }): Promise<HardwareRig[]> {
    const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 500);
    const offset = Math.max(opts?.offset ?? 0, 0);
    const sortCol = opts?.sort === "seenCount" ? hardwareRigs.seenCount
      : opts?.sort === "firstSeenAt" ? hardwareRigs.firstSeenAt
      : hardwareRigs.lastSeenAt;
    return await db.select().from(hardwareRigs).orderBy(desc(sortCol)).limit(limit).offset(offset);
  }

  async addTweakSuggestion(data: InsertTweakSuggestion): Promise<TweakSuggestion> {
    const [row] = await db.insert(tweakSuggestions).values(data).returning();
    return row;
  }

  async listSuggestions(status?: SuggestionStatus): Promise<TweakSuggestion[]> {
    if (status) {
      return await db.select().from(tweakSuggestions)
        .where(eq(tweakSuggestions.status, status))
        .orderBy(desc(tweakSuggestions.createdAt));
    }
    return await db.select().from(tweakSuggestions).orderBy(desc(tweakSuggestions.createdAt));
  }

  async updateSuggestionStatus(id: number, status: SuggestionStatus): Promise<TweakSuggestion | null> {
    const [row] = await db.update(tweakSuggestions)
      .set({ status })
      .where(eq(tweakSuggestions.id, id))
      .returning();
    return row ?? null;
  }

  async upsertNvidiaDriver(data: InsertNvidiaDriver): Promise<NvidiaDriver> {
    // Only overwrite columns explicitly provided on the input. This makes
    // partial updates (e.g. toggling tweaksValidated from the admin UI) safe
    // and prevents wiping out releasedAt/branch with nulls.
    const setOnConflict: Record<string, unknown> = { lastSeenAt: new Date() };
    if (data.releasedAt !== undefined) setOnConflict.releasedAt = data.releasedAt;
    if (data.branch !== undefined) setOnConflict.branch = data.branch;
    if (data.tweaksValidated !== undefined) setOnConflict.tweaksValidated = data.tweaksValidated;

    const [row] = await db.insert(nvidiaDrivers)
      .values({ ...data, lastSeenAt: new Date() })
      .onConflictDoUpdate({
        target: nvidiaDrivers.version,
        set: setOnConflict,
      })
      .returning();
    return row;
  }

  async listNvidiaDrivers(): Promise<NvidiaDriver[]> {
    return await db.select().from(nvidiaDrivers).orderBy(desc(nvidiaDrivers.releasedAt));
  }

  async markDriverAlertSent(version: string): Promise<void> {
    await db.update(nvidiaDrivers).set({ alertSentAt: new Date() }).where(eq(nvidiaDrivers.version, version));
  }

  // ── Pro entitlements (Task #41) ─────────────────────────────────────────────
  async grantPro(args: { discordUserId: string; source: import("@shared/schema").ProSource; grantedBy?: string | null; notes?: string | null }): Promise<ProEntitlement> {
    const [row] = await db.insert(proEntitlements)
      .values({
        discordUserId: args.discordUserId,
        source: args.source,
        grantedBy: args.grantedBy ?? null,
        notes: args.notes ?? null,
        // revokedAt left null so the user is immediately Pro
      })
      .onConflictDoUpdate({
        target: proEntitlements.discordUserId,
        // Re-granting a previously revoked entitlement clears revokedAt and
        // refreshes the source / notes so admins can see the latest grant path.
        set: {
          source: args.source,
          grantedBy: args.grantedBy ?? null,
          notes: args.notes ?? null,
          grantedAt: new Date(),
          revokedAt: null,
        },
      })
      .returning();
    return row;
  }

  async revokePro(discordUserId: string): Promise<void> {
    await db.update(proEntitlements)
      .set({ revokedAt: new Date() })
      .where(eq(proEntitlements.discordUserId, discordUserId));
  }

  async isPro(discordUserId: string): Promise<ProEntitlement | null> {
    if (!discordUserId) return null;
    const rows = await db.select().from(proEntitlements)
      .where(and(eq(proEntitlements.discordUserId, discordUserId), isNull(proEntitlements.revokedAt)));
    return rows[0] ?? null;
  }

  async getProEntitlement(discordUserId: string): Promise<ProEntitlement | null> {
    if (!discordUserId) return null;
    const rows = await db.select().from(proEntitlements)
      .where(eq(proEntitlements.discordUserId, discordUserId));
    return rows[0] ?? null;
  }

  async listDiscordUsers(): Promise<{ discordId: string; username: string; globalName: string | null; avatarUrl: string | null }[]> {
    return db.select({
      discordId: users.discordId,
      username: users.username,
      globalName: users.globalName,
      avatarUrl: users.avatarUrl,
    }).from(users);
  }

  async listProUsers(): Promise<(ProEntitlement & { username: string | null; avatarUrl: string | null })[]> {
    const rows = await db
      .select({
        discordUserId: proEntitlements.discordUserId,
        source: proEntitlements.source,
        grantedAt: proEntitlements.grantedAt,
        grantedBy: proEntitlements.grantedBy,
        notes: proEntitlements.notes,
        revokedAt: proEntitlements.revokedAt,
        username: users.username,
        avatarUrl: users.avatarUrl,
      })
      .from(proEntitlements)
      .leftJoin(users, eq(users.discordId, proEntitlements.discordUserId))
      .orderBy(desc(proEntitlements.grantedAt));
    return rows;
  }

  async persistNativeToken(token: string, userId: string, expiresAt: number): Promise<void> {
    await db.insert(nativeTokensTable).values({
      token,
      userId,
      expiresAt,
      createdAt: Date.now(),
    }).onConflictDoNothing();
  }

  async lookupNativeToken(token: string): Promise<{ userId: string; expiresAt: number } | null> {
    const now = Date.now();
    const rows = await db.select().from(nativeTokensTable)
      .where(eq(nativeTokensTable.token, token));
    const row = rows[0];
    if (!row) return null;
    if (now > row.expiresAt) {
      await db.delete(nativeTokensTable).where(eq(nativeTokensTable.token, token)).catch(() => {});
      return null;
    }
    return { userId: row.userId, expiresAt: row.expiresAt };
  }

  async purgeExpiredNativeTokens(): Promise<void> {
    await db.delete(nativeTokensTable).where(lt(nativeTokensTable.expiresAt, Date.now()));
  }

  async grantGraphicsStudio(discordUserId: string, grantedBy?: string | null, notes?: string | null): Promise<void> {
    await db.insert(graphicsStudioGrants)
      .values({ discordUserId, grantedBy: grantedBy ?? null, notes: notes ?? null })
      .onConflictDoNothing();
  }

  async revokeGraphicsStudio(discordUserId: string): Promise<void> {
    await db.delete(graphicsStudioGrants).where(eq(graphicsStudioGrants.discordUserId, discordUserId));
  }

  async hasGraphicsStudio(discordUserId: string): Promise<boolean> {
    const rows = await db.select({ d: graphicsStudioGrants.discordUserId })
      .from(graphicsStudioGrants).where(eq(graphicsStudioGrants.discordUserId, discordUserId));
    return rows.length > 0;
  }

  async listGraphicsStudioGrants(): Promise<GraphicsStudioGrant[]> {
    return db.select().from(graphicsStudioGrants).orderBy(desc(graphicsStudioGrants.grantedAt));
  }

  async getAllFivemServers(): Promise<FivemServer[]> {
    return db.select().from(fivemServers).orderBy(desc(fivemServers.createdAt));
  }

  async upsertFivemServer(connectCode: string, name: string, logoUrl?: string | null): Promise<FivemServer> {
    const [row] = await db
      .insert(fivemServers)
      .values({ connectCode, name, logoUrl: logoUrl ?? null })
      .onConflictDoUpdate({
        target: fivemServers.connectCode,
        set: {
          name: sql`EXCLUDED.name`,
          logoUrl: sql`COALESCE(fivem_servers.logo_url, EXCLUDED.logo_url)`,
        },
      })
      .returning();
    return row;
  }

  async updateFivemServerLogo(connectCode: string, logoUrl: string | null): Promise<void> {
    await db.update(fivemServers).set({ logoUrl }).where(eq(fivemServers.connectCode, connectCode));
  }

  async getHudSettings() {
    const DEF = { coverWidth: 180, iconSize: 140, iconLeft: 50, iconTop: 50, showServerName: true };
    const rows = await db.select({ h: adminSettings.hudSettings }).from(adminSettings).limit(1);
    if (!rows.length || !rows[0].h) return DEF;
    try { return { ...DEF, ...JSON.parse(rows[0].h) }; } catch { return DEF; }
  }

  async saveHudSettings(s: { coverWidth: number; iconSize: number; iconLeft: number; iconTop: number; showServerName: boolean }) {
    const rows = await db.select({ id: adminSettings.id }).from(adminSettings).limit(1);
    const json = JSON.stringify(s);
    if (rows.length) {
      await db.update(adminSettings).set({ hudSettings: json }).where(eq(adminSettings.id, rows[0].id));
    } else {
      await db.insert(adminSettings).values({ hudSettings: json });
    }
  }
}

export const storage = new DatabaseStorage();
