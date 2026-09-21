# Opti Gods by leaq

A Windows 10/11 PC optimizer web dashboard with a strict Red/Black WinUI aesthetic.

## Developer / Tester Rig (leaq)

- **CPU**: AMD Ryzen 5 3500
- **GPU**: NVIDIA GeForce GTX 1650 Super
- **RAM**: 32 GB
- **Games tested**: FiveM, Call of Duty, Fortnite

## V2.2 — AI Preset Generator Overhaul (Task #51, 2026-05-17)

Single canonical preset path: `buildSafePreset(hardware, goal, optInFlags)` in `shared/preset-builder.ts`, called by both Aether (admin chat), Opti Gods AI (user chat) and the Admin Preset Generator tab via the new `POST /api/ai/preset` endpoint.

**Hard rules enforced server-side (no model can override):**
- `EnableMSIMode`, `DisableIPv6`, `SetTimerResolution` — the V2.1 forbidden trio — are NEVER auto-included. They land in `blocked` unless their exact ID appears in `optInFlags`, and even then they're surfaced under "Advanced (opt-in)" in red, never in `core`.
- All `safety: "expert"` tweaks (DisableDefender, Win11DisableVBS/HVCI, SysHypervisorOff, DisableMemoryCompression, DisablePagefileEncryption, Lap_Intel_DisableECores) are routed to `expert` only — opt-in surfaces them but they still render in the red section, never in `core`.
- GPU-vendor cross-contamination is impossible: `Nvidia*` tweaks blocked on AMD/Intel boxes, `Amd*` on NVIDIA, `IGpu_*` on systems with `hasDiscreteGpu: true`, `Lap_*` only on laptops, `Win11*` only on Windows 11.

**Aether admin slash command:** `Generate preset for rig #42` (optional `with EnableMSIMode,DisableDefender`) — pulls the rig from `hardware_rigs`, runs `buildSafePreset`, streams a structured response with Core / Advanced opt-in / Blocked sections plus a machine-readable `[PRESET_JSON]…[/PRESET_JSON]` block. New `storage.getRigById(id)` helper.

**Opti Gods AI prompt rewrite:** the model no longer hand-rolls preset arrays. It emits `[SAVE_PRESET:AUTO]` and the dashboard resolves it via `/api/ai/preset` using detected hardware. Telemetry warns in server logs if the model ever drifts back to hand-rolled lists.

**Admin Preset Generator tab:** preview now renders the buildSafePreset output — emerald "Core" chip list, **red "Advanced — Opt-in Required" section** with toggle buttons that re-bias the next generate, and a collapsible "Blocked" details panel.

**Tests:** `scripts/test-preset-builder.ts` runs under `npx tsx` (no vitest infra change — package.json is forbidden territory) and covers vendor filtering, FORBIDDEN gating, opt-in escape paths, hardware-mismatch blocking, and `hardwareFromRig` translation. Add to CI alongside `scripts/smoke-test-ps1.ts`.

**Intentional deviations from original task spec:**
- Tests use `tsx + node:assert` rather than vitest because adding vitest requires editing `package.json` (forbidden by the fullstack-js skill in this repo). The shape is vitest-portable — `test()` blocks can be one-line-replaced with `it()` once vitest is installed.
- Did not replace `computeSmartRecs` in the in-browser dashboard UI (would break hundreds of toggle bindings and was out of scope). The dashboard's manual tweak surface still uses `computeSmartRecs` for in-UI recommendations; only the AI-generated preset path is centralised through `buildSafePreset`.

## V2.2 (2026-05-17) — Reapplicable Driver Tweaks (Task #50)

Adds 19 driver-level tweaks that survive game restarts but get wiped on driver reinstall — plus a dedicated "Reapply driver tweaks" button at the top of NVIDIA + AMD tabs that downloads a focused PS1 hitting ONLY the selected driver-class keys (no full preset rerun needed after each Adrenalin / GeForce update).

**NVIDIA (12)**: Texture Filter HighPerf, Low Latency Ultra, Threaded Opt ON, Power Mgmt Max, Frame Cap (Off / 30 / 60 / 120 / 144 / 240 / Custom-via-Read-Host 10–1000), EnableMSIMode_Safe.
**AMD (8)**: Texture Filter Perf, Surface Format Opt, Tess 16x cap, Radeon Boost Off, FRTC 60 / 144 / 240, EnableMSIMode_Safe.

