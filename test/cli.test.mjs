import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const entrypoint = path.join(root, "bin", "cursor-workers.mjs");

describe("bin/cursor-workers.mjs", () => {
  it("prints version", () => {
    const result = spawnSync(process.execPath, [entrypoint, "--version"], { encoding: "utf8" });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /1\.0\.0/);
  });

  it("prints help", () => {
    const result = spawnSync(process.execPath, [entrypoint, "--help"], { encoding: "utf8" });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /cursor-workers setup/);
    assert.match(result.stdout, /cursor-workers status/);
  });
});
