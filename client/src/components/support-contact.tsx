import { FormEvent, useState } from "react";
import {
  Clock3, ExternalLink, Mail, MessageCircle, Send, ShieldCheck,
} from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { cn } from "@/lib/utils";
import {
  buildSupportMailto,
  DISCORD_INVITE,
  SUPPORT_EMAIL,
} from "@/lib/brand-links";

const TOPICS = [
  "Choose a topic",
  "Installer or update",
  "Account or Pro access",
  "Optimization help",
  "Bug or crash",
  "Feature request",
];

const WINDOWS_VERSIONS = [
  "Choose Windows version",
  "Windows 11",
  "Windows 10",
  "Not sure",
];

export function SupportContact({ className }: { className?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [windows, setWindows] = useState(WINDOWS_VERSIONS[0]);
  const [message, setMessage] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    window.location.href = buildSupportMailto({ name, email, topic, windows, message });
  };

  return (
    <section
      id="support"
      data-testid="support-contact-panel"
      className={cn(
        "overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#080a0e] shadow-[0_30px_90px_-50px_rgba(239,68,68,0.6)]",
        className,
      )}
    >
      <div className="grid lg:grid-cols-[0.8fr_1.2fr]">
        <div className="relative border-b border-white/10 p-6 md:p-8 lg:border-b-0 lg:border-r">
          <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-red-600/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-red-400">
              <MessageCircle className="h-3.5 w-3.5" />
              Contact &amp; support
            </div>
            <h2 className="mt-4 max-w-sm font-display text-3xl font-black leading-[1.05] text-white md:text-4xl">
              Tell us what&apos;s happening.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-400">
              Prefer email over Discord? Send the details below and your default mail app will open a ready-to-send support request.
            </p>

            <div className="mt-7 space-y-2.5">
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Opti Gods support request")}`}
                data-testid="link-support-email"
                className="group flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-3.5 transition-colors hover:border-red-500/40 hover:bg-red-500/5"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10">
                  <Mail className="h-4 w-4 text-red-400" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-white">Email support</span>
                  <span className="mt-0.5 block truncate text-[11px] text-zinc-500">{SUPPORT_EMAIL}</span>
                </span>
                <ExternalLink className="h-3.5 w-3.5 text-zinc-600 transition-colors group-hover:text-red-300" />
              </a>
              <a
                href={DISCORD_INVITE}
                target="_blank"
                rel="noreferrer"
                data-testid="link-support-discord"
                className="group flex items-center gap-3 rounded-xl border border-[#5865F2]/25 bg-[#5865F2]/5 p-3.5 transition-colors hover:border-[#5865F2]/60 hover:bg-[#5865F2]/10"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#5865F2]/30 bg-[#5865F2]/10">
                  <SiDiscord className="h-4 w-4 text-[#a5adff]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-white">Discord community</span>
                  <span className="mt-0.5 block text-[11px] text-zinc-500">Quick help, tickets, presets, and updates</span>
                </span>
                <ExternalLink className="h-3.5 w-3.5 text-zinc-600 transition-colors group-hover:text-[#a5adff]" />
              </a>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-3.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/5">
                  <Clock3 className="h-4 w-4 text-amber-300" />
                </span>
                <span>
                  <span className="block text-xs font-bold text-white">Include useful details</span>
                  <span className="mt-0.5 block text-[11px] text-zinc-500">Your PC specs, error, and what happened first</span>
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-emerald-400/15 bg-emerald-400/5 p-3 text-[11px] leading-relaxed text-zinc-400">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
              <span>No passwords or payment details are needed for support.</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-lg font-black text-white">Send a support request</p>
              <p className="mt-1 text-xs text-zinc-500">Choose the closest topic so the right details are included.</p>
            </div>
            <span className="rounded-md border border-red-500/25 bg-red-500/5 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-red-300">
              Secure request
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                className="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-xs text-white outline-none transition-colors placeholder:text-zinc-700 focus:border-red-500/50"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-xs text-white outline-none transition-colors placeholder:text-zinc-700 focus:border-red-500/50"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Topic</span>
              <select
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                className="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-xs text-zinc-300 outline-none transition-colors focus:border-red-500/50"
              >
                {TOPICS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Windows version</span>
              <select
                value={windows}
                onChange={(event) => setWindows(event.target.value)}
                className="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-xs text-zinc-300 outline-none transition-colors focus:border-red-500/50"
              >
                {WINDOWS_VERSIONS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>

          <label className="mt-4 block space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Message</span>
            <textarea
              required
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Tell us what you need help with. Add your GPU, CPU, Windows version, and any error text."
              className="min-h-32 w-full resize-y rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-xs leading-relaxed text-white outline-none transition-colors placeholder:text-zinc-700 focus:border-red-500/50"
            />
          </label>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              data-testid="button-support-submit"
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-3 text-xs font-bold text-white shadow-[0_0_22px_-8px_rgba(239,68,68,0.9)] transition-colors hover:bg-red-500"
            >
              <Send className="h-3.5 w-3.5" />
              Open email draft
            </button>
            <span className="text-[10px] text-zinc-600">Opens your email app — nothing is sent automatically.</span>
          </div>
        </form>
      </div>
    </section>
  );
}