New endpoint `/api/script/driver-reapply` is Pro-gated with strict per-tab allowlists, regex-validated IDs, and bounded list length. CI now runs `scripts/smoke-test-ps1.ts` + PowerShell AST parsing on every push to catch syntax errors in `TWEAK_COMMANDS` before the expensive Tauri build.

**Intentional deviations from original task spec:**
- `EnableMSIMode_Safe` ships as a pure-PowerShell registry helper (multi-device MSI enable + Affinity Policy wipe to prevent the V1 BSOD) rather than vendoring the third-party msiutilv3 GUI binary. Functionally equivalent, no supply-chain risk, **no interactive device picker** — selection is automatic (GPU only on non-hybrid hosts + filtered physical NICs + NVMe controllers).
- `AmdAntiLag` is **NOT** part of the V2.2 driver-reapply allowlist — it already lives in the AMD registry tweaks section and the RX 9000 V2TweakSection's `AntiLag2NextGen`. Support docs should not claim it's in the reapply set.
- Legacy `EnableMSIMode` is **kept alongside** `EnableMSIMode_Safe` for saved-preset back-compat. Users should prefer `_Safe` on new installs.

Versioned `2.2.0` in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`.

## V2.1 (2026-05-17) — Stability Surgery

Fixed the V1 publish-blocking crashes:
- **BSOD (`SYSTEM_THREAD_EXCEPTION_NOT_HANDLED`)** — `EnableMSIMode` no longer writes `DevicePolicy=4` / `DevicePriority=3` to GPU Affinity Policy (invalid IRQ config without an `AssignmentSetOverride` CPU mask); also skips on multi-GPU/hybrid hosts.
- **FiveM `productId != ProductID::INVALID`** — `DisableIPv6` now uses the supported registry method (`DisabledComponents=0x20`, prefer-IPv4) instead of `Disable-NetAdapterBinding`, so Rockstar entitlement / Discord voice / Xbox party chat keep working.
- **Boot hang on Ryzen APUs / Intel chipsets** — `SetTimerResolution` + `IGpu_SetTimerResolution` switched from `bcdedit /set useplatformtick yes` to the safer `bcdedit /set disabledynamictick yes`.
- **TCP stack break on modern Win10/11** — removed deprecated `netsh int tcp set global netdma=enabled` from `OptimizeTCP`.
- **CORE auto-preset hardened** — `EnableMSIMode`, `DisableIPv6`, `SetTimerResolution` removed from the default auto-applied set in `client/src/lib/smart-recommendations.ts`. They're still available but opt-in only.
- **Recovery for existing victims** — the Fixes tab "CPU Scheduling & Timer" restore block now proactively wipes `DevicePolicy` / `DevicePriority` / `AssignmentSetOverride` on every display device.

Versioned `2.1.0` in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`.

## Architecture

- **Frontend**: React + Vite + TypeScript, Tailwind CSS + shadcn/ui, wouter routing, TanStack Query v5
- **Backend**: Express.js + TypeScript (tsx runner), in-memory session map, no ORM for routes
- **Database**: PostgreSQL (Drizzle ORM, schema at `shared/schema.ts`)
- **Port**: 5000 (Express serves both API and Vite frontend)

## Key Features

