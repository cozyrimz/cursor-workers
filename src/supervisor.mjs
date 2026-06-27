import fs from "node:fs";
import path from "node:path";
import { SUPERVISOR_PID_PATH } from "./config.mjs";
import { isRunning, readPid, startWorker, stopWorker } from "./worker-process.mjs";

const RESTART_DELAY_MS = 5000;

/** Delay between worker spawns — concurrent `agent worker start` races on macOS keychain auth. */
export const WORKER_START_STAGGER_MS = 2000;

export function scheduleWorkerStarts(workers, startFn, { staggerMs = WORKER_START_STAGGER_MS } = {}) {
  let scheduled = 0;
  let delay = 0;

  for (const worker of workers) {
    if (delay === 0) {
      startFn(worker);
    } else {
      setTimeout(() => startFn(worker), delay);
    }
    scheduled += 1;
    delay += staggerMs;
  }

  return scheduled;
}

export function readSupervisorPid(pidPath = SUPERVISOR_PID_PATH) {
  if (!fs.existsSync(pidPath)) return null;
  const value = Number.parseInt(fs.readFileSync(pidPath, "utf8").trim(), 10);
  return Number.isFinite(value) ? value : null;
}

export function writeSupervisorPid(pid, pidPath = SUPERVISOR_PID_PATH) {
  fs.mkdirSync(path.dirname(pidPath), { recursive: true });
  fs.writeFileSync(pidPath, String(pid));
}

export function clearSupervisorPid(pidPath = SUPERVISOR_PID_PATH) {
  fs.rmSync(pidPath, { force: true });
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

  const workersToStart = config.workers.filter((worker) => {
    const pid = readPid(config.stateDir, worker.id);
    return !isRunning(pid);
  });
  scheduleWorkerStarts(workersToStart, (worker) => ensureWorkerRunning(config, worker));

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
  const workersToStart = config.workers.filter((worker) => {
    const pid = readPid(config.stateDir, worker.id);
    return !isRunning(pid);
  });

  return scheduleWorkerStarts(workersToStart, (worker) => {
    startWorker(config, worker, { detach: true });
  });
}
