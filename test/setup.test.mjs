import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { readRawConfig } from "../src/config.mjs";
import { addWorkspace, removeWorkspace } from "../src/setup.mjs";
import { createTempDir, makeWorkspaceDir, removeTempDir, sampleRawConfig } from "./lib/helpers.mjs";

describe("setup.mjs", () => {
  describe("addWorkspace", () => {
    it("appends a workspace to config", () => {
      const root = createTempDir();
      try {
        const first = makeWorkspaceDir(path.join(root, "first"));
        const second = makeWorkspaceDir(path.join(root, "second"));
        const configPath = path.join(root, "config.json");
        fs.writeFileSync(configPath, `${JSON.stringify(sampleRawConfig(first), null, 2)}\n`);

        addWorkspace(second, { name: "second-worker", configPath });

        const raw = readRawConfig(configPath);
        assert.equal(raw.workspaces.length, 2);
        assert.equal(raw.workspaces[1].name, "second-worker");
      } finally {
        removeTempDir(root);
      }
    });

    it("rejects duplicate workspace paths", () => {
      const root = createTempDir();
      try {
        const workspace = makeWorkspaceDir(root);
        const configPath = path.join(root, "config.json");
        fs.writeFileSync(configPath, `${JSON.stringify(sampleRawConfig(workspace), null, 2)}\n`);

        assert.throws(
          () => addWorkspace(workspace, { configPath }),
          /already configured/,
        );
      } finally {
        removeTempDir(root);
      }
    });

    it("rejects missing directories", () => {
      assert.throws(
        () => addWorkspace("/tmp/definitely-not-a-real-workspace-path"),
        /Path does not exist/,
      );
    });
  });

  describe("removeWorkspace", () => {
    it("removes by id or path", () => {
      const root = createTempDir();
      try {
        const workspace = makeWorkspaceDir(root);
        const configPath = path.join(root, "config.json");
        fs.writeFileSync(
          configPath,
          `${JSON.stringify(
            {
              ...sampleRawConfig(workspace),
              workspaces: [{ id: "my-workspace", path: workspace, name: "test", enabled: true }],
            },
            null,
            2,
          )}\n`,
        );

        removeWorkspace("my-workspace", { configPath });
        assert.equal(readRawConfig(configPath).workspaces.length, 0);
      } finally {
        removeTempDir(root);
      }
    });

    it("throws when workspace is not found", () => {
      const root = createTempDir();
      try {
        const workspace = makeWorkspaceDir(root);
        const configPath = path.join(root, "config.json");
        fs.writeFileSync(configPath, `${JSON.stringify(sampleRawConfig(workspace), null, 2)}\n`);

        assert.throws(
          () => removeWorkspace("missing-id", { configPath }),
          /Workspace not found/,
        );
      } finally {
        removeTempDir(root);
      }
    });
  });
});
