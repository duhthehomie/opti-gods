---
name: Security Audit — June 2026
description: Full audit of all Pro access paths; findings and fixes applied
---

## Result: No exploitation found, one loophole fixed

### All attack paths verified SECURE
- Script downloads: `requirePaidPro(req)` on all 3 endpoints (`/api/script/download`, `/api/script/download-bat`, GET `/api/script/download`)
- Stripe webhook: `constructEvent()` signature check; returns 503 if `STRIPE_WEBHOOK_SECRET` not set
- Stripe `/api/verify-payment`: idempotent via `findCodeByStripeRef` — same session ID never creates 2 codes
- Friend tokens: DB-level `WHERE used_at IS NULL` — single-use enforced at DB layer
- Pro session: `verifyProSession` cross-validates code ref; orphan sessions auto-killed
- Admin routes: all behind `checkAdminKey`
- VITE_FREE_KEY: NOT present in codebase (referenced in replit.md docs only)

### Fixed: Email double-submission
**Problem:** Same person could submit payment proof form twice → admin sees 2 pending requests → accidentally sends 2 codes.
**Fix 1:** `POST /api/request-code` now calls `getEmailRequests()` before insert; returns 409 if same email has pending/sent entry.
**Fix 2:** `POST /api/admin/email-requests/:id/send` checks for other entries with same email already marked sent; returns 409 naming the duplicate.
**Frontend:** Both `get-code.tsx` and `admin.tsx` already read `d.error` / `data.error` — no frontend changes needed.

### DB state at time of audit (2026-06-07)
- 14 script downloads: ALL have `session_token = null` → admin key downloads (leaq testing)
- 2 Pro sessions: both `friend:` code_ref → legitimately given friend tokens
- email_requests: empty (codes for person today were sent manually outside the system)
- pro_access_codes: 1 code (`ZF3W-P4VC-HQ9Z`, unused)
- IP logs reference 2 deleted codes (`775G-JUXY-7W23`, `VNTW-3Z3K-M8EL`) — sessions dead

**Why:** `verifyProSession` cross-validates code_ref against `pro_access_codes` and auto-deletes orphan sessions. Deleting a code instantly kills access.
