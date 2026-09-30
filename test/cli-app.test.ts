import path from "node:path";
import { describe, expect, it } from "vitest";
import { CliExecutionError, runCli, type CliServices } from "../src/cli-app.js";

const cwd = path.resolve("/tmp/create-web-app-cli");

describe("non-interactive CLI contract", () => {
  it("writes one deterministic JSON success result", async () => {
    const output = await invoke(["orders", "--no-install", "--no-git", "--json"], {
      generate: (options) => Promise.resolve({
        destination: options.destination,
        files: 42,
        actions: { rendered: true, installed: false, gitInitialized: false },
        recoveryPath: null,
      }),
    });
    expect(output.exitCode).toBe(0);
    expect(output.stderr).toBe("");
    expect(output.stdout.split("\n").filter(Boolean)).toHaveLength(1);
    expect(JSON.parse(output.stdout)).toMatchObject({
      schema: "create-web-app.cli-result",
      schemaVersion: 1,
      success: true,
      generatorVersion: "0.1.0",
      templateVersion: "0.1.0",
      options: { packageName: "orders", install: false, initializeGit: false, json: true },
      paths: { destination: path.join(cwd, "orders") },
      actions: { rendered: true, installed: false, gitInitialized: false },
      files: 42,
      recoveryPath: null,
    });
  });

  it("writes human success without JSON noise", async () => {
    const output = await invoke(["orders", "--yes"], successfulServices());
    expect(output).toMatchObject({ exitCode: 0, stderr: "" });
    expect(output.stdout).toContain(`Created Orders at ${path.join(cwd, "orders")}`);
  });

  it("returns stable input and generation failures", async () => {
    const input = await invoke(["--json", "--unknown"], successfulServices());
    expect(input.exitCode).toBe(2);
    expect(JSON.parse(input.stdout)).toMatchObject({ success: false, error: { code: "invalid_arguments" }, recoveryPath: null });

    const generation = await invoke(["orders", "--json"], {
      generate: () => Promise.reject(new CliExecutionError("install_failed", "npm exited with status 1", "/tmp/recovery")),
    });
    expect(generation.exitCode).toBe(1);
    expect(JSON.parse(generation.stdout)).toMatchObject({
      success: false,
      error: { code: "install_failed", message: "npm exited with status 1" },
      recoveryPath: "/tmp/recovery",
    });
  });

  it("prints help and version without calling generation", async () => {
    const unavailable: CliServices = { generate: () => Promise.reject(new Error("must not run")) };
    const help = await invoke(["--help"], unavailable);
    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("Usage:");
    expect(await invoke(["--version"], unavailable)).toEqual({ exitCode: 0, stdout: "0.1.0\n", stderr: "" });
  });
});

function successfulServices(): CliServices {
  return {
    generate: (options) => Promise.resolve({
      destination: options.destination,
      files: 1,
      actions: { rendered: true, installed: options.install, gitInitialized: options.initializeGit },
      recoveryPath: null,
    }),
  };
}

async function invoke(arguments_: readonly string[], services: CliServices) {
  let stdout = "";
  let stderr = "";
  const exitCode = await runCli(arguments_, {
    stdout: (text) => { stdout += text; },
    stderr: (text) => { stderr += text; },
  }, services, cwd);
  return { exitCode, stdout, stderr };
}