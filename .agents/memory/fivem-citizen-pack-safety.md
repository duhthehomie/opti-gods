---
name: FiveM citizen-pack safety
description: Safety and truthfulness boundaries for generated FiveM graphics packs.
---

Generated FiveM graphics packs must contain only supported client-side citizen visual overrides. Do not ship local server resources, patch autoexec.cfg, or claim that a player can override server-controlled time, weather, or permissions.

**Why:** A local player cannot reliably start a server resource or defeat server authority as previously claimed, and overwrite-only installers can destroy existing citizen packs without a recoverable backup.

**How to apply:** Keep generated output backup-first and citizen-only. Do not add automatic overwrite installers until installation is transactional with verified backup and restore. Avoid partial visualsettings.dat replacements and unsupported exact FPS claims.