import nodemailer from "nodemailer";
import type { SecurityEvent, HardwareRig, NvidiaDriver } from "@shared/schema";

function getTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

async function sendDiscordAlert(event: SecurityEvent, webhookUrl: string, adminPanelUrl: string): Promise<void> {
  const typeLabels: Record<string, string> = {
    code_sharing: "Code Sharing",
    vpn_detected: "VPN Detected",
    rate_block: "Rate Block",
    multi_ip: "Multi-IP",
    manual_flag: "Manual Flag",
  };

  const payload = {
    embeds: [
      {
        title: `🚨 CRITICAL Security Alert — ${typeLabels[event.type] ?? event.type}`,
        color: 0xef4444,
        fields: [
          { name: "Event Type", value: typeLabels[event.type] ?? event.type, inline: true },
          { name: "Severity", value: event.severity.toUpperCase(), inline: true },
          { name: "IP Address", value: event.ip || "—", inline: true },
          { name: "Country", value: event.country || "—", inline: true },
          { name: "ISP", value: event.isp || "—", inline: true },
          { name: "Code / Ref", value: event.codeRef || "—", inline: true },
          { name: "Details", value: event.details, inline: false },
          { name: "Admin Panel", value: `[View in Aether Intelligence Center](${adminPanelUrl})`, inline: false },
        ],
        footer: { text: `Event ID #${event.id} · Opti Gods Aether` },
        timestamp: event.createdAt ? new Date(event.createdAt).toISOString() : new Date().toISOString(),
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discord webhook failed: ${res.status} — ${body}`);
  }
}

async function sendEmailAlert(event: SecurityEvent, toEmail: string, adminPanelUrl: string): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) throw new Error("Email transporter not configured (EMAIL_USER/EMAIL_PASS missing)");

  const typeLabels: Record<string, string> = {
    code_sharing: "Code Sharing",
    vpn_detected: "VPN Detected",
    rate_block: "Rate Block",
    multi_ip: "Multi-IP",
    manual_flag: "Manual Flag",
  };

  const label = typeLabels[event.type] ?? event.type;

  await transporter.sendMail({
    from: `"Opti Gods Aether" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `🚨 [CRITICAL] Security Alert — ${label} · Event #${event.id}`,
    html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0c0c0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:40px auto;padding:20px;">

    <div style="background:#160808;border:1px solid #3a1414;border-left:4px solid #dc2626;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
      <p style="margin:0 0 4px;font-size:10px;color:#ef4444;text-transform:uppercase;letter-spacing:2px;font-weight:bold;">Critical Security Alert</p>
      <p style="margin:0;font-size:20px;font-weight:900;color:#fff;">${label}</p>
    </div>

    <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
      ${[
        ["Event Type", label],
        ["Severity", event.severity.toUpperCase()],
        ["IP Address", event.ip || "—"],
        ["Country", event.country || "—"],
        ["ISP", event.isp || "—"],
        ["Code / Ref", event.codeRef || "—"],
      ].map(([k, v]) => `
      <tr style="border-bottom:1px solid #1c1c1c;">
        <td style="padding:8px 0;font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:1px;width:120px;">${k}</td>
        <td style="padding:8px 0;font-size:13px;color:#e4e4e7;font-weight:600;">${v}</td>
      </tr>`).join("")}
    </table>

    <div style="background:#111;border:1px solid #222;border-radius:8px;padding:14px 16px;margin:0 0 20px;">
      <p style="margin:0 0 6px;font-size:10px;color:#52525b;text-transform:uppercase;letter-spacing:2px;">Details</p>
      <p style="margin:0;font-size:13px;color:#d4d4d8;line-height:1.6;">${event.details}</p>
    </div>

    <a href="${adminPanelUrl}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-size:12px;font-weight:700;padding:10px 20px;border-radius:6px;letter-spacing:0.5px;">
      View in Admin Panel
    </a>

    <div style="border-top:1px solid #1c1c1c;padding-top:16px;margin-top:24px;">
      <p style="color:#3f3f46;font-size:11px;margin:0;">Event #${event.id} · Opti Gods Aether Intelligence Center</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `
CRITICAL SECURITY ALERT — ${label}

Event Type: ${label}
Severity:   ${event.severity.toUpperCase()}
IP Address: ${event.ip || "—"}
Country:    ${event.country || "—"}
ISP:        ${event.isp || "—"}
Code / Ref: ${event.codeRef || "—"}

Details: ${event.details}

View in admin panel: ${adminPanelUrl}

— Opti Gods Aether Intelligence Center (Event #${event.id})
    `.trim(),
  });
}

export async function notifySale(opts: {
  tier: "pro" | "manual";
  email: string | null;
  code: string | null;
  amount: number;
  stripeSessionId: string;
  adminPanelUrl: string;
  discordWebhookUrl?: string | null;
}): Promise<void> {
  const { tier, email, code, amount, stripeSessionId, adminPanelUrl, discordWebhookUrl } = opts;
  const label = tier === "manual" ? "Manual Opti ($25)" : "Pro ($15)";
  const amountStr = `$${(amount / 100).toFixed(2)}`;

  if (discordWebhookUrl) {
    const payload = {
      embeds: [
        {
          title: `💰 New Sale — ${label}`,
          color: tier === "manual" ? 0xf59e0b : 0x22c55e,
          fields: [
            { name: "Tier", value: label, inline: true },
            { name: "Amount", value: amountStr, inline: true },
            { name: "Email", value: email || "card-only (no email)", inline: false },
            ...(code ? [{ name: "Pro Code", value: `\`${code}\``, inline: false }] : []),
            { name: "Stripe Session", value: `\`${stripeSessionId}\``, inline: false },
            { name: "Admin Panel", value: `[View Codes](${adminPanelUrl})`, inline: false },
          ],
          footer: { text: "Opti Gods · Stripe Payment" },
          timestamp: new Date().toISOString(),
        },
      ],
    };
    try {
      await fetch(discordWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error("[alerts] Sale Discord notification failed:", e);
    }
  }
}

