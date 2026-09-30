export { GENERATOR_VERSION, TEMPLATE_VERSION } from "./version.js";

export { CanonicalJsonError, canonicalJson, digestDocument, sha256 } from "./canonical-json.js";
export { CliExecutionError, runCli } from "./cli-app.js";
export type { CliIo, CliServices, GenerationOutcome } from "./cli-app.js";
export { DestinationError, validateDestination } from "./destination.js";
export type { DestinationErrorCode, ValidatedDestination } from "./destination.js";
export { CliInputError, normalizedOptionsSchema, parseCliArguments } from "./options.js";
export type { CliInputErrorCode, CliRequest, NormalizedOptions } from "./options.js";
export { PostActionError, runPostActions } from "./post-actions.js";
export type { CommandRequest, CommandResult, CommandRunner, PostAction, PostActionOptions, PostActionResult } from "./post-actions.js";
export { PromptCancelledError, resolveInteractiveOptions } from "./prompts.js";
export type { PromptAdapter } from "./prompts.js";
export { RenderError, renderTemplate } from "./render.js";
export type { RenderHooks, RenderPhase, RenderTemplateOptions, RenderedTemplate, TemplateSubstitutions } from "./render.js";
export { readProvenance, provenanceSchema } from "./provenance.js";
export type { GeneratorProvenance } from "./provenance.js";
export { createTemplateManifest, templateManifestSchema, verifyTemplate } from "./template-manifest.js";
export type { TemplateManifest, VerifiedTemplate } from "./template-manifest.js";
