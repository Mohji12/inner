/**
 * Extract nested string leaves from a TS object-literal assignment (no execution).
 * Usage: node backend/scripts/_extract_ts_strings.mjs <file> <exportName>
 * Prints JSON: { "a.b.c": "value", ... }
 */
import fs from "fs";
import path from "path";
import ts from "typescript";

const filePath = path.resolve(process.argv[2] || "");
const exportName = process.argv[3] || "appEn";

if (!filePath || !fs.existsSync(filePath)) {
  console.error("Usage: node _extract_ts_strings.mjs <file> <exportName>");
  process.exit(1);
}

const source = fs.readFileSync(filePath, "utf8");
const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function objFromInitializer(node) {
  if (!node) return null;
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
    return objFromInitializer(node.expression);
  }
  if (ts.isObjectLiteralExpression(node)) {
    const out = {};
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const key = prop.name && ts.isIdentifier(prop.name)
        ? prop.name.text
        : prop.name && ts.isStringLiteral(prop.name)
          ? prop.name.text
          : null;
      if (!key) continue;
      if (ts.isStringLiteral(prop.initializer) || ts.isNoSubstitutionTemplateLiteral(prop.initializer)) {
        out[key] = prop.initializer.text;
      } else if (ts.isObjectLiteralExpression(prop.initializer)) {
        out[key] = objFromInitializer(prop.initializer);
      }
    }
    return out;
  }
  return null;
}

function findExportObject(node) {
  if (ts.isVariableStatement(node)) {
    for (const decl of node.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.name.text === exportName) {
        return objFromInitializer(decl.initializer);
      }
    }
  }
  // const baseOverrides = { fr: { ... }, nl: { ... } }
  if (ts.isVariableStatement(node)) {
    for (const decl of node.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.name.text === exportName) {
        return objFromInitializer(decl.initializer);
      }
    }
  }
  return null;
}

let found = null;
function visit(node) {
  if (found) return;
  const hit = findExportObject(node);
  if (hit) {
    found = hit;
    return;
  }
  ts.forEachChild(node, visit);
}
visit(sf);

if (!found) {
  console.error(`Export/object ${exportName} not found in ${filePath}`);
  process.exit(2);
}

function flatten(obj, prefix = "", acc = {}) {
  if (obj == null || typeof obj !== "object") return acc;
  for (const [k, v] of Object.entries(obj)) {
    const pathKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") acc[pathKey] = v;
    else if (v && typeof v === "object") flatten(v, pathKey, acc);
  }
  return acc;
}

process.stdout.write(JSON.stringify(flatten(found), null, 0));
