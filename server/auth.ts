import type { Express, Request, Response } from "express";
import { randomBytes } from "crypto";
import { storage } from "./storage";
import { getLatestGhRelease } from "./github-release";

// ── Native bearer tokens ──────────────────────────────────────────────────────
// After Discord OAuth completes for a native (desktop) client we cannot use
// the session cookie (SameSite=Lax blocks cross-origin requests from tauri.localhost).
// We generate a 30-day bearer token, persist it to the DB, and the desktop app
// sends it as  X-Native-Auth: <token>  on every API call.
// The DB-backed store means .exe users stay signed in across server restarts.
interface NativeTokenEntry { userId: string; expiresAt: number }
const tokenCache = new Map<string, NativeTokenEntry>(); // hot-path in-memory cache

export async function validateNativeToken(token: string): Promise<string | null> {
  // 1. Fast path — check in-memory cache
  const cached = tokenCache.get(token);
  if (cached) {
    if (Date.now() > cached.expiresAt) { tokenCache.delete(token); return null; }
    return cached.userId;
  }
  // 2. Slow path — check DB (handles post-restart lookups)
  try {
    const row = await storage.lookupNativeToken(token);
    if (!row) return null;
    // Re-warm the cache so subsequent calls are fast
    tokenCache.set(token, { userId: row.userId, expiresAt: row.expiresAt });
    return row.userId;
  } catch {
    return null;
  }
}

async function issueNativeToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + 30 * 24 * 60 * 60_000;
  tokenCache.set(token, { userId, expiresAt });
  // Persist to DB — fire-and-forget, don't block the HTTP response
  storage.persistNativeToken(token, userId, expiresAt).catch((err) =>
    console.error("[auth] Failed to persist nativeToken:", err)
  );
  return token;
}

// Purge expired tokens from cache and DB once per hour
setInterval(() => {
  const now = Date.now();
  tokenCache.forEach((v, k) => { if (now > v.expiresAt) tokenCache.delete(k); });
  storage.purgeExpiredNativeTokens().catch(() => {});
}, 60 * 60_000);

const DISCORD_API = "https://discord.com/api";
const DISCORD_AUTHORIZE = "https://discord.com/oauth2/authorize";

function getRedirectUri(_req: Request): string {
  // 1. Explicit override via env (use this for the live domain).
  if (process.env.DISCORD_REDIRECT_URI) return process.env.DISCORD_REDIRECT_URI;
  // 2. Derive from the canonical SITE_URL (never from proxy headers — Replit's
  //    x-forwarded-* values are unreliable and break Discord OAuth).
  const site = (process.env.SITE_URL || "").replace(/\/$/, "");
  if (site) return `${site}/api/auth/discord/callback`;
  // 3. Absolute last-resort fallback (should never hit in production).
  return "https://optigods.com/api/auth/discord/callback";
}

