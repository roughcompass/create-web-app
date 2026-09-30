import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runPostActions, type CommandRequest, type CommandRunner } from "../src/post-actions.js";

const temporary: string[] = [];

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe("post-generation actions", () => {
  it("runs npm and Git as shell-free argument arrays", async () => {
    const destination = await fixture();
    const requests: CommandRequest[] = [];
    const runner: CommandRunner = (request) => {
      requests.push(request);
      return Promise.resolve({ status: 0, stdout: "", stderr: "" });
    };
    await expect(runPostActions({ destination, install: true, initializeGit: true, runner })).resolves.toEqual({
      installed: true,
      gitInitialized: true,
    });
    expect(requests).toEqual([
      { command: "npm", args: ["ci", "--ignore-scripts"], cwd: destination },
      { command: "git", args: ["init", "--initial-branch=main"], cwd: destination },
    ]);
  });

  it.each(["install", "git"] as const)("preserves source and bounds %s failure diagnostics", async (action) => {
    const destination = await fixture();
    const source = path.join(destination, "source.ts");
    const before = await fs.readFile(source);
    const runner: CommandRunner = (request) => Promise.resolve(
      request.command === (action === "install" ? "npm" : "git")
        ? { status: 1, stdout: "", stderr: "x".repeat(20_000) }
        : { status: 0, stdout: "", stderr: "" },
    );
    await expect(runPostActions({ destination, install: true, initializeGit: true, runner })).rejects.toMatchObject({
      action,
      destination,
    });
    expect(await fs.readFile(source)).toEqual(before);
    try {
      await runPostActions({ destination, install: action === "install", initializeGit: action === "git", runner });
    } catch (error) {
      expect((error as Error).message.length).toBeLessThan(8_300);
    }
  });

  it("initializes a real repository on main without installing", async () => {
    const destination = await fixture();
    await expect(runPostActions({ destination, install: false, initializeGit: true })).resolves.toEqual({
      installed: false,
      gitInitialized: true,
    });
    await expect(fs.readFile(path.join(destination, ".git", "HEAD"), "utf8")).resolves.toBe("ref: refs/heads/main\n");
  });

  it("runs a real script-disabled clean install", async () => {
    const destination = await fixture();
    const manifest = { name: "generated-fixture", version: "1.0.0", private: true };
    const lock = {
      name: manifest.name,
      version: manifest.version,
      lockfileVersion: 3,
      requires: true,
      packages: { "": manifest },
    };
    await fs.writeFile(path.join(destination, "package.json"), JSON.stringify(manifest));
    await fs.writeFile(path.join(destination, "package-lock.json"), JSON.stringify(lock));
    await expect(runPostActions({ destination, install: true, initializeGit: false })).resolves.toEqual({
      installed: true,
      gitInitialized: false,
    });
  });
});

async function fixture(): Promise<string> {
  const destination = await fs.mkdtemp(path.join(os.tmpdir(), "create-web-app-post-actions-"));
  temporary.push(destination);
  await fs.writeFile(path.join(destination, "source.ts"), "export const source = true;\n");
  return destination;
}