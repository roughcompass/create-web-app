import fs from "node:fs/promises";
import path from "node:path";
import * as z from "zod/v4";
import { digestDocument, sha256 } from "./canonical-json.js";
import { GENERATOR_VERSION, TEMPLATE_VERSION } from "./version.js";

const relativePathSchema = z.string().min(1).superRefine((value, context) => {
  if (value.startsWith("/") || value.includes("\\") || value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    context.addIssue({ code: "custom", message: "Template paths must be normalized relative POSIX paths" });
  }
});

export const templateManifestSchema = z.strictObject({
  schema: z.literal("create-web-app.template-manifest"),
  schemaVersion: z.literal(1),
  generatorVersion: z.string().min(1),
  templateVersion: z.string().min(1),
  files: z.array(z.strictObject({
    path: relativePathSchema,
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    mode: z.enum(["0644", "0755"]),
    substitution: z.enum(["none", "text", "json", "yaml"]),
  })).min(1),
}).superRefine((manifest, context) => {
  const paths = manifest.files.map((file) => file.path);
  if (new Set(paths).size !== paths.length) context.addIssue({ code: "custom", path: ["files"], message: "Template file paths must be unique" });
  if (paths.some((file, index) => {
    const previous = paths[index - 1];
    return previous !== undefined && previous >= file;
  })) {
    context.addIssue({ code: "custom", path: ["files"], message: "Template files must use strict lexical order" });
  }
});

export type TemplateManifest = z.infer<typeof templateManifestSchema>;

export interface VerifiedTemplate {
  manifest: TemplateManifest;
  manifestDigest: string;
  files: string[];
}

export async function verifyTemplate(templateRoot: string): Promise<VerifiedTemplate> {
  const root = await fs.realpath(templateRoot);
  const manifest = templateManifestSchema.parse(JSON.parse(await fs.readFile(path.join(root, "manifest.json"), "utf8")) as unknown);
  if (manifest.generatorVersion !== GENERATOR_VERSION || manifest.templateVersion !== TEMPLATE_VERSION) {
    throw new Error("Template manifest version does not match this generator release");
  }
  const actual = await listFiles(root);
  const declared = manifest.files.map((file) => file.path);
  const unexpected = actual.filter((file) => file !== "manifest.json" && !declared.includes(file));
  const missing = declared.filter((file) => !actual.includes(file));
  if (unexpected.length > 0 || missing.length > 0) {
    throw new Error(`Template file set mismatch: ${[
      ...missing.map((file) => `missing ${file}`),
      ...unexpected.map((file) => `undeclared ${file}`),
    ].sort().join(", ")}`);
  }
  for (const declaration of manifest.files) {
    const file = path.join(root, ...declaration.path.split("/"));
    const stat = await fs.lstat(file);
    if (!stat.isFile()) throw new Error(`Template path ${declaration.path} is not a regular file`);
    const digest = sha256(await fs.readFile(file));
    if (digest !== declaration.digest) throw new Error(`Template digest mismatch for ${declaration.path}`);
    const mode = (stat.mode & 0o111) === 0 ? "0644" : "0755";
    if (mode !== declaration.mode) throw new Error(`Template mode mismatch for ${declaration.path}`);
  }
  return { manifest, manifestDigest: digestDocument(manifest).digest, files: actual };
}

export function createTemplateManifest(files: TemplateManifest["files"]): TemplateManifest {
  return templateManifestSchema.parse({
    schema: "create-web-app.template-manifest",
    schemaVersion: 1,
    generatorVersion: GENERATOR_VERSION,
    templateVersion: TEMPLATE_VERSION,
    files: [...files].sort((left, right) => compareCodeUnits(left.path, right.path)),
  });
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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
      else throw new Error(`Template path ${relative} is not a regular file`);
    }
  }
}