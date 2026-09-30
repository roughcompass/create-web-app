import { describe, expect, it } from "vitest";
import { z } from "zod";
import { requestJson, shouldRetry } from "../template/src/shared/api/client.js";
import { appError, normalizeError } from "../template/src/shared/api/errors.js";
import { ConfigurationError, parsePublicEnvironment } from "../template/src/shared/config/environment.js";

const responseSchema = z.strictObject({ id: z.string(), title: z.string() });

describe("template typed boundaries", () => {
  it("accepts complete public configuration and rejects missing values", () => {
    expect(parsePublicEnvironment({ VITE_APP_ID: "orders", VITE_API_BASE_URL: "/api", VITE_APP_ENV: "test" })).toEqual({
      VITE_APP_ID: "orders",
      VITE_API_BASE_URL: "/api",
      VITE_APP_ENV: "test",
    });
    try {
      parsePublicEnvironment({ VITE_APP_ID: "orders" });
      throw new Error("Expected configuration parsing to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      if (!(error instanceof ConfigurationError)) throw error;
      expect(error.kind).toBe("configuration");
      expect(error.message).toContain("VITE_API_BASE_URL");
    }
  });

  it("validates successful service responses", async () => {
    const result = await requestJson(responseSchema, "/work-items/1", {
      fetcher: () => Promise.resolve(Response.json({ id: "1", title: "Review model" })),
    });
    expect(result).toEqual({ id: "1", title: "Review model" });
  });

  it.each([
    ["HTTP", () => requestJson(responseSchema, "/failure", { fetcher: () => Promise.resolve(new Response("", { status: 503 })) }), "http"],
    ["malformed JSON", () => requestJson(responseSchema, "/malformed", { fetcher: () => Promise.resolve(new Response("not-json")) }), "invalid-response"],
    ["invalid schema", () => requestJson(responseSchema, "/invalid", { fetcher: () => Promise.resolve(Response.json({ id: 1 })) }), "invalid-response"],
    ["network", () => requestJson(responseSchema, "/network", { fetcher: () => Promise.reject(new TypeError("offline")) }), "network"],
    ["abort", () => requestJson(responseSchema, "/abort", { fetcher: () => Promise.reject(new DOMException("Aborted", "AbortError")) }), "aborted"],
  ])("normalizes %s failure", async (_name, operation, kind) => {
    await expect(operation()).rejects.toMatchObject({ kind });
  });

  it("normalizes unexpected values and applies bounded retry policy", () => {
    expect(normalizeError("failure")).toMatchObject({ kind: "unexpected" });
    expect(shouldRetry(0, appError("network", "offline"))).toBe(true);
    expect(shouldRetry(1, appError("http", "unavailable", { status: 503 }))).toBe(true);
    expect(shouldRetry(2, appError("network", "offline"))).toBe(false);
    expect(shouldRetry(0, appError("http", "not found", { status: 404 }))).toBe(false);
    expect(shouldRetry(0, appError("invalid-response", "bad response"))).toBe(false);
  });
});