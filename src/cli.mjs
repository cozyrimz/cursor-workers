import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  CONFIG_DIR,
  CONFIG_PATH,
  ENV_PATH,
  LAUNCH_AGENT_PATH,
  ensureDirs,
  hasApiKey,
  loadConfig,
  resolveCliPath,
} from "./config.mjs";
import {
  formatStatusJson,
  formatStatusTable,
  getAllStatus,
  runWorkerDebug,
} from "./status.mjs";
import { buildLaunchAgentPlist } from "./launchd.mjs";
import { addWorkspace, listWorkspaces, removeWorkspace, runSetup } from "./setup.mjs";
import { readSupervisorPid, startAll, stopAll, supervise } from "./supervisor.mjs";
import { isRunning } from "./worker-process.mjs";

const ROOT = path.dirname(path.dirname(import.meta.url.replace("file://", "")));
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;

function usage() {
  console.log(`cursor-workers ${VERSION} — keep Cursor cloud workers running on macOS

Usage:
  cursor-workers setup                Interactive setup (API key + workspace paths)
  cursor-workers install              Install launchd agent (auto-start at login)
  cursor-workers uninstall            Remove launchd agent
  cursor-workers status [--json]      Show worker status
  cursor-workers workspace list       List configured workspace paths
  cursor-workers workspace add <path> Add a workspace
  cursor-workers workspace remove <id> Remove a workspace
  cursor-workers auth check           Verify API key + worker visibility
  cursor-workers logs <id>            Tail worker log
  cursor-workers debug [id]           Run agent worker preflight
  cursor-workers start|stop|restart   Control workers manually

Config: ${CONFIG_PATH}
Env:    ${ENV_PATH}
Docs:   https://cursor.com/docs/cloud-agent/my-machines
`);
}

function installLaunchAgent() {
  if (!hasApiKey()) {
    throw new Error("API key required. Run: cursor-workers setup");
  }

  const cliPath = resolveCliPath();
  if (!fs.existsSync(cliPath)) {
    throw new Error(`CLI not found at ${cliPath}. Re-run ./install.sh`);
  }
  const plist = buildLaunchAgentPlist(cliPath);
  fs.mkdirSync(path.dirname(LAUNCH_AGENT_PATH), { recursive: true });
  fs.writeFileSync(LAUNCH_AGENT_PATH, plist);

  spawnSync("launchctl", ["bootout", `gui/${process.getuid()}`, LAUNCH_AGENT_PATH], {
    encoding: "utf8",
  });

  const load = spawnSync("launchctl", ["bootstrap", `gui/${process.getuid()}`, LAUNCH_AGENT_PATH], {
    encoding: "utf8",
  });

  if (load.status !== 0) {
    console.error(load.stderr || load.stdout);
    process.exit(1);
  }

  console.log(`Installed launch agent: ${LAUNCH_AGENT_PATH}`);
  console.log(`Using API key from: ${ENV_PATH}`);
  console.log("Workers will start at login and stay running.");
}

function uninstallLaunchAgent() {
  spawnSync("launchctl", ["bootout", `gui/${process.getuid()}`, LAUNCH_AGENT_PATH], {
    encoding: "utf8",
  });
  fs.rmSync(LAUNCH_AGENT_PATH, { force: true });
  console.log("Removed launch agent.");
}

function tailLog(file, lines = 50) {
  if (!fs.existsSync(file)) {
    console.error(`Log not found: ${file}`);
    process.exit(1);
  }
  const content = fs.readFileSync(file, "utf8").split("\n");
  console.log(content.slice(-lines).join("\n"));
}

