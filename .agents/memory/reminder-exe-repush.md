---
name: Reminder — next .exe push
description: Tracks what version is live in downloads/ and what needs to happen next for the desktop build.
---

**Current state (2026-06-18):**
- `downloads/OptiGods-Setup-3.1.4.exe` (139 MB) — placed directly in the repo root `downloads/` folder
- `/api/download/latest` serves this file first (local folder beats GitHub releases)
- After next publish, the site download button will serve this file automatically

**What's in 3.1.4:**
- Discord name/avatar in Sessions online chip (discordUserId stamped on pro_sessions)
- 30s pro-status ping to keep lastCheckedAt fresh; 2-hour online window
- Admin .exe Stripe button uses openExternal (was going nowhere in Tauri webview)
- Showcase mobile Stripe "Pay with Card" button added
- All Stripe buttons now use direct payment link https://buy.stripe.com/5kQdRacgM48Yb4Y4WD14400
- Avatar chip renders letter fallback correctly when Discord img 404s
- $20 price everywhere

**Git push for new .exe build (only if leaq wants a fresh GitHub Actions build):**
git push origin main
— but the download button already serves the file above without a GitHub push.
