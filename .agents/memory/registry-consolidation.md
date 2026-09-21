---
name: Registry sections consolidation
description: registry.tsx merged 10 named sections down to 5 to reduce scroll. Key duplicate IDs to watch for.
---

**Rule:** CPU_TWEAKS and POWER_TWEAKS share two IDs that must NOT appear in both arrays:
- `DisableCoreParking` — lives in CPU_TWEAKS only
- `DisableDynamicTick` — lives in CPU_TWEAKS only

**Why:** The render merges them as `[...CPU_TWEAKS, ...POWER_TWEAKS]`. Duplicate `id` props cause React key collisions and the same toggle appearing twice on screen.

**Current 5-section layout (registry.tsx):**
1. CPU, Power & Timer — CPU_TWEAKS + POWER_TWEAKS (deduped)
2. Network & Internet — NETWORK_TWEAKS + ADVANCED_NETWORK_TWEAKS
3. Memory Management — MEMORY_TWEAKS alone
4. Visual, Kernel & System — VISUAL_TWEAKS + KERNEL_TWEAKS
5. Process Scheduling & Win11 — PROCESS_TWEAKS + WIN11_GAMING_TWEAKS
6. Advanced/Risky — inline section (not a Section component)
7. V2TweakSections below — unchanged (Net Advanced, Security, AC, Input, Zen5, Arrow Lake)

**How to apply:** If adding a new tweak that fits an existing category, put it in exactly one array. If it conceptually fits two (e.g. power + CPU), pick the primary one.
