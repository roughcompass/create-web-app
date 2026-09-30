import path from "node:path";
import * as clack from "@clack/prompts";
import { parseCliArguments, type NormalizedOptions } from "./options.js";

export interface PromptAdapter {
  text: (options: { message: string; initialValue?: string; placeholder?: string }) => Promise<string>;
  confirm: (options: { message: string; initialValue: boolean }) => Promise<boolean>;
  note: (message: string, title: string) => void;
}

export class PromptCancelledError extends Error {
  override readonly name = "PromptCancelledError";

  constructor() {
    super("Generation was cancelled before writing files.");
  }
}

export async function resolveInteractiveOptions(
  defaults: Partial<NormalizedOptions>,
  cwd: string,
  prompts: PromptAdapter = clackAdapter(),
): Promise<NormalizedOptions> {
  const packageName = await prompts.text({ message: "npm package name", placeholder: "my-web-app" });
  const baseRequest = parseCliArguments([packageName, "--yes"], cwd);
  if (baseRequest.kind !== "generate") throw new Error("Interactive package name did not normalize to generation options");
  const displayName = await prompts.text({
    message: "Application display name",
    initialValue: defaults.displayName ?? baseRequest.options.displayName,
  });
  const destination = await prompts.text({
    message: "Destination directory",
    initialValue: defaults.destination ?? baseRequest.options.destination,
  });
  const install = await prompts.confirm({ message: "Install dependencies after generation?", initialValue: defaults.install ?? true });
  const initializeGit = await prompts.confirm({ message: "Initialize a Git repository on main?", initialValue: defaults.initializeGit ?? true });
  prompts.note([
    `Package: ${packageName}`,
    `Display: ${displayName}`,
    `Destination: ${path.resolve(cwd, destination)}`,
    `Install: ${install ? "yes" : "no"}`,
    `Git: ${initializeGit ? "yes" : "no"}`,
  ].join("\n"), "Generation plan");
  const confirmed = await prompts.confirm({ message: "Create this application?", initialValue: true });
  if (!confirmed) throw new PromptCancelledError();
  const request = parseCliArguments([
    "--name", packageName,
    "--display-name", displayName,
    "--directory", destination,
    install ? "--install" : "--no-install",
    initializeGit ? "--git" : "--no-git",
    "--yes",
  ], cwd);
  if (request.kind !== "generate") throw new Error("Interactive options did not normalize to generation options");
  return request.options;
}

function clackAdapter(): PromptAdapter {
  return {
    text: async (options) => textValue(await clack.text(options)),
    confirm: async (options) => booleanValue(await clack.confirm(options)),
    note: (message, title) => {
      clack.note(message, title);
    },
  };
}

function textValue(result: string | symbol): string {
  if (typeof result === "symbol") throw new PromptCancelledError();
  return result;
}

function booleanValue(result: boolean | symbol): boolean {
  if (typeof result === "symbol") throw new PromptCancelledError();
  return result;
}