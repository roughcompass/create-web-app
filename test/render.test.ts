import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { canonicalJson, sha256 } from "../src/canonical-json.js";
import { RenderError, renderTemplate, type RenderHooks } from "../src/render.js";
import { createTemplateManifest, type TemplateManifest } from "../src/template-manifest.js";

const temporary: string[] = [];

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe("transactional template rendering", () => {
  it("renders text, JSON, and YAML structurally and deterministically", async () => {
    const fixture = await buildFixture();
    const first = await render(fixture, "first");
    const second = await render(fixture, "second");
    expect(await tree(first.destination)).toEqual(await tree(second.destination));
    expect(JSON.parse(await fs.readFile(path.join(first.destination, "package.json"), "utf8"))).toMatchObject({ name: "@wealth/orders", displayName: "Wealth Orders" });
    expect(await fs.readFile(path.join(first.destination, "README.md"), "utf8")).toContain("Wealth Orders");
    expect(await fs.readFile(path.join(first.destination, "workflow.yml"), "utf8")).toContain("@wealth/orders");
  });

  it.each(["read", "render", "write", "activate"] as const)("cleans staging after an injected %s failure", async (phase) => {
    const fixture = await buildFixture();
    const sentinel = path.join(fixture.root, "sentinel.txt");
    await fs.writeFile(sentinel, "keep\n");
    const hooks: RenderHooks = {
      ...(phase === "read" ? { beforeRead: () => { throw new Error("read failed"); } } : {}),
      ...(phase === "render" ? { beforeRender: () => { throw new Error("render failed"); } } : {}),
      ...(phase === "write" ? { beforeWrite: () => { throw new Error("write failed"); } } : {}),
      ...(phase === "activate" ? { beforeActivate: () => { throw new Error("activate failed"); } } : {}),
    };
    await expect(render(fixture, `failure-${phase}`, hooks)).rejects.toMatchObject({ phase, recoveryPath: null });
    await expect(fs.readFile(sentinel, "utf8")).resolves.toBe("keep\n");
    expect((await fs.readdir(fixture.root)).filter((entry) => entry.includes(".create-web-app-"))).toEqual([]);
  });

  it("restores a pre-existing empty destination after activation failure", async () => {
    const fixture = await buildFixture();
    const destination = path.join(fixture.root, "empty");
    await fs.mkdir(destination);
    await expect(renderTemplate({
      ...renderOptions(fixture, destination),
      hooks: { beforeActivate: () => { throw new Error("rename failed"); } },
    })).rejects.toBeInstanceOf(RenderError);
    expect(await fs.readdir(destination)).toEqual([]);
  });

  it("rejects unresolved placeholders and credential markers", async () => {
    const placeholder = await buildFixture({ "README.md": "{{UNKNOWN}}\n" });
    await expect(render(placeholder, "placeholder")).rejects.toThrow(/unresolved placeholder/);
    const credential = await buildFixture({ "README.md": "_authToken=literal-secret\n" });
    await expect(render(credential, "credential")).rejects.toThrow(/credential marker/);
  });
});

async function render(fixture: Awaited<ReturnType<typeof buildFixture>>, name: string, hooks?: RenderHooks) {
  return renderTemplate({ ...renderOptions(fixture, path.join(fixture.root, name)), ...(hooks === undefined ? {} : { hooks }) });
}

function renderOptions(fixture: Awaited<ReturnType<typeof buildFixture>>, destination: string) {
  return {
    templateRoot: fixture.template,
    destination,
    invocationRoot: fixture.root,
    substitutions: {
      packageName: "@wealth/orders",
      displayName: "Wealth Orders",
      generatorVersion: "0.1.0",
      templateVersion: "0.1.0",
    },
  };
}

async function buildFixture(overrides: Record<string, string> = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "create-web-app-render-"));
  temporary.push(root);
  const template = path.join(root, "template-source");
  await fs.mkdir(template);
  const files: Record<string, { contents: string; substitution: TemplateManifest["files"][number]["substitution"] }> = {
    "README.md": { contents: "# {{DISPLAY_NAME}}\n", substitution: "text" },
    "package.json": { contents: '{"name":"{{PACKAGE_NAME}}","displayName":"{{DISPLAY_NAME}}"}\n', substitution: "json" },
    "workflow.yml": { contents: "application: '{{PACKAGE_NAME}}'\n", substitution: "yaml" },
  };
  for (const [file, contents] of Object.entries(overrides)) files[file] = { contents, substitution: "text" };
  const declarations: TemplateManifest["files"] = [];
  for (const [file, descriptor] of Object.entries(files).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)) {
    await fs.writeFile(path.join(template, file), descriptor.contents, { mode: 0o644 });
    declarations.push({ path: file, digest: sha256(descriptor.contents), mode: "0644", substitution: descriptor.substitution });
  }
  await fs.writeFile(path.join(template, "manifest.json"), `${canonicalJson(createTemplateManifest(declarations))}\n`);
  return { root, template };
}

async function tree(root: string): Promise<Record<string, string>> {
  return Object.fromEntries(await Promise.all((await fs.readdir(root)).sort().map(async (file) => [file, await fs.readFile(path.join(root, file), "utf8")] as const)));
}