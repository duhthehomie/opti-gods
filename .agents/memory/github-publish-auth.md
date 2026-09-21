---
name: GitHub publish authentication
description: Replit-specific authentication behavior observed when publishing this repository through GitHub.
---

Do not assume that attaching the Replit GitHub App immediately updates Git authentication for this workspace. The Git CLI can continue using a stale PAT through `GIT_ASKPASS`. The standard GitHub connector can still publish through the repository API.

**Why:** The GitHub App and CLI both failed to write, but an explicitly authorized standard GitHub connector recreated the local commit chain through GitHub’s Git Data API with byte-identical SHAs and fast-forwarded main without force.

**How to apply:** Inspect the auth path without printing credentials and never retry old PATs. If CLI auth is stale, use the standard GitHub connector and Git Data API; verify the remote head is an ancestor and update the branch with force disabled.