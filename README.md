# Opti Gods

[![Build Windows Installer](https://github.com/duhthehomie/opti-gods/actions/workflows/build-windows.yml/badge.svg?branch=main)](https://github.com/duhthehomie/opti-gods/actions/workflows/build-windows.yml)

A Windows 10/11 PC optimizer dashboard with 437+ optimization tweaks, AI-powered preset generation, and a native desktop installer — built for gamers.

## Features

- **437+ optimization toggles** — Registry, FiveM, NVIDIA, AMD, Intel, Laptop, Network, Debloat, Memory, Fortnite, Discord, and more
- **PowerShell script generation** — download a personalized `.ps1` based on your selections
- **AI Preset Generator** — Groq-powered AI detects your hardware and builds a safe, vendor-filtered preset
- **Opti Gods AI chat** — SSE-streamed AI assistant with image analysis and session persistence
- **Pro paywall** — unlocked via access code, Stripe, CashApp, or PayPal
- **Smart Game Detection** — scans 14 game install paths and surfaces relevant tweaks
- **Native desktop app** — Tauri v2 NSIS installer with Authenticode signing and auto-updater

## CI / Build

The `Build Windows installer` workflow runs on every push to `main`:

1. Syncs version from `version.json` → `tauri.conf.json`
2. Runs preset-builder, hardware-info, smart-recs, and PowerShell AST smoke tests
3. Compiles the Vite frontend and Tauri NSIS installer
4. Authenticode-signs the `.exe` when `SIGNING_CERT_BASE64` + `SIGNING_CERT_PASSWORD` repo secrets are present
5. Writes a `latest.json` auto-updater manifest
6. Creates / updates a GitHub Release with the installer attached

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React + Vite + TypeScript, Tailwind CSS, shadcn/ui, wouter, TanStack Query v5 |
| Backend | Express.js + TypeScript (tsx runner) |
| Database | PostgreSQL via Drizzle ORM |
| Desktop | Tauri v2 (Rust, NSIS bundle) |
| AI | Groq (llama-3 family) via SSE streaming |

## Version

Current: **v3.0.0** — see [`version.json`](./version.json) and [`src-tauri/tauri.conf.json`](./src-tauri/tauri.conf.json).
