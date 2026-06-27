import fs from "node:fs";
import path from "node:path";
import { SUPERVISOR_PID_PATH } from "./config.mjs";
import { isRunning, readPid, startWorker, stopWorker } from "./worker-process.mjs";

const RESTART_DELAY_MS = 5000;

export function readSupervisorPid() {
  if (!fs.existsSync(SUPERVISOR_PID_PATH)) return null;
  const value = Number.parseInt(fs.readFileSync(SUPERVISOR_PID_PATH, "utf8").trim(), 10);
  return Number.isFinite(value) ? value : null;
}

export function writeSupervisorPid(pid) {
  fs.mkdirSync(path.dirname(SUPERVISOR_PID_PATH), { recursive: true });
  fs.writeFileSync(SUPERVISOR_PID_PATH, String(pid));
}

export function clearSupervisorPid() {
  fs.rmSync(SUPERVISOR_PID_PATH, { force: true });
}

const children = new Map();
let shuttingDown = false;

function ensureWorkerRunning(config, worker) {
  const pid = readPid(config.stateDir, worker.id);
  if (isRunning(pid)) {
    return;
  }

  if (children.has(worker.id)) {
    return;
  }

  const child = startWorker(config, worker);
  children.set(worker.id, child);

  child.on("exit", () => {
    children.delete(worker.id);
    if (shuttingDown) return;
    setTimeout(() => {
      if (!shuttingDown) {
        ensureWorkerRunning(config, worker);
      }
    }, RESTART_DELAY_MS);
  });
}

export function supervise(config) {
  writeSupervisorPid(process.pid);

  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const worker of config.workers) {
      stopWorker(config.stateDir, worker.id);
    }
    for (const child of children.values()) {
      try {
        child.kill("SIGTERM");
      } catch {
        // ignore
      }
    }
    clearSupervisorPid();
    process.exit(signal === "SIGTERM" ? 0 : 1);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  for (const worker of config.workers) {
    ensureWorkerRunning(config, worker);
  }

  setInterval(() => {
    for (const worker of config.workers) {
      ensureWorkerRunning(config, worker);
    }
  }, 30_000);
}

export function stopAll(config) {
  let stopped = 0;
  for (const worker of config.workers) {
    const result = stopWorker(config.stateDir, worker.id);
    if (result.stopped) stopped += 1;
  }

  const supervisorPid = readSupervisorPid();
  if (isRunning(supervisorPid)) {
    process.kill(supervisorPid, "SIGTERM");
  }
  clearSupervisorPid();
  return stopped;
}

export function startAll(config) {
  let started = 0;
  for (const worker of config.workers) {
    const pid = readPid(config.stateDir, worker.id);
    if (isRunning(pid)) continue;
    startWorker(config, worker, { detach: true });
    started += 1;
  }
  return started;
}
