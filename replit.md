# Opti Gods by leaq

A Windows 10/11 PC optimizer web dashboard with a strict Red/Black WinUI aesthetic.

## Architecture

- **Frontend**: React + Vite + TypeScript, Tailwind CSS + shadcn/ui, wouter routing, TanStack Query v5
- **Backend**: Express.js + TypeScript (tsx runner), in-memory session map, no ORM for routes
- **Database**: PostgreSQL (Drizzle ORM, schema at `shared/schema.ts`)
- **Port**: 5000 (Express serves both API and Vite frontend)

## Key Features

- **130+ optimization toggles** across 9 tabs (Registry, FiveM, NVIDIA, Network, Startup, Debloat, Memory, Fortnite, Game Detection)
- **PowerShell script generation** — downloads a personalized `.ps1` file based on selected tweaks
- **Pro paywall** (`ProGate` component) — unlocked by access code, CashApp, PayPal, or Stripe (optional)
- **Free friend unlock** via URL param `?unlock=<VITE_FREE_KEY>`
- **Smart Game Detection** — PS1 scanner checks 14 game paths, opens `/game-detection?games=<ids>` in browser
- **Preset save/load** — stored in PostgreSQL via `/api/presets`

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

## Important Files

| File | Purpose |
|------|---------|
| `client/src/components/pro-gate.tsx` | Paywall modal (CashApp/PayPal/Stripe/code) |
| `client/src/lib/pro-status.ts` | `getProStatus()` utility (localStorage) |
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
