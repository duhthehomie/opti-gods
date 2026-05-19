import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startAutoSendScheduler } from "./auto-send";
import { startNvidiaDriverPoller } from "./nvidia-poller";
import { seedAnnouncements } from "./seed";
import { storage } from "./storage";

const app = express();
const httpServer = createServer(app);

// Trust the Replit/reverse-proxy X-Forwarded-* headers for correct HTTPS origin detection
app.set("trust proxy", 1);

// ── CORS for the Tauri desktop shell ─────────────────────────────────────────
// The desktop app loads its HTML from `tauri://localhost` (Windows: `http://tauri.localhost`)
// and calls the production API at https://optigods.replit.app. WebView2 enforces
// CORS the same as Chromium, so we must explicitly echo allowed origins.
//
// We DO NOT use a wildcard — credentials require an exact-match origin. The
// allowlist covers both the Tauri scheme and any extra hosts set via
// EXTRA_ALLOWED_ORIGINS (comma-separated) for staging / preview builds.
const NATIVE_ALLOWED_ORIGINS = new Set<string>([
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
  ...(process.env.EXTRA_ALLOWED_ORIGINS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean),
]);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && NATIVE_ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Admin-Key, X-Pro-Session, X-Native-Auth",
    );
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
  }
  next();
});

// ── Session middleware (used for Discord OAuth login wall) ───────────────────
declare module "express-session" {
  interface SessionData {
    userId?: string;          // Discord user id once authenticated
    oauthState?: string;      // CSRF token for the OAuth round-trip
    returnTo?: string;        // Path to send user back to after login
    nativeFlow?: boolean;     // True when OAuth was started from the desktop app
  }
}

const MemoryStore = createMemoryStore(session);
const IS_PROD = process.env.NODE_ENV === "production";
if (IS_PROD && !process.env.SESSION_SECRET) {
  // Fail closed — never sign production sessions with a known default secret.
  // Configure SESSION_SECRET in Replit Secrets before deploying.
  // eslint-disable-next-line no-console
  console.error("[fatal] SESSION_SECRET is required in production. Refusing to start.");
  process.exit(1);
}
const SESSION_SECRET = process.env.SESSION_SECRET || "optigods-dev-secret-change-me";
app.use(session({
  name: "optigods.sid",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  store: new MemoryStore({ checkPeriod: 24 * 60 * 60 * 1000 }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
}));

// Explicitly allow indexing — overrides any noindex headers injected by the hosting platform
app.use((_req, res, next) => {
  res.setHeader("X-Robots-Tag", "index, follow");
  next();
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await seedAnnouncements();

  // On every startup / deploy: auto-sweep any orphan Pro sessions whose
  // codeRef no longer exists in pro_access_codes. This ensures no one
  // retains free Pro access across server restarts.
  const swept = await storage.deleteOrphanSessions();
  if (swept > 0) log(`[startup] Auto-swept ${swept} orphan Pro session(s) with no matching code`, "security");

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      startAutoSendScheduler();
      startNvidiaDriverPoller();
    },
  );
})();
