---
name: Reminder — next .exe push
description: Tracks what version was last pushed and what needs to happen next for the desktop build.
---

**Current state (2026-06-18):**
- Version bumped to 3.1.4 in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`
- leaq needs to run in Shell: `git add src-tauri/tauri.conf.json src-tauri/Cargo.toml && git commit -m "chore: bump version to 3.1.4" && git tag v3.1.4 && git push origin v3.1.4`
- GitHub Actions will build `OptiGods-Setup-3.1.4.exe`
- After build: send .exe here → update download link on site → republish

**What's in 3.1.4:**
- Discord name/avatar in Sessions online chip (discordUserId stamped on pro_sessions)
- 30s pro-status ping to keep lastCheckedAt fresh
- 2-hour online window in admin Sessions panel
- Admin .exe Stripe button now opens system browser (was going nowhere)
- Showcase mobile Stripe "Pay with Card" button added
