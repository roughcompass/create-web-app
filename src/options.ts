import path from "node:path";
import { parseArgs } from "node:util";
import npa from "npm-package-arg";
import * as z from "zod/v4";

export const normalizedOptionsSchema = z.strictObject({
  packageName: z.string().min(1),
  displayName: z.string().trim().min(1).max(100),
  destination: z.string().min(1),
  install: z.boolean(),
  initializeGit: z.boolean(),
  json: z.boolean(),
});

export type NormalizedOptions = z.infer<typeof normalizedOptionsSchema>;

export type CliRequest =
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "interactive"; defaults: Partial<NormalizedOptions> }
  | { kind: "generate"; options: NormalizedOptions };

export type CliInputErrorCode = "incompatible_options" | "invalid_arguments" | "invalid_display_name" | "invalid_package_name" | "missing_name";

export class CliInputError extends Error {
  override readonly name = "CliInputError";

  constructor(readonly code: CliInputErrorCode, message: string) {
    super(message);
  }
}

const CLI_OPTIONS = {
  name: { type: "string" },
  "display-name": { type: "string" },
  directory: { type: "string" },
  install: { type: "boolean" },
  "no-install": { type: "boolean" },
  git: { type: "boolean" },
  "no-git": { type: "boolean" },
  json: { type: "boolean" },
  yes: { type: "boolean", short: "y" },
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" },
} as const;

export function parseCliArguments(arguments_: readonly string[], cwd = process.cwd()): CliRequest {
  let parsed: ReturnType<typeof parseArguments>;
  try {
    parsed = parseArguments(arguments_);
  } catch {
    throw new CliInputError("invalid_arguments", "Arguments are invalid. Run create-web-app --help for supported options.");
  }
  const { values, positionals } = parsed;
  if (values.help === true) return { kind: "help" };
  if (values.version === true) return { kind: "version" };
  if (positionals.length > 1) throw new CliInputError("invalid_arguments", "Provide at most one positional application name.");
  const positionalName = positionals[0];
  if (values.name !== undefined && positionalName !== undefined && values.name !== positionalName) {
    throw new CliInputError("incompatible_options", "The positional name and --name must match when both are provided.");
  }
  const packageName = values.name ?? positionalName;
  const install = toggle(values.install, values["no-install"], "--install", "--no-install", true);
  const initializeGit = toggle(values.git, values["no-git"], "--git", "--no-git", true);
  const json = values.json === true;
  const automation = values.yes === true || json;
  if (packageName === undefined) {
    if (automation) throw new CliInputError("missing_name", "A package name is required with --yes or --json.");
    return {
      kind: "interactive",
      defaults: {
        ...(values["display-name"] === undefined ? {} : { displayName: normalizeDisplayName(values["display-name"]) }),
        ...(values.directory === undefined ? {} : { destination: path.resolve(cwd, values.directory) }),
        install,
        initializeGit,
        json,
      },
    };
  }
  validatePackageName(packageName);
  const unscopedName = packageName.includes("/") ? packageName.slice(packageName.lastIndexOf("/") + 1) : packageName;
  return {
    kind: "generate",
    options: normalizedOptionsSchema.parse({
      packageName,
      displayName: normalizeDisplayName(values["display-name"] ?? titleize(unscopedName)),
      destination: path.resolve(cwd, values.directory ?? unscopedName),
      install,
      initializeGit,
      json,
    }),
  };
}

function parseArguments(arguments_: readonly string[]) {
  return parseArgs({
    args: [...arguments_],
    allowPositionals: true,
    strict: true,
    options: CLI_OPTIONS,
  });
}

function toggle(positive: boolean | undefined, negative: boolean | undefined, positiveName: string, negativeName: string, fallback: boolean): boolean {
  if (positive === true && negative === true) {
    throw new CliInputError("incompatible_options", `${positiveName} and ${negativeName} cannot be used together.`);
  }
  if (positive === true) return true;
  if (negative === true) return false;
  return fallback;
}

function validatePackageName(packageName: string): void {
  try {
    const parsed = npa.resolve(packageName, "1.0.0");
    if (parsed.name !== packageName || parsed.type !== "version") throw new Error("not an exact registry package");
  } catch {
    throw new CliInputError("invalid_package_name", `Invalid npm package name: ${JSON.stringify(packageName)}.`);
  }
}

function normalizeDisplayName(value: string): string {
  const trimmed = value.trim();
  let hasControlCharacter = false;
  for (const character of trimmed) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 31 || codePoint === 127) {
      hasControlCharacter = true;
      break;
    }
  }
  if (trimmed.length === 0 || trimmed.length > 100 || hasControlCharacter) {
    throw new CliInputError("invalid_display_name", "Display name must contain 1 to 100 printable characters.");
  }
  return trimmed;
}

function titleize(value: string): string {
  return value.split(/[-_]+/u).filter(Boolean).map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`).join(" ");
}