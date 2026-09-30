import fs from "node:fs/promises";
import * as z from "zod/v4";
import { GENERATOR_VERSION } from "./version.js";

export const provenanceSchema = z.strictObject({
  schema: z.literal("create-web-app.provenance"),
  schemaVersion: z.literal(1),
  version: z.string().min(1),
  source: z.strictObject({
    repository: z.string().min(1),
    commit: z.string().regex(/^[a-f0-9]{40}$/).nullable(),
  }),
});

export type GeneratorProvenance = z.infer<typeof provenanceSchema>;

export async function readProvenance(file: string): Promise<GeneratorProvenance> {
  const provenance = provenanceSchema.parse(JSON.parse(await fs.readFile(file, "utf8")) as unknown);
  if (provenance.version !== GENERATOR_VERSION) {
    throw new Error(`Provenance version ${provenance.version} does not match generator ${GENERATOR_VERSION}`);
  }
  return provenance;
}