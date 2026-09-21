# Building Opti Gods locally on Windows

> Use this when you want a one-off `.exe` on your own machine without waiting
> for the GitHub Actions release. For every real release, push to `main` and
> let `.github/workflows/build-windows.yml` do it — that's the path the
> auto-updater consumes.

## 1. Install the toolchain (one-time)

You need **Windows 10/11 x64**, ~6 GB of free disk, and admin rights.

1. **Node 20 LTS** — https://nodejs.org/en/download/ (the .msi installer is fine; tick "Add to PATH")
2. **Rust (stable, MSVC)** — https://rustup.rs/  
   When the installer asks, accept the default `x86_64-pc-windows-msvc` toolchain.
3. **Visual Studio 2022 Build Tools** — https://visualstudio.microsoft.com/visual-cpp-build-tools/  
   In the installer, tick **"Desktop development with C++"**. This brings in the MSVC linker that the Rust toolchain links against.
4. **WebView2 Runtime** — already on every Win11 box, and on Win10 if it's patched. If a friend reports the installer crashing on launch, point them at https://developer.microsoft.com/microsoft-edge/webview2/.
5. **Tauri CLI**:
   ```powershell
   npm install --global @tauri-apps/cli@latest
   ```

Verify everything is on PATH:
```powershell
node --version       # v20.x
cargo --version      # cargo 1.7x
tauri --version      # tauri-cli 2.x
```

## 2. Bump the version

Open `version.json` at the repo root and bump `version` (semver). This is the
single source of truth — both the installer and the in-app "you're on v…"
chip read from it.

```json
{
  "version": "2.0.1",
  "notes": "Hotfix: Discord login now retries on flaky DNS."
}
```

## 3. Build

From the repo root, in PowerShell or Windows Terminal:

```powershell
npm install
npx tsx scripts/sync-version.ts     # writes version into src-tauri/tauri.conf.json
npm run build                       # builds the Vite frontend into dist/public
tauri build --bundles nsis          # builds the .exe — takes ~3 min cold, ~30s warm
```

The installer lands at:

```
src-tauri/target/release/bundle/nsis/OptiGods_<version>_x64-setup.exe
```

Copy it wherever you want. Double-click to run — Windows will prompt for
admin (the manifest declares `requireAdministrator`).

## 4. (Optional) Sign it locally

If you've got a code-signing cert installed in your **Current User → Personal**
store, sign with:

```powershell
$exe = "src-tauri/target/release/bundle/nsis/OptiGods_2.0.1_x64-setup.exe"
$signtool = (Get-ChildItem "C:/Program Files (x86)/Windows Kits/10/bin" -Recurse -Filter signtool.exe |
             Where-Object { $_.FullName -like "*x64*" } | Select-Object -First 1).FullName
& $signtool sign /a /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 $exe
```

`/a` tells signtool to pick the best cert automatically. See `SIGNING.md`
for what cert types work + how to put the cert into GitHub Secrets so CI
signs every release.

## 5. Test before shipping

Every release should pass the smoke checklist in `PREVIEW-CHECKLIST.md`.
SmartScreen will warn on unsigned + low-reputation signed builds — that's
normal and covered in `SIGNING.md`.
