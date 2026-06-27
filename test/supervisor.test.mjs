import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it, mock } from "node:test";
import {
  clearSupervisorPid,
  readSupervisorPid,
  scheduleWorkerStarts,
  writeSupervisorPid,
  WORKER_START_STAGGER_MS,
} from "../src/supervisor.mjs";
import { createTempDir, removeTempDir } from "./lib/helpers.mjs";

describe("supervisor.mjs", () => {
  describe("supervisor pid file", () => {
    it("writes, reads, and clears pid files", () => {
      const root = createTempDir();
      const pidPath = path.join(root, "supervisor.pid");

      try {
        assert.equal(readSupervisorPid(pidPath), null);

        writeSupervisorPid(12345, pidPath);
        assert.equal(readSupervisorPid(pidPath), 12345);

        clearSupervisorPid(pidPath);
        assert.equal(readSupervisorPid(pidPath), null);
      } finally {
        removeTempDir(root);
      }
    });

    it("returns null for invalid pid content", () => {
      const root = createTempDir();
      const pidPath = path.join(root, "supervisor.pid");

      try {
        fs.writeFileSync(pidPath, "not-a-pid");
        assert.equal(readSupervisorPid(pidPath), null);
      } finally {
        removeTempDir(root);
      }
    });
  });

  describe("scheduleWorkerStarts", () => {
    afterEach(() => {
      mock.timers.reset();
    });

    it("starts the first worker immediately and staggers the rest", () => {
      mock.timers.enable({ apis: ["setTimeout"] });

      const order = [];
      const workers = [{ id: "a" }, { id: "b" }, { id: "c" }];
      const scheduled = scheduleWorkerStarts(workers, (worker) => order.push(worker.id), {
        staggerMs: 1000,
      });

      assert.equal(scheduled, 3);
      assert.deepEqual(order, ["a"]);

      mock.timers.tick(1000);
      assert.deepEqual(order, ["a", "b"]);

      mock.timers.tick(1000);
      assert.deepEqual(order, ["a", "b", "c"]);
    });

    it("returns zero when no workers need starting", () => {
      assert.equal(
        scheduleWorkerStarts([], () => {
          throw new Error("should not start");
        }),
        0,
      );
    });

    it("exports a default stagger interval", () => {
      assert.equal(WORKER_START_STAGGER_MS, 2000);
    });
  });
});
