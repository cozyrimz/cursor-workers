import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  clearSupervisorPid,
  readSupervisorPid,
  writeSupervisorPid,
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
});
