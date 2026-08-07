/**
 * Phase O4B final: behavioral test of the real production
 * {@link ../../useSecureDocumentPreview} hook against mocked
 * {@code documentService.getDocumentPreview} responses.
 *
 * <p>Strategy:</p>
 * <ol>
 *   <li>The shim registers every {@code useRef} /
 *       {@code useState} by order-of-call. The hook uses a known,
 *       fixed order of refs and states, so the test fixture can
 *       index them deterministically.</li>
 *   <li>The shim captures {@code useEffect} cleanup so the test
 *       can simulate unmount.</li>
 *   <li>The hook source is copied to a temp directory with the
 *       react / documentService imports rewritten. The hook then
 *       runs against the REAL production
 *       {@link ../../securePreviewHelpers} helpers.</li>
 * </ol>
 *
 * <p>This test verifies the production polling policy against:</p>
 * <ul>
 *   <li>200 PDF FULL / LIMITED</li>
 *   <li>200 LOCKED</li>
 *   <li>202 PENDING / PROCESSING / RETRY</li>
 *   <li>409 DEAD</li>
 *   <li>409 without DEAD payload</li>
 *   <li>rejected 401 / 403 / 500</li>
 *   <li>unmount cancellation</li>
 *   <li>manual refresh after error</li>
 *   <li>malformed Blob inputs</li>
 *   <li>invalid PDF modes</li>
 *   <li>malformed waiting</li>
 *   <li>no-final-Blob invariant</li>
 *   <li>stale-state protection</li>
 *   <li>request-ownership protection</li>
 * </ul>
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  securePreviewValidateStatus,
  isSecurePreviewTerminal,
  shouldPollSecurePreview,
} from "../securePreviewHelpers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const HOOK_PATH = join(__dirname, "..", "useSecureDocumentPreview.js");
const HELPERS_PATH = join(__dirname, "..", "securePreviewHelpers.js");

// ─────────────────────────────────────────────────────────────────
// Build a fresh fixture + load the production hook source under
// test, with mocked react / documentService imports.
// ─────────────────────────────────────────────────────────────────

function makeDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function loadHookWithFixture() {
  const workDir = mkdtempSync(join(tmpdir(), "secure-hook-test-"));

  // Fixture: refs + state slots + deferreds queue + call log.
  const refs = [];
  const states = [];
  const cleanups = [];
  const deferreds = [];
  const calls = [];

  const fixture = {
    refs,
    states,
    cleanups,
    deferreds,
    calls,
    unmount: () => {
      const active = refs[3]; // activeRef is the 4th ref
      if (active) active.current = false;
      for (const c of cleanups) {
        try { c(); } catch { /* ignore */ }
      }
    },
  };

  const documentService = {
    async getDocumentPreview(documentId, options = {}) {
      calls.push({ documentId, validateStatus: options?.validateStatus, signal: options?.signal });
      const d = makeDeferred();
      d.signal = options?.signal || null;
      deferreds.push(d);
      return d.promise;
    },
  };

  // React shim — pre-registers refs and states by index.
  const reactShim = `
    const refs = globalThis.__fixture__.refs;
    const states = globalThis.__fixture__.states;
    const cleanups = globalThis.__fixture__.cleanups;
    let _ri = 0;
    let _si = 0;
    export function useRef(initial) {
      const i = _ri++;
      if (refs.length <= i) refs.push({ current: initial });
      return refs[i];
    }
    export function useState(initial) {
      const i = _si++;
      if (states.length <= i) {
        states.push({ value: typeof initial === "function" ? initial() : initial });
      }
      const slot = states[i];
      const set = (next) => {
        slot.value = typeof next === "function" ? next(slot.value) : next;
      };
      return [slot.value, set];
    }
    export function useEffect(fn) {
      const cleanup = fn();
      if (typeof cleanup === "function") cleanups.push(cleanup);
    }
    export function useCallback(fn) { return fn; }
  `;
  writeFileSync(join(workDir, "__reactShim__.mjs"), reactShim, "utf8");

  // Service shim that forwards to globalThis.__documentService__.
  const serviceShim = `
    export const documentService = {
      async getDocumentPreview(documentId, options) {
        return globalThis.__documentService__.getDocumentPreview(documentId, options);
      },
    };
  `;
  writeFileSync(join(workDir, "__serviceShim__.mjs"), serviceShim, "utf8");

  // Helpers — copy verbatim from the new production helpers.
  const helpersSrc = readFileSync(HELPERS_PATH, "utf8");
  writeFileSync(join(workDir, "__helpersShim__.mjs"), helpersSrc, "utf8");

  // Hook source — copy with rewritten imports.
  let hookSrc = readFileSync(HOOK_PATH, "utf8");
  hookSrc = hookSrc.replace(/from\s+["']\.\.\/services\/api["']/g,
    `from "./__serviceShim__.mjs"`);
  hookSrc = hookSrc.replace(/from\s+["']\.\/securePreviewHelpers["']/g,
    `from "./__helpersShim__.mjs"`);
  hookSrc = hookSrc.replace(/from\s+["']react["']/g,
    `from "./__reactShim__.mjs"`);
  writeFileSync(join(workDir, "__hook__.mjs"), hookSrc, "utf8");

  // Wire globals so the shim can find the fixture / service.
  globalThis.__fixture__ = fixture;
  globalThis.__documentService__ = documentService;

  const mod = await import(pathToFileURL(join(workDir, "__hook__.mjs")).href);

  return {
    fixture,
    documentService,
    useSecureDocumentPreview: mod.useSecureDocumentPreview,
    cleanup() {
      try {
        globalThis.__fixture__ = undefined;
        globalThis.__documentService__ = undefined;
      } catch { /* ignore */ }
    },
  };
}

async function settle() {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

// Reference to the production hook's ref order:
//   refs[0] = timerRef
//   refs[1] = abortRef
//   refs[2] = fetchingRef
//   refs[3] = activeRef
//   states[0] = preview
//   states[1] = loading
//   states[2] = httpError

// ─────────────────────────────────────────────────────────────────
// Existing tests — kept and updated
// ─────────────────────────────────────────────────────────────────

test("200 PDF FULL → preview.kind pdf, mode FULL, pdfBuffer ArrayBuffer", async () => {
  const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
  useSecureDocumentPreview("doc-1");
  await settle();
  fixture.deferreds[0].resolve({
    kind: "pdf",
    blob: new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])]),
    mode: "FULL",
  });
  await settle();
  const p = fixture.states[0].value;
  assert.equal(p.kind, "pdf");
  assert.equal(p.mode, "FULL");
  assert.ok(p.pdfBuffer instanceof ArrayBuffer,
    "final pdfBuffer must be ArrayBuffer, never Blob");
  assert.equal(p.pdfBuffer instanceof Blob, false,
    "final state must never contain Blob");
  assert.equal(fixture.refs[0].current, null,
    "terminal pdf must NOT schedule a follow-up");
});

