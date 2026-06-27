#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${CURSOR_WORKERS_HOME:-$HOME/.local/share/cursor-workers/app}"
DATA_DIR="$HOME/.local/share/cursor-workers"
NODE_PATH_FILE="$DATA_DIR/node-path"
BIN_DIR="$HOME/.local/bin"
WRAPPER_PATH="$BIN_DIR/cursor-workers"

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

NODE_BIN="$(command -v node)"
NODE_MAJOR="$("$NODE_BIN" -p "process.versions.node.split('.')[0]")"
if (( NODE_MAJOR < 20 )); then
  echo "Error: Node.js 20+ required (found $($NODE_BIN -v))." >&2
  echo "With nvm: nvm install 20 && nvm use 20, then re-run ./install.sh" >&2
  exit 1
fi

if ! command -v agent >/dev/null 2>&1; then
  echo "Cursor agent CLI not found. Installing..."
  curl https://cursor.com/install -fsS | bash
fi

mkdir -p "$INSTALL_DIR" "$BIN_DIR" "$DATA_DIR"

if [[ "$REPO_DIR" != "$INSTALL_DIR" ]]; then
  echo "Installing to $INSTALL_DIR"
  rsync -a --delete \
    --exclude node_modules \
    --exclude .git \
    "$REPO_DIR/" "$INSTALL_DIR/"
else
  echo "Using repo directory: $INSTALL_DIR"
fi

# Pin the Node binary used at install time so nvm/default version changes don't break the CLI.
echo "$NODE_BIN" > "$NODE_PATH_FILE"
echo "Pinned Node: $NODE_BIN ($("$NODE_BIN" -v))"

rm -f "$WRAPPER_PATH"
cat > "$WRAPPER_PATH" <<EOF
#!/usr/bin/env bash
set -euo pipefail
NODE="\$(cat "$NODE_PATH_FILE" 2>/dev/null || true)"
APP="$INSTALL_DIR"
if [[ -z "\$NODE" || ! -x "\$NODE" ]]; then
  echo "cursor-workers: pinned Node runtime missing. Re-run ./install.sh" >&2
  exit 1
fi
exec "\$NODE" "\$APP/bin/cursor-workers.mjs" "\$@"
EOF
chmod +x "$WRAPPER_PATH"
echo "Installed CLI wrapper: $WRAPPER_PATH"

# Remove npm link shims that shadow the wrapper when an old Node version is active.
if command -v npm >/dev/null 2>&1; then
  npm unlink -g cursor-workers >/dev/null 2>&1 || true
fi
for link in "$HOME/.nvm/versions/node"/v*/bin/cursor-workers; do
  [[ -L "$link" ]] && rm -f "$link"
done

export PATH="$BIN_DIR:$PATH"

echo ""
echo "Installed cursor-workers $("$NODE_BIN" "$INSTALL_DIR/bin/cursor-workers.mjs" --version 2>/dev/null || echo "")"

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
echo ""
echo "Tip: keep \$HOME/.local/bin early in PATH (before nvm shims)."