function authCheck(config) {
  const worker = config.workers[0];
  const report = runWorkerDebug(config, worker);
  const auth = report.auth ?? {};
  const identity = report.identity ?? {};
  const visibility = report.visibilityProbe ?? {};

  console.log("\nAuth check");
  console.log("=".repeat(40));
  console.log(`API key in env file: ${hasApiKey() ? "yes" : "no"}`);
  console.log(`Auth method:         ${auth.method ?? "unknown"}`);
  console.log(`Identity:            ${identity.status === "ok" ? identity.email ?? "ok" : identity.status ?? "unknown"}`);
  console.log(`Worker visible:      ${visibility.status ?? "unknown"}`);
  if (visibility.status !== "ok") {
    console.log("\nFix: run cursor-workers setup and confirm your API key at cursor.com/dashboard → Integrations");
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  if (args[0] === "--version" || args[0] === "-v") {
    console.log(VERSION);
    return;
  }

  const [command, subcommand, ...rest] = args;

  switch (command) {
    case "setup":
      await runSetup();
      return;

    case "install":
      loadConfig();
      installLaunchAgent();
      return;

    case "uninstall":
      stopAll(loadConfig());
      uninstallLaunchAgent();
      return;

    case "supervise": {
      const config = loadConfig();
      ensureDirs(config);
      supervise(config);
      return;
    }

    case "start": {
      const config = loadConfig();
      ensureDirs(config);
      console.log(`Started ${startAll(config)} worker(s).`);
      return;
    }

    case "stop": {
      const config = loadConfig();
      console.log(`Stopped ${stopAll(config)} worker(s).`);
      return;
    }

    case "restart": {
      const config = loadConfig();
      stopAll(config);
      console.log(`Restarted ${startAll(config)} worker(s).`);
      return;
    }

    case "status": {
      const config = loadConfig();
      const report = await getAllStatus(config);
      const supervisorPid = readSupervisorPid();
      report.supervisor = {
        pid: supervisorPid,
        running: isRunning(supervisorPid),
      };
      if (rest.includes("--json") || args.includes("--json")) {
        console.log(formatStatusJson(report));
      } else {
        console.log(formatStatusTable(report));
        console.log(
          `Supervisor: ${report.supervisor.running ? `running (pid ${report.supervisor.pid})` : "stopped"}`,
        );
      }
      return;
    }

    case "workspace": {
      if (subcommand === "list") {
        listWorkspaces();
        return;
      }
      if (subcommand === "add") {
        const rawPath = rest[0];
        if (!rawPath) {
          console.error("Usage: cursor-workers workspace add <path> [--name <name>]");
          process.exit(1);
        }
        const nameFlag = rest.indexOf("--name");
        const name = nameFlag >= 0 ? rest[nameFlag + 1] : undefined;
        addWorkspace(rawPath, { name });
        return;
      }
      if (subcommand === "remove") {
        const id = rest[0];
        if (!id) {
          console.error("Usage: cursor-workers workspace remove <id-or-path>");
          process.exit(1);
        }
        removeWorkspace(id);
        return;
      }
      console.error("Usage: cursor-workers workspace list|add|remove");
      process.exit(1);
    }

    case "auth": {
      if (subcommand !== "check") {
        console.error("Usage: cursor-workers auth check");
        process.exit(1);
      }
      authCheck(loadConfig());
      return;
    }

    case "logs": {
      const config = loadConfig();
      const workerId = subcommand;
      if (!workerId) {
        console.error("Usage: cursor-workers logs <workspace-id>");
        process.exit(1);
      }
      if (!config.workers.find((item) => item.id === workerId)) {
        console.error(`Unknown workspace: ${workerId}`);
        process.exit(1);
      }
      tailLog(path.join(config.logDir, `${workerId}.log`), Number(rest[0]) || 50);
      return;
    }

    case "debug": {
      const config = loadConfig();
      const worker = subcommand
        ? config.workers.find((item) => item.id === subcommand)
        : config.workers[0];
      if (!worker) {
        console.error(subcommand ? `Unknown workspace: ${subcommand}` : "No workspaces configured.");
        process.exit(1);
      }
      console.log(JSON.stringify(runWorkerDebug(config, worker), null, 2));
      return;
    }

    default:
      console.error(`Unknown command: ${command}`);
      usage();
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