test("200 PDF LIMITED → preview.kind pdf, mode LIMITED, pdfBuffer ArrayBuffer, not Blob", async () => {
  const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
  useSecureDocumentPreview("doc-1");
  await settle();
  fixture.deferreds[0].resolve({
    kind: "pdf",
    blob: new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])]),
    mode: "LIMITED",
  });
  await settle();
  const p = fixture.states[0].value;
  assert.equal(p.kind, "pdf",
    "FULL and LIMITED both use kind pdf");
  assert.equal(p.mode, "LIMITED");
  assert.ok(p.pdfBuffer instanceof ArrayBuffer,
    "final pdfBuffer must be ArrayBuffer");
  assert.equal(p.pdfBuffer instanceof Blob, false,
    "final state must never contain Blob");
  assert.equal(fixture.refs[0].current, null,
    "terminal pdf must NOT schedule a follow-up");
});

test("200 LOCKED → preview.kind locked", async () => {
  const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
  useSecureDocumentPreview("doc-1");
  await settle();
  fixture.deferreds[0].resolve({
    kind: "locked",
    mode: "LIMITED",
    reason: "PURCHASE_REQUIRED",
    message: "Mua",
  });
  await settle();
  const p = fixture.states[0].value;
  assert.equal(p.kind, "locked");
  assert.equal(p.pdfBuffer, null);
  assert.equal(fixture.refs[0].current, null,
    "locked must NOT schedule a follow-up");
});

