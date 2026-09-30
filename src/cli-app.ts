import process from "node:process";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "./canonical-json.js";
import { GENERATOR_VERSION, TEMPLATE_VERSION } from "./version.js";
import { CliInputError, parseCliArguments, type NormalizedOptions } from "./options.js";
import { PostActionError, runPostActions } from "./post-actions.js";
import { PromptCancelledError, resolveInteractiveOptions } from "./prompts.js";
import { RenderError, renderTemplate } from "./render.js";

export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

export interface GenerationOutcome {
  destination: string;
  files: number;
  actions: {
    rendered: boolean;
    installed: boolean;
    gitInitialized: boolean;
  };
  recoveryPath: string | null;
}

export interface CliServices {
  generate: (options: NormalizedOptions, cwd: string) => Promise<GenerationOutcome>;
  prompt?: (defaults: Partial<NormalizedOptions>, cwd: string) => Promise<NormalizedOptions>;
}

export class CliExecutionError extends Error {
  override readonly name = "CliExecutionError";

  constructor(readonly code: string, message: string, readonly recoveryPath: string | null = null) {
    super(message);
  }
}

const HELP = `create-web-app ${GENERATOR_VERSION}

Usage: create-web-app <name> [options]

Options:
  --name <package>         npm package name (positional name is also accepted)
  --display-name <name>    human-readable application name
  --directory <path>       destination directory
  --install | --no-install install dependencies (default: install)
  --git | --no-git         initialize Git on main (default: initialize)
  -y, --yes                use defaults without prompts
  --json                   write one structured result to stdout
  -v, --version            print the generator version
  -h, --help               show this help
`;

export async function runCli(
  arguments_: readonly string[],
  io: CliIo = processIo(),
  services: CliServices = defaultServices(),
  cwd = process.cwd(),
): Promise<number> {
  const jsonRequested = arguments_.includes("--json");
  try {
    const request = parseCliArguments(arguments_, cwd);
    if (request.kind === "help") {
      io.stdout(HELP);
      return 0;
    }
    if (request.kind === "version") {
      io.stdout(`${GENERATOR_VERSION}\n`);
      return 0;
    }
    const options = request.kind === "interactive"
      ? await (services.prompt ?? resolveInteractiveOptions)(request.defaults, cwd)
      : request.options;
    const outcome = await services.generate(options, cwd);
    const result = {
      schema: "create-web-app.cli-result",
      schemaVersion: 1,
      success: true,
      generatorVersion: GENERATOR_VERSION,
      templateVersion: TEMPLATE_VERSION,
      options,
      paths: { destination: outcome.destination },
      actions: outcome.actions,
      files: outcome.files,
      recoveryPath: outcome.recoveryPath,
      verification: ["npm run check", "npm run build", "npm run build:storybook", "npm run test:visual"],
    } as const;
    if (options.json) io.stdout(`${canonicalJson(result)}\n`);
    else {
      io.stdout(`Created ${options.displayName} at ${outcome.destination}\n`);
      io.stdout(`Next: cd ${JSON.stringify(outcome.destination)} && npm run check\n`);
    }
    return 0;
  } catch (error) {
    const normalized = normalizeError(error);
    const result = {
      schema: "create-web-app.cli-result",
      schemaVersion: 1,
      success: false,
      generatorVersion: GENERATOR_VERSION,
      templateVersion: TEMPLATE_VERSION,
      error: { code: normalized.code, message: normalized.message },
      recoveryPath: normalized.recoveryPath,
    } as const;
    if (jsonRequested) io.stdout(`${canonicalJson(result)}\n`);
    else io.stderr(`create-web-app: ${normalized.message}\n`);
    return normalized.exitCode;
  }
}

function normalizeError(error: unknown): { code: string; message: string; recoveryPath: string | null; exitCode: 1 | 2 } {
  if (error instanceof CliInputError) return { code: error.code, message: error.message, recoveryPath: null, exitCode: 2 };
  if (error instanceof PromptCancelledError) return { code: "cancelled", message: error.message, recoveryPath: null, exitCode: 1 };
  if (error instanceof RenderError) return { code: "render_failed", message: error.message, recoveryPath: error.recoveryPath, exitCode: 1 };
  if (error instanceof PostActionError) return { code: `${error.action}_failed`, message: error.message, recoveryPath: error.destination, exitCode: 1 };
  if (error instanceof CliExecutionError) return { code: error.code, message: error.message, recoveryPath: error.recoveryPath, exitCode: 1 };
  return { code: "internal_error", message: error instanceof Error ? error.message : String(error), recoveryPath: null, exitCode: 1 };
}

function defaultServices(): CliServices {
  return {
    generate: async (options, cwd) => {
      const rendered = await renderTemplate({
        templateRoot: fileURLToPath(new URL("../template", import.meta.url)),
        destination: options.destination,
        invocationRoot: cwd,
        substitutions: {
          packageName: options.packageName,
          displayName: options.displayName,
          generatorVersion: GENERATOR_VERSION,
          templateVersion: TEMPLATE_VERSION,
        },
      });
      const actions = await runPostActions({
        destination: rendered.destination,
        install: options.install,
        initializeGit: options.initializeGit,
      });
      return {
        destination: rendered.destination,
        files: rendered.files.length,
        actions: { rendered: true, ...actions },
        recoveryPath: null,
      };
    },
  };
}

function processIo(): CliIo {
  return {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  };
}