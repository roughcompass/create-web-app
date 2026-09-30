import { QueryClient } from "@tanstack/react-query";
import { normalizeError } from "./errors";
import { shouldRetry } from "./client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => shouldRetry(failureCount, normalizeError(error)),
      staleTime: 30_000,
    },
  },
});