import { storage } from "./storage";
import { sendProCode, isEmailConfigured } from "./email";
import { log } from "./index";

export const autoSendState = {
  lastRunAt: null as Date | null,
  lastSentCount: 0,
  totalAutoSent: 0,
  nextRunAt: null as Date | null,
  isRunning: false,
  thresholdMinutes: 5,
  intervalMinutes: 2,
};

function getSiteUrl(): string {
  const domains = process.env.REPLIT_DOMAINS || "";
  const first = domains.split(",")[0]?.trim();
  if (first) return `https://${first}`;
  return "https://optigods.replit.app";
}

export async function runAutoSend(): Promise<number> {
  if (!isEmailConfigured()) return 0;
  if (autoSendState.isRunning) return 0;
  autoSendState.isRunning = true;

  let sent = 0;
  try {
    const requests = await storage.getEmailRequests();
    const now = Date.now();
    const thresholdMs = autoSendState.thresholdMinutes * 60 * 1000;

    // Only auto-send requests that:
    //   1. Are pending
    //   2. Have been waiting at least thresholdMinutes
    //   3. Have a verified amountPaid (amount was validated against today's price on submission)
    const stale = requests.filter(r =>
      r.status === "pending" &&
      r.amountPaid !== null && r.amountPaid !== undefined && r.amountPaid > 0 &&
      r.createdAt &&
      now - new Date(r.createdAt).getTime() >= thresholdMs
    );

    const reservedCodeIds = new Set(
      requests
        .filter(r => r.sentCodeId && (r.status === "sent" || r.status === "auto-sent"))
        .map(r => r.sentCodeId)
    );

    for (const req of stale) {
      try {
        const allCodes = await storage.getAllCodes();
        const available = allCodes.find(c => !c.usedAt && !reservedCodeIds.has(c.id));
        if (!available) {
          log("[auto-send] No available codes left — stopping auto-send", "auto-send");
          break;
        }
        reservedCodeIds.add(available.id);
        await sendProCode(req.email, available.code, getSiteUrl());
        await storage.updateEmailRequestStatus(req.id, "auto-sent", available.id, `Auto-sent after ${autoSendState.thresholdMinutes} min — amount verified $${req.amountPaid}`);
        log(`[auto-send] Sent code to ${req.email} (paid $${req.amountPaid}, discord: ${req.discordUsername || "not provided"})`, "auto-send");
        sent++;
      } catch (err) {
        log(`[auto-send] Failed for ${req.email}: ${err}`, "auto-send");
      }
    }
  } finally {
    autoSendState.isRunning = false;
    autoSendState.lastRunAt = new Date();
    autoSendState.lastSentCount = sent;
    autoSendState.totalAutoSent += sent;
    autoSendState.nextRunAt = new Date(Date.now() + autoSendState.intervalMinutes * 60 * 1000);
  }

  if (sent > 0) log(`[auto-send] Completed — sent ${sent} code(s)`, "auto-send");
  return sent;
}

export function startAutoSendScheduler(): void {
  const intervalMs = autoSendState.intervalMinutes * 60 * 1000;
  autoSendState.nextRunAt = new Date(Date.now() + intervalMs);

  setInterval(async () => {
    autoSendState.nextRunAt = new Date(Date.now() + intervalMs);
    await runAutoSend();
  }, intervalMs);

  log(`Auto-send scheduler started — checks every ${autoSendState.intervalMinutes} min, sends after ${autoSendState.thresholdMinutes} min (amount-verified requests only)`, "auto-send");
}
