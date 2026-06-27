#!/usr/bin/env node

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 20) {
  console.error(`Error: Node.js 20+ required (found ${process.version}).`);
  console.error("Re-run ./install.sh — it pins a compatible Node and installs a wrapper in ~/.local/bin.");
  process.exit(1);
}

const path = await import("node:path");
const { fileURLToPath } = await import("node:url");
const here = path.dirname(fileURLToPath(import.meta.url));
await import(path.join(here, "..", "src", "cli.mjs"));
