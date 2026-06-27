# Git hooks

Project hooks live in `.githooks/`. Enable them once per clone:

```bash
./scripts/setup-dev.sh
```

This installs hooks and runs `npm test`. Use `./scripts/setup-git-hooks.sh` only if you need hooks without the full dev check.

## Hooks

| Hook | When | What |
|------|------|------|
| `commit-msg` | Every commit | Subject line length, clarity, capital letter |
| `pre-push` | Before `git push` | `npm test` (Node 20+) |

Tests run on **push**, not on every commit — so local WIP commits stay fast, but broken code can't reach the remote without `--no-verify`.

CI (GitHub Actions) still runs on every push/PR as the backstop for clones without hooks installed.

## Bypass

Emergency only:

```bash
git push --no-verify
```

Do not use routinely; CI will still fail on bad code.

## Requirements

- Node.js 20+ on PATH when pushing
- Run `./scripts/setup-dev.sh` once after clone