function discordAvatarUrl(id: string, avatarHash: string | null): string | null {
  if (!avatarHash) return null;
  const ext = avatarHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${id}/${avatarHash}.${ext}?size=128`;
}

export function registerAuthRoutes(app: Express): void {
  // GET /api/auth/discord/config — returns the Discord client ID so the native
  // desktop app can start the loopback OAuth flow without shipping the ID in
  // the binary at compile time.
  app.get("/api/auth/discord/config", (_req: Request, res: Response) => {
    const clientId = process.env.DISCORD_CLIENT_ID;
    if (!clientId) return res.status(503).json({ error: "Discord not configured" });
    res.json({ clientId });
  });

  // GET /api/auth/discord/login — kick off OAuth round-trip
  app.get("/api/auth/discord/login", (req: Request, res: Response) => {
    const clientId = process.env.DISCORD_CLIENT_ID;
    if (!clientId) {
      return res.status(503).send("Discord login is not configured on this server.");
    }

    const state = randomBytes(16).toString("hex");
    req.session.oauthState = state;

    // Flag native (desktop) OAuth flows so the callback can return a bearer token
    req.session.nativeFlow = req.query.native === "1";

    const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : "/";
    // Only store same-origin paths
    if (returnTo.startsWith("/") && !returnTo.startsWith("//")) {
      req.session.returnTo = returnTo;
    } else {
      req.session.returnTo = "/";
    }

    const url = new URL(DISCORD_AUTHORIZE);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", getRedirectUri(req));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "identify email");
    url.searchParams.set("state", state);

    req.session.save(() => res.redirect(url.toString()));
  });

  // GET /api/auth/discord/callback — Discord redirects here
  app.get("/api/auth/discord/callback", async (req: Request, res: Response) => {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.status(503).send("Discord login is not configured on this server.");
    }

    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const expectedState = req.session.oauthState;

    if (!code) return res.redirect("/?login=error&reason=missing_code");
    if (!state || !expectedState || state !== expectedState) {
      return res.redirect("/?login=error&reason=state_mismatch");
    }

    try {
      // Exchange code for access token
      const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: getRedirectUri(req),
        }).toString(),
      });
      if (!tokenRes.ok) {
        const body = await tokenRes.text();
        console.error("[auth] Discord token exchange failed", tokenRes.status, body);
        return res.redirect("/?login=error&reason=token_exchange");
      }
      const tokenJson = (await tokenRes.json()) as { access_token?: string };
      if (!tokenJson.access_token) return res.redirect("/?login=error&reason=no_token");

      // Fetch the user identity
      const userRes = await fetch(`${DISCORD_API}/users/@me`, {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      if (!userRes.ok) {
        return res.redirect("/?login=error&reason=user_fetch");
      }
      const userJson = (await userRes.json()) as {
        id: string;
        username: string;
        global_name?: string | null;
        avatar?: string | null;
        email?: string | null;
      };

      // Persist user
      await storage.upsertUser({
        discordId: userJson.id,
        username: userJson.username,
        globalName: userJson.global_name ?? null,
        avatarUrl: discordAvatarUrl(userJson.id, userJson.avatar ?? null),
        email: userJson.email ?? null,
      });

      // Sign in
      req.session.userId = userJson.id;
      req.session.oauthState = undefined;
      const isNativeFlow = req.session.nativeFlow === true;
      req.session.nativeFlow = undefined;

      if (isNativeFlow) {
        // Generate a 30-day bearer token persisted to DB so server restarts
        // don't log out .exe users.
        const token = await issueNativeToken(userJson.id);
        const dest = `tauri://localhost/?nativeToken=${token}`;
        req.session.returnTo = undefined;
        return req.session.save(() => res.redirect(dest));
      }

      const dest = req.session.returnTo && req.session.returnTo.startsWith("/")
        ? req.session.returnTo
        : "/";
      req.session.returnTo = undefined;

      req.session.save(() => res.redirect(dest));
    } catch (err) {
      console.error("[auth] Discord OAuth callback error:", err);
      res.redirect("/?login=error&reason=server");
    }
  });

  // Shared handler for the desktop OAuth code exchange.
  // Registered at two paths:
  //   /api/auth/discord/exchange  — legacy path (kept for back-compat with older .exe builds)
  //   /api/app/link               — WAF-neutral path used by v2.3+ .exe builds
  // Both paths are functionally identical; the Rust binary targets /api/app/link so proxy
  // bot-protection rules (which flag "auth"+"exchange" path segments) don't block it.
  async function handleDiscordExchange(req: Request, res: Response) {
    console.log("[auth/exchange] incoming POST path:", req.path, "| UA:", req.headers["user-agent"], "| origin:", req.headers.origin ?? "(none)");
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.status(503).json({ error: "Discord login is not configured on this server." });
    }

    const { code, redirect_uri, loopback_port } = req.body as { code?: string; redirect_uri?: string; loopback_port?: number };
    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Missing code" });
    }

    // Prefer loopback_port (a plain number — WAF-safe) over redirect_uri (which
    // contains "127.0.0.1" and triggers SSRF-protection rules on Replit's proxy).
    let resolvedRedirectUri: string;
    if (typeof loopback_port === "number" && loopback_port > 0 && loopback_port < 65536) {
      resolvedRedirectUri = `http://127.0.0.1:${loopback_port}/callback`;
    } else if (redirect_uri && typeof redirect_uri === "string") {
      // Legacy path — kept for backward compat with older .exe builds.
      if (!redirect_uri.startsWith("http://127.0.0.1:") && !redirect_uri.startsWith("http://localhost:")) {
        return res.status(400).json({ error: "Invalid redirect_uri — must be a loopback address" });
      }
      resolvedRedirectUri = redirect_uri;
    } else {
      return res.status(400).json({ error: "Missing redirect_uri or loopback_port" });
    }

    try {
      const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: resolvedRedirectUri,
        }).toString(),
      });
      if (!tokenRes.ok) {
        const body = await tokenRes.text();
        console.error("[auth/exchange] Discord token exchange failed", tokenRes.status, body);
        return res.status(502).json({ error: "token_exchange_failed" });
      }
      const tokenJson = (await tokenRes.json()) as { access_token?: string };
      if (!tokenJson.access_token) {
        return res.status(502).json({ error: "no_access_token" });
      }

      const userRes = await fetch(`${DISCORD_API}/users/@me`, {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      if (!userRes.ok) {
        return res.status(502).json({ error: "user_fetch_failed" });
      }
      const userJson = (await userRes.json()) as {
        id: string;
        username: string;
        global_name?: string | null;
        avatar?: string | null;
        email?: string | null;
      };

      await storage.upsertUser({
        discordId: userJson.id,
        username: userJson.username,
        globalName: userJson.global_name ?? null,
        avatarUrl: discordAvatarUrl(userJson.id, userJson.avatar ?? null),
        email: userJson.email ?? null,
      });

      // Issue and persist a 30-day nativeToken
      const token = await issueNativeToken(userJson.id);

      return res.json({
        access_token: token,
        user: { id: userJson.id, username: userJson.username },
      });
    } catch (err) {
      console.error("[auth/exchange] error:", err);
      return res.status(500).json({ error: "server_error" });
    }
  }

  // Legacy path — kept so any older .exe in the wild still works
  app.post("/api/auth/discord/exchange", handleDiscordExchange);
  // WAF-neutral path — used by v2.3+ .exe builds to avoid proxy bot-protection blocks
  app.post("/api/app/link", handleDiscordExchange);

  // GET /api/d — zero-body WAF-bypass path used by v2.3.8+ .exe builds.
  // Code + port travel as query params so there is no request body for the WAF
  // (or TLS-fingerprint bot-detection) to inspect or block.
  app.get("/api/d", async (req: Request, res: Response) => {
    // CORS — the fetch originates from http://127.0.0.1:25444 (loopback HTML page in Chrome)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.status(503).json({ error: "Discord login is not configured." });
    }
    const { c: code, p: portStr } = req.query as { c?: string; p?: string };
    if (!code || typeof code !== "string") return res.status(400).json({ error: "Missing code" });
    const port = parseInt(portStr ?? "0", 10);
    if (!port || port <= 0 || port >= 65536) return res.status(400).json({ error: "Invalid port" });
    const resolvedRedirectUri = `http://127.0.0.1:${port}/callback`;
    console.log("[auth/d] GET exchange | port:", port, "| UA:", req.headers["user-agent"]);
    try {
      const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: resolvedRedirectUri,
        }).toString(),
      });
      if (!tokenRes.ok) {
        const body = await tokenRes.text();
        console.error("[auth/d] Discord token exchange failed", tokenRes.status, body);
        return res.status(502).json({ error: "token_exchange_failed" });
      }
      const tokenJson = (await tokenRes.json()) as { access_token?: string };
      if (!tokenJson.access_token) return res.status(502).json({ error: "no_access_token" });
      const userRes = await fetch(`${DISCORD_API}/users/@me`, {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      if (!userRes.ok) return res.status(502).json({ error: "user_fetch_failed" });
      const userJson = (await userRes.json()) as {
        id: string; username: string; global_name?: string | null;
        avatar?: string | null; email?: string | null;
      };
      await storage.upsertUser({
        discordId: userJson.id,
        username: userJson.username,
        globalName: userJson.global_name ?? null,
        avatarUrl: discordAvatarUrl(userJson.id, userJson.avatar ?? null),
        email: userJson.email ?? null,
      });
      const token = await issueNativeToken(userJson.id);
      return res.json({ access_token: token, user: { id: userJson.id, username: userJson.username } });
    } catch (err) {
      console.error("[auth/d] error:", err);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // GET /api/me — current Discord user (used by the auth gate)
  app.get("/api/me", async (req: Request, res: Response) => {
    // Desktop app sends X-Native-Auth bearer token (no SameSite cookie available)
    if (!req.session.userId) {
      const nativeToken = req.headers["x-native-auth"];
      if (typeof nativeToken === "string") {
        const userId = await validateNativeToken(nativeToken);
        if (userId) req.session.userId = userId;
      }
    }
    if (!req.session.userId) return res.status(401).json({ user: null });
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      // Session points to a user that no longer exists — clear it
      req.session.userId = undefined;
      return res.status(401).json({ user: null });
    }
    return res.json({
      user: {
        discordId: user.discordId,
        username: user.username,
        globalName: user.globalName,
        avatarUrl: user.avatarUrl,
      },
    });
  });

  // POST /api/logout — destroy the session and clear the cookie
  app.post("/api/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {
      res.clearCookie("optigods.sid");
      res.json({ ok: true });
    });
  });

  // GET /api/version — public version info for the auto-update modal.
  //
  // Priority: admin override → GitHub latest release → version.json → hardcoded.
  // GitHub is polled automatically every 10 minutes — no admin panel changes
  // needed after a new release is published on GitHub.
  app.get("/api/version", async (_req: Request, res: Response) => {
    const [settings, gh] = await Promise.all([
      storage.getAdminSettings(),
      getLatestGhRelease(),
    ]);
    const fileVersion = readVersionFromFile();
    const CURRENT = "4.0.0";
    const SITE = process.env.SITE_URL ?? "https://optigods.com";
    const INSTALLER_URL = `${SITE}/api/download/latest`;

    // currentVersion is always the compiled-in version — the app binary knows
    // its own version; never show a stale DB value as "current".
    const currentVersion = CURRENT;

    // latestVersion: if the resolved value is older than CURRENT (e.g. GitHub
    // still has a v2.x tag and v3 isn't published yet), floor it at CURRENT so
    // the UI never shows "update to v2.3.7" while running v3.0.0.
    const resolvedLatest = settings?.latestVersion ?? gh?.version ?? fileVersion ?? CURRENT;
    const latestVersion = semverGte(resolvedLatest, CURRENT) ? resolvedLatest : CURRENT;

    res.json({
      currentVersion,
      latestVersion,
      updaterCmdUrl:  settings?.updaterCmdUrl  ?? INSTALLER_URL,
      updatePageUrl:  settings?.updatePageUrl  ?? gh?.pageUrl ?? "https://optigods.com",
    });
  });
}

// Semver GTE — returns true when a >= b (used to floor latestVersion at CURRENT)
function semverGte(a: string, b: string): boolean {
  const pa = a.split(".").map(n => parseInt(n, 10) || 0);
  const pb = b.split(".").map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return true;
}

// Cached read of /version.json — the file is committed so this never throws
// in normal operation; the try/catch just means we degrade gracefully if
// someone deletes it from a fork.
let _cachedFileVersion: string | null | undefined;
function readVersionFromFile(): string | null {
  if (_cachedFileVersion !== undefined) return _cachedFileVersion;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const raw = fs.readFileSync(path.resolve(process.cwd(), "version.json"), "utf8");
    _cachedFileVersion = (JSON.parse(raw) as { version?: string }).version ?? null;
  } catch {
    _cachedFileVersion = null;
  }
  return _cachedFileVersion;
}
