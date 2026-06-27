import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { isRunning, logPath, readPid } from "./worker-process.mjs";

async function fetchMetrics(port) {
  if (!port) return null;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/metrics`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return null;
    const text = await response.text();
    return parsePrometheus(text);
  } catch {
    return null;
  }
}

export function parsePrometheus(text) {
  const metrics = {};
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\s+([0-9.eE+-]+)/);
    if (match) {
      metrics[match[1]] = Number(match[2]);
    }
  }
  return metrics;
}

async function fetchFleetSummary(apiKey) {
  if (!apiKey) return null;
  try {
    const auth = Buffer.from(`${apiKey}:`).toString("base64");
    const response = await fetch("https://api.cursor.com/v0/private-workers/summary", {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export async function getWorkerStatus(config, worker) {
  const pid = readPid(config.stateDir, worker.id);
  const running = isRunning(pid);
  const metrics = running ? await fetchMetrics(worker.managementPort) : null;

  return {
    id: worker.id,
    name: worker.name,
    workerDir: worker.workerDir,
    pool: worker.pool,
    poolName: worker.poolName,
    pid,
    running,
    managementPort: worker.managementPort,
    connected: metrics?.cursor_self_hosted_worker_connected === 1,
    sessionActive: metrics?.cursor_self_hosted_worker_session_active === 1,
    lastActivityUnix: metrics?.cursor_self_hosted_worker_last_activity_unix_seconds ?? null,
    logFile: logPath(config.logDir, worker.id),
  };
}

export async function getAllStatus(config) {
  const statuses = [];
  for (const worker of config.workers) {
    statuses.push(await getWorkerStatus(config, worker));
  }

  const apiKey = process.env[config.apiKeyEnv];
  const fleet = apiKey ? await fetchFleetSummary(apiKey) : null;

  return { workers: statuses, fleet };
}

export function runWorkerDebug(config, worker) {
  const args = ["worker"];
  const dirs = worker.workerDirs.length > 0 ? worker.workerDirs : [worker.workerDir];
  for (const dir of dirs) {
    args.push("--worker-dir", dir);
  }
  if (worker.pool) args.push("--pool");
  if (worker.name) args.push("--name", worker.name);
  args.push("debug", "--json");

  const env = { ...process.env };
  const apiKey = env[worker.apiKeyEnv];
  if (apiKey) env.CURSOR_API_KEY = apiKey;

  const result = spawnSync(config.agentBin, args, {
    cwd: worker.workerDir,
    env,
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.stdout.trim()) {
    try {
      return JSON.parse(result.stdout);
    } catch {
      return { raw: result.stdout, stderr: result.stderr };
    }
  }

  return { stderr: result.stderr, status: result.status };
}

export function formatStatusTable(report) {
  const lines = [];
  lines.push("");
  lines.push("Cursor Workers");
  lines.push("=".repeat(72));

  for (const worker of report.workers) {
    const state = worker.running
      ? worker.connected
        ? worker.sessionActive
          ? "busy"
          : "idle"
        : "starting"
      : "stopped";

    lines.push(`${worker.id} (${worker.name})`);
    lines.push(`  state:     ${state}`);
    lines.push(`  pid:       ${worker.pid ?? "-"}`);
    lines.push(`  workspace: ${worker.workerDir}`);
    lines.push(`  pool:      ${worker.pool ? worker.poolName : "my-machine"}`);
    if (worker.managementPort) {
      lines.push(`  metrics:   http://127.0.0.1:${worker.managementPort}/metrics`);
    }
    lines.push(`  log:       ${worker.logFile}`);
    lines.push("");
  }

  if (report.fleet?.teamSummary) {
    const team = report.fleet.teamSummary;
    lines.push("Fleet summary (service account key)");
    lines.push(`  connected: ${team.totalConnected ?? 0}`);
    lines.push(`  in use:    ${team.inUse ?? 0}`);
    lines.push("");
  }

  return lines.join("\n");
}

export function formatStatusJson(report) {
  return JSON.stringify(report, null, 2);
}
