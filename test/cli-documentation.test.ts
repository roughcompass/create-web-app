import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../src/cli-app.js";

const root = path.resolve(import.meta.dirname, "..");
const temporary: string[] = [];

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe("documented CLI commands", () => {
  it("keeps required examples and trust boundaries in shipped documentation", async () => {
    const documentation = await fs.readFile(path.join(root, "docs", "cli.md"), "utf8");
    for (const expected of [
      "create-web-app --help",
      "create-web-app --version",
      "create-web-app example-app --directory example-app --no-install --no-git",
      "--display-name \"Example App\"",
      "does not fetch remote templates",
      "npm ci --ignore-scripts",
    ]) expect(documentation).toContain(expected);
  });

  it("executes each prompt-free example against temporary destinations", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "create-web-app-docs-"));
    temporary.push(cwd);
    const human = await invoke(["example-app", "--directory", "example-app", "--no-install", "--no-git"], cwd);
    expect(human).toMatchObject({ exitCode: 0, stderr: "" });
    expect(await fs.readdir(path.join(cwd, "example-app"))).toContain("README.md");

    const json = await invoke([
      "--name", "example-json",
      "--display-name", "Example App",
      "--directory", "example-json",
      "--no-install",
      "--no-git",
      "--json",
    ], cwd);
    expect(JSON.parse(json.stdout)).toMatchObject({ success: true, options: { displayName: "Example App" } });
    expect((await invoke(["--help"], cwd)).stdout).toContain("Usage:");
    expect((await invoke(["--version"], cwd)).stdout).toBe("0.1.0\n");
  });
});

async function invoke(arguments_: readonly string[], cwd: string) {
  let stdout = "";
  let stderr = "";
  const exitCode = await runCli(arguments_, {
    stdout: (text) => { stdout += text; },
    stderr: (text) => { stderr += text; },
  }, undefined, cwd);
  return { exitCode, stdout, stderr };
}