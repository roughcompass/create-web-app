import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateDestination } from "../src/destination.js";

const temporary: string[] = [];

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe("destination validation", () => {
  it("accepts missing and empty child directories", async () => {
    const root = await fixtureRoot();
    const missing = await validateDestination(path.join(root, "apps", "orders"), root);
    expect(missing).toMatchObject({ existed: false, destination: path.join(await fs.realpath(root), "apps", "orders") });

    const empty = path.join(root, "empty");
    await fs.mkdir(empty);
    await expect(validateDestination(empty, root)).resolves.toMatchObject({
      existed: true,
      destination: path.join(await fs.realpath(root), "empty"),
    });
  });

  it.each([
    ["root", (root: string) => root, "destination_root"],
    ["traversal", (root: string) => path.resolve(root, "../outside"), "destination_outside_root"],
    ["non-empty", (root: string) => path.join(root, "occupied"), "destination_exists"],
    ["file", (root: string) => path.join(root, "file"), "destination_file"],
    ["symlink", (root: string) => path.join(root, "link"), "destination_outside_root"],
  ] as const)("rejects %s destinations before writing", async (_name, destinationOf, code) => {
    const root = await fixtureRoot();
    await fs.mkdir(path.join(root, "occupied"));
    await fs.writeFile(path.join(root, "occupied", "work.txt"), "keep\n");
    await fs.writeFile(path.join(root, "file"), "keep\n");
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "create-web-app-outside-"));
    temporary.push(outside);
    await fs.symlink(outside, path.join(root, "link"));

    await expect(validateDestination(destinationOf(root), root)).rejects.toMatchObject({ code });
    await expect(fs.readFile(path.join(root, "occupied", "work.txt"), "utf8")).resolves.toBe("keep\n");
    await expect(fs.readFile(path.join(root, "file"), "utf8")).resolves.toBe("keep\n");
    expect(await fs.readdir(outside)).toEqual([]);
  });

  it("rejects a destination below an ancestor symlink that escapes the root", async () => {
    const root = await fixtureRoot();
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "create-web-app-outside-parent-"));
    temporary.push(outside);
    await fs.symlink(outside, path.join(root, "linked-parent"));
    await expect(validateDestination(path.join(root, "linked-parent", "app"), root)).rejects.toMatchObject({
      code: "destination_outside_root",
    });
    expect(await fs.readdir(outside)).toEqual([]);
  });
});

async function fixtureRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "create-web-app-destination-"));
  temporary.push(root);
  return root;
}