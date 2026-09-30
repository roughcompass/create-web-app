import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const projectRoot = process.cwd();
const rootIndex = process.argv.indexOf("--root");
const rootArgument = rootIndex >= 0 ? process.argv[rootIndex + 1] : undefined;
if (rootIndex >= 0 && rootArgument === undefined) throw new Error("--root requires a directory");
const sourceRoot = path.resolve(projectRoot, rootArgument === undefined ? "src" : rootArgument);
const violations = [];

for (const file of sourceFiles(sourceRoot)) {
  const content = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const importer = ownership(relativeToProject(file));
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
    const moduleSpecifier = statement.moduleSpecifier;
    if (moduleSpecifier === undefined || !ts.isStringLiteral(moduleSpecifier)) continue;
    const target = targetOf(moduleSpecifier.text, file);
    if (target === null) continue;
    const reason = boundaryViolation(importer, ownership(target), moduleSpecifier.text);
    if (reason !== null) {
      const position = source.getLineAndCharacterOfPosition(moduleSpecifier.getStart(source));
      violations.push(`${relativeToProject(file)}:${String(position.line + 1)}:${String(position.character + 1)} ${reason}`);
    }
  }
}

if (violations.length > 0) {
  process.stderr.write(`${violations.sort().join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Architecture boundaries valid\n");
}

function boundaryViolation(importer, target, specifier) {
  if (target.layer === "external" || importer.layer === "test") return null;
  if (target.layer === "app" && importer.layer !== "app" && importer.layer !== "root") return "features and shared modules cannot import app composition";
  if (importer.layer === "shared" && target.layer === "feature") return "shared modules cannot import features";
  if (importer.layer === "feature" && target.layer === "feature" && importer.area !== target.area && !isPublicSpecifier(specifier, "features", target.area)) {
    return "cross-feature imports must use the feature public index";
  }
  if (target.layer === "feature" && importer.layer !== "feature" && !isPublicSpecifier(specifier, "features", target.area)) {
    return "feature imports must use the feature public index";
  }
  if (target.layer === "shared" && (importer.layer !== "shared" || importer.area !== target.area) && !isPublicSpecifier(specifier, "shared", target.area)) {
    return "shared imports must use the shared-area public index";
  }
  if (specifier.startsWith(".") && importer.layer !== target.layer) return "relative imports cannot cross architecture layers";
  return null;
}

function isPublicSpecifier(specifier, layer, area) {
  return area !== null && specifier === `@${layer}/${area}`;
}

function ownership(file) {
  const normalized = file.replaceAll(path.sep, "/");
  const segments = normalized.split("/");
  const srcIndex = segments.lastIndexOf("src");
  const scoped = srcIndex >= 0 ? segments.slice(srcIndex + 1) : segments;
  if (scoped[0] === "app") return { layer: "app", area: null };
  if (scoped[0] === "features") return { layer: "feature", area: scoped[1] ?? null };
  if (scoped[0] === "shared") return { layer: "shared", area: scoped[1] ?? null };
  if (scoped[0] === "test") return { layer: "test", area: null };
  return { layer: srcIndex >= 0 ? "root" : "external", area: null };
}

function targetOf(specifier, importer) {
  const aliases = {
    "@app/": "src/app/",
    "@features/": "src/features/",
    "@shared/": "src/shared/",
    "@test/": "src/test/",
  };
  for (const [alias, target] of Object.entries(aliases)) {
    if (specifier.startsWith(alias)) return `${target}${specifier.slice(alias.length)}`;
  }
  if (specifier.startsWith(".")) return relativeToProject(path.resolve(path.dirname(importer), specifier));
  return null;
}

function sourceFiles(root) {
  const files = [];
  if (!fs.existsSync(root)) return files;
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && /\.[cm]?[jt]sx?$/u.test(entry.name)) files.push(absolute);
    }
  };
  visit(root);
  return files;
}

function relativeToProject(file) {
  return path.relative(projectRoot, file).replaceAll(path.sep, "/");
}