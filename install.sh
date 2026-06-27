#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${CURSOR_WORKERS_HOME:-$HOME/.local/share/cursor-workers/app}"
BIN_DIR="$HOME/.local/bin"

echo "Cursor Workers installer"
echo "========================"
echo ""

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Error: macOS is required (uses launchd LaunchAgents)." >&2
  exit 1
fi

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing dependency: $1" >&2
    return 1
  fi
}

if ! need node; then
  echo "Install Node.js 20+ from https://nodejs.org or via nvm." >&2
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if (( NODE_MAJOR < 20 )); then
  echo "Error: Node.js 20+ required (found $(node -v))." >&2
  exit 1
fi

if ! command -v agent >/dev/null 2>&1; then
  echo "Cursor agent CLI not found. Installing..."
  curl https://cursor.com/install -fsS | bash
fi

mkdir -p "$INSTALL_DIR" "$BIN_DIR"

if [[ "$REPO_DIR" != "$INSTALL_DIR" ]]; then
  echo "Installing to $INSTALL_DIR"
  rsync -a --delete \
    --exclude node_modules \
    --exclude .git \
    "$REPO_DIR/" "$INSTALL_DIR/"
else
  echo "Using repo directory: $INSTALL_DIR"
fi

cd "$INSTALL_DIR"
npm link --force >/dev/null 2>&1 || npm link

if [[ ! -x "$BIN_DIR/cursor-workers" ]] && [[ -f "$INSTALL_DIR/bin/cursor-workers.mjs" ]]; then
  ln -sf "$INSTALL_DIR/bin/cursor-workers.mjs" "$BIN_DIR/cursor-workers"
fi

echo ""
echo "Installed cursor-workers $(node "$INSTALL_DIR/bin/cursor-workers.mjs" --version 2>/dev/null || echo "")"

if [[ ! -f "$HOME/.config/cursor-workers/config.json" ]]; then
  echo ""
  echo "Running interactive setup..."
  cursor-workers setup
else
  echo ""
  echo "Existing config found. Skipping setup."
  echo "  cursor-workers workspace list"
  echo "  cursor-workers setup            # reconfigure"
fi

echo ""
echo "Done. Try:"
echo "  cursor-workers status"
echo "  cursor-workers install          # auto-start at login"
