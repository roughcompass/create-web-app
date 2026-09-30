import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "create-web-app-registry-"));
const storage = path.join(workspace, "registry");
const sentinel = path.join(workspace, "lifecycle-ran");
const packageName = "@enterprise/create-web-app-registry-fixture";
let registry: { url: string; child: ChildProcess };
let token = "";

beforeAll(async () => {
  registry = await startRegistry();
  token = await createToken(registry.url);
  const publisher = project("publisher", {
    name: packageName,
    version: "1.0.0",
    type: "module",
    main: "index.js",
    scripts: {
      install: `node -e "require('fs').writeFileSync('${sentinel}', 'ran')"`,
      postinstall: `node -e "require('fs').writeFileSync('${sentinel}', 'ran')"`,
    },
  }, { "index.js": "export const answer = 42;\n" });
  const auth = authFile(registry.url, token);
  const published = npm(publisher, ["publish", "--userconfig", auth]);
  expect(published.status, published.stderr).toBe(0);
}, 60_000);

afterAll(async () => {
  if (registry.child.exitCode === null) {
    await new Promise<void>((resolve) => {
      registry.child.once("exit", () => {
        resolve();
      });
      registry.child.kill("SIGTERM");
    });
  }
  fs.rmSync(workspace, { recursive: true, force: true });
});

describe("internal npm registry", () => {
  it("installs an exact version with integrity and no lifecycle scripts", async () => {
    const consumer = project("consumer", { name: "consumer", version: "1.0.0", private: true });
    const installed = npm(consumer, ["install", "--save-exact", `${packageName}@1.0.0`]);
    expect(installed.status, installed.stderr).toBe(0);
    expect(fs.existsSync(sentinel)).toBe(false);
    const manifest = readJson(path.join(consumer, "package.json")) as { dependencies: Record<string, string> };
    expect(manifest.dependencies).toEqual({ [packageName]: "1.0.0" });
    const lock = readJson(path.join(consumer, "package-lock.json")) as { packages: Record<string, { integrity?: string; resolved?: string }> };
    const entry = lock.packages[`node_modules/${packageName}`];
    expect(entry).toBeDefined();
    if (entry === undefined) throw new Error("Installed package is absent from the lockfile");
    expect(entry).not.toHaveProperty("resolved");
    const tarball = Buffer.from(await (await fetch(new URL(`${packageName}/-/create-web-app-registry-fixture-1.0.0.tgz`, registry.url))).arrayBuffer());
    expect(entry.integrity).toBe(`sha512-${crypto.createHash("sha512").update(tarball).digest("base64")}`);
  }, 60_000);

  it("fails closed without the internal registry setting", () => {
    const consumer = project("unconfigured", { name: "unconfigured", version: "1.0.0", private: true });
    const installed = npm(consumer, ["install", `${packageName}@1.0.0`], { CREATE_WEB_APP_NPM_REGISTRY: undefined });
    expect(installed.status).not.toBe(0);
    expect(fs.existsSync(path.join(consumer, "node_modules", "@enterprise"))).toBe(false);
  });

  it("keeps runtime credentials outside repository files", () => {
    const { password } = readJson(path.join(storage, "account.json")) as { password: string };
    for (const file of repositoryFiles(root)) {
      const contents = fs.readFileSync(path.join(root, file), "utf8");
      expect(contents, file).not.toContain(token);
      expect(contents, file).not.toContain(password);
      if (file.endsWith(".npmrc") || file.startsWith("registry/") || file.startsWith("scripts/")) {
        expect(contents, file).not.toMatch(/_authToken\s*=\s*[^$\s]/);
      }
    }
  });
});

async function startRegistry() {
  const port = await freePort();
  fs.mkdirSync(storage, { recursive: true });
  const template = fs.readFileSync(path.join(root, "registry", "verdaccio.yaml"), "utf8");
  const config = path.join(storage, "verdaccio.yaml");
  fs.writeFileSync(config, template.replace("../tmp/registry/storage", "./storage").replace("../tmp/registry/htpasswd", "./htpasswd"));
  const child = spawn(path.join(root, "node_modules", ".bin", "verdaccio"), ["--config", config, "--listen", `127.0.0.1:${String(port)}`], {
    stdio: "ignore",
    env: { ...process.env, NODE_ENV: "production" },
  });
  const url = `http://127.0.0.1:${String(port)}/`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Verdaccio exited with ${String(child.exitCode)}`);
    try {
      if ((await fetch(new URL("-/ping", url))).ok) return { url, child };
    } catch {
      // The registry is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill("SIGTERM");
  throw new Error("Verdaccio did not start");
}

async function createToken(url: string) {
  fs.mkdirSync(storage, { recursive: true });
  const account = { name: "create-web-app-test", password: crypto.randomBytes(24).toString("base64url") };
  fs.writeFileSync(path.join(storage, "account.json"), JSON.stringify(account), { mode: 0o600 });
  const response = await fetch(new URL(`-/user/org.couchdb.user:${account.name}`, url), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...account, type: "user" }),
  });
  const body = await response.json() as { token?: string };
  if (body.token === undefined) throw new Error(`Registry authentication failed (${String(response.status)})`);
  return body.token;
}

function project(name: string, manifest: object, files: Record<string, string> = {}) {
  const directory = path.join(workspace, name);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "package.json"), JSON.stringify(manifest));
  fs.writeFileSync(path.join(directory, ".npmrc"), `@enterprise:registry=\${CREATE_WEB_APP_NPM_REGISTRY}\nomit-lockfile-registry-resolved=true\nignore-scripts=true\n`);
  for (const [file, contents] of Object.entries(files)) fs.writeFileSync(path.join(directory, file), contents);
  return directory;
}

function npm(cwd: string, args: string[], extraEnv: Record<string, string | undefined> = {}) {
  return spawnSync("npm", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, CREATE_WEB_APP_NPM_REGISTRY: registry.url, ...extraEnv },
  });
}

function authFile(url: string, authToken: string) {
  const file = path.join(workspace, "auth.npmrc");
  const registryUrl = new URL(url);
  fs.writeFileSync(file, `//${registryUrl.host}/:_authToken=${authToken}\n`, { mode: 0o600 });
  return file;
}

function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("No registry port"));
        return;
      }
      server.close(() => {
        resolve(address.port);
      });
    });
  });
}

function repositoryFiles(directory: string): string[] {
  const files: string[] = [];
  const visit = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if ([".git", "dist", "node_modules", "tmp"].includes(entry.name)) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
      } else if (entry.isFile()) {
        files.push(path.relative(directory, absolute));
      }
    }
  };
  visit(directory);
  return files;
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
}