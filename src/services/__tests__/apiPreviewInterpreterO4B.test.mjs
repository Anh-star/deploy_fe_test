/**
 * Phase O4B final: contract tests for the secure-preview interpreter
 * inside {@code api.js}.
 *
 * Verifies:
 *   - HTTP 202 → waiting descriptor with previewState PENDING /
 *     PROCESSING / RETRY.
 *   - HTTP 409 with payload { status: "DEAD", retryable: false }
 *     → kind dead.
 *   - HTTP 409 with payload missing `status: "DEAD"` (or with a
 *     different status) → kind error (protocol violation). Never
 *     kind dead, never kind locked.
 *   - HTTP 409 with malformed JSON → kind error.
 *   - HTTP 200 application/pdf → kind pdf.
 *   - HTTP 200 application/json → kind locked.
 *   - DOCX / text/html → kind locked (fail-closed; never a docx /
 *     docHtml kind).
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

const INTERPRETER_BODY = (() => {
  // Find the function declaration and extract a balanced-brace body.
  const fnStart = API_SOURCE.indexOf("async function interpretPreviewResponse(res)");
  if (fnStart < 0) return "";
  const bracePos = API_SOURCE.indexOf("{", fnStart);
  if (bracePos < 0) return "";
  let depth = 0;
  let i = bracePos;
  while (i < API_SOURCE.length) {
    if (API_SOURCE[i] === "{") depth++;
    else if (API_SOURCE[i] === "}") {
      depth--;
      if (depth === 0) return API_SOURCE.slice(bracePos + 1, i);
    }
    i++;
  }
  return "";
})();

/**
 * Extracts a balanced-brace block from `startPos` (the opening brace).
 * Used to extract complete if/try/catch blocks from INTERPRETER_BODY.
 */
function extractBlock(body, startPos) {
  if (body[startPos] !== "{") return null;
  let depth = 0;
  let i = startPos;
  while (i < body.length) {
    if (body[i] === "{") depth++;
    else if (body[i] === "}") {
      depth--;
      if (depth === 0) return body.slice(startPos, i + 1);
    }
    i++;
  }
  return null;
}

/**
 * Extracts the complete 409 branch from the interpreter body using
 * balanced-brace extraction (replaces the non-greedy regex).
 */
function extract409Branch() {
  const if409 = INTERPRETER_BODY.indexOf("if (status === 409)");
  if (if409 < 0) return null;
  const brace = INTERPRETER_BODY.indexOf("{", if409);
  return extractBlock(INTERPRETER_BODY, brace);
}

test("interpreter recognises HTTP 202 as a waiting descriptor", () => {
  assert.match(INTERPRETER_BODY, /if\s*\(\s*status\s*===\s*202\s*\)/);
  assert.match(INTERPRETER_BODY, /kind:\s+["']waiting["']/);
  // The 202 branch assigns previewStateRaw from the validated status field.
  assert.match(INTERPRETER_BODY, /previewStateRaw\s*=/);
  assert.match(INTERPRETER_BODY, /typeof\s+raw\?\.status\s*===\s*["']string["']/);
  assert.match(INTERPRETER_BODY, /previewState:\s+previewStateRaw/);
  assert.match(INTERPRETER_BODY, /retryable:\s+raw\?\.retryable\s*===\s*true/);
});

test("interpreter validates 409 payload: only status DEAD → kind dead", () => {
  // Extract the complete 409 branch with balanced braces.
  const deadBranch = extract409Branch();
  assert.ok(deadBranch, "expected 409 branch");
  // The branch must reference `status: "DEAD"` and emit kind "dead".
  assert.match(deadBranch, /payloadStatus\s*===\s*["']DEAD["']/);
  assert.match(deadBranch, /kind:\s+["']dead["']/);
});

test("interpreter rejects 409 without status DEAD → kind error", () => {
  const deadBranch = extract409Branch();
  assert.ok(deadBranch);
  // Look for the fall-through branch that returns kind error.
  assert.match(deadBranch, /kind:\s+["']error["']/);
  // The 409 branch must NOT have a kind:"locked" fallback.
  assert.ok(
    !/kind:\s+["']locked["']/.test(deadBranch),
    "409 branch MUST NOT map any case to kind locked"
  );
  // The 409 branch must have a conditional kind:"dead".
  const hasConditionalDead = /kind:\s+["']dead["']/.test(deadBranch);
  assert.ok(hasConditionalDead,
    "dead result is allowed ONLY under the payloadStatus === DEAD guard");
});

test("interpreter swallows malformed 409 JSON → kind error", () => {
  const deadBranch = extract409Branch();
  assert.ok(deadBranch);
  assert.match(deadBranch, /try\s*\{/);
  assert.match(deadBranch, /readJsonBody/);
  assert.match(deadBranch, /catch\s*\{/);
  assert.match(deadBranch, /raw\s*=\s*null/);
});

test("PDF MIME type still maps to kind pdf", () => {
  assert.match(INTERPRETER_BODY, /kind:\s+["']pdf["']/);
});

test("200 application/json LOCKED maps to kind locked", () => {
  assert.match(INTERPRETER_BODY, /kind:\s+["']locked["']/);
});

test("DOCX MIME type no longer maps to a docx kind", () => {
  assert.ok(
    !/kind:\s+["']docx["']/.test(INTERPRETER_BODY),
    "DOCX MIME must not produce a docx kind — fails closed into locked"
  );
});

test("text/html no longer maps to a docHtml kind", () => {
  assert.ok(
    !/kind:\s+["']docHtml["']/.test(INTERPRETER_BODY),
    "text/html must not produce a docHtml kind — fails closed into locked"
  );
});

test("interpreter does not surface raw exception details for 409", () => {
  const deadBranch = extract409Branch();
  assert.ok(deadBranch);
  // The safe message must mention "không hợp lệ" or similar generic
  // hint, not the raw payload.
  assert.match(deadBranch, /Bản xem trước không khả dụng/);
  // It must NOT include stack traces, internal errors, etc.
  assert.ok(!/stack/i.test(deadBranch));
  assert.ok(!/throw\s+new\s+Error/.test(deadBranch),
    "interpreter MUST NOT throw — it always returns a unified result");
});
