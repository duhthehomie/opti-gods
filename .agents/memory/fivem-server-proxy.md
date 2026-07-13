---
name: FiveM server info proxy & connect string helpers
description: CORS workaround for cfx.re server info + correct URL formats for server icons and join links
---

## Rule
Never fetch cfx.re server-info directly from the browser — CORS blocks it. Always use the backend proxy at `GET /api/fivem/server-info/:code` (added to server/routes.ts just before `/api/fivem-crash-fix-script`).

**Why:** cfx.re does not send CORS headers; browser fetch from the frontend fails with a network error. The Express proxy is the only path.

## Connect string formats
User input arrives in many forms — always normalize with these helpers in game-detection.tsx:
- `cleanConnect(raw)` — strips `"connect "` prefix and `"fivem://connect/"` prefix
- `extractCfxCode(clean)` — returns bare 4–8 char cfx.re code if the string is a cfx.re shortlink; returns null for IP:Port

## Correct join URL
`https://cfx.re/join/{code}` — open in new tab via `window.open()`.
**Never** use `fivem://connect/connect XXXXXX` (wrong — double prefix, wrong protocol for short codes).

## Server icon URL
`https://cfx-nui-prime.akamaized.net/servers/icon/{code}/{iconVersion}.png`
iconVersion comes from the `/info.json` API response field `iconVersion`.

## Auto-detect from CitizenFX.log
- Rust command `read_fivem_log()` in `src-tauri/src/commands/misc.rs` — reads last 400 lines of `%LOCALAPPDATA%\FiveM\FiveM.app\logs\CitizenFX.log`
- Bridge: `readFivemLog()` in `client/src/lib/tauri-bridge.ts`
- NowPlayingPanel: useEffect runs readFivemLog when FiveM is the detected game, extracts last "Connecting to" cfx.re code, auto-adds + marks active
- **Requires a new .exe build** — this Rust command was added in this session; web-only mode will not have it.

## How to apply
Any time code needs to look up cfx.re server details, add a server from user input, or build a join link — follow these patterns. The proxy endpoint and helpers already exist; don't re-fetch from the browser.
