#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

git config core.hooksPath .githooks
chmod +x .githooks/*

echo "Installed git hooks from .githooks/"
echo "  commit-msg  validate commit subject"
echo "  pre-push    run npm test before push"
echo ""
echo "Skip once with: git push --no-verify"
