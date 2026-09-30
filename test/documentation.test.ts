import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

describe("development documentation", () => {
  it.each([
    "npm ci --ignore-scripts",
    "npm run check",
    "npm run ci",
    "npm run build",
    "node dist/cli.js --version",
    "npm run registry",
  ])("documents %s", (command) => {
    expect(readme).toContain(command);
  });
});