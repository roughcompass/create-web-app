import path from "node:path";
import { describe, expect, it } from "vitest";
import { runCli, type CliServices } from "../src/cli-app.js";
import { parseCliArguments } from "../src/options.js";
import { PromptCancelledError, resolveInteractiveOptions, type PromptAdapter } from "../src/prompts.js";

const cwd = path.resolve("/tmp/create-web-app-prompts");

describe("interactive option collection", () => {
  it("normalizes to the same options as explicit arguments", async () => {
    const prompts = scripted(["@wealth/orders", "Wealth Orders", "apps/orders"], [false, false, true]);
    const interactive = await resolveInteractiveOptions({}, cwd, prompts.adapter);
    const explicit = parseCliArguments([
      "--name", "@wealth/orders",
      "--display-name", "Wealth Orders",
      "--directory", "apps/orders",
      "--no-install",
      "--no-git",
      "--yes",
    ], cwd);
    expect(explicit.kind).toBe("generate");
    if (explicit.kind !== "generate") throw new Error("Explicit arguments did not produce generation options");
    expect(interactive).toEqual(explicit.options);
    expect(prompts.notes).toContainEqual(expect.objectContaining({ title: "Generation plan" }));
  });

  it("cancels before generation when final confirmation is declined", async () => {
    const prompts = scripted(["orders", "Orders", "orders"], [true, true, false]);
    await expect(resolveInteractiveOptions({}, cwd, prompts.adapter)).rejects.toBeInstanceOf(PromptCancelledError);
  });

  it("routes an interactive CLI request through the prompt service", async () => {
    let receivedPackage = "";
    const services: CliServices = {
      prompt: () => Promise.resolve({
        packageName: "orders",
        displayName: "Orders",
        destination: path.join(cwd, "orders"),
        install: false,
        initializeGit: false,
        json: false,
      }),
      generate: (options) => {
        receivedPackage = options.packageName;
        return Promise.resolve({
          destination: options.destination,
          files: 1,
          actions: { rendered: true, installed: false, gitInitialized: false },
          recoveryPath: null,
        });
      },
    };
    let stdout = "";
    let stderr = "";
    const exitCode = await runCli([], {
      stdout: (text) => { stdout += text; },
      stderr: (text) => { stderr += text; },
    }, services, cwd);
    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(receivedPackage).toBe("orders");
    expect(stdout).toContain("Created Orders");
  });
});

function scripted(texts: string[], confirmations: boolean[]) {
  const notes: { message: string; title: string }[] = [];
  const adapter: PromptAdapter = {
    text: () => {
      const next = texts.shift();
      if (next === undefined) return Promise.reject(new Error("No scripted text response"));
      return Promise.resolve(next);
    },
    confirm: () => {
      const next = confirmations.shift();
      if (next === undefined) return Promise.reject(new Error("No scripted confirmation response"));
      return Promise.resolve(next);
    },
    note: (message, title) => {
      notes.push({ message, title });
    },
  };
  return { adapter, notes };
}