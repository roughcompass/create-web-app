import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { canonicalJson, createTemplateManifest, sha256 } from "../dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const template = path.join(root, "template");
const files = [];
await visit(template, "");
const manifest = createTemplateManifest(files);
await fs.writeFile(path.join(template, "manifest.json"), `${canonicalJson(manifest)}\n`, "utf8");
process.stdout.write(`Template manifest: ${String(files.length)} files\n`);

async function visit(directory, relativeDirectory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const relative = relativeDirectory === "" ? entry.name : path.posix.join(relativeDirectory, entry.name);
    if (relative === "manifest.json") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(absolute, relative);
    else if (entry.isFile()) {
      const stat = await fs.stat(absolute);
      files.push({
        path: relative,
        digest: sha256(await fs.readFile(absolute)),
        mode: (stat.mode & 0o111) === 0 ? "0644" : "0755",
        substitution: substitutionFor(relative),
      });
    } else throw new Error(`Template path ${relative} is not a regular file`);
  }
}

function substitutionFor(file) {
  if (/\.(?:png|jpe?g|gif|webp|woff2?)$/iu.test(file)) return "none";
  if (file.endsWith(".json")) return "json";
  if (/\.ya?ml$/u.test(file)) return "yaml";
  return "text";
}