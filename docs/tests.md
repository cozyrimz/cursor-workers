# Tests

cursor-workers uses Node's built-in test runner (`node:test`). No extra test dependencies.

## Run locally

```bash
npm test
```

Requires Node.js 20+ (same as the app).

## What is covered

| Area | File | Focus |
|------|------|-------|
| Config normalization | `test/config.test.mjs` | `slugify`, `expandHome`, `normalizeConfig`, `loadConfig`, env helpers (`applyApiKeyEnv`), port assignment, pinned Node |
| Worker CLI args | `test/worker-process.test.mjs` | `buildWorkerArgs`, PID helpers, `isRunning`, `stopWorker` edge cases |
| Supervisor state | `test/supervisor.test.mjs` | Supervisor PID file, staggered worker starts |
| Status output | `test/status.test.mjs` | Prometheus parsing, status table/JSON formatting |
| launchd plist | `test/launchd.test.mjs` | LaunchAgent XML structure and env sourcing |
| Workspace CRUD | `test/setup.test.mjs` | `addWorkspace`, `removeWorkspace` |
| CLI entrypoint | `test/cli.test.mjs` | `--version`, `--help` smoke tests |

Tests use temporary directories — they do not touch `~/.config/cursor-workers` or running workers.

## Adding tests

1. Put new test files in `test/` as `*.test.mjs`
2. Reuse helpers from `test/lib/helpers.mjs` for temp dirs and sample config
3. Prefer testing pure functions and file-based logic over live `agent` or launchd calls
4. **Regression tests:** every bug fix should add a test that fails without the fix (see `.cursor/rules/regression-tests.mdc`)
5. Run `npm test` before opening a PR

### Patterns

**Temp workspace + config path**

```javascript
import { createTempDir, makeWorkspaceDir, removeTempDir, sampleRawConfig } from "./lib/helpers.mjs";
import { loadConfig, writeConfig } from "../src/config.mjs";

const root = createTempDir();
try {
  const workspace = makeWorkspaceDir(root);
  const configPath = `${root}/config.json`;
  writeConfig(sampleRawConfig(workspace), configPath);
  const config = loadConfig(configPath);
  // assertions...
} finally {
  removeTempDir(root);
}
```

**Optional path parameters**

Several modules accept explicit paths for testability (`configPath`, `pidPath`, `envPath`, etc.). Use those instead of mocking `os.homedir()`.

## CI

GitHub Actions runs `npm test` on every push to `main` and on pull requests (`.github/workflows/test.yml`).

## Git hooks

Optional but recommended locally:

```bash
./scripts/setup-dev.sh
```

- **commit-msg** — validates commit subject line
- **pre-push** — runs `npm test` before push

See [git-hooks.md](git-hooks.md).

## Not covered (manual)

- Live `agent worker` spawn/stop
- launchd install/bootstrap
- Cursor API / fleet summary fetch
- Interactive `cursor-workers setup` prompts

See [CONTRIBUTING.md](../CONTRIBUTING.md) for manual verification steps.
