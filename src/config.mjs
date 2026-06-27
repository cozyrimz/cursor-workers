import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const CONFIG_DIR = path.join(os.homedir(), ".config", "cursor-workers");
export const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
export const ENV_PATH = path.join(CONFIG_DIR, "env");
export const DATA_DIR = path.join(os.homedir(), ".local", "share", "cursor-workers");
export const INSTALL_DIR = path.join(DATA_DIR, "app");
export const NODE_PATH_FILE = path.join(DATA_DIR, "node-path");
export const WRAPPER_PATH = path.join(os.homedir(), ".local", "bin", "cursor-workers");
export const SUPERVISOR_PID_PATH = path.join(DATA_DIR, "supervisor.pid");
export const LAUNCH_AGENT_LABEL = "com.cursor.workers";
export const LAUNCH_AGENT_PATH = path.join(
  os.homedir(),
  "Library",
  "LaunchAgents",
  `${LAUNCH_AGENT_LABEL}.plist`,
);

export function readPinnedNode(nodePathFile = NODE_PATH_FILE) {
  if (!fs.existsSync(nodePathFile)) return null;
  const nodeBin = fs.readFileSync(nodePathFile, "utf8").trim();
  if (!nodeBin || !fs.existsSync(nodeBin)) return null;
  return nodeBin;
}

export function resolveCliPath({ wrapperPath = WRAPPER_PATH, installDir = INSTALL_DIR } = {}) {
  if (fs.existsSync(wrapperPath)) return wrapperPath;
  return path.join(installDir, "bin", "cursor-workers.mjs");
}

export function expandHome(value) {
  if (typeof value !== "string") return value;
  return value.replace(/^~(?=$|[/\\])/, os.homedir());
}

export function slugify(value) {
  return value
    .replace(/^~[/\\]?/, "")
    .replace(/[/\\]+/g, "-")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "workspace";
}

function normalizeWorkspace(entry, index, defaults) {
  if (typeof entry === "string") {
    const expanded = expandHome(entry);
    return {
      id: slugify(expanded),
      name: path.basename(expanded),
      workerDir: expanded,
      workerDirs: [],
      pool: defaults.pool ?? false,
      poolName: defaults.poolName ?? "default",
      managementPort: undefined,
      idleReleaseTimeout: defaults.idleReleaseTimeout ?? 0,
      labels: {},
      verbose: false,
      enabled: true,
      hasExplicitPort: false,
    };
  }

  const paths = (entry.paths ?? (entry.path ? [entry.path] : [])).map(expandHome);
  if (paths.length === 0) {
    throw new Error("Each workspace needs a path or paths field.");
  }

  const primary = paths[0];

  return {
    id: entry.id ?? slugify(primary),
    name: entry.name ?? path.basename(primary),
    workerDir: primary,
    workerDirs: paths.length > 1 ? paths : [],
    pool: entry.pool ?? defaults.pool ?? false,
    poolName: entry.poolName ?? defaults.poolName ?? "default",
    managementPort: entry.managementPort,
    idleReleaseTimeout: entry.idleReleaseTimeout ?? defaults.idleReleaseTimeout ?? 0,
    labels: entry.labels ?? {},
    verbose: Boolean(entry.verbose),
    enabled: entry.enabled !== false,
    hasExplicitPort: entry.managementPort !== undefined,
  };
}

export function assignManagementPorts(workers, defaults = {}) {
  const base = defaults.managementPortBase ?? 18080;
  const used = new Set();

  workers.forEach((worker, index) => {
    let port = worker.hasExplicitPort ? worker.managementPort : base + index;

    if (worker.hasExplicitPort && used.has(port)) {
      throw new Error(
        `Duplicate managementPort ${port} for workspace "${worker.id}".`,
      );
    }

    while (used.has(port)) {
      port += 1;
    }

    worker.managementPort = port;
    used.add(port);
    delete worker.hasExplicitPort;
  });

  return workers;
}

export function normalizeConfig(raw) {
  const defaults = raw.defaults ?? {};
  const agentBin = expandHome(raw.agentBin ?? "agent");
  const logDir = expandHome(raw.logDir ?? path.join(DATA_DIR, "logs"));
  const stateDir = expandHome(raw.stateDir ?? path.join(DATA_DIR, "state"));

  if (!Array.isArray(raw.workspaces) || raw.workspaces.length === 0) {
    throw new Error("Config must include a non-empty workspaces array.");
  }

  const workers = raw.workspaces
    .map((entry, index) => normalizeWorkspace(entry, index, defaults))
    .filter((worker) => worker.enabled);

  assignManagementPorts(workers, defaults);

  return {
    agentBin,
    apiKeyEnv: raw.apiKeyEnv ?? "CURSOR_API_KEY",
    logDir,
    stateDir,
    defaults,
    workers,
  };
}

export function loadConfig(configPath = CONFIG_PATH) {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config not found at ${configPath}. Run: cursor-workers setup`);
  }

  const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const config = normalizeConfig(raw);

  if (config.workers.length === 0) {
    throw new Error("No enabled workspaces in config.");
  }

  for (const worker of config.workers) {
    const dirs = worker.workerDirs.length > 0 ? worker.workerDirs : [worker.workerDir];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        throw new Error(`Workspace "${worker.id}" path does not exist: ${dir}`);
      }
    }
  }

  return config;
}

export function readRawConfig(configPath = CONFIG_PATH) {
  if (!fs.existsSync(configPath)) {
    return {
      agentBin: "agent",
      defaults: {
        pool: false,
        poolName: "default",
        idleReleaseTimeout: 0,
        managementPortBase: 18080,
      },
      workspaces: [],
    };
  }
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

export function writeConfig(raw, configPath = CONFIG_PATH) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(raw, null, 2)}\n`);
}

export function ensureDirs(config) {
  fs.mkdirSync(config.logDir, { recursive: true });
  fs.mkdirSync(config.stateDir, { recursive: true });
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

export function loadEnvFile(envPath = ENV_PATH) {
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

export function hasApiKey(envPath = ENV_PATH) {
  return Boolean(resolveApiKey({ apiKeyEnv: "CURSOR_API_KEY" }, process.env, envPath));
}

export function resolveApiKey(config = { apiKeyEnv: "CURSOR_API_KEY" }, env = process.env, envPath = ENV_PATH) {
  const keyName = config.apiKeyEnv ?? "CURSOR_API_KEY";
  return env[keyName] ?? loadEnvFile(envPath)[keyName] ?? null;
}

export function applyApiKeyEnv(config, env = { ...process.env }, envPath = ENV_PATH) {
  const apiKey = resolveApiKey(config, env, envPath);
  if (apiKey) {
    env.CURSOR_API_KEY = apiKey;
  }
  return env;
}

export function writeEnvFile(apiKey, envPath = ENV_PATH) {
  fs.mkdirSync(path.dirname(envPath), { recursive: true });
  const content = `# Cursor API key for unattended workers (launchd).\n# https://cursor.com/dashboard → Integrations\nCURSOR_API_KEY=${apiKey}\n`;
  fs.writeFileSync(envPath, content, { mode: 0o600 });
  try {
    fs.chmodSync(envPath, 0o600);
  } catch {
    // ignore
  }
}
