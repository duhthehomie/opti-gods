import nodemailer from "nodemailer";
import type { SecurityEvent } from "@shared/schema";

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
