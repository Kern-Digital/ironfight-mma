/**
 * Modul-Auflöser für Node-Skripte, die TypeScript aus `lib/` direkt laden.
 *
 * Node 24 streift Typen selbst (`--experimental-strip-types` ist Standard),
 * kennt aber weder den Alias `@/` aus tsconfig noch Importe ohne Endung.
 * Dieser Hook ergänzt beides — mehr nicht. Damit lassen sich reine Module
 * wie `lib/profile-evidence.ts` ohne Build und ohne zusätzliche Abhängigkeit
 * prüfen.
 *
 * Aufruf:  node --import ./scripts/lib/ts-loader-register.mjs <skript>
 */

import { existsSync, statSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ENDUNGEN = [".ts", ".tsx", ".mts", ".js", ".mjs"];

function mitEndung(pfad) {
  if (existsSync(pfad) && statSync(pfad).isFile()) return pfad;
  for (const e of ENDUNGEN) if (existsSync(pfad + e)) return pfad + e;
  for (const e of ENDUNGEN) {
    const index = resolvePath(pfad, "index" + e);
    if (existsSync(index)) return index;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  let pfad = null;
  if (specifier.startsWith("@/")) {
    pfad = resolvePath(ROOT, specifier.slice(2));
  } else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL?.startsWith("file:")
  ) {
    pfad = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
  }
  if (pfad) {
    const treffer = mitEndung(pfad);
    if (treffer) return { url: pathToFileURL(treffer).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
