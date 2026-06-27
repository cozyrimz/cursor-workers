import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { LAUNCH_AGENT_LABEL } from "../src/config.mjs";
import { buildLaunchAgentPlist } from "../src/launchd.mjs";
import { createTempDir, removeTempDir } from "./lib/helpers.mjs";

describe("launchd.mjs", () => {
  describe("buildLaunchAgentPlist", () => {
    it("builds a launchd plist that sources env and execs the wrapper", () => {
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
        assert.match(plist, /source .+env/);
        assert.match(plist, new RegExp(`exec ${wrapper} supervise`));
        assert.match(plist, new RegExp(`<string>${home}</string>`));
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
