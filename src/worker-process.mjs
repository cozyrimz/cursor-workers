import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { applyApiKeyEnv } from "./config.mjs";

export function pidPath(stateDir, workerId) {
  return path.join(stateDir, `${workerId}.pid`);
}

export function logPath(logDir, workerId) {
  return path.join(logDir, `${workerId}.log`);
}

export function readPid(stateDir, workerId) {
  const file = pidPath(stateDir, workerId);
  if (!fs.existsSync(file)) return null;
  const value = Number.parseInt(fs.readFileSync(file, "utf8").trim(), 10);
  return Number.isFinite(value) ? value : null;
}

export function isRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function buildWorkerArgs(config, worker) {
  const args = ["worker"];
  const dirs = worker.workerDirs.length > 0 ? worker.workerDirs : [worker.workerDir];

  for (const dir of dirs) {
    args.push("--worker-dir", dir);
  }

  if (worker.pool) {
    args.push("--pool");
    if (worker.poolName && worker.poolName !== "default") {
      args.push("--pool-name", worker.poolName);
    }
  }

  if (worker.name) {
    args.push("--name", worker.name);
  }

  if (worker.managementPort) {
    args.push("--management-addr", `127.0.0.1:${worker.managementPort}`);
  }

  if (worker.idleReleaseTimeout > 0) {
    args.push("--idle-release-timeout", String(worker.idleReleaseTimeout));
  }

  for (const [key, value] of Object.entries(worker.labels)) {
    args.push("--label", `${key}=${value}`);
  }

  args.push("start");
  if (worker.verbose) {
    args.push("--verbose");
  }

  return args;
}

export function startWorker(config, worker, { detach = false } = {}) {
  const args = buildWorkerArgs(config, worker);
  const out = fs.openSync(logPath(config.logDir, worker.id), "a");
  const env = applyApiKeyEnv(config);

  const child = spawn(config.agentBin, args, {
    cwd: worker.workerDir,
    env,
    detached: detach,
    stdio: ["ignore", out, out],
  });

  fs.writeFileSync(pidPath(config.stateDir, worker.id), String(child.pid));

  if (detach) {
    child.unref();
    return child;
  }

  child.on("exit", (code, signal) => {
    const currentPid = readPid(config.stateDir, worker.id);
    if (currentPid === child.pid) {
      fs.rmSync(pidPath(config.stateDir, worker.id), { force: true });
    }
    const suffix = signal ? `signal ${signal}` : `code ${code}`;
    fs.appendFileSync(
      logPath(config.logDir, worker.id),
      `\n[supervisor] worker exited with ${suffix} at ${new Date().toISOString()}\n`,
    );
  });

  return child;
}

export function stopWorker(stateDir, workerId, signal = "SIGTERM") {
  const pid = readPid(stateDir, workerId);
  if (!pid) return { stopped: false, reason: "not_running" };
  if (!isRunning(pid)) {
    fs.rmSync(pidPath(stateDir, workerId), { force: true });
    return { stopped: false, reason: "stale_pid" };
  }
  process.kill(pid, signal);
  return { stopped: true, pid };
}