test("202 PENDING → preview.kind waiting, schedules follow-up", async () => {
  const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
  useSecureDocumentPreview("doc-1");
  await settle();
  fixture.deferreds[0].resolve({
    kind: "waiting",
    previewState: "PENDING",
    message: "wait",
    retryable: true,
  });
  await settle();
  const p = fixture.states[0].value;
  assert.equal(p.kind, "waiting");
  assert.equal(p.previewState, "PENDING");
  assert.notEqual(fixture.refs[0].current, null,
    "PENDING must schedule a follow-up");
});

test("202 PROCESSING → preview.kind waiting, schedules follow-up", async () => {
  const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
  useSecureDocumentPreview("doc-1");
  await settle();
  fixture.deferreds[0].resolve({
    kind: "waiting",
    previewState: "PROCESSING",
    message: "Đang chuyển đổi",
    retryable: true,
  });
  await settle();
  assert.equal(fixture.states[0].value.kind, "waiting");
  assert.notEqual(fixture.refs[0].current, null);
});

test("202 RETRY → preview.kind waiting, schedules follow-up", async () => {
  const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
  useSecureDocumentPreview("doc-1");
  await settle();
  fixture.deferreds[0].resolve({
    kind: "waiting",
    previewState: "RETRY",
    message: "Thử lại",
    retryable: true,
  });
  await settle();
  assert.equal(fixture.states[0].value.kind, "waiting");
  assert.notEqual(fixture.refs[0].current, null);
});

test("409 DEAD → preview.kind dead, no follow-up, never locked", async () => {
  const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
  useSecureDocumentPreview("doc-1");
  await settle();
  fixture.deferreds[0].resolve({
    kind: "dead",
    previewState: "DEAD",
    message: "Bản xem trước không khả dụng",
    retryable: false,
  });
  await settle();
  const p = fixture.states[0].value;
  assert.equal(p.kind, "dead",
    "Only a 409 payload whose status is DEAD maps to dead");
  assert.notEqual(p.kind, "locked",
    "409 DEAD MUST NEVER map to the business locked state");
  assert.equal(p.pdfBuffer, null);
  assert.equal(fixture.refs[0].current, null,
    "dead MUST NOT schedule a follow-up");
});

test("409 without DEAD → preview.kind error, no follow-up", async () => {
  const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
  useSecureDocumentPreview("doc-1");
  await settle();
  fixture.deferreds[0].resolve({
    kind: "error",
    message: "Bản xem trước không khả dụng (phản hồi 409 không hợp lệ)",
    retryable: false,
  });
  await settle();
  const p = fixture.states[0].value;
  assert.equal(p.kind, "error",
    "409 without DEAD must surface as kind error");
  assert.notEqual(p.kind, "dead");
  assert.notEqual(p.kind, "locked");
  assert.equal(fixture.refs[0].current, null);
});

test("rejected 401 → preview.kind error, zero follow-ups, never locked", async () => {
  const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
  useSecureDocumentPreview("doc-1");
  await settle();
  fixture.deferreds[0].reject({
    response: { status: 401, data: null },
    message: "Request failed",
  });
  await settle();
  const p = fixture.states[0].value;
  assert.equal(p.kind, "error");
  assert.notEqual(p.kind, "locked",
    "401 MUST NOT map to the business locked state");
  assert.equal(p.pdfBuffer, null,
    "401 result MUST NOT carry pdfBuffer");
  assert.equal(fixture.refs[0].current, null,
    "401 schedules zero follow-up timers");
  assert.equal(fixture.calls.length, 1);
});

