# Contributing

Thanks for helping improve cursor-workers. This is a small Node.js CLI with no build step — changes should stay focused and easy to review.

## Prerequisites

- macOS (launchd is required for the full daemon flow)
- Node.js 20+
- [Cursor agent CLI](https://cursor.com/install) (`agent`)
- A Cursor API key from [cursor.com/dashboard → Integrations](https://cursor.com/dashboard)

## Development setup

```bash
git clone https://github.com/cozyrimz/cursor-workers.git
cd cursor-workers
npm link                     # symlink cursor-workers into PATH
cursor-workers setup         # local config + API key (optional for code-only changes)
```

To test against the installed copy (mirrors what `install.sh` does):

```bash
./install.sh
```

The install script rsyncs the repo to `~/.local/share/cursor-workers/app` and links the global binary there.

## Project layout

```
bin/cursor-workers.mjs   CLI entry
src/cli.mjs              Commands and launchd integration
src/config.mjs           Config load/normalize
src/setup.mjs            Setup wizard and workspace management
src/supervisor.mjs       Worker supervisor loop
src/worker-process.mjs   agent worker spawn/stop
src/status.mjs           Status, metrics, debug
install.sh               macOS installer
config/                  Example config and env files
docs/                    Detailed reference docs
```

See [docs/architecture.md](docs/architecture.md) for how the pieces connect.

## Conventions

- **ES modules** — `import`/`export`, `"type": "module"` in `package.json`
- **No build step** — run `.mjs` files directly with Node 20+
- **No runtime dependencies** — stdlib only
- **Config:** only `config.json` + `workspaces` array; do not add legacy format support
- **Auth:** daemon/launchd path assumes API key in `~/.config/cursor-workers/env`
- **macOS only** — guard platform-specific code; don't add cross-platform daemon abstractions unless explicitly scoped

## Manual testing

There is no automated test suite yet. Verify changes manually:

```bash
node --version                          # must be 20+
cursor-workers workspace list
cursor-workers auth check
cursor-workers debug
cursor-workers status
cursor-workers start && cursor-workers status
cursor-workers stop
```

For launchd integration:

```bash
cursor-workers install
launchctl print gui/$(id -u)/com.cursor.workers
cursor-workers status
cursor-workers uninstall
```

## Pull requests

1. Fork and branch from `main`
2. Keep PRs focused — one concern per PR when possible
3. Update docs if you change CLI behavior, config shape, or install flow
4. Describe manual testing in the PR body

## Docs

- **README.md** — short user-facing overview; don't bloat it
- **AGENTS.md** — agent entry point and source map
- **docs/** — detailed reference (config, CLI, architecture)

When adding features, update the relevant doc in `docs/` and add a one-line pointer in README or AGENTS.md if needed.

## Questions

Open a [GitHub issue](https://github.com/cozyrimz/cursor-workers/issues) for bugs, feature ideas, or design questions before large changes.