- **442 optimization toggles** across 15+ tabs (Registry, FiveM, NVIDIA, AMD, AMD Integrated GPU, Intel iGPU, Laptop, Network, Startup, Debloat, Memory, Fortnite, Discord While Gaming, Game Detection, Process Lasso)
- **PowerShell script generation** — downloads a personalized `.ps1` file based on selected tweaks
- **Pro paywall** (`ProGate` component) — secured server-side session token (64-char hex), unlocked via access code redeem
- **Payment options**: CashApp `$my1ik`, PayPal `paypal.me/accountslg`, Stripe card payments ($15 flat)
- **Free friend unlock** via URL param `?unlock=<VITE_FREE_KEY>`
- **Smart Game Detection** — PS1 scanner checks 14 game paths, opens `/game-detection?games=<ids>` in browser
- **Preset save/load** — stored in PostgreSQL via `/api/presets`
- **Admin panel** — 11 tabs: Codes, Friends, Activity, Email, Sessions, Updates, Analytics, Security, Preset Gen, Aether AI, Tickets
- **Opti Gods AI** — Groq-powered AI chat (SSE streaming) with smart preset generation, image analysis, session persistence
- **Aether Admin AI** — admin-only AI chat with live stats injection (revenue, visits, downloads, security events, user tickets)
- **User Report System** — users submit issue reports via AI chat page, admin reviews in Tickets tab with status tracking (open/acknowledged/resolved)
- **Mobile Showcase Mode** — mobile visitors see a marketing showcase with feature highlights, results, and CTA buttons instead of optimizer UI
- **Smart AI Popup** — first-visit desktop popup pointing users to the AI assistant
- **Floating AI Button** — persistent bottom-right button on optimizer pages linking to AI chat
- **Aether Security Center** — threat monitoring, IP bans, rate-limit blocks, geo-intelligence
- **Critical Event Alerts** — Discord webhook + email notifications for critical security events; configurable via admin panel Alert Config tab; per-event deduplication via `alertSentAt` column
- **Integrated GPU (Vega 8) tab** — AMD Ryzen 2200G/Vega 8 specific tweaks including TDR timeout, HDCP disable, audio co-processor power-gating

## Payment System

### CashApp / PayPal (Primary — manual)
Set these env vars in Replit Secrets:
- `VITE_CASHAPP_TAG` — your $cashtag (e.g. `$leaq`)
- `VITE_PAYPAL_LINK` — your PayPal.me link

### Stripe (Optional — automated card payments)
Set these env vars to activate:
- `STRIPE_SECRET_KEY` — from Stripe Dashboard → Developers → API Keys
- `STRIPE_PRICE_ID` — run `npx tsx scripts/seed-stripe-product.ts` to create it
- `VITE_STRIPE_ENABLED=true` — shows "Pay with Card" button in the UI

When `STRIPE_SECRET_KEY` is not set, Stripe endpoints gracefully return 503. The button is hidden when `VITE_STRIPE_ENABLED` is not `true`.

### Access Codes (Manual comps / giveaways)
- `PRO_CODES` — comma-separated codes (e.g. `GODMODE-001,GODMODE-002`)

### Free Friend Unlock
- `VITE_FREE_KEY` — the secret URL param value (e.g. `friends2024`)
- Share: `https://yourapp.replit.app/?unlock=friends2024`

## Critical Event Alerts

Optional env vars for alert delivery (can also be set via Admin Panel → Security → Alert Config):
- `DISCORD_WEBHOOK_URL` — Discord channel webhook URL for critical security alerts
- `ALERT_EMAIL` — recipient email for critical security event notifications (requires EMAIL_USER + EMAIL_PASS)
- `SITE_URL` — base URL used in deep links within alerts (e.g. `https://optigods.replit.app`)

New files: `server/alerts.ts` — Discord + email notification helpers.
New DB: `admin_settings` table (single-row config), `alertSentAt` column on `security_events`.

## Important Files

| File | Purpose |
|------|---------|
| `client/src/components/pro-gate.tsx` | Paywall modal (CashApp/PayPal/Stripe/code) |
| `client/src/lib/pro-status.ts` | `useProStatus()` reactive hook + `setProStatus()` (localStorage + event bus) |
| `client/src/pages/payment-success.tsx` | Stripe return page — verifies + sets Pro |
| `client/src/pages/payment-cancel.tsx` | Redirects to dashboard |
| `client/src/pages/game-detection.tsx` | Game card grid filtered by URL params |
| `client/src/App.tsx` | Router + FriendUnlockHandler |
| `server/routes.ts` | All API endpoints |
| `scripts/seed-stripe-product.ts` | One-time Stripe product creation script |

## Running

The `Start application` workflow runs `npm run dev` which starts Express + Vite on port 5000.

## Fast Refresh Notes

- `getProStatus` must live in `@/lib/pro-status.ts` (not re-exported from the ProGate component file) to avoid Vite Fast Refresh incompatibility warnings.
- All custom hooks must have `use` prefix in their own file.

## Stripe API Version

Using `2024-06-20`. If upgrading Stripe, update all `apiVersion` references in `server/routes.ts`.