test("rejected 403 → preview.kind error, zero follow-ups", async () => {
  const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
  useSecureDocumentPreview("doc-1");
  await settle();
  fixture.deferreds[0].reject({
    response: { status: 403, data: null },
    message: "Request failed",
  });
  await settle();
  const p = fixture.states[0].value;
  assert.equal(p.kind, "error");
  assert.notEqual(p.kind, "locked");
  assert.equal(p.pdfBuffer, null);
  assert.equal(fixture.refs[0].current, null);
  assert.equal(fixture.calls.length, 1);
});

test("rejected 500 → preview.kind error, zero follow-ups", async () => {
  const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
  useSecureDocumentPreview("doc-1");
  await settle();
  fixture.deferreds[0].reject({
    response: { status: 500, data: null },
    message: "boom",
  });
  await settle();
  const p = fixture.states[0].value;
  assert.equal(p.kind, "error",
    "500 MUST surface as kind error");
  assert.notEqual(p.kind, "waiting");
  assert.notEqual(p.kind, "locked");
  assert.notEqual(p.kind, "dead");
  assert.equal(p.pdfBuffer, null);
  assert.equal(fixture.refs[0].current, null,
    "500 schedules zero follow-up timers");
  assert.equal(fixture.calls.length, 1);
});

test("401/403/500 results never carry pdfBuffer", async () => {
  for (const status of [401, 403, 500]) {
    const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
    useSecureDocumentPreview("doc-1");
    await settle();
    fixture.deferreds[0].reject({
      response: { status, data: null },
      message: "x",
    });
    await settle();
    const p = fixture.states[0].value;
    assert.equal(p.kind, "error");
    assert.equal(p.pdfBuffer, null,
      `${status} result MUST NOT carry pdfBuffer`);
  }
});

test("unmount cancellation does NOT surface an error", async () => {
  const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
  useSecureDocumentPreview("doc-1");
  await settle();
  // Capture request A's signal from the service mock.
  const signalA = fixture.deferreds[0].signal;
  assert.ok(signalA, "request A must have a signal");
  // Simulate unmount by invoking the production effect cleanup.
  fixture.unmount();
  await settle();
  // Signal A must be aborted by the cleanup.
  assert.equal(signalA.aborted, true,
    "unmount must abort the in-flight request");
  // Settle A as recognized cancellation.
  fixture.deferreds[0].reject({
    name: "CanceledError",
    code: "ERR_CANCELED",
  });
  await settle();
  // Cancellation must NOT surface a preview or error.
  assert.equal(fixture.states[0].value, null,
    "cancellation must NOT surface a preview or error");
  // No follow-up was scheduled.
  assert.equal(fixture.refs[0].current, null,
    "cancellation must NOT schedule a follow-up");
});

test("manual refresh after error performs exactly one new request", async () => {
  const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
  // Invoke the hook once and retain the result.
  const result = useSecureDocumentPreview("doc-1");
  await settle();
  // Settle A as an error.
  fixture.deferreds[0].reject({
    response: { status: 401, data: null },
    message: "x",
  });
  await settle();
  assert.equal(fixture.states[0].value.kind, "error");
  assert.equal(fixture.calls.length, 1,
    "first request was the only automatic request");

  // Exercise the production refresh() callback from the retained result.
  assert.equal(typeof result.refresh, "function");
  result.refresh();
  await settle();
  assert.equal(fixture.calls.length, 2,
    "manual refresh issues exactly one new request");
  // Inspect B through refs[2] (abortRef) and its captured signal.
  const controllerB = fixture.refs[2].current;
  assert.ok(controllerB, "refresh must create a new controller");
  assert.equal(controllerB.signal.aborted, false,
    "the new request must NOT be aborted");
  // No automatic follow-up timer was scheduled.
  fixture.deferreds[1].reject({
    response: { status: 401, data: null },
    message: "x",
  });
  await settle();
  assert.equal(fixture.calls.length, 2,
    "no automatic follow-up after a manual refresh");
  assert.equal(fixture.refs[0].current, null,
    "no follow-up timer scheduled after refresh + 401");
});

