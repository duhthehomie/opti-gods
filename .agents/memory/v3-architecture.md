---
name: V3 architecture decisions
description: Key V3 facts about tweak counts, store, downloads, git, and the auto-release pipeline.
---

# Tweak counts
- **580 DEFAULT_TWEAKS = 580 TWEAK_REGISTRY** — these must stay in sync. Any new tweak added to the registry must also be added to DEFAULT_TWEAKS.
- Displayed counts in index.html, meta tags, structured data: 580+ (not 461 or any older number).

# Store
- Persist key: `optigods-tweaks-v2`
- Deep-merge function on rehydration — partial saves are merged with defaults, not overwritten.
- Do NOT change the persist key without migrating stored user data.

# Script downloads
- All downloads are `.bat` — the bat wraps the embedded PS1 with `##PS1_START##` launcher format.
- Provides UAC elevation, progress output, visible `[OK] N of M tweaks applied` summary.
- The `/api/download/latest` endpoint serves the installer from the GitHub Release.

# Git workflow
- Remote: `origin https://github.com/duhthehomie/opti-gods.git`
- If push is rejected (non-fast-forward): remove lock file if present (`rm .git/refs/remotes/origin/main.lock`), then `git pull origin main --rebase`, then `git push origin main`.
- The Replit main agent sandbox blocks `git fetch` / `git pull` / destructive git ops — leaq must run these in the Shell tab himself.

# GitHub Actions — fully automatic
- `build-windows.yml` triggers on every push to `main`.
- It: builds the Vite frontend → runs tests (preset-builder, hardware-info, smart-recs, PS1 smoke) → compiles Tauri NSIS installer → signs if certs present → computes SHA-256 → writes `latest.json` → commits `Cargo.lock` → creates/updates GitHub Release → uploads `OptiGods-Setup-<version>.exe` + `latest.json`.
- **Nothing manual required after the push.** Never describe any of these steps as something leaq needs to do himself.
- Actions URL: https://github.com/duhthehomie/opti-gods/actions

# Version
- Current: 3.0.0 in `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `version.json`.

**Why:** These facts have been re-established from scratch multiple times across sessions due to context loss.
