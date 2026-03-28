import { log } from "./index";

export const autoSendState = {
  lastRunAt: null as Date | null,
  lastSentCount: 0,
  totalAutoSent: 0,
  nextRunAt: null as Date | null,
  isRunning: false,
  thresholdMinutes: 0,
  intervalMinutes: 0,
};

// SECURITY: Auto-send is permanently disabled.
// The email request form only queues requests for admin review.
// Codes must be sent manually by the admin after verifying real payment proof.
// This prevents anyone from submitting a fake payment reference and receiving a code.
export async function runAutoSend(): Promise<number> {
  return 0;
}

export function startAutoSendScheduler(): void {
  log("Auto-send scheduler is DISABLED — codes require manual admin approval", "auto-send");
}
