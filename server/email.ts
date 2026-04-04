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
    from: `"leaq | Opti Gods" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "your opti gods pro code is here",
    html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0c0c0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:40px auto;padding:20px;">

    <p style="color:#a1a1aa;font-size:14px;line-height:1.7;margin:0 0 24px;">
      hey, thanks for grabbing opti gods 🙏<br>
      here's your lifetime pro access code:
    </p>

    <div style="background:#111;border:1px solid #222;border-left:3px solid #dc2626;border-radius:8px;padding:20px 24px;margin:0 0 24px;">
      <p style="margin:0 0 4px;font-size:10px;color:#52525b;text-transform:uppercase;letter-spacing:2px;">your code</p>
      <p style="margin:0;font-size:28px;font-weight:900;color:#ef4444;letter-spacing:6px;font-family:'Courier New',monospace;">${code}</p>
    </div>

    <p style="color:#a1a1aa;font-size:14px;line-height:1.7;margin:0 0 8px;"><strong style="color:#e4e4e7;">how to use it:</strong></p>
    <p style="color:#71717a;font-size:13px;line-height:1.9;margin:0 0 24px;">
      1. go to <a href="${siteUrl}" style="color:#ef4444;text-decoration:none;">${siteUrl}</a><br>
      2. click <strong style="color:#e4e4e7;">Unlock Pro — $25 Lifetime</strong><br>
      3. click <strong style="color:#e4e4e7;">I Have an Access Code</strong><br>
      4. paste the code above and hit <strong style="color:#e4e4e7;">Activate</strong>
    </p>

    <p style="color:#71717a;font-size:13px;line-height:1.7;margin:0 0 24px;">
      need help or have questions? drop in the discord and i'll sort you out:<br>
      <a href="https://discord.gg/optigods" style="color:#5865f2;text-decoration:none;">discord.gg/optigods</a>
    </p>

    <div style="border-top:1px solid #1c1c1c;padding-top:16px;margin-top:8px;">
      <p style="color:#3f3f46;font-size:11px;margin:0;line-height:1.6;">
        — leaq<br>
        <span style="color:#27272a;">opti gods · one-time payment · lifetime access · each code is single-use, keep it safe</span>
      </p>
    </div>

  </div>
</body>
</html>
    `,
    text: `
hey, thanks for grabbing opti gods!

your lifetime pro code: ${code}

how to use it:
1. go to ${siteUrl}
2. click "Unlock Pro — $25 Lifetime"
3. click "I Have an Access Code"
4. paste the code and hit Activate

need help? join the discord: discord.gg/optigods

— leaq
    `.trim(),
  });
}
