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
./install.sh                 # pins Node 20+, installs ~/.local/bin wrapper
cursor-workers setup         # local config + API key (optional for code-only changes)
```

Use `./install.sh` for development — it rsyncs to `~/.local/share/cursor-workers/app` and installs the CLI wrapper. Avoid `npm link` (it ties the command to whichever Node version is active).

Enable git hooks (commit message check + tests before push):

```bash
./scripts/setup-git-hooks.sh
```

See [docs/git-hooks.md](docs/git-hooks.md).

## Project layout

```
bin/cursor-workers.mjs   CLI entry
src/cli.mjs              Commands and launchd integration
src/config.mjs           Config load/normalize
src/launchd.mjs          LaunchAgent plist generation
src/setup.mjs            Setup wizard and workspace management
src/supervisor.mjs       Worker supervisor loop
src/worker-process.mjs   agent worker spawn/stop
src/status.mjs           Status, metrics, debug
install.sh               macOS installer
test/                    Unit tests (*.test.mjs)
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

## Tests (required)

**All changes must include or update unit tests and pass `npm test`.**

```bash
npm test
```

See [docs/tests.md](docs/tests.md) for coverage details, patterns, and how to add tests.

CI runs the same suite on every push and pull request. Local clones should enable git hooks (`./scripts/setup-git-hooks.sh`) so `pre-push` runs tests before code leaves your machine.

PRs with failing tests will not be merged.

## Manual testing

Automated tests cover config, worker args, status formatting, launchd plist generation, and workspace CRUD. Also verify integration behavior manually when touching runtime or install flows:

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
3. **Run `npm test` and include new/updated tests for behavior changes**
4. Update docs if you change CLI behavior, config shape, or install flow
5. Describe manual testing in the PR body when relevant

## Docs

- **README.md** — short user-facing overview; don't bloat it
- **AGENTS.md** — agent entry point and source map
- **docs/** — detailed reference (config, CLI, architecture, tests)

When adding features, update the relevant doc in `docs/` and add a one-line pointer in README or AGENTS.md if needed.

## Questions

Open a [GitHub issue](https://github.com/cozyrimz/cursor-workers/issues) for bugs, feature ideas, or design questions before large changes.
