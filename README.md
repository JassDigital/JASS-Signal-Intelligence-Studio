# JASS Signal Intelligence Studio

**Version 0.1.0 foundation** — Windows-first, local-first global intelligence workspace.

## Current scope

- Electron + React + Vite desktop application.
- SQLite local database and migration marker.
- Situation Room, Signals, Sources, Watchlist, Timeline and Settings.
- Local event/source/topic management, search, severity filtering and local settings.
- Optional Ollama/LM Studio configuration fields; no AI calls are made in v0.1.
- Demonstration records are explicitly labelled and are not live intelligence.

## Requirements

- Windows 10/11 (64-bit)
- Node.js 22 LTS recommended
- npm
- Build tools may be required if `better-sqlite3` needs a native rebuild.

## Run in PowerShell

```powershell
cd D:\Github\JASS-Signal-Intelligence-Studio
npm install
npm test
npm run dev
```

Build the renderer:

```powershell
npm run build
```

Package the Windows installer:

```powershell
npm run dist:win
```

Installer output is written to `release\`.

## Local data

The SQLite database is created at Electron's per-user application-data location:
`%APPDATA%\jass-signal-intelligence-studio\jass-signal.sqlite` (Electron may normalize the application directory name based on platform conventions).

Do not put personal data, SQLite files, secrets, `node_modules`, or release artifacts in Git.

## Important limitations in v0.1

- No live RSS/API collection.
- No production world map or 3D globe.
- No automated alerts or cross-source correlation.
- AI settings are stored locally but no model calls are made.
- Source definitions are configuration only and are not fetched.

## Security notes

The renderer uses context isolation, disables Node integration, and communicates through a narrow preload bridge. Validate any new IPC handlers and keep remote content out of the privileged renderer. Open external URLs only through a controlled main-process allowlist.

## Development checkpoint

A01–A03 foundation scaffold. Run tests and a packaged Windows smoke test before declaring a release complete.
