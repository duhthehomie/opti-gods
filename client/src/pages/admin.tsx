import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Copy, Trash2, Plus, Key, Link, Check, AlertCircle, Shield, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProAccessCode, ProFriendToken } from "@shared/schema";

const ADMIN_KEY_STORAGE = "optigods_admin_key";

function getAppOrigin(): string {
  return window.location.origin;
}

function fmt(dateStr: string | Date | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString();
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-red-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function Admin() {
  const [key, setKey] = useState(() => localStorage.getItem(ADMIN_KEY_STORAGE) || "");
  const [input, setInput] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [noteCode, setNoteCode] = useState("");
  const [noteFriend, setNoteFriend] = useState("");

  const headers = { "Content-Type": "application/json", "x-admin-key": key };

  const codesQuery = useQuery<ProAccessCode[]>({
    queryKey: ["/api/admin/codes", key],
    queryFn: () => fetch("/api/admin/codes", { headers }).then(r => {
      if (!r.ok) throw new Error("Unauthorized");
      return r.json();
    }),
    enabled: authed,
    retry: false,
  });

  const friendsQuery = useQuery<ProFriendToken[]>({
    queryKey: ["/api/admin/friends", key],
    queryFn: () => fetch("/api/admin/friends", { headers }).then(r => {
      if (!r.ok) throw new Error("Unauthorized");
      return r.json();
    }),
    enabled: authed,
    retry: false,
  });

  const genCode = useMutation({
    mutationFn: () => fetch("/api/admin/codes", {
      method: "POST",
      headers,
      body: JSON.stringify({ note: noteCode.trim() || null }),
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/codes", key] });
      setNoteCode("");
    },
  });

  const delCode = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/codes/${id}`, { method: "DELETE", headers }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/codes", key] }),
  });

  const genFriend = useMutation({
    mutationFn: () => fetch("/api/admin/friends", {
      method: "POST",
      headers,
      body: JSON.stringify({ note: noteFriend.trim() || null }),
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/friends", key] });
      setNoteFriend("");
    },
  });

  const delFriend = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/friends/${id}`, { method: "DELETE", headers }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/friends", key] }),
  });

  const handleLogin = async () => {
    setAuthError("");
    const res = await fetch("/api/admin/codes", { headers: { "x-admin-key": input } });
    if (res.ok) {
      localStorage.setItem(ADMIN_KEY_STORAGE, input);
      setKey(input);
      setAuthed(true);
    } else {
      setAuthError("Wrong key. Set ADMIN_KEY in your environment secrets.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_KEY_STORAGE);
    setKey("");
    setInput("");
    setAuthed(false);
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="w-6 h-6 text-red-500" />
            <span className="font-bold text-xl text-white font-display">Admin Panel</span>
            <span className="text-zinc-600 text-sm">— Opti Gods</span>
          </div>
          <p className="text-xs text-zinc-500">Enter your ADMIN_KEY (set in environment secrets)</p>
          <input
            data-testid="input-admin-key"
            type="password"
            placeholder="Admin key..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-500/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none font-mono transition-colors"
          />
          {authError && (
            <div className="flex items-center gap-2 text-xs text-red-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {authError}
            </div>
          )}
          <Button
            data-testid="button-admin-login"
            onClick={handleLogin}
            className="w-full bg-red-600 hover:bg-red-700 text-white border border-red-500/30"
          >
            Enter Admin Panel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-red-500" />
          <span className="font-bold text-lg text-white font-display">Opti Gods — Admin</span>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 transition-colors">
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </div>

      {/* How to use banner */}
      <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 space-y-1 leading-relaxed">
        <p><span className="text-white font-medium">Access codes</span> — Generate below, then DM the code to your customer after they pay. Each code works <span className="text-red-400">once</span> and cannot be reused or shared.</p>
        <p><span className="text-white font-medium">Friend links</span> — Generate one per person, copy the link, send it. When they visit it, they get Pro free. Each link also works <span className="text-red-400">once only</span> — it can't be forwarded.</p>
      </div>

      {/* Access Codes */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-red-500" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-300">Access Codes</h2>
          <span className="ml-auto text-xs text-zinc-600">{codesQuery.data?.length ?? 0} total</span>
        </div>

        <div className="flex gap-2">
          <input
            data-testid="input-code-note"
            type="text"
            placeholder="Label (e.g. John Doe, CashApp payment)"
            value={noteCode}
            onChange={e => setNoteCode(e.target.value)}
            className="flex-1 bg-zinc-900 border border-zinc-700 focus:border-red-500/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors"
          />
          <Button
            data-testid="button-gen-code"
            onClick={() => genCode.mutate()}
            disabled={genCode.isPending}
            className="bg-red-600 hover:bg-red-700 text-white border border-red-500/30 shrink-0 gap-1.5"
          >
            <Plus className="w-4 h-4" /> Generate Code
          </Button>
        </div>

        <div className="rounded-xl border border-white/5 overflow-hidden">
          {codesQuery.isLoading && (
            <div className="p-6 text-center text-xs text-zinc-600">Loading...</div>
          )}
          {codesQuery.data?.length === 0 && (
            <div className="p-6 text-center text-xs text-zinc-600">No codes yet. Generate one above.</div>
          )}
          {codesQuery.data?.map((c) => (
            <div
              key={c.id}
              data-testid={`row-code-${c.id}`}
              className={cn(
                "flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0",
                c.usedAt ? "opacity-50" : ""
              )}
            >
              <span className="font-mono text-sm font-bold text-white tracking-wider min-w-[140px]">{c.code}</span>
              <CopyButton text={c.code} />
              <div className="flex-1 min-w-0">
                {c.note && <p className="text-xs text-zinc-400 truncate">{c.note}</p>}
                <p className="text-[10px] text-zinc-600">Created {fmt(c.createdAt)}</p>
              </div>
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded border shrink-0",
                c.usedAt
                  ? "text-zinc-600 bg-zinc-800/50 border-zinc-700"
                  : "text-red-400 bg-red-500/10 border-red-500/20"
              )}>
                {c.usedAt ? `USED ${fmt(c.usedAt)}` : "AVAILABLE"}
              </span>
              <button
                data-testid={`button-del-code-${c.id}`}
                onClick={() => delCode.mutate(c.id)}
                className="p-1.5 rounded hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Friend Links */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Link className="w-4 h-4 text-red-500" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-300">Friend Links (Free Access)</h2>
          <span className="ml-auto text-xs text-zinc-600">{friendsQuery.data?.length ?? 0} total</span>
        </div>

        <div className="flex gap-2">
          <input
            data-testid="input-friend-note"
            type="text"
            placeholder="Label (e.g. XxSniperx, Discord @user)"
            value={noteFriend}
            onChange={e => setNoteFriend(e.target.value)}
            className="flex-1 bg-zinc-900 border border-zinc-700 focus:border-red-500/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors"
          />
          <Button
            data-testid="button-gen-friend"
            onClick={() => genFriend.mutate()}
            disabled={genFriend.isPending}
            className="bg-red-600 hover:bg-red-700 text-white border border-red-500/30 shrink-0 gap-1.5"
          >
            <Plus className="w-4 h-4" /> Generate Link
          </Button>
        </div>

        <div className="rounded-xl border border-white/5 overflow-hidden">
          {friendsQuery.isLoading && (
            <div className="p-6 text-center text-xs text-zinc-600">Loading...</div>
          )}
          {friendsQuery.data?.length === 0 && (
            <div className="p-6 text-center text-xs text-zinc-600">No friend links yet. Generate one above.</div>
          )}
          {friendsQuery.data?.map((t) => {
            const link = `${getAppOrigin()}/?friend=${t.token}`;
            return (
              <div
                key={t.id}
                data-testid={`row-friend-${t.id}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0",
                  t.usedAt ? "opacity-50" : ""
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs text-zinc-300 truncate">{link}</span>
                    <CopyButton text={link} />
                  </div>
                  {t.note && <p className="text-[11px] text-zinc-500 truncate mt-0.5">{t.note}</p>}
                  <p className="text-[10px] text-zinc-600">Created {fmt(t.createdAt)}</p>
                </div>
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded border shrink-0",
                  t.usedAt
                    ? "text-zinc-600 bg-zinc-800/50 border-zinc-700"
                    : "text-red-400 bg-red-500/10 border-red-500/20"
                )}>
                  {t.usedAt ? `USED ${fmt(t.usedAt)}` : "AVAILABLE"}
                </span>
                <button
                  data-testid={`button-del-friend-${t.id}`}
                  onClick={() => delFriend.mutate(t.id)}
                  className="p-1.5 rounded hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
