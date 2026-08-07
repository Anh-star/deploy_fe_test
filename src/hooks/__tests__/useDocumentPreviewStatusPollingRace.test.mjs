/**
 * Phase O4B correction tests for the polling ownership invariant
 * inside useDocumentPreviewStatus.
 *
 * Verifies:
 *  - the finally block only clears abortRef / fetchingRef when the
 *    completing request still owns abortRef (so an aborted old
 *    request cannot clear the ownership of a newer request);
 *  - refresh clears the existing timer and aborts the in-flight
 *    request.
 *
 * Race scenario covered by source-level invariant checks:
 *   1. request A starts;
 *   2. refresh aborts A and starts request B;
 *   3. A finishes its finally block;
 *   4. abortRef / fetchingRef MUST still reflect B's ownership;
 *   5. no overlapping request C starts.
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

test("finally block only clears abortRef and fetchingRef when the completing request still owns abortRef", () => {
  // Extract the complete fetchStatus callback with balanced braces,
  // then walk to the finally block and extract it with balanced braces.
  const fetchHeaderIdx = HOOK_SOURCE.indexOf("const fetchStatus = useCallback(");
  assert.ok(fetchHeaderIdx >= 0, "expected a fetchStatus declaration");
  const fetchOpenIdx = HOOK_SOURCE.indexOf("{", fetchHeaderIdx);
  assert.ok(fetchOpenIdx >= 0, "fetchStatus opening brace must exist");
  const fetchBody = extractBlock(HOOK_SOURCE, fetchOpenIdx);
  assert.ok(fetchBody, "fetchStatus body must be balanced");

  // finally keyword must exist inside fetchStatus.
  assert.match(fetchBody, /\bfinally\s*\{/);
  const finallyKeyIdx = fetchBody.indexOf("finally");
  assert.ok(finallyKeyIdx >= 0, "finally keyword must exist in fetchStatus");
  const finallyBraceIdx = fetchBody.indexOf("{", finallyKeyIdx);
  assert.ok(finallyBraceIdx >= 0, "finally opening brace must exist");
  const finallyBlock = extractBlock(fetchBody, finallyBraceIdx);
  assert.ok(finallyBlock, "finally block must be balanced");

  // The race-fix invariant: clearing ref state is gated on
  // (abortRef.current === controller).
  assert.match(
    finallyBlock,
    /abortRef\.current\s*===\s*controller/,
    "finally must gate clearing on (abortRef.current === controller)"
  );

  // The clearing if-block must contain both assignments.
  const clearingIf = finallyBlock.match(
    /if\s*\(\s*abortRef\.current\s*===\s*controller\s*\)\s*\{[\s\S]*?\}/
  );
  assert.ok(
    clearingIf,
    "fetchingRef and abortRef must only be cleared inside the ownership if-block"
  );
  const clearingBody = clearingIf[0];
  assert.match(clearingBody, /abortRef\.current\s*=\s*null/);
  assert.match(clearingBody, /fetchingRef\.current\s*=\s*false/);

  // The clearing statements MUST NOT also exist outside the gate.
  const bodyOutsideIf = finallyBlock.replace(clearingIf[0], "");
  assert.ok(
    !/fetchingRef\.current\s*=\s*false/.test(bodyOutsideIf),
    "fetchingRef.current must NOT be set to false outside the ownership gate"
  );
  assert.ok(
    !/abortRef\.current\s*=\s*null/.test(bodyOutsideIf),
    "abortRef.current must NOT be set to null outside the ownership gate"
  );
});

test("refresh always clears the existing timer and aborts the in-flight request", () => {
  // Extract the complete refresh callback with balanced braces.
  const refreshHeaderIdx = HOOK_SOURCE.indexOf("const refresh = useCallback(");
  assert.ok(refreshHeaderIdx >= 0, "expected a refresh declaration");
  const refreshOpenIdx = HOOK_SOURCE.indexOf("{", refreshHeaderIdx);
  assert.ok(refreshOpenIdx >= 0, "refresh opening brace must exist");
  const refreshBody = extractBlock(HOOK_SOURCE, refreshOpenIdx);
  assert.ok(refreshBody, "refresh callback must be balanced");

  assert.match(refreshBody, /clearTimer\s*\(\s*\)/, "refresh must clear timer");
  // Guarded abort, accepted as either `abortRef.current?.abort()` or
  // the production `if (abortRef.current) { abortRef.current.abort(); }`.
  const guardedAbort =
    /if\s*\(\s*abortRef\.current\s*\)\s*\{[\s\S]*?abortRef\.current\.abort\(\)/.test(
      refreshBody
    ) || /abortRef\.current\?\.abort\(\)/.test(refreshBody);
  assert.ok(guardedAbort, "refresh must abort the in-flight request");
  assert.match(refreshBody, /abortRef\.current\s*=\s*null/);
  assert.match(refreshBody, /fetchingRef\.current\s*=\s*false/);
  assert.match(refreshBody, /consecutiveErrorsRef\.current\s*=\s*0/);
  assert.match(refreshBody, /setHttpError\(null\)/);

  // fetchStatus(() => true) must come AFTER the timer/request cleanup.
  const fetchCall = refreshBody.match(
    /fetchStatus\s*\(\s*\(\s*\)\s*=>\s*true\s*\)/
  );
  assert.ok(fetchCall, "refresh must start one fetchStatus(() => true) call");
  const cleanupEndIdx = Math.max(
    refreshBody.lastIndexOf("clearTimer()"),
    refreshBody.lastIndexOf("abortRef.current = null")
  );
  assert.ok(
    cleanupEndIdx >= 0 &&
      refreshBody.indexOf(fetchCall[0]) > cleanupEndIdx,
    "fetchStatus call must come after timer/request ownership cleanup"
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

test("cleanup clears the timer, aborts the owned request, and resets ownership", () => {
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

  // Active is set false.
  assert.match(cleanupBody, /\bactive\s*=\s*false\b/);
  // Timer is cleared.
  assert.match(cleanupBody, /clearTimer\s*\(\s*\)/);
  // Guarded abort with the AbortController belonging to this effect.
  const guardedAbort =
    /if\s*\(\s*abortRef\.current\s*\)\s*\{[\s\S]*?abortRef\.current\.abort\(\)/.test(
      cleanupBody
    ) || /abortRef\.current\?\.abort\(\)/.test(cleanupBody);
  assert.ok(guardedAbort, "cleanup must abort the in-flight request");
  // abortRef.current is set null.
  assert.match(cleanupBody, /abortRef\.current\s*=\s*null/);
  // fetchingRef.current is set false.
  assert.match(cleanupBody, /fetchingRef\.current\s*=\s*false/);

  // Both timer cleanup and request cancellation must occur before
  // the cleanup function returns; both indices lie strictly before
  // the closing brace of the bounded cleanup body.
  const closeIdx = cleanupBody.lastIndexOf("}");
  assert.ok(closeIdx > 0);
  const clearTimerPos = cleanupBody.indexOf("clearTimer()");
  const abortPos = cleanupBody.search(/abortRef\.current\.abort\(\)/);
  assert.ok(clearTimerPos >= 0 && clearTimerPos < closeIdx);
  assert.ok(abortPos >= 0 && abortPos < closeIdx);
});
