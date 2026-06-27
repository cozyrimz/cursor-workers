# Architecture

## Overview

cursor-workers is a thin supervisor around the official Cursor `agent worker` CLI. It does not implement agent logic itself — it keeps worker processes running and wires them into macOS auto-start.

```
┌─────────────────────────────────────────────────────────┐
│  launchd LaunchAgent (com.cursor.workers)               │
│  RunAtLoad + KeepAlive                                  │
└────────────────────┬────────────────────────────────────┘
                     │ exec cursor-workers supervise
                     ▼
┌─────────────────────────────────────────────────────────┐
│  supervisor.mjs                                         │
│  - writes supervisor.pid                                │
│  - every 30s: ensure each enabled worker is running     │
│  - 5s backoff after crash before restart                │
└────────────────────┬────────────────────────────────────┘
                     │ spawn per workspace
                     ▼
┌─────────────────────────────────────────────────────────┐
│  worker-process.mjs                                     │
│  agent worker start --dir <path> [--name ...]           │
│  - PID file per worker in state/                        │
│  - stdout/stderr → logs/<id>.log                        │
└────────────────────┬────────────────────────────────────┘
                     │ outbound HTTPS
                     ▼
              Cursor cloud agent service
                     │ tool calls
                     ▼
              Local workspace directories
```

## Modules

### `src/cli.mjs`

Command router. Handles user-facing commands and launchd plist generation/install.

- `install` / `uninstall` — write/remove `~/Library/LaunchAgents/com.cursor.workers.plist`, bootstrap/bootout via `launchctl`
- `supervise` — entry point for launchd; delegates to `supervisor.mjs`
- `start` / `stop` / `restart` — manual control without launchd
- `status`, `logs`, `debug`, `auth check` — observability

The launchd plist runs `<cli-path> supervise` directly (not via a shell wrapper) so macOS Login Items shows **cursor-workers** instead of **zsh**. `CURSOR_API_KEY` is copied from `~/.config/cursor-workers/env` into the plist `EnvironmentVariables` at install time.

### `src/config.mjs`

Loads `~/.config/cursor-workers/config.json`, normalizes the `workspaces` array into internal worker objects, validates paths exist.

Each workspace becomes a worker with:

- `id` — slug from path (or explicit `id`)
- `name` — Cursor dashboard name
- `workerDir` / `workerDirs` — one or more local directories
- `managementPort` — auto-assigned from `defaults.managementPortBase + index`
- `pool` — Enterprise pool flag

Throws if `workspaces` is missing/empty or paths don't exist.

### `src/setup.mjs`

Interactive wizard and workspace CRUD:

- Prompts for API key → writes `env` (mode 600)
- Prompts for workspace paths → merges into `config.json`
- `workspace add/remove/list` — non-interactive path management

### `src/supervisor.mjs`

Long-running loop used by `cursor-workers supervise`:

1. Write PID to `~/.local/share/cursor-workers/state/supervisor.pid`
2. Start all enabled workers
3. Poll every 30 seconds; restart any worker whose PID is dead
4. Wait 5 seconds after detecting a crash before restart

### `src/worker-process.mjs`

Spawns `agent worker start` with flags derived from the normalized worker config:

- `--dir` for primary workspace
- Additional dirs via worker config when multi-repo
- `--name`, `--management-port`, pool flags as configured

Workers are detached (`child.unref()`) so one-shot `cursor-workers start` can exit while processes keep running.

PID files: `~/.local/share/cursor-workers/state/<id>.pid`

Logs: `~/.local/share/cursor-workers/logs/<id>.log`

### `src/status.mjs`

Builds status reports:

- Local PID + process liveness
- Optional Prometheus scrape from `http://127.0.0.1:<managementPort>/metrics`
- Fleet API summary (Enterprise service account keys only)
- `runWorkerDebug` — preflight used by `debug` and `auth check`

## Install flow

`install.sh`:

1. Verify macOS + Node 20+ + `agent` CLI
2. `rsync` repo to `~/.local/share/cursor-workers/app`
3. Pin the Node binary to `~/.local/share/cursor-workers/node-path`
4. Install `~/.local/bin/cursor-workers` wrapper (exec pinned Node + app entrypoint)
5. Remove stale `npm link` shims from nvm
6. Run `cursor-workers setup` if no config exists

The wrapper insulates the CLI from nvm default version changes. launchd invokes the same wrapper path.

Runtime state lives outside the install dir under `~/.config/cursor-workers/` and `~/.local/share/cursor-workers/`.

## Design decisions

| Decision | Rationale |
|----------|-----------|
| API key only for daemon | Browser login needs a GUI session; launchd runs headless at login |
| No legacy `workers.json` | Single config format reduces maintenance and agent confusion |
| Supervisor separate from launchd KeepAlive | launchd keeps the supervisor alive; supervisor keeps individual workers alive and handles config-driven worker count |
| rsync install dir | Stable path for launchd plist regardless of where the git clone lives |
| No npm dependencies | Small attack surface; easy to audit; no build step |
