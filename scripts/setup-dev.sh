#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

WITH_CLI=false
for arg in "$@"; do
  case "$arg" in
    --with-cli) WITH_CLI=true ;;
    -h|--help)
      cat <<EOF
Usage: ./scripts/setup-dev.sh [--with-cli]

One-time contributor setup for this clone:
  1. Install git hooks (commit-msg + pre-push tests)
  2. Run npm test to verify Node 20+ and the suite pass

Options:
  --with-cli   Also run ./install.sh (CLI wrapper + optional cursor-workers setup)

For dogfooding / launchd work, use --with-cli and then:
  cursor-workers setup
  cursor-workers auth check
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (try --help)" >&2
      exit 1
      ;;
  esac
done

echo "cursor-workers contributor setup"
echo "================================"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js not found. Install Node 20+ first." >&2
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if (( NODE_MAJOR < 20 )); then
  echo "Error: Node.js 20+ required (found $(node -v))." >&2
  echo "With nvm: nvm install 20 && nvm use 20" >&2
  exit 1
fi

echo "→ Git hooks"
"$REPO_ROOT/scripts/setup-git-hooks.sh"
echo ""

echo "→ Unit tests"
npm test
echo ""

if [[ "$WITH_CLI" == true ]]; then
  echo "→ CLI install (./install.sh)"
  "$REPO_ROOT/install.sh"
  echo ""
fi

echo "Done. You can contribute from this clone."
echo ""
echo "Next:"
echo "  npm test                         # before pushing (also runs via pre-push hook)"
if [[ "$WITH_CLI" == true ]]; then
  echo "  cursor-workers setup             # API key + workspaces (for dogfooding)"
else
  echo "  ./scripts/setup-dev.sh --with-cli   # optional: install CLI for dogfooding"
fi
echo "  See CONTRIBUTING.md"
