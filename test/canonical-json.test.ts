import { describe, expect, it } from "vitest";
import { CanonicalJsonError, canonicalJson, digestDocument } from "../src/canonical-json.js";

describe("canonical JSON", () => {
  it("sorts keys and produces order-independent digests", () => {
    const first = { schemaVersion: 1, nested: { beta: 2, alpha: 1 }, schema: "example" };
    const second = { schema: "example", nested: { alpha: 1, beta: 2 }, schemaVersion: 1 };
    expect(canonicalJson(first)).toBe('{"nested":{"alpha":1,"beta":2},"schema":"example","schemaVersion":1}');
    expect(digestDocument(first)).toEqual(digestDocument(second));
  });

  it("rejects values outside the canonical domain", () => {
    expect(() => canonicalJson({ value: 1.5 })).toThrow(CanonicalJsonError);
    expect(() => canonicalJson({ value: undefined })).toThrow(CanonicalJsonError);
    expect(() => canonicalJson(new Date())).toThrow(CanonicalJsonError);
  });
});