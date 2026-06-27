# CLI reference

```bash
cursor-workers [--version | --help]
```

## Setup & install

| Command | Description |
|---------|-------------|
| `setup` | Interactive wizard: API key + workspace paths |
| `install` | Install launchd LaunchAgent (auto-start at login) |
| `uninstall` | Stop workers, remove launchd agent |

`install` requires a valid API key in `~/.config/cursor-workers/env` and at least one enabled workspace in config.

## Workspaces

| Command | Description |
|---------|-------------|
| `workspace list` | List configured workspaces |
| `workspace add <path> [--name <name>]` | Add a workspace directory |
| `workspace remove <id-or-path>` | Remove a workspace |

## Runtime control

| Command | Description |
|---------|-------------|
| `start` | Start all enabled workers (detached) |
| `stop` | Stop all workers |
| `restart` | Stop then start all workers |
| `supervise` | Run supervisor loop (used by launchd, not typically manual) |

## Observability

| Command | Description |
|---------|-------------|
| `status [--json]` | Worker and supervisor status table or JSON |
| `logs <workspace-id> [lines]` | Tail worker log (default 50 lines) |
| `debug [workspace-id]` | Run agent worker preflight (JSON output) |
| `auth check` | Verify API key and worker visibility |

## Examples

```bash
# First-time setup
./install.sh
cursor-workers setup
cursor-workers auth check
cursor-workers install
cursor-workers status

# Add a repo later
cursor-workers workspace add ~/Code/new-project --name sarim-mac-new-project
cursor-workers restart

# Debug a specific workspace
cursor-workers debug my-project

# JSON status for scripting
cursor-workers status --json
```

## Exit codes

Commands exit non-zero on:

- Missing or invalid config
- Missing API key when required
- Unknown workspace id
- Failed `auth check` (worker not visible to Cursor)

## Global flags

| Flag | Description |
|------|-------------|
| `--version`, `-v` | Print version |
| `--help`, `-h` | Print usage |