export interface NotifyResult {
  sentAny: boolean;
  discord: "sent" | "skipped" | "failed";
  email: "sent" | "skipped" | "failed" | "unconfigured";
  errors: string[];
}

export async function notifyCriticalEvent(
  event: SecurityEvent,
  opts: {
    discordWebhookUrl?: string | null;
    alertEmail?: string | null;
    adminPanelUrl: string;
  }
): Promise<NotifyResult> {
  const { discordWebhookUrl, alertEmail, adminPanelUrl } = opts;
  const errs: string[] = [];
  let discordResult: NotifyResult["discord"] = "skipped";
  let emailResult: NotifyResult["email"] = "skipped";

  if (discordWebhookUrl) {
    try {
      await sendDiscordAlert(event, discordWebhookUrl, adminPanelUrl);
      discordResult = "sent";
    } catch (e) {
      discordResult = "failed";
      errs.push(`Discord: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (alertEmail) {
    const transporter = getTransporter();
    if (!transporter) {
      emailResult = "unconfigured";
      errs.push("Email: EMAIL_USER/EMAIL_PASS not set — skipped email delivery");
    } else {
      try {
        await sendEmailAlert(event, alertEmail, adminPanelUrl);
        emailResult = "sent";
      } catch (e) {
        emailResult = "failed";
        errs.push(`Email: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  const sentAny = discordResult === "sent" || emailResult === "sent";

  if (errs.length) {
    console.error("[alerts] Notification errors:", errs.join(" | "));
  }

  return { sentAny, discord: discordResult, email: emailResult, errors: errs };
}

// ── Hardware rig + NVIDIA driver alerts (Task #36) ────────────────────────────

/** Heuristic — suggest up to 3 tweak categories worth offering for a new rig. */
export function suggestTweakCategories(rig: HardwareRig): string[] {
  const gpu = (rig.gpu || "").toLowerCase();
  const cpu = (rig.cpu || "").toLowerCase();
  const chassis = (rig.chassis || "").toLowerCase();
  const out: string[] = [];

  if (gpu.includes("nvidia") || gpu.includes("geforce") || gpu.includes("rtx") || gpu.includes("gtx")) {
    out.push("NVIDIA Control Panel + driver tweaks");
  } else if (gpu.includes("radeon") || gpu.includes("amd") || gpu.includes("vega") || gpu.includes("rx ")) {
    if (gpu.includes("vega") || cpu.includes("ryzen 3 2") || cpu.includes("ryzen 5 2400") || cpu.includes("2200g") || cpu.includes("2400g")) {
      out.push("AMD Integrated GPU (Vega) tweaks");
    } else {
      out.push("AMD Adrenalin + Radeon tweaks");
    }
  } else if (gpu.includes("intel") || gpu.includes("uhd") || gpu.includes("iris")) {
    out.push("Intel iGPU tweaks");
  }

  if (chassis.includes("laptop") || chassis.includes("notebook")) {
    out.push("Laptop power-plan + thermal tweaks");
  }

  if ((rig.vramMb ?? 0) > 0 && (rig.vramMb ?? 0) < 4096) {
    out.push("Low-VRAM memory tweaks");
  } else if ((rig.ramGb ?? 0) > 0 && (rig.ramGb ?? 0) <= 8) {
    out.push("Memory pressure / pagefile tweaks");
  }

  if ((rig.anticheats ?? []).length > 0) {
    out.push(`Anti-cheat safe baseline (${(rig.anticheats ?? []).join(", ")})`);
  }

  if (out.length < 3) out.push("Registry baseline + Debloat");
  if (out.length < 3) out.push("Network + latency tweaks");

  return out.slice(0, 3);
}

export async function sendNewRigAlert(
  rig: HardwareRig,
  opts: { discordWebhookUrl?: string | null; alertEmail?: string | null; adminPanelUrl: string }
): Promise<NotifyResult> {
  const { discordWebhookUrl, alertEmail, adminPanelUrl } = opts;
  const errs: string[] = [];
  let discordResult: NotifyResult["discord"] = "skipped";
  let emailResult: NotifyResult["email"] = "skipped";

  const cats = suggestTweakCategories(rig);
  // adminPanelUrl already ends in /admin — append query params directly
  const rigUrl = `${adminPanelUrl.replace(/\/$/, "")}?tab=rigs&hash=${encodeURIComponent(rig.hash)}`;

  if (!discordWebhookUrl && !alertEmail) {
    console.info(`[alerts] sendNewRigAlert: no channels configured — skipping rig #${rig.id}`);
    return { sentAny: false, discord: "skipped", email: "skipped", errors: [] };
  }
  const specLine = [
    rig.cpu,
    rig.gpu + (rig.vramMb ? ` (${Math.round(rig.vramMb / 1024)}GB VRAM)` : ""),
    rig.ramGb ? `${rig.ramGb}GB RAM${rig.ramMhz ? ` @ ${rig.ramMhz}MHz` : ""}` : null,
    rig.chassis,
    rig.coolingType ? `${rig.coolingType} cooling` : null,
  ].filter(Boolean).join(" · ");

  if (discordWebhookUrl) {
    try {
      const payload = {
        embeds: [{
          title: "🧠 New Rig Detected — Aether",
          color: 0x8b5cf6,
          fields: [
            { name: "CPU", value: rig.cpu || "—", inline: true },
            { name: "GPU", value: rig.gpu || "—", inline: true },
            { name: "Chassis", value: rig.chassis || "—", inline: true },
            { name: "Cooling", value: rig.coolingType || "—", inline: true },
            { name: "RAM", value: rig.ramGb ? `${rig.ramGb}GB${rig.ramMhz ? ` @ ${rig.ramMhz}MHz` : ""}` : "—", inline: true },
            { name: "VRAM", value: rig.vramMb ? `${Math.round(rig.vramMb / 1024)}GB` : "—", inline: true },
            { name: "Anti-cheats", value: (rig.anticheats ?? []).join(", ") || "—", inline: true },
            { name: "Suggested tweak categories", value: cats.map(c => `• ${c}`).join("\n"), inline: false },
            { name: "Hash", value: `\`${rig.hash.slice(0, 16)}…\``, inline: false },
            { name: "Aether Rig Profile", value: `[Open in Admin → Hardware DB](${rigUrl})`, inline: false },
          ],
          footer: { text: `Rig #${rig.id} · Opti Gods Aether` },
          timestamp: (rig.firstSeenAt ? new Date(rig.firstSeenAt) : new Date()).toISOString(),
        }],
      };
      const res = await fetch(discordWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Discord webhook failed: ${res.status} — ${await res.text()}`);
      discordResult = "sent";
    } catch (e) {
      discordResult = "failed";
      errs.push(`Discord: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (alertEmail) {
    const transporter = getTransporter();
    if (!transporter) {
      emailResult = "unconfigured";
      errs.push("Email: EMAIL_USER/EMAIL_PASS not set — skipped email delivery");
    } else {
      try {
        await transporter.sendMail({
          from: `"Opti Gods Aether" <${process.env.EMAIL_USER}>`,
          to: alertEmail,
          subject: `🧠 New Rig — ${rig.cpu} · ${rig.gpu}`,
          html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0c0c0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:520px;margin:40px auto;padding:20px;">
  <div style="background:#0c0820;border:1px solid #2a1a4a;border-left:4px solid #8b5cf6;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
    <p style="margin:0 0 4px;font-size:10px;color:#a78bfa;text-transform:uppercase;letter-spacing:2px;font-weight:bold;">New Rig Detected · Aether</p>
    <p style="margin:0;font-size:16px;font-weight:900;color:#fff;">${specLine || rig.cpu}</p>
  </div>
  <div style="background:#111;border:1px solid #222;border-radius:8px;padding:14px 16px;margin:0 0 20px;">
    <p style="margin:0 0 8px;font-size:10px;color:#52525b;text-transform:uppercase;letter-spacing:2px;">Suggested tweak categories</p>
    ${cats.map(c => `<p style="margin:4px 0;font-size:13px;color:#d4d4d8;">• ${c}</p>`).join("")}
  </div>
  <a href="${rigUrl}" style="display:inline-block;background:#8b5cf6;color:#fff;text-decoration:none;font-size:12px;font-weight:700;padding:10px 20px;border-radius:6px;letter-spacing:0.5px;">Open Rig Profile</a>
  <div style="border-top:1px solid #1c1c1c;padding-top:16px;margin-top:24px;"><p style="color:#3f3f46;font-size:11px;margin:0;">Rig #${rig.id} · hash ${rig.hash.slice(0,16)}…</p></div>
</div></body></html>`,
          text: `New rig: ${specLine}\n\nSuggested:\n${cats.map(c => `- ${c}`).join("\n")}\n\n${rigUrl}`,
        });
        emailResult = "sent";
      } catch (e) {
        emailResult = "failed";
        errs.push(`Email: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  if (errs.length) console.error("[alerts] sendNewRigAlert errors:", errs.join(" | "));
  return { sentAny: discordResult === "sent" || emailResult === "sent", discord: discordResult, email: emailResult, errors: errs };
}

export async function sendNewDriverAlert(
  driver: NvidiaDriver,
  opts: {
    discordWebhookUrl?: string | null;
    alertEmail?: string | null;
    adminPanelUrl: string;
    recentRigs?: HardwareRig[];
    validatedBaseline?: string | null;
  }
): Promise<NotifyResult> {
  const { discordWebhookUrl, alertEmail, adminPanelUrl, recentRigs = [], validatedBaseline = null } = opts;
  const errs: string[] = [];
  let discordResult: NotifyResult["discord"] = "skipped";
  let emailResult: NotifyResult["email"] = "skipped";
  // adminPanelUrl already ends in /admin
  const driverUrl = `${adminPanelUrl.replace(/\/$/, "")}?tab=drivers`;

  if (!discordWebhookUrl && !alertEmail) {
    console.info(`[alerts] sendNewDriverAlert: no channels configured — skipping v${driver.version}`);
    return { sentAny: false, discord: "skipped", email: "skipped", errors: [] };
  }
  const rigLines = recentRigs.slice(0, 5).map(r =>
    `• ${r.cpu} · ${r.gpu}${r.vramMb ? ` ${Math.round(r.vramMb / 1024)}GB` : ""}${r.chassis ? ` · ${r.chassis}` : ""}`
  );
  const rigsField = recentRigs.length
    ? `${rigLines.join("\n")}${recentRigs.length > 5 ? `\n…and ${recentRigs.length - 5} more` : ""}`
    : "No recent rigs on record yet";

  if (discordWebhookUrl) {
    try {
      const payload = {
        embeds: [{
          title: `🟢 New NVIDIA Driver — ${driver.version}`,
          color: 0x22c55e,
          fields: [
            { name: "Version", value: driver.version, inline: true },
            { name: "Branch", value: driver.branch || "—", inline: true },
            { name: "Released", value: driver.releasedAt ? new Date(driver.releasedAt).toISOString().slice(0, 10) : "—", inline: true },
            { name: "Last validated baseline", value: validatedBaseline ? `v${validatedBaseline}` : "none yet", inline: true },
            { name: `Recent rigs — latest scans (${recentRigs.length})`, value: rigsField.slice(0, 1000), inline: false },
            { name: "Action", value: `[Validate tweaks in Admin → NVIDIA Tracker](${driverUrl})`, inline: false },
          ],
          footer: { text: "Opti Gods Aether · Driver Poller" },
          timestamp: new Date().toISOString(),
        }],
      };
      const res = await fetch(discordWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Discord webhook failed: ${res.status} — ${await res.text()}`);
      discordResult = "sent";
    } catch (e) {
      discordResult = "failed";
      errs.push(`Discord: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (alertEmail) {
    const transporter = getTransporter();
    if (!transporter) {
      emailResult = "unconfigured";
      errs.push("Email: EMAIL_USER/EMAIL_PASS not set — skipped email delivery");
    } else {
      try {
        await transporter.sendMail({
          from: `"Opti Gods Aether" <${process.env.EMAIL_USER}>`,
          to: alertEmail,
          subject: `🟢 New NVIDIA Driver — ${driver.version}`,
          html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0c0c0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:520px;margin:40px auto;padding:20px;">
  <div style="background:#06170c;border:1px solid #14401f;border-left:4px solid #22c55e;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
    <p style="margin:0 0 4px;font-size:10px;color:#4ade80;text-transform:uppercase;letter-spacing:2px;font-weight:bold;">New NVIDIA Driver</p>
    <p style="margin:0;font-size:20px;font-weight:900;color:#fff;">v${driver.version}</p>
    ${driver.branch ? `<p style="margin:4px 0 0;font-size:11px;color:#a1a1aa;">Branch ${driver.branch}</p>` : ""}
    <p style="margin:6px 0 0;font-size:11px;color:#a1a1aa;">Last validated baseline: ${validatedBaseline ? `v${validatedBaseline}` : "none yet"}</p>
  </div>
  <div style="background:#111;border:1px solid #222;border-radius:8px;padding:14px 16px;margin:0 0 20px;">
    <p style="margin:0 0 8px;font-size:10px;color:#52525b;text-transform:uppercase;letter-spacing:2px;">Recent rigs — latest scans (${recentRigs.length})</p>
    ${rigLines.length ? rigLines.map(l => `<p style="margin:3px 0;font-size:12px;color:#d4d4d8;">${l}</p>`).join("") : `<p style="margin:0;font-size:12px;color:#71717a;">No recent rigs on record yet</p>`}
  </div>
  <a href="${driverUrl}" style="display:inline-block;background:#22c55e;color:#000;text-decoration:none;font-size:12px;font-weight:700;padding:10px 20px;border-radius:6px;letter-spacing:0.5px;">Open NVIDIA Tracker</a>
</div></body></html>`,
          text: `New NVIDIA driver: v${driver.version}${driver.branch ? ` (branch ${driver.branch})` : ""}\nLast validated baseline: ${validatedBaseline ?? "none yet"}\n\nRecent rigs:\n${rigLines.join("\n") || "—"}\n\n${driverUrl}`,
        });
        emailResult = "sent";
      } catch (e) {
        emailResult = "failed";
        errs.push(`Email: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  if (errs.length) console.error("[alerts] sendNewDriverAlert errors:", errs.join(" | "));
  return { sentAny: discordResult === "sent" || emailResult === "sent", discord: discordResult, email: emailResult, errors: errs };
}
