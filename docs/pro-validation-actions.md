# Pro missing-tweak validation actions

These three actions are explicitly test-stage. They are available to compatible
Pro Windows users through the existing Missing Tweaks buttons. They are not
members of the automatic Full Optimize preset. Promote them only after actual
Windows testing, not merely a TypeScript build or a successful registry write.

## Actions

- **DirectX & FiveM Cache Refresh**: Windows D3DSCache, NVIDIA DXCache and FiveM data/cache files
  only. Requires games closed; checks processes again before every deletion.
  Rejects reparse points, preserves subprocess directories and runtime binaries.
  Missing folders are not created. Existing empty folders are a valid no-op.
  This is permanent cleanup, not a reversible registry tweak. The next game
  launch may stutter while shaders rebuild. A game starting during deletion
  stops further cleanup; already-deleted cache files cannot be restored.
  Sharing/lock violations (Win32 32/33, including nested exceptions) leave that
  file untouched and do not prevent cleanup of other eligible files or roots.
  Results report verified deletion, locked, already-absent and error counts.
  A partial cleanup is explicitly labeled; an all-locked attempt with no
  progress is skipped/retryable, never reported as a successful deletion. Other deletion errors still fail after
  attempting the remaining files. Never stop GPU services to remove locks.
  Only handled sharing errors are removed from the strict delivery wrapper's
  error history; access denied, earlier errors and unrelated failures stay errors.
- **Windows Game Mode State Alignment**: Windows 10/11; discovers installed
  FiveM/GTA executables and modern subprocesses, enables Game Mode, disables
  Windows background game capture in the user settings, and writes
  `GpuPreference=2;` for real executable paths, preserving other preference
  tokens. NVIDIA capture/overlay settings remain unchanged. Windows chooses
  the actual adapter; registry readback does not prove higher FPS.
  Compares the original type and value before writing and changes only
  mismatched entries. The short user result distinguishes "Already configured.
  No settings changed." from applied/verified system and per-game changes.
  Per-setting before/verified-after values are saved in a protected local
  `WindowsGameModeAlignment-report-*.txt` under the backup directory below,
  not dumped into the ordinary result text. This is not an FPS benchmark.
- **MSI Mode Utility Optimization**: exactly one present, healthy PCI
  `VEN_10DE` display device. Requires an existing DWORD MSI capability value
  of 0 or 1. Writes and reads back MSISupported=1. No other adapters, NICs,
  NVMe controllers, affinity policies or interrupt priority are changed.
  Requires reboot; runtime MSI interrupt use still needs Windows verification.

Both registry-changing actions save typed originals before writing, as JSON
under `%ProgramData%\OptiGods-ValidationBackups`. The directory grants access
only to Administrators and SYSTEM. Snapshot creation and disk flush must succeed
before mutation. These files are local Windows backups, not cloud backups or a
replacement for the application's full undo engine. They are not yet integrated
with its automatic Undo button. A partial failure may leave some settings
changed; the backup and restore point remain available for recovery.

## Diagnostic codes

Errors include the prefix, stage, Windows exception message and HRESULT.
The existing Applied Tweaks result log contains the action name and message.

| Prefix | Stages | Meaning |
| --- | --- | --- |
| `OG-CACHE` | `PREFLIGHT`, `GAME_RUNNING`, `DISCOVERY`, `PATH_SAFETY`, `DELETE`, `LOCKED`, `VERIFY` | OS/admin, running game, absent cache, redirected path, deletion error, no-progress locked cache or verification failure |
| `OG-GAMEMODE` | `PREFLIGHT`, `GAME_RUNNING`, `DISCOVERY`, `BASELINE`, `BACKUP`, `WRITE`, `VERIFY`, `REPORT` | OS/admin, running game, missing executable/preferences, baseline inspection, snapshot, registry write/readback or diagnostic report failure |
| `OG-MSI` | `PREFLIGHT`, `DISCOVERY`, `CAPABILITY`, `BACKUP`, `WRITE`, `VERIFY` | OS/admin, ambiguous/missing NVIDIA device, unsupported capability, snapshot, write or readback failure |

Example: `OG-MSI-CAPABILITY | ... | HRESULT=...`.
Existing network, entitlement and native timeout errors retain their original
codes rather than being mislabeled as tweak failures.

## Verification

`npx tsx script/test-pro-validation-actions.ts` checks selection, compatibility,
free/Pro separation, preset exclusion, missing-only state, backup-before-write,
readback/error stages and source-level cache safety.

Actual PowerShell 5.1 execution, permissions, GPU driver behavior, custom install
paths and reboot verification require the Windows installer. Linux source checks
are not evidence those Windows flows passed.

On Windows, the existing smoke-test step also runs six non-destructive
PowerShell regressions: real exclusive cache locks, partial DirectX cleanup
through the strict delivery wrapper, empty cache, access denied, and mocked
registry no-op/change cases. These use isolated temporary files and do not
modify the runner's actual Windows settings.

The site's server-owned commands and desktop UI/native runner are independent
delivery surfaces. Publish the updated website and build the desktop from the
verified current release line, reconciling this workspace's older source first.
Do not replace a newer Windows release with this older workspace wholesale.
