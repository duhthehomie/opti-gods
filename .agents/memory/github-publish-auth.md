---
name: GitHub publish authentication
description: Replit-specific authentication behavior observed when publishing this repository through GitHub.
---

Do not assume that attaching the Replit GitHub App immediately updates Git authentication for this workspace. The Git CLI can continue using a stale PAT through `GIT_ASKPASS`, while connector credentials may be withheld from the execution sandbox.

**Why:** A valid GitHub App connection was attached, but direct Git pushes still received “Invalid username or token,” no repository credential helper was configured, and the connected credential was unavailable through the connector sandbox.

**How to apply:** Before retrying a failed publish, inspect which authentication path Git is actually using without printing credentials. Never fall back to old PAT secrets. If the App remains unavailable, use Replit’s Git UI or refresh the workspace connection rather than repeating pushes.