test("securePreviewValidateStatus is the exact whitelist used by the hook", async () => {
  const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
  useSecureDocumentPreview("doc-1");
  await settle();
  const call = fixture.calls[0];
  assert.equal(typeof call.validateStatus, "function");
  assert.equal(call.validateStatus(200), true);
  assert.equal(call.validateStatus(202), true,
    "HTTP 202 is accepted as a successful waiting response");
  assert.equal(call.validateStatus(409), true);
  assert.equal(call.validateStatus(401), false);
  assert.equal(call.validateStatus(403), false);
  assert.equal(call.validateStatus(500), false);
  // Same as the production helper.
  assert.equal(call.validateStatus(200), securePreviewValidateStatus(200));
  assert.equal(call.validateStatus(401), securePreviewValidateStatus(401));
});

test("isSecurePreviewTerminal — production helper", () => {
  for (const kind of ["pdf", "locked", "dead", "error"]) {
    assert.equal(isSecurePreviewTerminal({ kind }), true);
  }
  assert.equal(isSecurePreviewTerminal({ kind: "waiting" }), false);
});

test("shouldPollSecurePreview — production helper", () => {
  for (const ps of ["PENDING", "PROCESSING", "RETRY"]) {
    assert.equal(
      shouldPollSecurePreview({ kind: "waiting", previewState: ps }),
      true
    );
  }
  assert.equal(
    shouldPollSecurePreview({ kind: "waiting", previewState: "DEAD" }),
    false
  );
  for (const kind of ["pdf", "locked", "dead", "error"]) {
    assert.equal(shouldPollSecurePreview({ kind }), false);
  }
});

// ─────────────────────────────────────────────────────────────────
// Genuinely absent real-hook integration tests
// ─────────────────────────────────────────────────────────────────

test("PDF missing blob property → preview.kind error, no timer", async () => {
  const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
  useSecureDocumentPreview("doc-1");
  await settle();
  // Raw result with no blob key at all.
  fixture.deferreds[0].resolve({ kind: "pdf", mode: "FULL" });
  await settle();
  const p = fixture.states[0].value;
  assert.equal(p.kind, "error",
    "missing blob property must become error");
  assert.equal(p.mode, null);
  assert.equal(p.pdfBuffer, null);
  assert.equal(fixture.refs[0].current, null,
    "error must not schedule a follow-up timer");
});

test("PDF null blob → preview.kind error, no timer", async () => {
  const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
  useSecureDocumentPreview("doc-1");
  await settle();
  fixture.deferreds[0].resolve({ kind: "pdf", mode: "FULL", blob: null });
  await settle();
  const p = fixture.states[0].value;
  assert.equal(p.kind, "error");
  assert.equal(p.pdfBuffer, null);
  assert.equal(fixture.refs[0].current, null);
});

test("PDF non-Blob blob value → preview.kind error, no timer", async () => {
  const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
  useSecureDocumentPreview("doc-1");
  await settle();
  fixture.deferreds[0].resolve({ kind: "pdf", mode: "FULL", blob: "not-a-blob" });
  await settle();
  const p = fixture.states[0].value;
  assert.equal(p.kind, "error",
    "non-Blob blob value must become error");
  assert.equal(p.pdfBuffer, null);
  assert.equal(fixture.refs[0].current, null);
});

test("PDF invalid modes → preview.kind error, no timer", async () => {
  for (const mode of [null, undefined, "LOCKED", "UNKNOWN", ""]) {
    const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
    useSecureDocumentPreview("doc-1");
    await settle();
    fixture.deferreds[0].resolve({
      kind: "pdf",
      blob: new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])]),
      mode,
    });
    await settle();
    const p = fixture.states[0].value;
    assert.equal(p.kind, "error",
      `PDF mode ${JSON.stringify(mode)} must become error`);
    assert.equal(p.pdfBuffer, null);
    assert.equal(fixture.refs[0].current, null);
  }
});

