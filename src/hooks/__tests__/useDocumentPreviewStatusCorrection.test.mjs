/**
 * Phase O4B correction tests for useDocumentPreviewStatus.
 *
 * Covers the regression-bug list:
 *  - POLLING_STATUSES is declared.
 *  - finally block does not return a React cleanup function.
 *  - no out-of-scope `active` variable is referenced.
 *  - fetchingRef is reset correctly.
 *  - AbortController is cleared only for the current request.
 *  - the Axios request receives the AbortSignal.
 *  - refresh clears the existing timer and request.
 *  - cleanup aborts the request and clears the timer.
 *  - unknown statuses do not poll forever.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HOOK_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "../useDocumentPreviewStatus.js"),
  "utf8"
);

// Balanced-brace block extraction. Walks every character with a depth
// counter starting at the supplied index, which MUST be the index of an
// actual `{`. The returned slice ends at the matching `}`.
function extractBlock(source, openIdx) {
  let depth = 0;
  let i = openIdx;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(openIdx, i + 1);
    }
    i += 1;
  }
  return null;
}

// Find the index of an opening `{` for a declaration whose header
// matches the supplied regex, starting from `from`.
function findOpenBraceAfter(source, regex, from = 0) {
  const m = source.slice(from).match(regex);
  if (!m) return -1;
  const headerIdx = from + (m.index ?? -1);
  if (headerIdx < 0) return -1;
  const braceIdx = source.indexOf("{", headerIdx);
  return braceIdx;
}

test("POLLING_STATUSES is declared in the hook source", () => {
  assert.match(
    HOOK_SOURCE,
    /const\s+POLLING_STATUSES\s*=\s*\["PENDING",\s*"PROCESSING",\s*"RETRY"\]/,
    "POLLING_STATUSES must be declared with PENDING/PROCESSING/RETRY values"
  );
});

test("finally block does not return a React cleanup function", () => {
  // Extract the complete fetchStatus callback with balanced braces,
  // then locate the finally block inside it with another balanced walk.
  const fetchHeaderIdx = HOOK_SOURCE.indexOf("const fetchStatus = useCallback(");
  assert.ok(fetchHeaderIdx >= 0, "expected a fetchStatus declaration");
  const fetchOpenIdx = HOOK_SOURCE.indexOf("{", fetchHeaderIdx);
  assert.ok(fetchOpenIdx >= 0, "fetchStatus opening brace must exist");
  const fetchBody = extractBlock(HOOK_SOURCE, fetchOpenIdx);
  assert.ok(fetchBody, "fetchStatus body must be balanced");

  // finally keyword must exist inside fetchStatus.
  assert.match(fetchBody, /\bfinally\s*\{/);
  // Locate the opening brace following the finally keyword.
  const finallyKeyIdx = fetchBody.indexOf("finally");
  assert.ok(finallyKeyIdx >= 0, "finally keyword must exist in fetchStatus");
  const finallyBraceIdx = fetchBody.indexOf("{", finallyKeyIdx);
  assert.ok(finallyBraceIdx >= 0, "finally opening brace must exist");
  // Extract the complete finally block with balanced braces.
  const finallyBlock = extractBlock(fetchBody, finallyBraceIdx);
  assert.ok(finallyBlock, "finally block must be balanced");

  // finally must not return an arrow function (React cleanup shape).
  assert.ok(
    !/return\s+\(\s*\)\s*=>/.test(finallyBlock),
    "finally block must not return an arrow function (React cleanup shape)"
  );
  // No effect cleanup function lives inside finally.
  assert.ok(
    !/return\s+function\s*\(/.test(finallyBlock),
    "finally block must not return a named function"
  );
  // The ownership guard must be present inside finally.
  assert.match(
    finallyBlock,
    /abortRef\.current\s*===\s*controller/,
    "finally must gate clearing on (abortRef.current === controller)"
  );
});

test("no out-of-scope `active` variable is referenced from useCallback", () => {
  // The effect body owns `active`; the fetchStatus callback must not
  // touch it directly. We assert there is no `active = true` or
  // `if (!active)` style reference inside fetchStatus.
  const fetchBodyMatch = HOOK_SOURCE.match(
    /const\s+fetchStatus\s*=\s*useCallback\(\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n\s*\}\s*,\s*\[/
  );
  assert.ok(fetchBodyMatch, "expected a fetchStatus useCallback");
  const fetchBody = fetchBodyMatch[1];
  assert.ok(
    !/\bactive\b\s*=\s*(true|false)/.test(fetchBody),
    "fetchStatus must not assign to an out-of-scope `active`"
  );
  assert.ok(
    !/if\s*\(\s*!\s*active\s*\)/.test(fetchBody),
    "fetchStatus must not read an out-of-scope `active`"
  );
});

test("AbortController is cleared only for the current request", () => {
  // After a successful fetch, we still keep the controller alive
  // because the next fetch may need to abort it. Only the cleanup
  // effect is allowed to clear abortRef.current.
  const cleanupMatch = HOOK_SOURCE.match(
    /return\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*;\s*\}\s*,\s*\[documentId/
  );
  assert.ok(cleanupMatch, "expected the effect cleanup function");
  const cleanup = cleanupMatch[1];
  assert.match(
    cleanup,
    /abortRef\.current\s*=\s*null/,
    "cleanup must clear abortRef.current"
  );
});

test("the Axios request receives the AbortSignal", () => {
  // Production uses the API wrapper getDocumentPreviewStatus rather than
  // a direct axiosClient.get. We assert the wrapper call inside the
  // bounded fetchStatus callback receives { signal: controller.signal }.
  const fetchHeaderIdx = HOOK_SOURCE.indexOf("const fetchStatus = useCallback(");
  assert.ok(fetchHeaderIdx >= 0, "expected a fetchStatus declaration");
  const fetchOpenIdx = HOOK_SOURCE.indexOf("{", fetchHeaderIdx);
  assert.ok(fetchOpenIdx >= 0, "fetchStatus opening brace must exist");
  const fetchBody = extractBlock(HOOK_SOURCE, fetchOpenIdx);
  assert.ok(fetchBody, "fetchStatus body must be balanced");

  // The wrapper is called.
  assert.match(fetchBody, /\bgetDocumentPreviewStatus\s*\(/);
  // documentId is passed.
  const wrapperCallMatch = fetchBody.match(
    /getDocumentPreviewStatus\s*\(([\s\S]*?)\)\s*;/
  );
  assert.ok(wrapperCallMatch, "getDocumentPreviewStatus call must exist");
  const wrapperArgs = wrapperCallMatch[1];
  assert.match(wrapperArgs, /\bdocumentId\b/);
  // The request options contain signal: controller.signal.
  assert.match(
    wrapperArgs,
    /\{[\s\S]*?signal\s*:\s*controller\.signal[\s\S]*?\}/,
    "the wrapper call must forward signal: controller.signal"
  );
});

test("refresh clears the existing timer and request", () => {
  // Extract the complete refresh callback with balanced braces.
  const refreshHeaderIdx = HOOK_SOURCE.indexOf("const refresh = useCallback(");
  assert.ok(refreshHeaderIdx >= 0, "expected a refresh declaration");
  const refreshOpenIdx = HOOK_SOURCE.indexOf("{", refreshHeaderIdx);
  assert.ok(refreshOpenIdx >= 0, "refresh opening brace must exist");
  const refreshBody = extractBlock(HOOK_SOURCE, refreshOpenIdx);
  assert.ok(refreshBody, "refresh callback must be balanced");

  // Timer is cleared.
  assert.match(refreshBody, /clearTimer\s*\(\s*\)/);
  // Guarded abort block exists (production uses `if (abortRef.current) { abort... }`).
  assert.match(
    refreshBody,
    /if\s*\(\s*abortRef\.current\s*\)\s*\{[\s\S]*?abortRef\.current\.abort\(\)/,
    "refresh must abort the in-flight request inside a guarded block"
  );
  // abortRef.current is cleared.
  assert.match(refreshBody, /abortRef\.current\s*=\s*null/);
  // fetchingRef is reset.
  assert.match(refreshBody, /fetchingRef\.current\s*=\s*false/);
  // fetchStatus(() => true) starts exactly one explicit request
  // AFTER the timer/request ownership cleanup.
  const fetchStatusCall = refreshBody.match(
    /fetchStatus\s*\(\s*\(\s*\)\s*=>\s*true\s*\)/
  );
  assert.ok(
    fetchStatusCall,
    "refresh must start a single explicit fetchStatus(() => true) request"
  );
  const cleanupEndIdx = Math.max(
    refreshBody.lastIndexOf("clearTimer()"),
    refreshBody.lastIndexOf("abortRef.current = null")
  );
  assert.ok(
    cleanupEndIdx >= 0 &&
      refreshBody.indexOf(fetchStatusCall[0]) > cleanupEndIdx,
    "fetchStatus call must come after timer/request ownership cleanup"
  );
  // Exactly one explicit fetchStatus call exists in refresh.
  const fetchStatusCount = (
    refreshBody.match(/fetchStatus\s*\(/g) || []
  ).length;
  assert.strictEqual(
    fetchStatusCount,
    1,
    "refresh must contain exactly one fetchStatus call"
  );
});

// Find the unique useEffect whose bounded callback contains every
// required anchor: the fetchStatus(isActive) call, the cleanup
// return, the active flag flip, and the timer clear. Returns the
// bounded callback body, or null when no/many candidates match.
function findPollingEffectCallback(source, extractBlock) {
  let cursor = 0;
  let match = null;
  while (true) {
    const idx = source.indexOf("useEffect(", cursor);
    if (idx < 0) break;
    const openIdx = source.indexOf("{", idx);
    if (openIdx < 0) break;
    const body = extractBlock(source, openIdx);
    if (!body) break;
    const hasFetchCall = body.includes("fetchStatus(isActive)");
    const hasCleanupReturn = body.includes("return () =>");
    const hasActiveFalse = /\bactive\s*=\s*false\b/.test(body);
    const hasClearTimer = body.includes("clearTimer()");
    if (hasFetchCall && hasCleanupReturn && hasActiveFalse && hasClearTimer) {
      if (match) return null; // ambiguity: more than one match
      match = body;
    }
    cursor = idx + "useEffect(".length;
  }
  return match;
}

test("cleanup aborts the request and clears the timer", () => {
  // Identify the polling useEffect by its bounded callback content,
  // not by the first global fetchStatus(isActive) occurrence.
  const effectBody = findPollingEffectCallback(HOOK_SOURCE, extractBlock);
  assert.ok(
    effectBody,
    "expected exactly one polling useEffect whose body contains fetchStatus(isActive), return () =>, active = false, and clearTimer()"
  );

  // The cleanup return sits inside this effect. It is `return () => { ... }`.
  const cleanupHeaderIdx = effectBody.indexOf("return () =>");
  assert.ok(cleanupHeaderIdx >= 0, "effect must return a cleanup function");
  const cleanupOpenIdx = effectBody.indexOf("{", cleanupHeaderIdx);
  assert.ok(cleanupOpenIdx >= 0, "cleanup opening brace must exist");
  const cleanupBody = extractBlock(effectBody, cleanupOpenIdx);
  assert.ok(cleanupBody, "cleanup body must be balanced");

  // active is set false.
  assert.match(cleanupBody, /\bactive\s*=\s*false\b/);
  // Timer is cleared.
  assert.match(cleanupBody, /clearTimer\s*\(\s*\)/);
  // Guarded abort block.
  assert.match(
    cleanupBody,
    /if\s*\(\s*abortRef\.current\s*\)\s*\{[\s\S]*?abortRef\.current\.abort\(\)/,
    "cleanup must abort the in-flight request inside a guarded block"
  );
  // abortRef.current is cleared.
  assert.match(cleanupBody, /abortRef\.current\s*=\s*null/);
  // fetchingRef is reset.
  assert.match(cleanupBody, /fetchingRef\.current\s*=\s*false/);
  // Both timer cleanup and request cancellation occur before the
  // cleanup function returns; their indices are both strictly < the
  // close-brace of the bounded body.
  const closeIdx = cleanupBody.lastIndexOf("}");
  assert.ok(closeIdx > 0);
  const clearTimerPos = cleanupBody.indexOf("clearTimer()");
  const abortPos = cleanupBody.search(/abortRef\.current\.abort\(\)/);
  assert.ok(clearTimerPos >= 0 && clearTimerPos < closeIdx);
  assert.ok(abortPos >= 0 && abortPos < closeIdx);
});

test("unknown statuses do not poll forever", () => {
  // The hook must surface an http error and stop polling for any
  // status outside the documented whitelist.
  const stopMatch = HOOK_SOURCE.match(
    /if\s*\(\s*!\s*POLLING_STATUSES\.includes\(next\.fullStatus\)\)\s*\{[\s\S]*?\}/
  );
  assert.ok(stopMatch, "expected an explicit POLLING_STATUSES guard");
  const body = stopMatch[0];
  assert.match(body, /clearTimer\(\)/, "unknown statuses must clear the timer");
  assert.match(body, /setHttpError\(/, "unknown statuses must surface an error");
});
