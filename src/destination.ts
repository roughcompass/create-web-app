import fs from "node:fs/promises";
import path from "node:path";

export type DestinationErrorCode = "destination_exists" | "destination_file" | "destination_outside_root" | "destination_root" | "destination_symlink";

export class DestinationError extends Error {
  override readonly name = "DestinationError";

  constructor(readonly code: DestinationErrorCode, message: string) {
    super(message);
  }
}

export interface ValidatedDestination {
  root: string;
  destination: string;
  existed: boolean;
}

export async function validateDestination(destinationInput: string, invocationRootInput: string): Promise<ValidatedDestination> {
  const lexicalRoot = path.resolve(invocationRootInput);
  const lexicalDestination = path.resolve(destinationInput);
  if (lexicalDestination === lexicalRoot) throw new DestinationError("destination_root", "Destination must be a child of the invocation directory.");
  assertInside(lexicalRoot, lexicalDestination);

  const root = await fs.realpath(lexicalRoot);
  const ancestor = await nearestExistingAncestor(lexicalDestination);
  const canonicalAncestor = await fs.realpath(ancestor);
  const canonicalDestination = path.resolve(canonicalAncestor, path.relative(ancestor, lexicalDestination));
  assertInside(root, canonicalDestination);

  let stat;
  try {
    stat = await fs.lstat(lexicalDestination);
  } catch (error) {
    if (isMissing(error)) return { root, destination: canonicalDestination, existed: false };
    throw error;
  }
  if (stat.isSymbolicLink()) throw new DestinationError("destination_symlink", "Destination cannot be a symbolic link.");
  if (!stat.isDirectory()) throw new DestinationError("destination_file", "Destination exists and is not a directory.");
  if ((await fs.readdir(lexicalDestination)).length > 0) {
    throw new DestinationError("destination_exists", "Destination exists and is not empty.");
  }
  return { root, destination: canonicalDestination, existed: true };
}

function assertInside(root: string, candidate: string): void {
  const relative = path.relative(root, candidate);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new DestinationError("destination_outside_root", "Destination must remain inside the invocation directory.");
  }
}

async function nearestExistingAncestor(candidate: string): Promise<string> {
  let current = candidate;
  for (;;) {
    try {
      await fs.lstat(current);
      return current;
    } catch (error) {
      if (!isMissing(error)) throw error;
      const parent = path.dirname(current);
      if (parent === current) throw new DestinationError("destination_outside_root", "Destination has no accessible parent directory.");
      current = parent;
    }
  }
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}