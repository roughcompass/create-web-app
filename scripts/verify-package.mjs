import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { readProvenance, verifyTemplate } from "../dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const lifecycle = ["preinstall", "install", "postinstall", "prepack", "prepare", "postpack"];
const forbiddenScripts = lifecycle.filter((name) => packageJson.scripts?.[name] !== undefined);
if (forbiddenScripts.length > 0) throw new Error(`Lifecycle scripts are forbidden: ${forbiddenScripts.join(", ")}`);

await readProvenance(path.join(root, "provenance.json"));
await verifyTemplate(path.join(root, "template"));

const packed = spawnSync("npm", ["pack", "--dry-run", "--json"], { cwd: root, encoding: "utf8" });
if (packed.status !== 0) throw new Error(packed.stderr || "npm pack failed");
const report = JSON.parse(packed.stdout)[0];
if (report === undefined || !Array.isArray(report.files)) throw new Error("npm pack returned no file report");
const allowed = ["README.md", "package.json", "provenance.json"];
for (const entry of report.files) {
  if (typeof entry.path !== "string") throw new Error("npm pack returned an invalid file path");
  if (!allowed.includes(entry.path) && !entry.path.startsWith("dist/") && !entry.path.startsWith("docs/") && !entry.path.startsWith("template/")) {
    throw new Error(`Unexpected published file ${entry.path}`);
  }
}
for (const required of ["dist/cli.js", "dist/index.js", "docs/cli.md", "provenance.json", "template/manifest.json"]) {
  if (!report.files.some((entry) => entry.path === required)) throw new Error(`Published package is missing ${required}`);
}
process.stdout.write(`Package verified: ${String(report.entryCount)} files\n`);