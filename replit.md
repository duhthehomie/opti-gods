# Opti Gods by leaq

A Windows 10/11 PC optimizer web dashboard with a strict Red/Black WinUI aesthetic.

## Architecture

- **Frontend**: React + Vite + TypeScript, Tailwind CSS + shadcn/ui, wouter routing, TanStack Query v5
- **Backend**: Express.js + TypeScript (tsx runner), in-memory session map, no ORM for routes
- **Database**: PostgreSQL (Drizzle ORM, schema at `shared/schema.ts`)
- **Port**: 5000 (Express serves both API and Vite frontend)

## Key Features

- **437 optimization toggles** across 15+ tabs (Registry, FiveM, NVIDIA, AMD, AMD Integrated GPU, Intel iGPU, Laptop, Network, Startup, Debloat, Memory, Fortnite, Discord, Game Detection, Process Lasso)
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
