# Code-signing the Opti Gods installer

The desktop installer needs an Authenticode signature so Windows
SmartScreen + Defender stop telling users "Unknown publisher — could
harm your PC". This doc covers:

1. Which cert types work
2. How to put the cert into GitHub Secrets (CI signs every release for you)
3. What users actually see — before signing, immediately after, and once
   SmartScreen has built up reputation

## 1. Which cert to buy

You want a **Windows Authenticode Code Signing Certificate**. Three tiers,
ordered by how kind SmartScreen is to brand-new releases:

| Tier | Vendors | Price / yr | SmartScreen behaviour                            |
|------|---------|-----------:|--------------------------------------------------|
| **OV (Organization Validated)** | Sectigo, DigiCert, GlobalSign | $200-$400 | "Unknown publisher" goes away. SmartScreen still warns on the first ~3,000 downloads until reputation builds (4-8 weeks for an active app). |
| **IV (Individual Validated)**   | SSL.com, Certera             | $80-$120  | Same as OV but issued to a person, not a company. Fine for a solo dev. Same reputation ramp. |
| **EV (Extended Validation)**    | SSL.com EV, DigiCert EV      | $300-$600 | **Instant** SmartScreen reputation — zero warnings from launch day. Ships on a hardware token (YubiKey-style) you have to plug in to sign locally, but you can also do it via the cloud-signing portals listed below. |

If you can afford it and you want a clean launch, get **SSL.com EV** — they're
the cheapest EV vendor and they offer cloud-signing (eSigner) so you don't
have to mail the YubiKey around.

If money is tight, **Sectigo OV** is the standard choice — works fine and
users still get the right brand name in the UAC prompt; they just see a
SmartScreen banner for the first few weeks until enough people install it.

## 1b. Updater signing (separate from Authenticode)

The Tauri auto-updater inside the desktop app refuses to install any update
whose `latest.json` doesn't carry a valid signature against the `pubkey`
baked into `src-tauri/tauri.conf.json`. That signature is produced by a
**different** key pair from the Authenticode cert above — it never leaves
your machine and doesn't cost anything.

One-time setup:

1. Install the Tauri CLI (if you haven't already): `npm install --global @tauri-apps/cli@latest`
2. Generate the key pair:
   ```powershell
   tauri signer generate -w optigods-updater.key
   ```
   This writes two files:
   - `optigods-updater.key` — the **private key**. Treat like a password.
   - `optigods-updater.key.pub` — the **public key**.
3. Paste the contents of `optigods-updater.key.pub` (a single base64 line)
   into `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`,
   replacing the `REPLACE_WITH_BASE64_PUBKEY_BEFORE_RELEASE` placeholder.
4. Add the private key + its password to GitHub Secrets:
   - `TAURI_SIGNING_PRIVATE_KEY` — full contents of `optigods-updater.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the password you set when generating it

Until those two secrets exist, CI prints a warning, the build still
succeeds, but the `signature` field in `latest.json` is empty and the
desktop app's auto-updater will skip every release. Set them once and
forget — they only have to be rotated if the private key leaks.

## 2. Put the Authenticode cert into GitHub Secrets

> Skip this section entirely if you're using EV cloud-signing (eSigner /
> DigiCert KeyLocker) — those need their own workflow steps that the vendor
> provides. Drop them into `.github/workflows/build-windows.yml` in place of
> the existing "Sign installer" step.

For an OV / IV cert delivered as a `.pfx` file:

1. **Export to base64** (PowerShell, on your local machine):
   ```powershell
   $bytes = [IO.File]::ReadAllBytes("optigods-signing.pfx")
   [Convert]::ToBase64String($bytes) | Set-Clipboard
   ```
   That copies the base64 blob to your clipboard.

2. **Paste into GitHub Secrets**: in your GitHub repo go to
   *Settings → Secrets and variables → Actions → New repository secret*. Add:
   - `SIGNING_CERT_BASE64` — paste the base64 blob from step 1
   - `SIGNING_CERT_PASSWORD` — the .pfx export password

3. **Push to main**. The next workflow run picks them up automatically and
   the release at `https://github.com/<owner>/<repo>/releases/latest`
   will carry a signed installer. The release name drops the "(unsigned-preview)"
   suffix once it's signed.

To roll the cert (new vendor, new year), repeat step 1 with the new .pfx
and overwrite the two secrets. No code change needed.

## 3. What users see

### Before signing (unsigned-preview builds)

- **Download**: browsers (Edge, Chrome) flag the .exe as "could harm your device" and require an explicit "Keep anyway".
- **Double-click**: SmartScreen shows the full-screen blue "Windows protected your PC" page with only a "Don't run" button visible. They have to click "More info" → "Run anyway".
- **UAC prompt**: yellow/orange banner, publisher shown as **"Unknown publisher"**.

### Immediately after signing (OV / IV, first weeks)

- **Download**: no browser warning.
- **Double-click**: SmartScreen still warns ("Microsoft Defender SmartScreen prevented an unrecognized app from starting") but the "Run anyway" button is visible immediately — much smaller friction.
- **UAC prompt**: blue banner, publisher shown as **"leaq"** (or whatever the cert is issued to).

### After reputation builds (OV / IV, ~3-8 weeks)

- No warnings anywhere. UAC still shows the publisher name.
- Reputation is per-certificate, per-binary-hash — every new version starts
  with partial reputation inherited from the cert. So once you ship 2-3
  versions, new releases stop triggering SmartScreen entirely.

### Day-one (EV)

- No warnings, ever. UAC shows the publisher name in blue from the very first download.

## 4. Verifying a signed build

After CI uploads the release, download the installer and run:

```powershell
$signtool = (Get-ChildItem "C:/Program Files (x86)/Windows Kits/10/bin" -Recurse -Filter signtool.exe |
             Where-Object { $_.FullName -like "*x64*" } | Select-Object -First 1).FullName
& $signtool verify /pa /v "OptiGods-Setup-2.0.0.exe"
```

A signed file prints `Successfully verified` and shows the cert chain + the
DigiCert RFC 3161 timestamp. If you see "No signature found", the workflow
either didn't have the secrets or signtool failed silently — re-check the
Action run logs.
