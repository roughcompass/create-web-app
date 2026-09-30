import { spawn } from "node:child_process";
import process from "node:process";

const OUTPUT_LIMIT = 8_192;

export type PostAction = "git" | "install";

export interface CommandRequest {
  command: string;
  args: string[];
  cwd: string;
}

export interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (request: CommandRequest) => Promise<CommandResult>;

export interface PostActionOptions {
  destination: string;
  install: boolean;
  initializeGit: boolean;
  runner?: CommandRunner;
}

export interface PostActionResult {
  installed: boolean;
  gitInitialized: boolean;
}

export class PostActionError extends Error {
  override readonly name = "PostActionError";

  constructor(readonly action: PostAction, message: string, readonly destination: string) {
    super(message);
  }
}

export async function runPostActions(options: PostActionOptions): Promise<PostActionResult> {
  const runner = options.runner ?? runCommand;
  let installed = false;
  let gitInitialized = false;
  if (options.install) {
    await checked(runner, "install", {
      command: "npm",
      args: ["ci", "--ignore-scripts"],
      cwd: options.destination,
    }, options.destination);
    installed = true;
  }
  if (options.initializeGit) {
    await checked(runner, "git", {
      command: "git",
      args: ["init", "--initial-branch=main"],
      cwd: options.destination,
    }, options.destination);
    gitInitialized = true;
  }
  return { installed, gitInitialized };
}

async function checked(runner: CommandRunner, action: PostAction, request: CommandRequest, destination: string): Promise<void> {
  let result: CommandResult;
  try {
    result = await runner(request);
  } catch (error) {
    throw new PostActionError(action, `${request.command} could not start: ${bounded(error instanceof Error ? error.message : String(error))}`, destination);
  }
  if (result.status !== 0) {
    const detail = bounded(result.stderr.trim() || result.stdout.trim() || `exit status ${String(result.status)}`);
    throw new PostActionError(action, `${request.command} failed: ${detail}`, destination);
  }
}

function runCommand(request: CommandRequest): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(request.command, request.args, {
      cwd: request.cwd,
      env: { ...process.env, npm_config_ignore_scripts: "true" },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout = bounded(`${stdout}${chunk}`); });
    child.stderr.on("data", (chunk: string) => { stderr = bounded(`${stderr}${chunk}`); });
    child.once("error", reject);
    child.once("close", (code) => {
      resolve({ status: code ?? 1, stdout, stderr });
    });
  });
}

function bounded(value: string): string {
  return value.length <= OUTPUT_LIMIT ? value : value.slice(value.length - OUTPUT_LIMIT);
}