import crypto from "node:crypto";

export class CanonicalJsonError extends Error {
  override readonly name = "CanonicalJsonError";
}

const MAX_DEPTH = 64;

export function canonicalJson(value: unknown): string {
  return serialize(value, 0, "$");
}

export function sha256(contents: string | Uint8Array): string {
  return crypto.createHash("sha256").update(contents).digest("hex");
}

export function digestDocument(value: unknown): { canonical: string; digest: string } {
  const canonical = canonicalJson(value);
  return { canonical, digest: sha256(canonical) };
}

function serialize(value: unknown, depth: number, valuePath: string): string {
  if (depth > MAX_DEPTH) throw new CanonicalJsonError(`${valuePath} exceeds maximum depth ${String(MAX_DEPTH)}`);
  switch (typeof value) {
    case "string":
      if (!value.isWellFormed()) throw new CanonicalJsonError(`${valuePath} contains malformed Unicode`);
      return JSON.stringify(value);
    case "number":
      if (!Number.isSafeInteger(value)) throw new CanonicalJsonError(`${valuePath} must be a safe integer`);
      return Object.is(value, -0) ? "0" : String(value);
    case "boolean":
      return value ? "true" : "false";
    case "object":
      if (value === null) return "null";
      if (Array.isArray(value)) return `[${value.map((entry, index) => serialize(entry, depth + 1, `${valuePath}[${String(index)}]`)).join(",")}]`;
      if (!isPlainObject(value)) throw new CanonicalJsonError(`${valuePath} must be a plain object`);
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${serialize(value[key], depth + 1, `${valuePath}.${key}`)}`).join(",")}}`;
    default:
      throw new CanonicalJsonError(`${valuePath} has unsupported type ${typeof value}`);
  }
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}