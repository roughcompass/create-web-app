import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../template");
const checker = path.join(root, "scripts", "check-boundaries.mjs");

describe("template architecture boundaries", () => {
  it("accepts documented public imports", () => {
    const result = check("quality-fixtures/boundaries/pass/src");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Architecture boundaries valid");
  });

  it.each([
    ["fail-cross-feature", "cross-feature imports must use the feature public index"],
    ["fail-shared-feature", "shared modules cannot import features"],
    ["fail-alias-escape", "shared imports must use the shared-area public index"],
  ])("rejects %s", (fixture, message) => {
    const result = check(`quality-fixtures/boundaries/${fixture}/src`);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
  });

  function check(relativeRoot: string) {
    return spawnSync(process.execPath, [checker, "--root", relativeRoot], {
      cwd: root,
      encoding: "utf8",
    });
  }
});