import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const storage = path.join(root, "tmp", "registry");
const port = Number(process.env.CREATE_WEB_APP_REGISTRY_PORT ?? "4874");
const url = `http://127.0.0.1:${port}/`;
const config = path.join(storage, "verdaccio.yaml");
const accountFile = path.join(storage, "account.json");

fs.mkdirSync(storage, { recursive: true });
const template = fs.readFileSync(path.join(root, "registry", "verdaccio.yaml"), "utf8");
fs.writeFileSync(config, template.replace("../tmp/registry/storage", "./storage").replace("../tmp/registry/htpasswd", "./htpasswd"));

const child = spawn(path.join(root, "node_modules", ".bin", "verdaccio"), ["--config", config, "--listen", `127.0.0.1:${port}`], {
  stdio: ["ignore", "inherit", "inherit"],
  env: { ...process.env, NODE_ENV: "production" },
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

await waitForRegistry();
const token = await createToken();
process.stdout.write(`Local registry: ${url}\n`);
process.stdout.write("To publish from another shell:\n");
process.stdout.write(`  export CREATE_WEB_APP_NPM_REGISTRY=${url}\n`);
process.stdout.write(`  export CREATE_WEB_APP_NPM_TOKEN=${token}\n`);

await new Promise((resolve, reject) => {
  child.once("exit", (code, signal) => resolve({ code, signal }));
  child.once("error", reject);
});

async function waitForRegistry() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Verdaccio exited with ${child.exitCode}`);
    try {
      const response = await fetch(new URL("-/ping", url));
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill("SIGTERM");
  throw new Error(`Verdaccio did not start on ${url}`);
}

async function createToken() {
  if (!fs.existsSync(accountFile)) {
    fs.writeFileSync(accountFile, JSON.stringify({
      name: "create-web-app-dev",
      password: crypto.randomBytes(24).toString("base64url"),
    }), { mode: 0o600 });
  }
  const account = JSON.parse(fs.readFileSync(accountFile, "utf8"));
  const endpoint = new URL(`-/user/org.couchdb.user:${encodeURIComponent(account.name)}`, url);
  const login = (authorization) => fetch(endpoint, {
    method: "PUT",
    headers: { "content-type": "application/json", ...(authorization === undefined ? {} : { authorization }) },
    body: JSON.stringify({ name: account.name, password: account.password, type: "user" }),
  });
  let response = await login();
  if (response.status === 409) response = await login(`Basic ${Buffer.from(`${account.name}:${account.password}`).toString("base64")}`);
  const body = await response.json();
  if (typeof body.token !== "string") throw new Error(`Registry authentication failed (${response.status})`);
  return body.token;
}