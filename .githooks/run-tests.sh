#!/usr/bin/env bash
# Shared test runner for git hooks.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "git hook: Node.js not found. Install Node 20+ to run tests." >&2
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if (( NODE_MAJOR < 20 )); then
  echo "git hook: Node.js 20+ required (found $(node -v))." >&2
  echo "Run: nvm use 20" >&2
  exit 1
fi

echo "git hook: running npm test..."
npm test
