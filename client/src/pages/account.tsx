import { LogOut, Shield, User, Cpu, Crown, ArrowLeft } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { useAuth, useLogout } from "@/hooks/use-auth";
import { useProStatus } from "@/lib/pro-status";
import { useVersionInfo } from "@/hooks/use-auth";
import { isNative } from "@/lib/tauri-bridge";
import { Button } from "@/components/ui/button";

export default function AccountPage() {
  const { user, isAuthenticated } = useAuth();
  const isPro = useProStatus();
  const logout = useLogout();
  const { data: versionData } = useVersionInfo();

  const display = user?.globalName || user?.username;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 max-w-lg mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <button
          data-testid="button-account-back"
          onClick={() => window.history.back()}
          className="w-9 h-9 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center hover:bg-zinc-800 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <div>
          <h1 className="text-2xl font-display font-black text-white">Account</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Manage your session and profile</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Discord profile card */}
        {isAuthenticated && user ? (
          <div className="rounded-xl border border-white/8 bg-zinc-900/50 p-5">
            <div className="flex items-center gap-4">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={display}
                  className="w-14 h-14 rounded-full object-cover border-2 border-[#5865F2]/40"
                  data-testid="img-account-avatar"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#5865F2]/20 border-2 border-[#5865F2]/30 flex items-center justify-center">
                  <SiDiscord className="w-7 h-7 text-[#5865F2]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p data-testid="text-account-displayname" className="text-lg font-bold text-white truncate">
                  {display}
                </p>
                <p className="text-sm text-zinc-500 truncate">@{user.username}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <SiDiscord className="w-3 h-3 text-[#5865F2]" />
                  <span className="text-[10px] text-[#7289DA] font-semibold uppercase tracking-wider">Discord linked</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-white/8 bg-zinc-900/50 p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center">
              <User className="w-5 h-5 text-zinc-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Guest / Code session</p>
              <p className="text-xs text-zinc-500">Not linked to a Discord account</p>
            </div>
          </div>
        )}

        {/* Pro status */}
        <div className="rounded-xl border border-white/8 bg-zinc-900/50 p-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isPro ? "bg-amber-500/15 border border-amber-500/25" : "bg-zinc-800 border border-white/10"}`}>
              <Crown className={`w-5 h-5 ${isPro ? "text-amber-400" : "text-zinc-600"}`} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                {isPro ? "Opti Gods Pro" : "Free tier"}
              </p>
              <p className="text-xs text-zinc-500">
                {isPro ? "All features unlocked" : "Upgrade to unlock Pro features"}
              </p>
            </div>
            {isPro && (
              <span className="ml-auto px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25 uppercase tracking-wider">
                ACTIVE
              </span>
            )}
          </div>
        </div>

        {/* App version */}
        {(isNative() || versionData) && (
          <div className="rounded-xl border border-white/8 bg-zinc-900/50 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center">
                <Cpu className="w-5 h-5 text-zinc-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">App version</p>
                <p data-testid="text-account-version" className="text-xs text-zinc-500 font-mono">
                  {versionData?.currentVersion ? `v${versionData.currentVersion}` : "v2.2"}
                  {versionData?.latestVersion && versionData.latestVersion !== versionData.currentVersion && (
                    <span className="ml-2 text-amber-400">→ v{versionData.latestVersion} available</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Security / session info */}
        <div className="rounded-xl border border-white/8 bg-zinc-900/50 p-5">
          <div className="flex items-center gap-3 mb-3">
            <Shield className="w-4 h-4 text-zinc-500 shrink-0" />
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Session</span>
          </div>
          <p className="text-xs text-zinc-600 leading-relaxed">
            {isNative()
              ? "You're running the desktop app. Your session is stored securely in the Windows Credential Manager."
              : "Your session is managed via a secure browser cookie."}
          </p>
        </div>

        {/* Logout */}
        <div className="pt-2">
          <Button
            data-testid="button-account-logout"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            variant="outline"
            className="w-full border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/15 hover:text-red-300 hover:border-red-500/50 font-bold h-11"
          >
            <LogOut className="w-4 h-4 mr-2" />
            {logout.isPending ? "Signing out…" : "Sign out"}
          </Button>
          <p className="text-center text-[10px] text-zinc-700 mt-2">
            Clears your local session and Discord link
          </p>
        </div>
      </div>
    </div>
  );
}
