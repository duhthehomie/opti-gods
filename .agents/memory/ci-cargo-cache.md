---
name: CI Cargo cache key
description: The GitHub Actions workflow caches src-tauri/target — cache key must include src/** hash or Rust source changes are silently ignored.
---

## Rule
The CI cache key for `src-tauri/target` must include `hashFiles('src-tauri/src/**')` alongside `Cargo.toml`. Without it, changes to any `.rs` file (e.g. `discord.rs`) hit the cache and the old binary is shipped — code changes never land in the exe.

**Why:** Discovered after multiple `discord.rs` fixes that never appeared in the built exe. The build was completing in ~7 min (cache hit) instead of ~25 min (full compile). Every "fix" was a no-op.

**How to apply:** Current key in `.github/workflows/build-windows.yml` is `cargo-v4-${{ runner.os }}-${{ hashFiles('src-tauri/Cargo.toml', 'src-tauri/src/**') }}`. Bump the version prefix (v4→v5 etc.) whenever you need to force a clean rebuild.
