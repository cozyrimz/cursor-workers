import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  expandHome,
  assignManagementPorts,
  hasApiKey,
  loadConfig,
  loadEnvFile,
  normalizeConfig,
  readPinnedNode,
  readRawConfig,
  resolveApiKey,
  resolveCliPath,
  slugify,
  writeConfig,
  writeEnvFile,
} from "../src/config.mjs";
import { createTempDir, makeWorkspaceDir, removeTempDir, sampleRawConfig } from "./lib/helpers.mjs";

describe("config.mjs", () => {
  describe("slugify", () => {
    it("derives ids from paths", () => {
      assert.equal(slugify("~/Code/my-app"), "code-my-app");
      assert.equal(slugify("/Users/dev/projects/foo_bar"), "users-dev-projects-foo-bar");
    });

    it("falls back to workspace for empty input", () => {
      assert.equal(slugify("---"), "workspace");
    });
  });

  describe("expandHome", () => {
    it("expands tilde paths", () => {
      assert.equal(expandHome("~/Code"), path.join(os.homedir(), "Code"));
      assert.equal(expandHome("~"), os.homedir());
    });

    it("passes through non-strings and absolute paths", () => {
      assert.equal(expandHome("/absolute"), "/absolute");
      assert.equal(expandHome(null), null);
    });
  });

  describe("normalizeConfig", () => {
    it("normalizes a single workspace with defaults", () => {
      const config = normalizeConfig({
        workspaces: [{ path: "/tmp/repo", name: "mac-repo" }],
      });

      assert.equal(config.workers.length, 1);
      assert.equal(config.workers[0].name, "mac-repo");
      assert.equal(config.workers[0].workerDir, "/tmp/repo");
      assert.equal(config.workers[0].managementPort, 18080);
      assert.equal(config.workers[0].pool, false);
    });

    it("supports string workspace entries", () => {
      const config = normalizeConfig({
        workspaces: ["/tmp/other"],
      });

      assert.equal(config.workers[0].id, "tmp-other");
      assert.equal(config.workers[0].name, "other");
    });

    it("assigns incremental management ports", () => {
      const config = normalizeConfig({
        defaults: { managementPortBase: 19000 },
        workspaces: [{ path: "/tmp/a" }, { path: "/tmp/b", managementPort: 19999 }],
      });

      assert.equal(config.workers[0].managementPort, 19000);
      assert.equal(config.workers[1].managementPort, 19999);
    });

    it("skips ports already taken by explicit assignments", () => {
      const config = normalizeConfig({
        defaults: { managementPortBase: 18080 },
        workspaces: [
          { path: "/tmp/a", managementPort: 18081 },
          { path: "/tmp/b" },
        ],
      });

      assert.equal(config.workers[0].managementPort, 18081);
      assert.equal(config.workers[1].managementPort, 18082);
    });

    it("rejects duplicate explicit management ports", () => {
      assert.throws(
        () =>
          normalizeConfig({
            workspaces: [
              { path: "/tmp/a", managementPort: 18081 },
              { path: "/tmp/b", managementPort: 18081 },
            ],
          }),
        /Duplicate managementPort 18081/,
      );
    });

    it("assignManagementPorts fills gaps after explicit ports", () => {
      const workers = assignManagementPorts(
        [
          { id: "a", managementPort: 18081, hasExplicitPort: true },
          { id: "b", hasExplicitPort: false },
          { id: "c", hasExplicitPort: false },
        ],
        { managementPortBase: 18080 },
      );

      assert.equal(workers[0].managementPort, 18081);
      assert.equal(workers[1].managementPort, 18082);
      assert.equal(workers[2].managementPort, 18083);
      assert.equal(workers[0].hasExplicitPort, undefined);
    });

    it("handles multi-repo paths", () => {
      const config = normalizeConfig({
        workspaces: [{ paths: ["/tmp/front", "/tmp/back"], name: "fullstack" }],
      });

      assert.deepEqual(config.workers[0].workerDirs, ["/tmp/front", "/tmp/back"]);
      assert.equal(config.workers[0].workerDir, "/tmp/front");
    });

    it("honors pool and idle timeout overrides", () => {
      const config = normalizeConfig({
        defaults: { pool: false, idleReleaseTimeout: 0 },
        workspaces: [
          {
            path: "/tmp/pool",
            pool: true,
            poolName: "team-a",
            idleReleaseTimeout: 120,
            verbose: true,
          },
        ],
      });

      const worker = config.workers[0];
      assert.equal(worker.pool, true);
      assert.equal(worker.poolName, "team-a");
      assert.equal(worker.idleReleaseTimeout, 120);
      assert.equal(worker.verbose, true);
    });

    it("filters disabled workspaces", () => {
      const config = normalizeConfig({
        workspaces: [
          { path: "/tmp/enabled", enabled: true },
          { path: "/tmp/disabled", enabled: false },
        ],
      });

      assert.equal(config.workers.length, 1);
      assert.equal(config.workers[0].workerDir, "/tmp/enabled");
    });

    it("rejects empty workspaces", () => {
      assert.throws(() => normalizeConfig({ workspaces: [] }), /non-empty workspaces/);
      assert.throws(() => normalizeConfig({}), /non-empty workspaces/);
    });

    it("rejects workspace without path", () => {
      assert.throws(
        () => normalizeConfig({ workspaces: [{ name: "orphan" }] }),
        /path or paths field/,
      );
    });
  });

  describe("loadConfig", () => {
    it("loads and validates existing workspace paths", () => {
      const root = createTempDir();
      try {
        const workspace = makeWorkspaceDir(root);
        const configPath = path.join(root, "config.json");
        writeConfig(sampleRawConfig(workspace), configPath);

        const config = loadConfig(configPath);
        assert.equal(config.workers[0].workerDir, workspace);
      } finally {
        removeTempDir(root);
      }
    });

    it("throws when config file is missing", () => {
      assert.throws(
        () => loadConfig("/tmp/does-not-exist-config.json"),
        /Config not found/,
      );
    });

    it("throws when workspace path does not exist", () => {
      const root = createTempDir();
      try {
        const configPath = path.join(root, "config.json");
        writeConfig(sampleRawConfig("/tmp/missing-workspace-path"), configPath);

        assert.throws(() => loadConfig(configPath), /path does not exist/);
      } finally {
        removeTempDir(root);
      }
    });

    it("throws when all workspaces are disabled", () => {
      const root = createTempDir();
      try {
        const workspace = makeWorkspaceDir(root);
        const configPath = path.join(root, "config.json");
        writeConfig(
          sampleRawConfig(workspace, {
            workspaces: [{ path: workspace, enabled: false }],
          }),
          configPath,
        );

        assert.throws(() => loadConfig(configPath), /No enabled workspaces/);
      } finally {
        removeTempDir(root);
      }
    });
  });

  describe("readRawConfig", () => {
    it("returns defaults when file is missing", () => {
      const raw = readRawConfig("/tmp/missing-raw-config.json");
      assert.deepEqual(raw.workspaces, []);
      assert.equal(raw.defaults.managementPortBase, 18080);
    });
  });

  describe("env helpers", () => {
    it("parses env files and ignores comments", () => {
      const root = createTempDir();
      try {
        const envPath = path.join(root, "env");
        fs.writeFileSync(envPath, "# comment\nCURSOR_API_KEY=abc123\nEMPTY=\n");

        assert.deepEqual(loadEnvFile(envPath), { CURSOR_API_KEY: "abc123", EMPTY: "" });
      } finally {
        removeTempDir(root);
      }
    });

    it("detects api keys from file or process env", () => {
      const root = createTempDir();
      try {
        const envPath = path.join(root, "env");
        writeEnvFile("secret-key", envPath);

        assert.equal(hasApiKey(envPath), true);
        assert.equal(resolveApiKey({ apiKeyEnv: "CURSOR_API_KEY" }, {}, envPath), "secret-key");
        assert.match(fs.readFileSync(envPath, "utf8"), /CURSOR_API_KEY=secret-key/);
      } finally {
        removeTempDir(root);
      }

      const previous = process.env.CURSOR_API_KEY;
      process.env.CURSOR_API_KEY = "from-env";
      try {
        assert.equal(hasApiKey("/tmp/no-env-file"), true);
      } finally {
        if (previous === undefined) delete process.env.CURSOR_API_KEY;
        else process.env.CURSOR_API_KEY = previous;
      }
    });
  });

  describe("readPinnedNode", () => {
    it("returns null when pin file is missing or invalid", () => {
      const root = createTempDir();
      try {
        const pinPath = path.join(root, "node-path");
        assert.equal(readPinnedNode(path.join(root, "missing")), null);

        fs.writeFileSync(pinPath, "/no/such/node");
        assert.equal(readPinnedNode(pinPath), null);
      } finally {
        removeTempDir(root);
      }
    });

    it("returns pinned node path when executable exists", () => {
      const root = createTempDir();
      try {
        const pinPath = path.join(root, "node-path");
        fs.writeFileSync(pinPath, process.execPath);
        assert.equal(readPinnedNode(pinPath), process.execPath);
      } finally {
        removeTempDir(root);
      }
    });
  });

  describe("resolveCliPath", () => {
    it("prefers wrapper when present", () => {
      const root = createTempDir();
      try {
        const wrapper = path.join(root, "cursor-workers");
        fs.writeFileSync(wrapper, "#!/bin/bash\n");
        assert.equal(
          resolveCliPath({ wrapperPath: wrapper, installDir: path.join(root, "app") }),
          wrapper,
        );
      } finally {
        removeTempDir(root);
      }
    });

    it("falls back to app entrypoint when wrapper is missing", () => {
      const root = createTempDir();
      try {
        const installDir = path.join(root, "app");
        assert.equal(
          resolveCliPath({ wrapperPath: path.join(root, "missing"), installDir }),
          path.join(installDir, "bin", "cursor-workers.mjs"),
        );
      } finally {
        removeTempDir(root);
      }
    });
  });
});
