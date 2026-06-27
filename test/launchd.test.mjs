import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { LAUNCH_AGENT_LABEL } from "../src/config.mjs";
import { buildLaunchAgentPlist } from "../src/launchd.mjs";
import { createTempDir, removeTempDir } from "./lib/helpers.mjs";

describe("launchd.mjs", () => {
  describe("buildLaunchAgentPlist", () => {
    it("builds a launchd plist that execs the CLI directly with api key env", () => {
      const root = createTempDir();
      try {
        const home = path.join(root, "home");
        const envPath = path.join(home, ".config", "cursor-workers", "env");
        fs.mkdirSync(path.dirname(envPath), { recursive: true });
        fs.writeFileSync(envPath, "CURSOR_API_KEY=test\n");

        const wrapper = path.join(home, ".local", "bin", "cursor-workers");
        const plist = buildLaunchAgentPlist(wrapper, { home, envPath });

        assert.match(plist, new RegExp(`<string>${LAUNCH_AGENT_LABEL}</string>`));
        assert.match(plist, /RunAtLoad/);
        assert.match(plist, /KeepAlive/);
        assert.match(plist, new RegExp(`<string>${wrapper}</string>`));
        assert.match(plist, /<string>supervise<\/string>/);
        assert.match(plist, /<key>CURSOR_API_KEY<\/key>\s*\n\s*<string>test<\/string>/);
        assert.match(plist, new RegExp(`<string>${home}</string>`));
        assert.doesNotMatch(plist, /\/bin\/zsh/);
      } finally {
        removeTempDir(root);
      }
    });

    it("throws when env file has no api key", () => {
      const root = createTempDir();
      try {
        const envPath = path.join(root, "env");
        fs.writeFileSync(envPath, "# empty\n");

        assert.throws(
          () => buildLaunchAgentPlist("/tmp/cursor-workers", { envPath }),
          /Missing CURSOR_API_KEY/,
        );
      } finally {
        removeTempDir(root);
      }
    });

    it("throws when env file is missing", () => {
      const root = createTempDir();
      try {
        assert.throws(
          () => buildLaunchAgentPlist("/tmp/cursor-workers", { envPath: path.join(root, "missing") }),
          /Missing .+Run: cursor-workers setup/,
        );
      } finally {
        removeTempDir(root);
      }
    });
  });
});
