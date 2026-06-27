import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  buildWorkerArgs,
  isRunning,
  logPath,
  pidPath,
  readPid,
  stopWorker,
} from "../src/worker-process.mjs";
import { createTempDir, removeTempDir, sampleConfig, sampleWorker } from "./lib/helpers.mjs";

describe("worker-process.mjs", () => {
  describe("paths", () => {
    it("builds pid and log paths", () => {
      assert.equal(pidPath("/state", "my-app"), "/state/my-app.pid");
      assert.equal(logPath("/logs", "my-app"), "/logs/my-app.log");
    });
  });

  describe("readPid", () => {
    it("reads numeric pid files and rejects invalid content", () => {
      const root = createTempDir();
      try {
        const stateDir = path.join(root, "state");
        fs.mkdirSync(stateDir);

        assert.equal(readPid(stateDir, "missing"), null);

        fs.writeFileSync(path.join(stateDir, "bad.pid"), "not-a-pid");
        assert.equal(readPid(stateDir, "bad"), null);

        fs.writeFileSync(path.join(stateDir, "good.pid"), "4242\n");
        assert.equal(readPid(stateDir, "good"), 4242);
      } finally {
        removeTempDir(root);
      }
    });
  });

  describe("isRunning", () => {
    it("detects live and missing processes", () => {
      assert.equal(isRunning(process.pid), true);
      assert.equal(isRunning(null), false);
      assert.equal(isRunning(999_999_999), false);
    });
  });

  describe("buildWorkerArgs", () => {
    it("builds default my-machine args", () => {
      const args = buildWorkerArgs(sampleConfig(), sampleWorker());
      assert.deepEqual(args, [
        "worker",
        "--worker-dir",
        "/tmp/my-app",
        "--name",
        "test-worker",
        "--management-addr",
        "127.0.0.1:18081",
        "start",
      ]);
    });

    it("includes pool, labels, idle timeout, and verbose flags", () => {
      const worker = sampleWorker({
        pool: true,
        poolName: "team-a",
        idleReleaseTimeout: 300,
        verbose: true,
        labels: { env: "staging", role: "worker" },
      });

      const args = buildWorkerArgs(sampleConfig(), worker);
      assert.ok(args.includes("--pool"));
      assert.ok(args.includes("--pool-name"));
      assert.ok(args.includes("team-a"));
      assert.ok(args.includes("--idle-release-timeout"));
      assert.ok(args.includes("300"));
      assert.ok(args.includes("--label"));
      assert.ok(args.includes("env=staging"));
      assert.ok(args.includes("role=worker"));
      assert.ok(args.at(-1) === "--verbose");
    });

    it("passes multiple worker directories", () => {
      const worker = sampleWorker({
        workerDir: "/tmp/front",
        workerDirs: ["/tmp/front", "/tmp/back"],
      });

      const args = buildWorkerArgs(sampleConfig(), worker);
      const dirs = args.filter((_, index, list) => list[index - 1] === "--worker-dir");
      assert.deepEqual(dirs, ["/tmp/front", "/tmp/back"]);
    });

    it("omits optional flags when unset", () => {
      const worker = sampleWorker({
        name: "",
        managementPort: 0,
        pool: false,
        poolName: "default",
      });

      const args = buildWorkerArgs(sampleConfig(), worker);
      assert.ok(!args.includes("--pool"));
      assert.ok(!args.includes("--management-addr"));
    });
  });

  describe("stopWorker", () => {
    it("reports not_running when pid file is absent", () => {
      const root = createTempDir();
      try {
        const stateDir = path.join(root, "state");
        fs.mkdirSync(stateDir);
        assert.deepEqual(stopWorker(stateDir, "missing"), { stopped: false, reason: "not_running" });
      } finally {
        removeTempDir(root);
      }
    });

    it("cleans stale pid files", () => {
      const root = createTempDir();
      try {
        const stateDir = path.join(root, "state");
        fs.mkdirSync(stateDir);
        fs.writeFileSync(path.join(stateDir, "stale.pid"), "999999999");

        const result = stopWorker(stateDir, "stale");
        assert.equal(result.stopped, false);
        assert.equal(result.reason, "stale_pid");
        assert.equal(fs.existsSync(path.join(stateDir, "stale.pid")), false);
      } finally {
        removeTempDir(root);
      }
    });
  });
});
