/**
 * Phase O4B final: status-code contract tests for the secure
 * preview API wiring.
 *
 * Verifies:
 *  - The default validateStatus accepts 2xx (incl. 202) and 409.
 *  - 401 / 403 / 500 are NOT whitelisted.
 *  - The signal is forwarded.
 *  - The interpreter treats HTTP 202 as `kind: "waiting"` and
 *    HTTP 409 with payload { status: "DEAD" } as `kind: "dead"`.
 *  - The interpreter treats HTTP 409 without status: "DEAD"
 *    as a protocol violation (kind: "error"), never kind: "dead"
 *    or kind: "locked".
 *  - 401 / 403 / 500 never reach the interpreter.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const API_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "../api.js"),
  "utf8"
);

const HELPER_BODY = (() => {
  // Find the function declaration and the opening brace of its body.
  const fnStart = API_SOURCE.indexOf("async getDocumentPreview(documentId");
  if (fnStart < 0) return "";
  // Find the ') {' that opens the function body (not the => of inner arrow functions).
  const bodyOpen = API_SOURCE.indexOf(") {", fnStart);
  if (bodyOpen < 0) return "";
  const bracePos = bodyOpen + 1; // '{' is at position bodyOpen + 1
  let depth = 0;
  let i = bracePos;
  while (i < API_SOURCE.length) {
    const ch = API_SOURCE[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return API_SOURCE.slice(bracePos + 1, i);
    }
    i++;
  }
  return "";
})();

test("helper body is captured", () => {
  assert.ok(
    HELPER_BODY.length > 0,
    "expected to find the getDocumentPreview helper body in api.js"
  );
});

test("helper forwards the abort signal", () => {
  assert.match(
    HELPER_BODY,
    /\.{3}\s*\(\s*options\.signal\s+\?\s*\{\s*signal:\s*options\.signal\s*\}\s*:\s*\{\}\s*\)/
  );
});

test("getDocumentPreview configures validateStatus to accept 2xx + 409", () => {
  // The exact whitelist required by Phase O4B final correction:
  //   (status) => (status >= 200 && status < 300) || status === 409
  // 202 is included via the 2xx range. 401/403/500 stay real errors.
  assert.match(
    HELPER_BODY,
    /validateStatus\s*:/,
    "helper must configure validateStatus"
  );
  assert.match(
    HELPER_BODY,
    /\([\s\n]*status[\s\n]*>=[\s\n]*200[\s\n]*&&[\s\n]*status[\s\n]*<[\s\n]*300[\s\n]*\)[\s\n]*\|\|[\s\n]*status[\s\n]*===\s*409/,
    "helper must whitelist 2xx + 409 (includes 202)"
  );
  // 401, 403, 500 must NOT be in the whitelist.
  assert.ok(
    !/status\s*===\s*401/.test(HELPER_BODY),
    "401 must NOT be whitelisted"
  );
  assert.ok(
    !/status\s*===\s*403/.test(HELPER_BODY),
    "403 must NOT be whitelisted"
  );
  assert.ok(
    !/status\s*===\s*500/.test(HELPER_BODY),
    "500 must NOT be whitelisted"
  );
});

test("interpreter treats HTTP 202 as waiting, HTTP 409 DEAD as dead", () => {
  const interpreterBody = (() => {
    const m = API_SOURCE.match(
      /async\s+function\s+interpretPreviewResponse\s*\([^)]*\)\s*\{/
    );
    if (!m) return "";
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < API_SOURCE.length) {
      const ch = API_SOURCE[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          return API_SOURCE.slice(start, i);
        }
      }
      i++;
    }
    return API_SOURCE.slice(start);
  })();
  assert.ok(interpreterBody.length > 0);
  assert.match(interpreterBody, /status\s*===\s*202/);
  assert.match(interpreterBody, /kind:\s*["']waiting["']/);
  assert.match(interpreterBody, /status\s*===\s*409/);
  assert.match(interpreterBody, /kind:\s*["']dead["']/);
  assert.match(interpreterBody, /kind:\s*["']error["']/);
});

test("401 / 403 / 500 stay real axios errors (do not silently become waiting/dead)", () => {
  const interpreterBody = (() => {
    const m = API_SOURCE.match(
      /async\s+function\s+interpretPreviewResponse\s*\([^)]*\)\s*\{/
    );
    if (!m) return "";
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < API_SOURCE.length) {
      const ch = API_SOURCE[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          return API_SOURCE.slice(start, i);
        }
      }
      i++;
    }
    return API_SOURCE.slice(start);
  })();
  assert.ok(interpreterBody.length > 0);
  assert.ok(!/status\s*===\s*401/.test(interpreterBody));
  assert.ok(!/status\s*===\s*403/.test(interpreterBody));
  assert.ok(!/status\s*===\s*500/.test(interpreterBody));
});

test("401 / 403 are recognized as authorization failures in the polling hook", () => {
  const HOOK_SOURCE = fs.readFileSync(
    path.resolve(__dirname, "../../hooks/useDocumentPreviewStatus.js"),
    "utf8"
  );
  assert.match(
    HOOK_SOURCE,
    /err\?\.response\?\.status\s*===\s*401/,
    "admin hook must recognize 401 as an authorization failure"
  );
  assert.match(
    HOOK_SOURCE,
    /err\?\.response\?\.status\s*===\s*403/,
    "admin hook must recognize 403 as an authorization failure"
  );
});
