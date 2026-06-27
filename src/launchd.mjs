import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ENV_PATH, LAUNCH_AGENT_LABEL, loadEnvFile } from "./config.mjs";

export function buildLaunchAgentPlist(cliPath, { home = os.homedir(), envPath = ENV_PATH } = {}) {
  const logDir = path.join(home, ".local", "share", "cursor-workers", "launchd");

  const pathEnv = [
    path.join(home, ".local", "bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
  ].join(":");

  if (!fs.existsSync(envPath)) {
    throw new Error(
      `Missing ${envPath}. Run: cursor-workers setup (API key required for auto-start).`,
    );
  }

  const envFile = loadEnvFile(envPath);
  const apiKey = envFile.CURSOR_API_KEY ?? "";
  if (!apiKey) {
    throw new Error(
      `Missing CURSOR_API_KEY in ${envPath}. Run: cursor-workers setup (API key required for auto-start).`,
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCH_AGENT_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${cliPath}</string>
    <string>supervise</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${path.join(logDir, "stdout.log")}</string>
  <key>StandardErrorPath</key>
  <string>${path.join(logDir, "stderr.log")}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${pathEnv}</string>
    <key>HOME</key>
    <string>${home}</string>
    <key>CURSOR_API_KEY</key>
    <string>${apiKey}</string>
  </dict>
</dict>
</plist>
`;
}
