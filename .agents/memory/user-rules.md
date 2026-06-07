---
name: User rules & hard limits
description: Explicit rules leaq has stated — violating these causes repeated frustration. Read at session start.
---

# Hard rules — never break these

## Code / architecture
- **NEVER edit package.json** — forbidden by fullstack-js skill and stated explicitly by leaq. If a package is needed, use the packager tool.
- **NEVER edit vite.config.ts or drizzle.config.ts** unless absolutely required.
- **NEVER put EnableMSIMode, DisableIPv6, SetTimerResolution in the CORE auto-preset** — these are the V2.1 forbidden trio. They must stay opt-in only, never auto-applied.
- **All expert-safety tweaks** (DisableDefender, Win11DisableVBS, SysHypervisorOff, DisableMemoryCompression, DisablePagefileEncryption, Lap_Intel_DisableECores) go in the `expert` bucket — never in `core`.

## GitHub / deployment
- **The GitHub Actions workflow (build-windows.yml) handles everything automatically** — build, sign, write latest.json, create GitHub Release, upload the .exe. Never describe these as things leaq needs to do manually. Never imply they are future work when the workflow already covers them.
- **Never attempt a raw `git push` if the last push was rejected** — always pull/rebase first or tell leaq to run the commands in shell.

## Communication
- **Do not re-explain things leaq already confirmed or built** — if it's in the workflow/codebase, it's done. Don't describe it as upcoming.
- **Do not suggest leaq contact Replit support for refunds or billing** — stay focused on the technical work.

# Strong preferences
- Red/Black WinUI aesthetic — never introduce whites, pastels, or non-brand colours.
- Full-width layout — no max-w-* constraints on page wrappers or the global layout.
- .bat format for all script downloads (not .ps1 directly) — wraps PS1 in the bat launcher with UAC, progress bars, visible output.
- Store persist key is `optigods-tweaks-v2` with deep-merge — do not change this key or the merge logic.

**Why:** leaq has spent $500+ and had to repeat these rules multiple times across sessions. Violations directly caused V2 bugs and regressions.
