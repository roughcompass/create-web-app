export type AppErrorKind = "aborted" | "configuration" | "http" | "invalid-response" | "network" | "unexpected";

export interface AppError {
  kind: AppErrorKind;
  message: string;
  status?: number;
  cause?: unknown;
}

export function appError(kind: AppErrorKind, message: string, options: { status?: number; cause?: unknown } = {}): AppError {
  return { kind, message, ...options };
}

export function normalizeError(error: unknown): AppError {
  if (isAppError(error)) return error;
  if (error instanceof DOMException && error.name === "AbortError") return appError("aborted", "The request was cancelled.", { cause: error });
  if (error instanceof TypeError) return appError("network", "The service could not be reached.", { cause: error });
  if (error instanceof Error) return appError("unexpected", error.message, { cause: error });
  return appError("unexpected", "An unexpected error occurred.", { cause: error });
}

export function isAppError(value: unknown): value is AppError {
  return typeof value === "object" && value !== null && "kind" in value && "message" in value;
}