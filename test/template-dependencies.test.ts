import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "template", "package.json"), "utf8")) as {
  engines: { node: string };
  packageManager: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};
const lock = JSON.parse(fs.readFileSync(path.join(root, "template", "package-lock.json"), "utf8")) as {
  lockfileVersion: number;
  packages: Record<string, { version?: string; integrity?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> }>;
};

describe("template dependency contract", () => {
  it("pins Node, npm, runtime, Salt, and qualified tooling versions", () => {
    expect(manifest.engines.node).toBe(">=24.14.0 <25");
    expect(manifest.packageManager).toBe("npm@11.6.2");
    expect(manifest.dependencies).toMatchObject({
      "@salt-ds/core": "1.72.0",
      "@salt-ds/icons": "1.18.3",
      "@salt-ds/theme": "1.47.0",
      react: "19.3.0",
      "react-dom": "19.3.0",
      "react-router": "8.4.0",
    });
    expect(manifest.devDependencies).toMatchObject({
      eslint: "9.39.5",
      typescript: "6.0.3",
      vitest: "5.0.2",
      storybook: "10.6.1",
      "@playwright/test": "1.63.0",
      stylelint: "17.15.0",
    });
  });

  it("uses exact dependency versions and matching lockfile roots", () => {
    for (const version of [...Object.values(manifest.dependencies), ...Object.values(manifest.devDependencies)]) {
      expect(version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
    }
    expect(lock.lockfileVersion).toBe(3);
    expect(lock.packages[""]?.dependencies).toEqual(manifest.dependencies);
    expect(lock.packages[""]?.devDependencies).toEqual(manifest.devDependencies);
  });

  it("records SHA-512 integrity for every registry package", () => {
    const registryPackages = Object.entries(lock.packages).filter(([name, entry]) => name.startsWith("node_modules/") && entry.version !== undefined);
    expect(registryPackages.length).toBeGreaterThan(600);
    for (const [name, entry] of registryPackages) expect(entry.integrity, name).toMatch(/^sha512-/);
  });
});