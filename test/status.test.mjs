import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatStatusJson,
  formatStatusTable,
  parsePrometheus,
  summarizeVisibilityProbe,
} from "../src/status.mjs";

describe("status.mjs", () => {
  describe("parsePrometheus", () => {
    it("parses metric lines and ignores comments", () => {
      const text = `
# HELP cursor_self_hosted_worker_connected connected
cursor_self_hosted_worker_connected 1
cursor_self_hosted_worker_session_active 0
cursor_self_hosted_worker_last_activity_unix_seconds 1710000000.0
`;

      assert.deepEqual(parsePrometheus(text), {
        cursor_self_hosted_worker_connected: 1,
        cursor_self_hosted_worker_session_active: 0,
        cursor_self_hosted_worker_last_activity_unix_seconds: 1710000000,
      });
    });

    it("returns empty object for blank input", () => {
      assert.deepEqual(parsePrometheus(""), {});
    });
  });

  describe("summarizeVisibilityProbe", () => {
    it("reads nested nonPrivacy probe fields", () => {
      assert.deepEqual(
        summarizeVisibilityProbe({
          nonPrivacy: { status: "ok", totalCount: 2 },
        }),
        { status: "ok", totalCount: 2 },
      );
    });

    it("falls back to flat probe shape", () => {
      assert.deepEqual(summarizeVisibilityProbe({ status: "error", totalCount: 0 }), {
        status: "error",
        totalCount: 0,
      });
    });
  });

  describe("formatStatusTable", () => {
    it("renders worker rows and fleet summary", () => {
      const report = {
        workers: [
          {
            id: "my-app",
            name: "mac-my-app",
            running: true,
            connected: true,
            sessionActive: false,
            pid: 100,
            workerDir: "/tmp/my-app",
            pool: false,
            poolName: "default",
            managementPort: 18081,
            logFile: "/tmp/logs/my-app.log",
          },
        ],
        fleet: {
          teamSummary: {
            totalConnected: 2,
            inUse: 1,
          },
        },
      };

      const table = formatStatusTable(report);
      assert.match(table, /local id:\s+my-app/);
      assert.match(table, /cloud name:\s+mac-my-app/);
      assert.match(table, /state:\s+idle/);
      assert.match(table, /pool:\s+my-machine/);
      assert.match(table, /metrics:\s+http:\/\/127\.0\.0\.1:18081\/metrics/);
      assert.match(table, /Fleet summary/);
      assert.match(table, /connected: 2/);
    });

    it("shows stopped and pool worker states", () => {
      const stopped = formatStatusTable({
        workers: [
          {
            id: "down",
            name: "down-worker",
            running: false,
            connected: false,
            sessionActive: false,
            pid: null,
            workerDir: "/tmp/down",
            pool: true,
            poolName: "team-a",
            managementPort: null,
            logFile: "/tmp/logs/down.log",
          },
        ],
        fleet: null,
      });

      assert.match(stopped, /state:\s+stopped/);
      assert.match(stopped, /pool:\s+team-a/);
      assert.match(stopped, /log:\s+/);
    });
  });

  describe("formatStatusJson", () => {
    it("serializes report as JSON", () => {
      const report = { workers: [], fleet: null };
      assert.equal(formatStatusJson(report), JSON.stringify(report, null, 2));
    });
  });
});
