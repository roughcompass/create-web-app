import { z } from "zod";

const publicEnvironmentSchema = z.strictObject({
  VITE_APP_ID: z.string().trim().min(1),
  VITE_API_BASE_URL: z.string().trim().min(1),
  VITE_APP_ENV: z.enum(["development", "test", "production"]),
});

export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;

export class ConfigurationError extends Error {
  override readonly name = "ConfigurationError";
  readonly kind = "configuration" as const;
}

export function parsePublicEnvironment(input: Record<string, unknown>): PublicEnvironment {
  const parsed = publicEnvironmentSchema.safeParse(input);
  if (!parsed.success) {
    throw new ConfigurationError(`Invalid public environment: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  }
  return parsed.data;
}

export function loadPublicEnvironment(): PublicEnvironment {
  const metadata = import.meta as ImportMeta & { env: Record<string, unknown> };
  return parsePublicEnvironment(metadata.env);
}