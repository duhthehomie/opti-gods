export const DISCORD_INVITE = "https://discord.gg/nQagPU5a4Z";
export const SUPPORT_EMAIL = "duhthehomie@gmail.com";

export type SupportDraft = {
  name?: string;
  email?: string;
  topic?: string;
  windows?: string;
  message?: string;
};

export function buildSupportMailto(draft: SupportDraft = {}) {
  const subject = draft.topic
    ? `Opti Gods support — ${draft.topic}`
    : "Opti Gods support request";
  const body = [
    draft.name && `Name: ${draft.name}`,
    draft.email && `Reply email: ${draft.email}`,
    draft.windows && `Windows version: ${draft.windows}`,
    "",
    draft.message || "I need help with Opti Gods.",
  ].filter((line): line is string => Boolean(line)).join("\n");

  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}