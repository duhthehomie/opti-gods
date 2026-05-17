# Pre-release preview checklist

> Run through this on every fresh unsigned-preview installer **before**
> you sign it and cut a public release. Each item is a real end-to-end
> flow — click the buttons, don't just stare at the UI.
>
> Mark every box. If anything is ✗, file it in the admin Tickets tab,
> fix in `main`, and re-run.

Tested build: `OptiGods-Setup-_____.exe`  
Test machine: ____________________  
Date: ____________________  
Windows version: ____________________

## 1. Install + first launch

- [ ] Installer double-click triggers the SmartScreen banner you expect (see `SIGNING.md`)
- [ ] UAC prompt fires; clicking **Yes** launches the app elevated
- [ ] Red ring splash window appears within ~1s of launch
- [ ] Splash closes automatically and the main window opens centered on the primary monitor
- [ ] Title bar reads **"Opti Gods"** and the taskbar icon is the red-on-black logo
- [ ] Version chip in the bottom-right corner shows the version from `version.json`

## 2. Discord login

- [ ] **Login with Discord** button on the dashboard opens the default browser to the Discord OAuth consent page
- [ ] After approving, the browser shows the "You can close this tab" landing page within ~3s
- [ ] The desktop app picks up the session automatically (no manual paste) and shows the Discord username + avatar in the header
- [ ] Closing the app + relaunching keeps you logged in (keyring cache works)
- [ ] **Logout** clears the username + avatar and forces a fresh OAuth flow next time

## 3. Hardware scan

- [ ] **Run instant native scan** button is visible on the dashboard (only in the desktop build)
- [ ] Clicking it returns CPU / GPU / RAM data within ~2s — no PowerShell copy-paste required
- [ ] The scan result is reflected in the admin panel's **Sessions → Hardware** row for your IP within 30s
- [ ] GPU vendor tab auto-selects correctly (NVIDIA box on an RTX, AMD on a Radeon, etc.)

## 4. Recommended preset apply + undo

- [ ] **Apply recommended preset** populates the toggle grid based on your hardware
- [ ] **Apply** runs without errors; toast shows "N tweaks applied"
- [ ] **Undo last apply** reverses every tweak from that batch; toast confirms
- [ ] After undo, the registry values are back to their pre-apply state (spot-check 2-3 via `regedit`)

## 5. System Restore point

- [ ] **Create restore point** in the Safety panel completes within ~10s
- [ ] `rstrui.exe` lists the new point with the label `OptiGods - <date>`
- [ ] **List restore points** in the desktop UI shows the same entry

## 6. Process Lasso replacement

- [ ] Launch a game (Fortnite, FiveM, Valorant — anything on the whitelist)
- [ ] Within ~5s the game's process is **HIGH** priority + pinned to every core in Task Manager → Details
- [ ] At the same time, a couple of background apps (Discord, Spotify) drop to **Below normal** + **Low I/O priority**
- [ ] Closing the game restores the original priorities within ~10s

## 7. Pro unlock celebration

- [ ] Redeem a Pro code via the in-app **Unlock Pro** dialog
- [ ] Celebration video / overlay plays full-screen
- [ ] After it ends, all Pro-gated tabs are unlocked
- [ ] Restart the app — you're still Pro (session token persisted)

## 8. Admin panel deep-link

- [ ] **Open admin** button in the desktop app header opens the default browser to `https://optigods.replit.app/admin`
- [ ] If you're not logged in as admin, you get the password screen; if you are, the panel loads with the desktop session's hardware row visible

## 9. Auto-updater

- [ ] Bump `version.json` to a fake higher version (e.g. `2.99.0`), push, let CI build it
- [ ] Re-open the still-old desktop app; within ~30s the **Update available** banner appears
- [ ] Clicking **Update now** downloads the new installer and re-launches into the new version

## 10. Uninstall

- [ ] **Settings → Apps → Opti Gods → Uninstall** runs the NSIS uninstaller cleanly
- [ ] After uninstall, no `Opti Gods` entry remains in Start Menu, no folder under `Program Files`, and the desktop shortcut is gone
- [ ] The Discord keyring entry is removed (Credential Manager → Windows Credentials, search "optigods")

---

When every box above is ✓, push the signing secrets (if not already there) and ship.
