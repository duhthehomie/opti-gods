---
name: Repeated mistakes to avoid
description: Mistakes that have happened more than once — check this before acting to avoid repeating them.
---

# Git mistakes
- **Trying git push without checking if remote is ahead** — always check `git log origin/main` vs local HEAD before pushing. If remote is ahead, pull/rebase first.
- **Trying git fetch/pull from the main agent sandbox** — the sandbox blocks these. Tell leaq to run them in the Shell tab instead.
- **Stale lock file** — if pull fails with "cannot lock ref", the fix is `rm .git/refs/remotes/origin/main.lock` before retrying.

# Workflow / communication mistakes
- **Describing already-automated steps as future work** — the GitHub Actions workflow is fully automatic. Do not say "it will upload the exe to the Release" as if leaq needs to do something. It happens automatically.
- **Re-explaining decisions leaq already confirmed** — if something is in the codebase or was explicitly confirmed by leaq ("yes that's done"), don't describe it as pending or upcoming.
- **Restating things from a compressed summary as if they're new** — after context compression, re-read actual files rather than trusting the summary blindly.

# Code mistakes
- **Adding expert tweaks to CORE auto-preset** — the Enable All / Smart Recs functions must filter out all 15 expert tweaks. This was broken at V2 launch and cost significant debugging time.
- **DEFAULT_TWEAKS and TWEAK_REGISTRY out of sync** — caused Quick Boost presets to silently skip tweaks. Always verify both lists match after adding new tweaks.
- **TypeScript errors from Discord fields on ProAccessCode type** — use `(c as any).discordLinked` etc. The DB type doesn't include those fields.

**Why:** Each of these has come up more than once and caused leaq to have to correct me, repeat himself, or debug regressions that shouldn't have happened.
