import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../template");
const documentation = fs.readFileSync(path.join(root, "docs", "architecture.md"), "utf8");

describe("template architecture guidance", () => {
  it.each([
    "src/features/<feature>/index.ts",
    "TanStack Query owns remote data",
    "Treat environment variables and service responses as unknown input",
    "Unhandled requests fail tests",
    "npm run lint:boundaries",
    "npm run verify:feature-guide",
    "SPA deployment",
  ])("documents %s", (requirement) => {
    expect(documentation).toContain(requirement);
  });
});