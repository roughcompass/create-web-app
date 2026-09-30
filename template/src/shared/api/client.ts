import type { z } from "zod";
import { appError, normalizeError, type AppError } from "./errors.js";

export interface RequestOptions {
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  init?: Omit<RequestInit, "signal">;
}

export async function requestJson<Schema extends z.ZodType>(schema: Schema, url: string, options: RequestOptions = {}): Promise<z.output<Schema>> {
  const fetcher = options.fetcher ?? fetch;
  let response: Response;
  try {
    response = await fetcher(url, {
      ...options.init,
      headers: { accept: "application/json", ...options.init?.headers },
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
  } catch (error) {
    throw normalizeError(error);
  }
  if (!response.ok) throw appError("http", `Service returned ${String(response.status)}.`, { status: response.status });
  let input: unknown;
  try {
    input = await response.json() as unknown;
  } catch (error) {
    throw appError("invalid-response", "Service returned malformed JSON.", { cause: error });
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw appError("invalid-response", "Service response did not match its schema.", { cause: parsed.error });
  return parsed.data;
}

export function shouldRetry(failureCount: number, error: AppError): boolean {
  if (failureCount >= 2) return false;
  return error.kind === "network" || (error.kind === "http" && (error.status ?? 0) >= 500);
}