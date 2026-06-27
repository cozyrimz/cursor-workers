import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  CONFIG_PATH,
  ENV_PATH,
  expandHome,
  hasApiKey,
  loadConfig,
  readRawConfig,
  slugify,
  writeConfig,
  writeEnvFile,
} from "./config.mjs";

function defaultMachineName() {
  return `${os.hostname().split(".")[0]}-worker`.toLowerCase();
}

async function prompt(rl, question, { defaultValue = "", secret = false } = {}) {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  if (!answer && defaultValue) return defaultValue;
  return answer;
}

function validatePath(value) {
  const expanded = expandHome(value);
  if (!fs.existsSync(expanded)) {
    throw new Error(`Path does not exist: ${expanded}`);
  }
  if (!fs.statSync(expanded).isDirectory()) {
    throw new Error(`Path is not a directory: ${expanded}`);
  }
  return expanded;
}

export async function runSetup({ nonInteractive = false } = {}) {
  const rl = nonInteractive ? null : readline.createInterface({ input, output });

  try {
    console.log("\nCursor Workers setup");
    console.log("====================\n");
    console.log(
      "Auth: use a Cursor API key for auto-start (browser login does not work headless at login).",
    );
    console.log("Create one at https://cursor.com/dashboard → Integrations\n");

    let apiKey = process.env.CURSOR_API_KEY ?? "";
    if (!hasApiKey()) {
      if (nonInteractive) {
        throw new Error("CURSOR_API_KEY is required. Run setup interactively or set the env var.");
      }
      apiKey = await prompt(rl, "Cursor API key", { secret: true });
      if (!apiKey) {
        throw new Error("API key is required for daemon mode.");
      }
      writeEnvFile(apiKey);
      console.log(`Saved ${ENV_PATH} (mode 600)`);
    } else {
      console.log(`Using existing API key from ${ENV_PATH} or environment.`);
    }

    const existing = readRawConfig();
    const workspaces = [...(existing.workspaces ?? [])];

    if (!nonInteractive) {
      console.log("\nAdd workspace directories (git repos) for agents to work in.");
      console.log("Press Enter on an empty line when done.\n");

      while (true) {
        const rawPath = await prompt(rl, "Workspace path (or Enter to finish)");
        if (!rawPath) break;

        const expanded = validatePath(rawPath);
        const baseName = path.basename(expanded);
        const name = await prompt(rl, "Worker name for Cursor dashboard", {
          defaultValue: `${defaultMachineName()}-${baseName}`,
        });

        workspaces.push({
          path: expanded.replace(os.homedir(), "~"),
          name,
          enabled: true,
        });
      }
    }

    if (workspaces.length === 0) {
      throw new Error("Add at least one workspace path.");
    }

    const config = {
      agentBin: existing.agentBin ?? "agent",
      defaults: existing.defaults ?? {
        pool: false,
        poolName: "default",
        idleReleaseTimeout: 0,
        managementPortBase: 18080,
      },
      workspaces,
    };

    writeConfig(config);
    console.log(`\nWrote ${CONFIG_PATH}`);
    console.log("\nNext:");
    console.log("  cursor-workers debug          # preflight");
    console.log("  cursor-workers install        # auto-start at login");
    console.log("  cursor-workers status");
  } finally {
    rl?.close();
  }
}

export function addWorkspace(rawPath, { name } = {}) {
  const expanded = validatePath(rawPath);
  const raw = readRawConfig();
  const workspaces = [...(raw.workspaces ?? [])];
  const id = slugify(expanded);

  if (workspaces.some((entry) => slugify(expandHome(entry.path ?? entry)) === id)) {
    throw new Error(`Workspace already configured: ${expanded}`);
  }

  workspaces.push({
    path: expanded.replace(os.homedir(), "~"),
    name: name ?? `${defaultMachineName()}-${path.basename(expanded)}`,
    enabled: true,
  });

  writeConfig({ ...raw, workspaces });
  console.log(`Added workspace: ${expanded}`);
}

export function removeWorkspace(idOrPath) {
  const raw = readRawConfig();
  const workspaces = raw.workspaces ?? [];
  const target = expandHome(idOrPath);
  const next = workspaces.filter((entry) => {
    const pathValue = expandHome(entry.path ?? entry);
    const entryId = entry.id ?? slugify(pathValue);
    return entryId !== idOrPath && pathValue !== target;
  });

  if (next.length === workspaces.length) {
    throw new Error(`Workspace not found: ${idOrPath}`);
  }

  writeConfig({ ...raw, workspaces: next });
  console.log(`Removed workspace: ${idOrPath}`);
}

export function listWorkspaces() {
  const config = loadConfig();
  if (config.workers.length === 0) {
    console.log("No workspaces configured.");
    return;
  }

  console.log("\nWorkspaces");
  console.log("=".repeat(60));
  for (const worker of config.workers) {
    console.log(worker.id);
    console.log(`  path:    ${worker.workerDir}`);
    console.log(`  name:    ${worker.name}`);
    console.log(`  port:    ${worker.managementPort ?? "-"}`);
    console.log("");
  }
}
