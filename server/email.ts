import nodemailer from "nodemailer";

function getTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

export function isEmailConfigured(): boolean {
  return !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

export async function sendProCode(toEmail: string, code: string, siteUrl: string): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) throw new Error("Email not configured — set EMAIL_USER and EMAIL_PASS");

  await transporter.sendMail({
    from: `"Opti Gods by leaq" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "🔑 Your Opti Gods Pro Access Code",
    html: `
<!DOCTYPE html>
<html>
<body style="background:#0a0a0a;color:#fff;font-family:monospace;margin:0;padding:40px 20px;">
  <div style="max-width:500px;margin:0 auto;background:#111;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;">
    <div style="background:#dc2626;padding:24px 28px;">
      <h1 style="margin:0;font-size:20px;font-weight:900;letter-spacing:2px;color:#fff;">OPTI GODS <span style="opacity:0.8">by leaq</span></h1>
      <p style="margin:4px 0 0;font-size:11px;opacity:0.7;letter-spacing:1px;text-transform:uppercase;">Pro Access Code</p>
    </div>
    <div style="padding:28px;">
      <p style="color:#a1a1aa;font-size:13px;margin:0 0 20px;">Thanks for your purchase! Here is your lifetime Pro access code:</p>
      <div style="background:#000;border:2px solid #dc2626;border-radius:8px;padding:20px;text-align:center;margin:0 0 24px;">
        <p style="margin:0 0 6px;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:2px;">Your Code</p>
        <p style="margin:0;font-size:26px;font-weight:900;color:#ef4444;letter-spacing:4px;">${code}</p>
      </div>
      <p style="color:#a1a1aa;font-size:13px;margin:0 0 12px;"><strong style="color:#fff;">How to redeem:</strong></p>
      <ol style="color:#a1a1aa;font-size:13px;padding-left:20px;margin:0 0 24px;">
        <li style="margin-bottom:8px;">Open <a href="${siteUrl}" style="color:#ef4444;">${siteUrl}</a></li>
        <li style="margin-bottom:8px;">Click <strong style="color:#fff;">Unlock Pro — $25 Lifetime</strong></li>
        <li style="margin-bottom:8px;">Select <strong style="color:#fff;">I Have an Access Code</strong></li>
        <li>Enter the code above and click <strong style="color:#fff;">Activate</strong></li>
      </ol>
      <p style="color:#52525b;font-size:11px;border-top:1px solid #1f1f1f;padding-top:16px;margin:0;">
        This code grants lifetime Pro access on any device. Keep it safe — each code can only be used once.<br>
        Need help? Join our Discord: <a href="https://discord.gg/C8WrQknN9k" style="color:#5865f2;">discord.gg/C8WrQknN9k</a>
      </p>
    </div>
  </div>
</body>
</html>
    `,
  });
}
