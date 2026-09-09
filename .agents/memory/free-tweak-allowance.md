---
name: Free tweak allowance security
description: Durable security boundary for the account-level free performance-tweak allowance.
---

Free tweak credits are consumed only by successful native desktop execution, never by selection or script delivery. Authorization uses a one-use server ticket whose result is finalized by the native executor.

**Why:** Renderer-controlled completion, cancellation, duplicate tickets, or stale-reservation cleanup can otherwise let modified clients apply more than the lifetime allowance or charge users for actions that never ran.

**How to apply:** Keep issuance, consume, cancellation, expiry, and finalization serialized per account. Automatic choices must intersect the native executable allowlist and exclude expert/forbidden tweaks. Undo never refunds credit.

On a cold Windows-app start, restore the bearer token from Windows Credential Manager before requesting or consuming a native ticket; localStorage alone is not a reliable session source.

Dashboard bulk selectors must never bypass entitlement: free/logged-out sessions may only enter the server-built Best 15 flow, and persisted selections above 15 must be cleared.