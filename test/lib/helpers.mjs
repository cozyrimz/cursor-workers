import fs, { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export function createTempDir(prefix = "cursor-workers-test-") {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function removeTempDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

export function makeWorkspaceDir(root) {
  const dir = path.join(root, "workspace");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function sampleRawConfig(workspaceDir, overrides = {}) {
  return {
    agentBin: "agent",
    defaults: {
      pool: false,
      poolName: "default",
      idleReleaseTimeout: 0,
      managementPortBase: 18080,
    },
    workspaces: [
      {
        path: workspaceDir,
        name: "test-worker",
        enabled: true,
      },
    ],
    ...overrides,
  };
}

export function sampleWorker(overrides = {}) {
  return {
    id: "my-app",
    name: "test-worker",
    workerDir: "/tmp/my-app",
    workerDirs: [],
    pool: false,
    poolName: "default",
    managementPort: 18081,
    idleReleaseTimeout: 0,
    labels: {},
    verbose: false,
    enabled: true,
    ...overrides,
  };
}

export function sampleConfig(overrides = {}) {
  return {
    agentBin: "agent",
    apiKeyEnv: "CURSOR_API_KEY",
    logDir: "/tmp/logs",
    stateDir: "/tmp/state",
    defaults: {},
    workers: [sampleWorker()],
    ...overrides,
  };
}
