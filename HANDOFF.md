# HANDOFF — cursor-workers

Paste this into a new chat opened in `~/Code/cursor-workers`.

## What this is

**cursor-workers** — unofficial macOS tool that keeps [Cursor Cloud Agent workers](https://cursor.com/docs/cloud-agent/my-machines) running via launchd. Wraps the official `agent worker` CLI with a supervisor, LaunchAgent auto-start, and a status CLI.

Not affiliated with Cursor.

## Stack

- Node.js 20+ (ES modules, no build step)
- macOS launchd LaunchAgent (`com.cursor.workers`)
- Cursor `agent` CLI (`curl https://cursor.com/install -fsS | bash`)

## Architecture

```
launchd (Login) → cursor-workers supervise
                      ↓
              spawns N × agent worker start
                      ↓
              outbound HTTPS to Cursor cloud
              tool calls run locally in workspace paths
```

| File | Role |
|------|------|
| `bin/cursor-workers.mjs` | CLI entry |
| `src/cli.mjs` | Commands |
| `src/config.mjs` | Load `config.json`, normalize workspaces → workers |
| `src/setup.mjs` | Interactive setup + `workspace add/list/remove` |
| `src/supervisor.mjs` | KeepAlive loop, restart crashed workers |
| `src/worker-process.mjs` | Spawn/stop `agent worker`, PID files |
| `src/status.mjs` | Status table, metrics scrape, fleet API |
| `install.sh` | macOS install: deps check, rsync to `~/.local/share/cursor-workers/app`, `npm link` |

## Config (user machine)

| Path | Purpose |
|------|---------|
| `~/.config/cursor-workers/config.json` | Workspace paths (only config format) |
| `~/.config/cursor-workers/env` | `CURSOR_API_KEY` (mode 600) |
| `~/.local/share/cursor-workers/logs/` | Per-worker logs |
| `~/.local/share/cursor-workers/state/` | PID files |
| `~/Library/LaunchAgents/com.cursor.workers.plist` | Created by `install` |

### config.json shape

```json
{
  "agentBin": "agent",
  "defaults": {
    "pool": false,
    "managementPortBase": 18080
  },
  "workspaces": [
    {
      "id": "mtg-collection",
      "path": "~/Code/mtg-collection",
      "name": "mtg-mac",
      "managementPort": 18081,
      "enabled": true
    }
  ]
}
```

- `path` — directory agents can work in (usually a git repo)
- `paths` — optional multi-repo worker (array)
- `name` — Cursor dashboard name; target via `worker=<name>` in Slack/GitHub
- `pool: true` — Enterprise pool workers (service account key only)

**No legacy support.** Only `config.json` + `workspaces` array. No `workers.json`.

## Auth decision

**API key only for daemon mode.** Browser login (`agent login`) does not work headless at login.

- Key from [cursor.com/dashboard → Integrations](https://cursor.com/dashboard)
- Stored in `~/.config/cursor-workers/env`
- `install` requires the env file to exist

## CLI

```bash
./install.sh                          # first-time install
cursor-workers setup                  # wizard: API key + paths
cursor-workers workspace add <path>   # add path
cursor-workers workspace list
cursor-workers auth check             # preflight
cursor-workers install                # launchd auto-start
cursor-workers status [--json]
cursor-workers logs <id>
cursor-workers debug [id]
cursor-workers stop | restart
cursor-workers uninstall
```

## Current state (Jun 2026)

- Repo at `~/Code/cursor-workers`, git initialized, **not committed or pushed**
- Intended GitHub: `cozyrimz/cursor-workers` (in `package.json`, repo not created yet)
- Dogfooding on Sarim's Mac with one workspace: `~/Code/mtg-collection` (`mtg-mac`)
- `npm link` installed; launchd **not** installed yet (`cursor-workers install` not run)
- API key env file may still need to be created via `cursor-workers setup`

## Known implementation notes

- `cursor-workers start` detaches workers (`child.unref()`) so CLI exits immediately
- Supervisor re-spawns workers every 30s if dead; 5s delay after crash
- `managementPort` enables local Prometheus metrics at `/metrics`
- Fleet summary in `status` only works with service account keys (Enterprise pool)

## Starter prompt for new chat

```
@HANDOFF.md @README.md

Working on cursor-workers (macOS daemon for Cursor cloud agent workers).

Goal: [your task — e.g. publish to GitHub, dogfood install, add tests, fix X]

Constraints:
- Node 20+ ESM, no build step
- API key auth for launchd (no browser login)
- config.json workspaces only, no legacy formats
- macOS only (launchd)
```

## Likely next steps

1. `git commit` + create public GitHub repo + push
2. Run `cursor-workers setup` → `auth check` → `install` to dogfood
3. Add workspace for `cursor-workers` repo itself (meta dogfood)
4. Optional: GitHub Actions smoke test, `--version` in install.sh check
