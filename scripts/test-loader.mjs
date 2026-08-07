/**
 * Node ESM loader shim used ONLY by the test runner. Resolves extension-less
 * import paths like "../api/axiosClient" to either "../api/axiosClient.js"
 * or "../api/axiosClient.ts" so plain `node --test` can load the production
 * source without modifying any production file.
 *
 * <p>Production builds go through Vite + tsc, which already handle this.
 */
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SOURCE_EXTS = [".js", ".ts", ".jsx", ".mjs"];

export async function resolve(specifier, context, nextResolve) {
  if (context.parentURL && specifier.startsWith(".")) {
    const parentURL = context.parentURL;
    const ext = pathExtension(specifier);

    // 1. If the specifier already has a source extension, let Node handle it.
    if (SOURCE_EXTS.includes(ext)) {
      return nextResolve(specifier, context);
    }

    // 2. Otherwise try the specifier verbatim, then each candidate extension.
    const tried = new Set([specifier]);
    const candidates = [specifier, ...SOURCE_EXTS.map((e) => `${specifier}${e}`)];
    for (const c of candidates) {
      if (tried.has(c)) continue;
      tried.add(c);
      try {
        const target = new URL(c, parentURL);
        const filePath = fileURLToPath(target);
        if (existsSync(filePath) && statSync(filePath).isFile()) {
          return nextResolve(c, context);
        }
      } catch {
        // ignore and keep trying
      }
    }
  }
  return nextResolve(specifier, context);
}

function pathExtension(specifier) {
  const i = specifier.lastIndexOf(".");
  return i < 0 ? "" : specifier.slice(i);
}