test("PDF Blob.arrayBuffer rejection → preview.kind error, no timer", async () => {
  const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
  useSecureDocumentPreview("doc-1");
  await settle();
  // Create a real Blob, then override its arrayBuffer to reject.
  const realBlob = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])]);
  realBlob.arrayBuffer = async () => {
    throw new Error("Blob decode failed");
  };
  fixture.deferreds[0].resolve({ kind: "pdf", blob: realBlob, mode: "FULL" });
  await settle();
  const p = fixture.states[0].value;
  assert.equal(p.kind, "error",
    "Blob.arrayBuffer rejection must become error");
  assert.equal(p.pdfBuffer, null,
    "error result must not carry pdfBuffer");
  assert.equal(fixture.refs[0].current, null,
    "error must not schedule a follow-up");
});

test("PDF Blob.arrayBuffer resolves non-ArrayBuffer → preview.kind error, no timer", async () => {
  const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
  useSecureDocumentPreview("doc-1");
  await settle();
  // Create a real Blob, then override its arrayBuffer to resolve a non-ArrayBuffer.
  const realBlob = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])]);
  realBlob.arrayBuffer = async () => "not an ArrayBuffer";
  fixture.deferreds[0].resolve({ kind: "pdf", blob: realBlob, mode: "FULL" });
  await settle();
  const p = fixture.states[0].value;
  assert.equal(p.kind, "error",
    "Blob.arrayBuffer resolving non-ArrayBuffer must become error");
  assert.equal(p.pdfBuffer, null);
  assert.equal(fixture.refs[0].current, null);
});

test("waiting malformed previewState → preview.kind error, no timer", async () => {
  for (const ps of [null, undefined, "READY", "DEAD", "UNKNOWN", ""]) {
    const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
    useSecureDocumentPreview("doc-1");
    await settle();
    fixture.deferreds[0].resolve({ kind: "waiting", previewState: ps });
    await settle();
    const p = fixture.states[0].value;
    assert.equal(p.kind, "error",
      `waiting previewState ${JSON.stringify(ps)} must become error`);
    assert.equal(fixture.refs[0].current, null,
      "malformed waiting must not schedule a follow-up");
  }
});

test("no final state ever contains Blob — direct real-hook invariant test", async () => {
  // Capture results from representative final states.
  const results = [];

  // FULL PDF
  {
    const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
    useSecureDocumentPreview("doc-full");
    await settle();
    fixture.deferreds[0].resolve({
      kind: "pdf",
      blob: new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])]),
      mode: "FULL",
    });
    await settle();
    results.push(fixture.states[0].value);
  }

  // LIMITED PDF
  {
    const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
    useSecureDocumentPreview("doc-limited");
    await settle();
    fixture.deferreds[0].resolve({
      kind: "pdf",
      blob: new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])]),
      mode: "LIMITED",
    });
    await settle();
    results.push(fixture.states[0].value);
  }

  // waiting PENDING
  {
    const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
    useSecureDocumentPreview("doc-pending");
    await settle();
    fixture.deferreds[0].resolve({ kind: "waiting", previewState: "PENDING" });
    await settle();
    results.push(fixture.states[0].value);
  }

  // locked
  {
    const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
    useSecureDocumentPreview("doc-locked");
    await settle();
    fixture.deferreds[0].resolve({ kind: "locked", mode: "LOCKED" });
    await settle();
    results.push(fixture.states[0].value);
  }

  // dead
  {
    const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
    useSecureDocumentPreview("doc-dead");
    await settle();
    fixture.deferreds[0].resolve({ kind: "dead", previewState: "DEAD" });
    await settle();
    results.push(fixture.states[0].value);
  }

  // error
  {
    const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
    useSecureDocumentPreview("doc-err");
    await settle();
    fixture.deferreds[0].resolve({ kind: "error", message: "boom" });
    await settle();
    results.push(fixture.states[0].value);
  }

  // malformed PDF (missing blob)
  {
    const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
    useSecureDocumentPreview("doc-malformed");
    await settle();
    fixture.deferreds[0].resolve({ kind: "pdf", mode: "FULL" });
    await settle();
    results.push(fixture.states[0].value);
  }

  // Assert the invariant across all results.
  for (const r of results) {
    assert.equal(r?.pdfBuffer instanceof Blob, false,
      `final state ${r?.kind} must never contain Blob — got ${r?.pdfBuffer}`);
  }

  // For FULL and LIMITED, also assert ArrayBuffer.
  const pdfResults = results.filter((r) => r?.kind === "pdf");
  for (const r of pdfResults) {
    assert.ok(r?.pdfBuffer instanceof ArrayBuffer,
      `PDF result must have pdfBuffer instanceof ArrayBuffer`);
  }
});

