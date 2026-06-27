# AGENTS.md

Context for AI agents working in **cursor-workers** — an unofficial macOS tool that keeps [Cursor Cloud Agent workers](https://cursor.com/docs/cloud-agent/my-machines) running via launchd.

## Read first

| Topic | Doc |
|-------|-----|
| System design, module map, supervisor behavior | [docs/architecture.md](docs/architecture.md) |
| `config.json`, disk paths, auth, pool vs my-machines | [docs/config.md](docs/config.md) |
| CLI commands | [docs/cli.md](docs/cli.md) |
| Dev setup, conventions, PRs | [CONTRIBUTING.md](CONTRIBUTING.md) |
| User-facing quick start | [README.md](README.md) |

## What this repo does

Wraps the official `agent worker` CLI with:

1. **Setup wizard** — API key + workspace paths
2. **Supervisor** — keeps workers alive, restarts on crash
3. **launchd LaunchAgent** — auto-start at login (`com.cursor.workers`)
4. **Status CLI** — table/JSON status, logs, debug preflight

```
launchd (Login) → cursor-workers supervise
                      ↓
              spawns N × agent worker start
                      ↓
              outbound HTTPS to Cursor cloud
              tool calls run locally in workspace paths
```

## Stack & constraints

- **Node.js 20+**, ES modules, **no build step**
- **macOS only** — uses launchd LaunchAgents
- **API key auth for daemon mode** — browser login (`agent login`) does not work headless at login
- **Config format:** `~/.config/cursor-workers/config.json` with a `workspaces` array only — **no legacy `workers.json` support**
- **Install target:** `install.sh` rsyncs to `~/.local/share/cursor-workers/app` and installs a bash wrapper at `~/.local/bin/cursor-workers` that uses a pinned Node path (`~/.local/share/cursor-workers/node-path`)

## Source map

| File | Role |
|------|------|
| `bin/cursor-workers.mjs` | CLI entry (re-exports `src/cli.mjs`) |
| `src/cli.mjs` | Command routing, launchd plist install/uninstall |
| `src/config.mjs` | Load/normalize `config.json`, env file helpers |
| `src/setup.mjs` | Interactive setup, `workspace add/list/remove` |
| `src/supervisor.mjs` | KeepAlive loop, restart crashed workers |
| `src/worker-process.mjs` | Spawn/stop `agent worker`, PID files |
| `src/status.mjs` | Status table, metrics scrape, fleet API |
| `install.sh` | macOS install script |

## Implementation notes

- `cursor-workers start` detaches workers (`child.unref()`) so the CLI exits immediately
- Supervisor polls every 30s; 5s delay after a worker crash before restart
- `managementPort` per workspace enables local Prometheus metrics at `/metrics`
- Fleet summary in `status` only works with service account keys (Enterprise pool)
- launchd plist sources `~/.config/cursor-workers/env` before running `cursor-workers supervise`

## Working in this repo

1. Read [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup
2. Match existing patterns — plain Node ESM, minimal dependencies, no transpiler
3. Keep user docs in `README.md` short; put detail in `docs/`
4. Do not reintroduce legacy config formats or browser-login-as-daemon assumptions
