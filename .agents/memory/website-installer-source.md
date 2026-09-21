---
name: Website installer source
description: Preventing the public Download button from serving an outdated Windows installer.
---

The public installer endpoint treats `DOWNLOAD_URL` as its highest-priority source, followed by an admin override and automatic GitHub release detection. Bundled local installers are emergency fallbacks only.

**Why:** A shared `DOWNLOAD_URL` remained pinned to v4.0.0 even after v5.2.4 was released, so the live website continued redirecting users to the old installer.

**How to apply:** After each Windows release, either update `DOWNLOAD_URL` to the verified release asset or remove it so GitHub release detection selects the newest installer. Republish after environment changes because the live deployment keeps its prior environment snapshot.