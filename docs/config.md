# Configuration

## Paths on disk

| Path | Purpose |
|------|---------|
| `~/.config/cursor-workers/config.json` | Workspace definitions (required) |
| `~/.config/cursor-workers/env` | `CURSOR_API_KEY` (mode 600, required for auto-start) |
| `~/.local/share/cursor-workers/app/` | Installed application files (`install.sh` target) |
| `~/.local/share/cursor-workers/logs/` | Per-worker stdout/stderr logs |
| `~/.local/share/cursor-workers/state/` | Supervisor and worker PID files |
| `~/Library/LaunchAgents/com.cursor.workers.plist` | launchd LaunchAgent (created by `install`) |

Example templates live in the repo under `config/config.example.json` and `config/env.example`.

## config.json

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

### Top-level fields

| Field | Default | Description |
|-------|---------|-------------|
| `agentBin` | `"agent"` | Path to Cursor agent CLI binary |
| `defaults` | `{}` | Shared defaults applied to each workspace |
| `workspaces` | required | Non-empty array of workspace entries |

### Workspace fields

| Field | Required | Description |
|-------|----------|-------------|
| `path` | yes* | Single directory agents can read/write (usually a git repo) |
| `paths` | yes* | Multiple roots on one worker (multi-repo). Use instead of `path`. |
| `name` | no | Shows in Cursor dashboard; target via `worker=<name>` in Slack/GitHub |
| `id` | no | Local identifier for logs/status; auto-generated from path if omitted |
| `enabled` | no | `false` to skip this workspace (default `true`) |
| `pool` | no | `true` for Enterprise pool workers (overrides default) |
| `poolName` | no | Pool name when `pool: true` |
| `managementPort` | no | Prometheus metrics port; auto-assigned if omitted |
| `idleReleaseTimeout` | no | Passed through to `agent worker` |
| `verbose` | no | Verbose worker logging |

\* Each workspace needs either `path` or `paths`.

### Defaults

| Field | Default | Description |
|-------|---------|-------------|
| `pool` | `false` | Enterprise pool mode |
| `poolName` | `"default"` | Pool identifier |
| `managementPortBase` | `18080` | First auto-assigned metrics port |
| `idleReleaseTimeout` | `0` | Worker idle timeout |

Ports are assigned as `managementPortBase + index` unless a workspace sets `managementPort` explicitly.

## Authentication

**Use an API key for daemon mode.**

Auto-start runs via launchd at login with no browser and no interactive shell. Browser login (`agent login`) works for manual terminal use but is unreliable headless.

1. Create a key at [cursor.com/dashboard → Integrations](https://cursor.com/dashboard)
2. Run `cursor-workers setup` or write `~/.config/cursor-workers/env`:

   ```
   CURSOR_API_KEY=your_key_here
   ```

3. Verify with `cursor-workers auth check`

| Auth method | Good for |
|-------------|----------|
| **API key** (recommended) | launchd auto-start, unattended workers |
| Browser login | Manual `agent worker start` in a terminal only |

## My Machines vs Pool

### My Machines (default)

Personal workers on your Mac. A normal user API key works. Each workspace maps to one `agent worker start` process.

### Pool (`"pool": true`)

Enterprise fleet workers. Requires a [service account key](https://cursor.com/docs/cloud-agent/self-hosted-pool). Set `"pool": true` on a workspace or in `defaults`.

Fleet summary in `cursor-workers status` only appears with service account keys.

## Managing workspaces

```bash
cursor-workers workspace add ~/Code/my-repo
cursor-workers workspace add ~/Code/other --name my-mac-other
cursor-workers workspace list
cursor-workers workspace remove my-repo
```

After changing config, restart workers:

```bash
cursor-workers restart
```

If launchd is installed, the supervisor picks up changes on its next poll cycle (within ~30s) or after `cursor-workers restart`.
