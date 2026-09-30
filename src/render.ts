import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import YAML from "yaml";
import { canonicalJson } from "./canonical-json.js";
import { validateDestination } from "./destination.js";
import { verifyTemplate, type TemplateManifest } from "./template-manifest.js";

export type RenderPhase = "activate" | "read" | "render" | "scan" | "write";

export interface TemplateSubstitutions {
  packageName: string;
  displayName: string;
  generatorVersion: string;
  templateVersion: string;
}

export interface RenderHooks {
  beforeRead?: (file: string) => Promise<void> | void;
  beforeRender?: (file: string) => Promise<void> | void;
  beforeWrite?: (file: string) => Promise<void> | void;
  beforeActivate?: (destination: string) => Promise<void> | void;
}

export interface RenderTemplateOptions {
  templateRoot: string;
  destination: string;
  invocationRoot: string;
  substitutions: TemplateSubstitutions;
  hooks?: RenderHooks;
}

export interface RenderedTemplate {
  destination: string;
  files: string[];
  manifestDigest: string;
}

export class RenderError extends Error {
  override readonly name = "RenderError";

  constructor(readonly phase: RenderPhase, message: string, readonly recoveryPath: string | null) {
    super(message);
  }
}

export async function renderTemplate(options: RenderTemplateOptions): Promise<RenderedTemplate> {
  const validated = await validateDestination(options.destination, options.invocationRoot);
  const verified = await verifyTemplate(options.templateRoot);
  const templateRoot = await fs.realpath(options.templateRoot);
  await fs.mkdir(path.dirname(validated.destination), { recursive: true });
  const staging = await fs.mkdtemp(path.join(path.dirname(validated.destination), `.${path.basename(validated.destination)}.create-web-app-`));
  let phase: RenderPhase = "read";
  let removedEmptyDestination = false;
  try {
    for (const declaration of verified.manifest.files) {
      phase = "read";
      await options.hooks?.beforeRead?.(declaration.path);
      const source = await fs.readFile(path.join(templateRoot, ...declaration.path.split("/")));
      phase = "render";
      await options.hooks?.beforeRender?.(declaration.path);
      const rendered = renderContents(source, declaration, options.substitutions);
      phase = "write";
      await options.hooks?.beforeWrite?.(declaration.path);
      const output = path.join(staging, ...declaration.path.split("/"));
      await fs.mkdir(path.dirname(output), { recursive: true });
      await fs.writeFile(output, rendered, { mode: declaration.mode === "0755" ? 0o755 : 0o644 });
    }
    phase = "scan";
    await scanRenderedTree(staging, verified.manifest, options);
    phase = "activate";
    if (validated.existed) {
      await fs.rmdir(validated.destination);
      removedEmptyDestination = true;
    }
    await options.hooks?.beforeActivate?.(validated.destination);
    await fs.rename(staging, validated.destination);
    return {
      destination: validated.destination,
      files: verified.manifest.files.map((file) => file.path),
      manifestDigest: verified.manifestDigest,
    };
  } catch (error) {
    let recoveryPath: string | null = null;
    try {
      await fs.rm(staging, { recursive: true, force: true });
    } catch {
      recoveryPath = staging;
    }
    if (removedEmptyDestination) await fs.mkdir(validated.destination, { recursive: true });
    const message = error instanceof Error ? error.message : String(error);
    throw new RenderError(phase, `Generation failed during ${phase}: ${message}`, recoveryPath);
  }
}

function renderContents(source: Buffer, declaration: TemplateManifest["files"][number], substitutions: TemplateSubstitutions): Buffer {
  if (declaration.substitution === "none") return source;
  const text = source.toString("utf8");
  if (declaration.substitution === "text") return Buffer.from(replacePlaceholders(text, substitutions), "utf8");
  if (declaration.substitution === "json") {
    const value = replaceStructured(JSON.parse(text) as unknown, substitutions);
    return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  }
  const value = replaceStructured(YAML.parse(text) as unknown, substitutions);
  return Buffer.from(YAML.stringify(value), "utf8");
}

function replaceStructured(value: unknown, substitutions: TemplateSubstitutions): unknown {
  if (typeof value === "string") return replacePlaceholders(value, substitutions);
  if (Array.isArray(value)) return value.map((entry) => replaceStructured(entry, substitutions));
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
      replacePlaceholders(key, substitutions),
      replaceStructured(entry, substitutions),
    ]));
  }
  return value;
}

function replacePlaceholders(text: string, substitutions: TemplateSubstitutions): string {
  const replacements: Record<string, string> = {
    "{{PACKAGE_NAME}}": substitutions.packageName,
    "{{DISPLAY_NAME}}": substitutions.displayName,
    "{{GENERATOR_VERSION}}": substitutions.generatorVersion,
    "{{TEMPLATE_VERSION}}": substitutions.templateVersion,
  };
  return Object.entries(replacements).reduce((result, [placeholder, replacement]) => result.replaceAll(placeholder, replacement), text);
}

async function scanRenderedTree(staging: string, manifest: TemplateManifest, options: RenderTemplateOptions): Promise<void> {
  const actual = await listFiles(staging);
  const expected = manifest.files.map((file) => file.path);
  if (canonicalJson(actual) !== canonicalJson(expected)) throw new Error("Rendered file set differs from the template manifest");
  const forbiddenPaths = [os.homedir(), path.resolve(options.templateRoot), path.resolve(options.invocationRoot)].filter((entry) => entry.length > 1);
  const credential = /(?:gho_|github_pat_|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|_authToken\s*=\s*[^$\s])/u;
  const unresolved = /\{\{[A-Z][A-Z0-9_]*\}\}/u;
  for (const file of actual) {
    const contents = await fs.readFile(path.join(staging, ...file.split("/")));
    if (contents.includes(0)) continue;
    const text = contents.toString("utf8");
    if (unresolved.test(text)) throw new Error(`Rendered file ${file} contains an unresolved placeholder`);
    if (credential.test(text)) throw new Error(`Rendered file ${file} contains a credential marker`);
    if (forbiddenPaths.some((forbidden) => text.includes(forbidden))) throw new Error(`Rendered file ${file} contains a host-specific path`);
  }
}

async function listFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  await visit(root, "");
  return files.sort();

  async function visit(directory: string, relativeDirectory: string): Promise<void> {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const relative = relativeDirectory === "" ? entry.name : path.posix.join(relativeDirectory, entry.name);
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute, relative);
      else if (entry.isFile()) files.push(relative);
      else throw new Error(`Rendered path ${relative} is not a regular file`);
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

export function stagingToken(): string {
  return crypto.randomUUID();
}