import path from "node:path";
import { describe, expect, it } from "vitest";
import { CliInputError, parseCliArguments } from "../src/options.js";

const cwd = path.resolve("/tmp/create-web-app-options");

describe("CLI option normalization", () => {
  it.each([
    {
      arguments: ["orders-app", "--yes"],
      expected: { packageName: "orders-app", displayName: "Orders App", destination: path.join(cwd, "orders-app"), install: true, initializeGit: true, json: false },
    },
    {
      arguments: ["--name", "@wealth/orders", "--display-name", "Ordres – Europe", "--directory", "apps/orders", "--no-install", "--no-git", "--json"],
      expected: { packageName: "@wealth/orders", displayName: "Ordres – Europe", destination: path.join(cwd, "apps/orders"), install: false, initializeGit: false, json: true },
    },
  ])("normalizes $arguments", ({ arguments: arguments_, expected }) => {
    expect(parseCliArguments(arguments_, cwd)).toEqual({ kind: "generate", options: expected });
  });

  it("returns interactive defaults when no name is supplied", () => {
    expect(parseCliArguments(["--no-install"], cwd)).toEqual({
      kind: "interactive",
      defaults: { install: false, initializeGit: true, json: false },
    });
  });

  it.each([
    [["--unknown"], "invalid_arguments"],
    [["first", "second"], "invalid_arguments"],
    [["--name", "first", "second"], "incompatible_options"],
    [["--yes"], "missing_name"],
    [["--name", "Invalid Name", "--yes"], "invalid_package_name"],
    [["app", "--install", "--no-install"], "incompatible_options"],
    [["app", "--git", "--no-git"], "incompatible_options"],
    [["app", "--display-name", "   "], "invalid_display_name"],
  ] as const)("returns stable error for %j", (arguments_, code) => {
    expect.assertions(2);
    try {
      parseCliArguments(arguments_, cwd);
    } catch (error) {
      expect(error).toBeInstanceOf(CliInputError);
      expect((error as CliInputError).code).toBe(code);
    }
  });

  it("recognizes help and version without requiring a name", () => {
    expect(parseCliArguments(["--help"], cwd)).toEqual({ kind: "help" });
    expect(parseCliArguments(["--version"], cwd)).toEqual({ kind: "version" });
  });
});