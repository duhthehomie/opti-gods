# Opti Gods — Tauri Desktop

This is the Rust + Tauri 2.x shell that wraps the existing React web app into
a Windows installer. The actual `.exe` build only runs on Windows (CI), but the
source lives here so the build pipeline (see Task #43 — Windows build + code-signing)
is fully reproducible.

## Layout

```
src-tauri/
├── Cargo.toml            # Rust deps + Tauri plugins
├── tauri.conf.json       # Tauri 2 app/bundle/plugin config
├── build.rs              # tauri-build script
├── app.manifest          # UAC elevation + DPI awareness + Win10/11 compat
├── capabilities/         # Tauri 2 capability ACLs (which windows can call which plugins)
├── splash.html           # Initial transparent splash window
└── src/
    ├── main.rs           # process entry (windows_subsystem in release)
    ├── lib.rs            # tauri::Builder + command handler registration
    ├── state.rs          # shared AppState (ProBalance flag + Discord session)
    ├── commands/         # #[tauri::command] surface called by React
    │   ├── splash.rs     # finish_splash — swap splash → main window
    │   ├── env.rs        # env_info — "am I in native mode?"
    │   ├── tweaks.rs     # apply_tweak / undo_tweak (20 native + PS fallback)
    │   ├── hardware.rs   # scan_hardware (WMI)
    │   ├── restore.rs    # create_restore_point / restore_to_point / list
    │   ├── process_lasso.rs # ProBalance replacement
    │   ├── discord.rs    # in-app loopback OAuth + keyring cache
    │   └── updater.rs    # tauri-plugin-updater wrapper
    └── win32/            # Windows-only helpers (gated by #[cfg(windows)])
        ├── registry.rs   # backup-before-write + base64 undo tokens
        ├── elevation.rs  # access-token integrity check
        ├── wmi_scan.rs   # CPU/GPU/RAM/MB/chassis/NIC pull
        ├── restore.rs    # SRSetRestorePointW + WMI list + rstrui replay
        └── processes.rs  # ToolHelp32 enum + SetPriorityClass overrides
```

## Build prerequisites (Windows host)

1. Install the Rust toolchain (stable, MSVC):
   ```powershell
   rustup default stable
   rustup target add x86_64-pc-windows-msvc
   ```
2. Install the Microsoft C++ Build Tools (`Desktop development with C++`
   workload, including the Windows 10/11 SDK).
3. Install [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)
   (most Windows 10/11 systems already have it).
4. Install the Tauri CLI:
   ```powershell
   cargo install tauri-cli@^2
   ```

## Build flow

Because Replit's `package.json` is owned by the Vite app, **we do not add Tauri
scripts there**. Instead the GitHub Actions workflow (see Task #43) does:

```yaml
- run: npm ci
- run: npm run build         # builds dist/public — the frontendDist target
- run: cd src-tauri && cargo tauri build --target x86_64-pc-windows-msvc
```

That produces `src-tauri/target/release/bundle/nsis/Opti Gods_2.0.0_x64-setup.exe`
which the signing step (next task) then signs with the code-signing cert.

## Local dev (on a Windows machine)

```powershell
npm run dev                   # in one terminal — starts the Vite dev server on :5000
cd src-tauri
cargo tauri dev               # in another — opens the native window, loads :5000
```

In dev mode `tauri.conf.json` points `devUrl` at `http://localhost:5000` so HMR
works inside the native window exactly like in the browser.

## What ships natively, what doesn't

| Surface | Native impl | Fallback |
|---|---|---|
| 20 high-impact tweaks (HAGS, MSI mode, NetworkThrottling, GameMode, …) | Direct registry writes via `winreg`, backup-before-write, base64 undo tokens | — |
| Remaining ~480 tweaks | — | `Command::new("powershell")` with the snippet from the React app |
| Hardware scan | `wmi` crate → Win32_Processor / VideoController / PhysicalMemory / BaseBoard / SystemEnclosure / NetworkAdapter | — |
| System Restore | `SRSetRestorePointW` via `windows` crate + WMI list + `rstrui.exe` replay | — |
| Process Lasso | `CreateToolhelp32Snapshot` + `SetPriorityClass` background tokio task | — |
| Discord login | 127.0.0.1 loopback listener + browser-launched consent + keyring cache | — |
| Auto-update | `tauri-plugin-updater` pointed at the GitHub Releases JSON manifest | — |

## Secret/config inputs

- `DISCORD_CLIENT_ID` — passed by the React app into `discord_login(client_id, …)`.
- `DISCORD_REDIRECT_URI` — not needed; the loopback flow generates an
  ephemeral port and registers it inline. The redirect URI registered in your
  Discord app should be `http://127.0.0.1` (Discord accepts any 127.0.0.1 port).
- `STRIPE_*` / `EMAIL_*` — server-side only, never embedded.

## Signing key (set per release)

`tauri.conf.json` ships `pubkey: "REPLACE_WITH_BASE64_PUBKEY_BEFORE_RELEASE"`.
The Windows build job in the next task generates a real keypair, embeds the
public half here, and stores the private half in the GitHub Actions secret
`TAURI_PRIVATE_KEY` for signing the updater bundle.
