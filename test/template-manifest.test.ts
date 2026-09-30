import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { canonicalJson, sha256 } from "../src/canonical-json.js";
import { createTemplateManifest, verifyTemplate } from "../src/template-manifest.js";

const temporary: string[] = [];

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe("template manifest", () => {
  it("verifies the complete declared tree", async () => {
    const root = await fixture();
    await expect(verifyTemplate(root)).resolves.toMatchObject({ files: ["manifest.json", "source.txt"] });
  });

  it("rejects altered, undeclared, and missing files", async () => {
    const altered = await fixture();
    await fs.writeFile(path.join(altered, "source.txt"), "changed\n");
    await expect(verifyTemplate(altered)).rejects.toThrow(/digest mismatch/);

    const undeclared = await fixture();
    await fs.writeFile(path.join(undeclared, "extra.txt"), "extra\n");
    await expect(verifyTemplate(undeclared)).rejects.toThrow(/undeclared extra\.txt/);

    const missing = await fixture();
    await fs.rm(path.join(missing, "source.txt"));
    await expect(verifyTemplate(missing)).rejects.toThrow(/missing source\.txt/);
  });
});

async function fixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "create-web-app-template-"));
  temporary.push(root);
  const contents = "model source\n";
  await fs.writeFile(path.join(root, "source.txt"), contents, { mode: 0o644 });
  const manifest = createTemplateManifest([{ path: "source.txt", digest: sha256(contents), mode: "0644", substitution: "none" }]);
  await fs.writeFile(path.join(root, "manifest.json"), `${canonicalJson(manifest)}\n`);
  return root;
}