test("stale request A cannot overwrite request B result", async () => {
  const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
  // Invoke the hook exactly once and retain the result.
  const result = useSecureDocumentPreview("doc-1");
  await settle();

  // Capture request A's deferred.
  const deferredA = fixture.deferreds[0];
  assert.equal(fixture.deferreds.length, 1, "only request A exists initially");

  // Call refresh exactly once — this creates request B.
  result.refresh();
  await settle();
  assert.equal(fixture.deferreds.length, 2,
    "refresh must create exactly one new request B");

  // Resolve B first with a terminal LOCKED result.
  fixture.deferreds[1].resolve({ kind: "locked", mode: "LOCKED" });
  await settle();

  // Resolve A afterward with a DEAD result.
  deferredA.resolve({ kind: "dead", previewState: "DEAD" });
  await settle();

  const p = fixture.states[0].value;
  // Final state must be from B (locked), not from A (dead).
  assert.equal(p.kind, "locked",
    "stale request A must not overwrite B — final state must be locked");
  assert.notEqual(p.kind, "dead",
    "stale request A (dead) must not overwrite the final state");
  // No timer must exist.
  assert.equal(fixture.refs[0].current, null,
    "terminal results must not schedule a follow-up");
});

test("request A finally block cannot clear controller B", async () => {
  const { fixture, useSecureDocumentPreview } = await loadHookWithFixture();
  // Invoke the hook exactly once and retain the result.
  const result = useSecureDocumentPreview("doc-1");
  await settle();

  // Capture request A's deferred.
  const deferredA = fixture.deferreds[0];
  assert.equal(fixture.calls.length, 1, "only request A exists initially");

  // Capture controller A from abortRef (refs[2]).
  const controllerA = fixture.refs[2].current;
  assert.ok(controllerA, "request A must have a controller");

  // Call refresh once — this creates request B.
  result.refresh();
  await settle();
  assert.equal(fixture.calls.length, 2, "refresh must create exactly one new request");

  // Capture controller B from abortRef (refs[2]).
  const controllerB = fixture.refs[2].current;
  assert.notStrictEqual(controllerA, controllerB,
    "refresh must create a new controller");

  // Settle A first (this triggers A's finally while B still owns abortRef).
  deferredA.resolve({ kind: "dead", previewState: "DEAD" });
  await settle();

  // After A's finally runs, abortRef must still hold controller B.
  assert.strictEqual(fixture.refs[2].current, controllerB,
    "A's finally must not clear abortRef — B's controller must remain");
  assert.equal(controllerB.signal.aborted, false,
    "controller B must not be aborted by A's finally");

  // Settle B successfully.
  fixture.deferreds[1].resolve({ kind: "locked", mode: "LOCKED" });
  await settle();

  // Final state must be from B.
  const p = fixture.states[0].value;
  assert.equal(p.kind, "locked",
    "B result must be applied after A's finally does not interfere");
});
