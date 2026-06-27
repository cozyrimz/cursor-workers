# cursor-workers

Keep [Cursor Cloud Agent workers](https://cursor.com/docs/cloud-agent/my-machines) running on your Mac — auto-start at login, workspace config, status CLI.

> Unofficial community tool. Not affiliated with Cursor.

## Prerequisites

Install these before `./install.sh`:

**Node.js 20+**

```bash
# Option A: nvm (recommended if you switch Node versions)
nvm install 20
nvm use 20

# Option B: direct install
# https://nodejs.org
```

**Cursor agent CLI**

```bash
curl https://cursor.com/install -fsS | bash
agent --version
```

`install.sh` will install the agent CLI automatically if it's missing.

## Quick start

**Requires:** macOS and the prerequisites above.

`install.sh` must run once with Node 20+ on PATH. It pins that Node binary and installs a wrapper at `~/.local/bin/cursor-workers`, so later nvm version switches won't break the CLI.

```bash
git clone https://github.com/cozyrimz/cursor-workers.git
cd cursor-workers
./install.sh
cursor-workers setup          # API key + workspace paths
cursor-workers auth check     # verify key works
cursor-workers install        # auto-start at login
cursor-workers status
```

Use an **API key** (not browser login) for unattended auto-start. Create one at [cursor.com/dashboard → Integrations](https://cursor.com/dashboard). The setup wizard saves it to `~/.config/cursor-workers/env`.

## Everyday commands

```bash
cursor-workers workspace add ~/Code/my-repo
cursor-workers workspace list
cursor-workers status
cursor-workers logs <workspace-id>
cursor-workers restart
```

## Uninstall

```bash
cursor-workers uninstall
rm -rf ~/.local/share/cursor-workers
```

## Docs

| Doc | For |
|-----|-----|
| [Configuration](docs/config.md) | `config.json`, paths, auth, pool workers |
| [CLI reference](docs/cli.md) | All commands and flags |
| [Architecture](docs/architecture.md) | How launchd, supervisor, and workers fit together |
| [Contributing](CONTRIBUTING.md) | Development setup and PR guidelines |
| [AGENTS.md](AGENTS.md) | Context for AI agents working in this repo |

## License

MIT
