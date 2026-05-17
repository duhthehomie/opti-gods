import type { Express, Request, Response } from "express";
import { randomBytes } from "crypto";
import { storage } from "./storage";

const DISCORD_API = "https://discord.com/api";
const DISCORD_AUTHORIZE = "https://discord.com/oauth2/authorize";

function getRedirectUri(req: Request): string {
  if (process.env.DISCORD_REDIRECT_URI) return process.env.DISCORD_REDIRECT_URI;
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}/api/auth/discord/callback`;
}

function discordAvatarUrl(id: string, avatarHash: string | null): string | null {
  if (!avatarHash) return null;
  const ext = avatarHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${id}/${avatarHash}.${ext}?size=128`;
}

export function registerAuthRoutes(app: Express): void {
  // GET /api/auth/discord/login — kick off OAuth round-trip
  app.get("/api/auth/discord/login", (req: Request, res: Response) => {
    const clientId = process.env.DISCORD_CLIENT_ID;
    if (!clientId) {
      return res.status(503).send("Discord login is not configured on this server.");
    }

    const state = randomBytes(16).toString("hex");
    req.session.oauthState = state;

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

  // GET /api/me — current Discord user (used by the auth gate)
  app.get("/api/me", async (req: Request, res: Response) => {
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

  // GET /api/version — public version info for the auto-update modal
  app.get("/api/version", async (_req: Request, res: Response) => {
    const settings = await storage.getAdminSettings();
    res.json({
      currentVersion: settings?.currentVersion ?? "2.00",
      latestVersion: settings?.latestVersion ?? "2.00",
      updaterCmdUrl: settings?.updaterCmdUrl ?? null,
      updatePageUrl: settings?.updatePageUrl ?? null,
    });
  });
}
