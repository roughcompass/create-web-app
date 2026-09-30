import path from "node:path";
import { describe, expect, it } from "vitest";
import { readProvenance } from "../src/provenance.js";

describe("generator provenance", () => {
  it("matches the package version and allows a development commit", async () => {
    await expect(readProvenance(path.resolve(import.meta.dirname, "../provenance.json"))).resolves.toMatchObject({
      schema: "create-web-app.provenance",
      schemaVersion: 1,
      version: "0.1.0",
      source: { commit: null },
    });
  });
});