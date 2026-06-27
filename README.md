# cursor-workers

Keep [Cursor Cloud Agent workers](https://cursor.com/docs/cloud-agent/my-machines) running on your Mac — auto-start at login, easy workspace config, status CLI.

> Unofficial community tool. Not affiliated with Cursor.

## Why API key (not browser login)?

**Use an API key for this project.** Auto-start runs via launchd at login with no browser and no shell profile. Browser login (`agent login`) works for interactive sessions but is unreliable for headless daemons.

Create a key at [cursor.com/dashboard → Integrations](https://cursor.com/dashboard). The setup wizard stores it in `~/.config/cursor-workers/env` (mode 600).

| Auth | Good for |
|------|----------|
| **API key** (recommended) | launchd auto-start, unattended workers |
| Browser login | Manual `agent worker start` in a terminal only |

## Install

```bash
git clone https://github.com/cozyrimz/cursor-workers.git
cd cursor-workers
chmod +x install.sh
./install.sh
```

Or from an existing clone:

```bash
./install.sh
```

Requires macOS, Node.js 20+, and the [Cursor agent CLI](https://cursor.com/install) (`agent`).

## Setup

Interactive wizard (API key + workspace paths):

```bash
cursor-workers setup
```

Add paths later without re-running full setup:

```bash
cursor-workers workspace add ~/Code/my-repo
cursor-workers workspace add ~/Code/other --name my-mac-other
cursor-workers workspace list
cursor-workers workspace remove my-repo
```

## Enable auto-start

```bash
cursor-workers auth check    # verify API key + visibility
cursor-workers install       # launchd LaunchAgent
cursor-workers status
```

## Config

`~/.config/cursor-workers/config.json`

```json
{
  "agentBin": "agent",
  "defaults": {
    "pool": false,
    "managementPortBase": 18080
  },
  "workspaces": [
    {
      "path": "~/Code/my-app",
      "name": "macbook-my-app",
      "enabled": true
    },
    {
      "paths": ["~/Code/backend", "~/Code/shared-lib"],
      "name": "macbook-fullstack",
      "enabled": true
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `path` | Directory agents can read/write (usually a git repo) |
| `paths` | Multiple roots on one worker (multi-repo) |
| `name` | Shows in Cursor dashboard; use `worker=<name>` in Slack/GitHub |
| `pool` | `true` for Enterprise pool workers (service account key) |
| `managementPortBase` | Auto-assigns metrics ports per workspace |

## CLI

```bash
cursor-workers setup
cursor-workers install | uninstall
cursor-workers status [--json]
cursor-workers workspace list|add|remove
cursor-workers auth check
cursor-workers logs <id>
cursor-workers debug [id]
cursor-workers start | stop | restart
```

## My Machines vs Pool

- **My Machines** (default): personal workers on your Mac. User API key works.
- **Pool** (`"pool": true`): Enterprise fleet. Requires a [service account key](https://cursor.com/docs/cloud-agent/self-hosted-pool).

## Files

| Path | Purpose |
|------|---------|
| `~/.config/cursor-workers/config.json` | Workspace paths |
| `~/.config/cursor-workers/env` | `CURSOR_API_KEY` |
| `~/Library/LaunchAgents/com.cursor.workers.plist` | launchd agent |
| `~/.local/share/cursor-workers/logs/` | Worker logs |

## Uninstall

```bash
cursor-workers uninstall
npm unlink -g cursor-workers
rm -rf ~/.local/share/cursor-workers/app
```

## License

MIT
