/**
 * Phase O4B final: behavioral tests for the secure-preview contract.
 *
 * <p>This file imports the PRODUCTION helpers from
 * {@link ../../securePreviewHelpers} and asserts their real behavior.
 * No copied re-implementations are present in this file.</p>
 *
 * <p>The tests cover:</p>
 * <ul>
 *   <li>validateStatus: 2xx + 409 only.</li>
 *   <li>normalizeSecurePreviewResult (async): the unified hook contract
 *       — Blob decoding, waiting validation, shape guarantees.</li>
 *   <li>normalizeSecurePreviewError: 401 / 403 / 500 / network /
 *       cancellation.</li>
 *   <li>isSecurePreviewTerminal: pdf / locked / dead / error.</li>
 *   <li>shouldPollSecurePreview: waiting + polling-eligible previewState.</li>
 *   <li>getSecurePreviewPresentation: the component rendering flags.</li>
 * </ul>
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  securePreviewValidateStatus,
  normalizeSecurePreviewResult,
  normalizeSecurePreviewError,
  isSecurePreviewTerminal,
  shouldPollSecurePreview,
  getSecurePreviewPresentation,
} from "../securePreviewHelpers";

// ─────────────────────────────────────────────────────────────────
// 1. validateStatus — exact whitelist required by Phase O4B final
// ─────────────────────────────────────────────────────────────────

test("validateStatus accepts 200 / 201 / 202 / 204 / 299 / 409", () => {
  for (const s of [200, 201, 202, 203, 204, 299, 409]) {
    assert.equal(securePreviewValidateStatus(s), true,
      `${s} must be accepted`);
  }
});

test("validateStatus rejects 300 / 400 / 401 / 403 / 410 / 500 / 503", () => {
  for (const s of [300, 400, 401, 403, 410, 500, 503]) {
    assert.equal(securePreviewValidateStatus(s), false,
      `${s} must be rejected`);
  }
});

test("validateStatus rejects 199", () => {
  assert.equal(securePreviewValidateStatus(199), false);
});

// ─────────────────────────────────────────────────────────────────
// 2. normalizeSecurePreviewResult (async)
// ─────────────────────────────────────────────────────────────────

test("normalize: 200 PDF FULL → kind pdf, mode FULL, pdfBuffer ArrayBuffer", async () => {
  const blob = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])]);
  const r = await normalizeSecurePreviewResult({ kind: "pdf", blob, mode: "FULL" });
  assert.equal(r.kind, "pdf");
  assert.equal(r.mode, "FULL");
  assert.equal(r.previewState, "READY");
  assert.ok(r.pdfBuffer instanceof ArrayBuffer,
    "final pdfBuffer must be ArrayBuffer, never Blob");
  assert.equal(r.pdfBuffer instanceof Blob, false,
    "final state must never contain Blob");
  assert.equal(r.retryable, false);
});

test("normalize: 200 PDF LIMITED → kind pdf, mode LIMITED, pdfBuffer ArrayBuffer", async () => {
  const blob = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])]);
  const r = await normalizeSecurePreviewResult({ kind: "pdf", blob, mode: "LIMITED" });
  assert.equal(r.kind, "pdf",
    "FULL and LIMITED both use kind pdf");
  assert.equal(r.mode, "LIMITED");
  assert.equal(r.previewState, "READY");
  assert.ok(r.pdfBuffer instanceof ArrayBuffer,
    "final pdfBuffer must be ArrayBuffer");
  assert.equal(r.pdfBuffer instanceof Blob, false);
  assert.equal(r.retryable, false);
});

test("normalize: 200 LOCKED → kind locked, mode LOCKED", async () => {
  const r = await normalizeSecurePreviewResult({
    kind: "locked",
    mode: "LIMITED",
    reason: "PURCHASE_REQUIRED",
    message: "Mua đi",
  });
  assert.equal(r.kind, "locked");
  assert.equal(r.mode, "LOCKED",
    "locked normalizer must set mode to LOCKED");
  assert.equal(r.previewState, null);
  assert.equal(r.pdfBuffer, null);
  assert.equal(r.retryable, false);
});

test("normalize: 202 PENDING → kind waiting, mode null", async () => {
  const r = await normalizeSecurePreviewResult({
    kind: "waiting",
    previewState: "PENDING",
    message: "Đang chờ",
    retryable: false,
  });
  assert.equal(r.kind, "waiting");
  assert.equal(r.mode, null,
    "waiting normalizer must set mode to null");
  assert.equal(r.previewState, "PENDING");
  assert.equal(r.pdfBuffer, null);
});

test("normalize: 202 PROCESSING → kind waiting, mode null", async () => {
  const r = await normalizeSecurePreviewResult({
    kind: "waiting",
    previewState: "PROCESSING",
    message: "Đang chuyển đổi",
    retryable: true,
  });
  assert.equal(r.kind, "waiting");
  assert.equal(r.mode, null);
  assert.equal(r.previewState, "PROCESSING");
});

test("normalize: 202 RETRY → kind waiting, mode null", async () => {
  const r = await normalizeSecurePreviewResult({
    kind: "waiting",
    previewState: "RETRY",
    message: "Thử lại",
    retryable: true,
  });
  assert.equal(r.kind, "waiting");
  assert.equal(r.mode, null);
  assert.equal(r.previewState, "RETRY");
});

test("normalize: 409 DEAD → kind dead, mode null, retryable false (raw retryable ignored)", async () => {
  const r = await normalizeSecurePreviewResult({
    kind: "dead",
    previewState: "DEAD",
    message: "Bản xem trước không khả dụng",
    retryable: true,
  });
  assert.equal(r.kind, "dead",
    "409 DEAD MUST map to kind dead");
  assert.notEqual(r.kind, "locked",
    "409 DEAD MUST NEVER map to kind locked");
  assert.equal(r.mode, null,
    "dead normalizer must set mode to null");
  assert.equal(r.previewState, "DEAD");
  assert.equal(r.pdfBuffer, null);
  assert.equal(r.retryable, false,
    "final retryable must be false regardless of raw value");
});

test("normalize: kind error → kind error, mode null, retryable false (raw retryable ignored)", async () => {
  const r = await normalizeSecurePreviewResult({
    kind: "error",
    message: "Boom",
    retryable: true,
  });
  assert.equal(r.kind, "error");
  assert.equal(r.mode, null);
  assert.equal(r.previewState, null);
  assert.equal(r.pdfBuffer, null);
  assert.equal(r.retryable, false,
    "final retryable must be false regardless of raw value");
});

// ─────────────────────────────────────────────────────────────────
// 2a. genuinely absent normalizer paths
// ─────────────────────────────────────────────────────────────────

test("normalize: PDF malformed blob inputs → kind error", async () => {
  // Group: missing, null, undefined, non-Blob, unavailable arrayBuffer,
  // rejection, decoded non-ArrayBuffer.
  const cases = [
    { kind: "pdf", mode: "FULL" },                          // missing blob
    { kind: "pdf", mode: "FULL", blob: null },              // null blob
    { kind: "pdf", mode: "FULL", blob: undefined },          // undefined blob
    { kind: "pdf", mode: "FULL", blob: "not-a-blob" },      // non-Blob
  ];

  // Case without arrayBuffer: real Blob with shadowed arrayBuffer property
  const blobNoMethod = new Blob(["x"]);
  Object.defineProperty(blobNoMethod, "arrayBuffer", {
    value: undefined,
    writable: true,
    configurable: true,
  });
  cases.push({ kind: "pdf", mode: "FULL", blob: blobNoMethod });

  // Rejection: real Blob with overriding arrayBuffer that rejects
  const blobRejecting = new Blob([new Uint8Array([1])]);
  blobRejecting.arrayBuffer = async () => { throw new Error("decode fail"); };
  cases.push({ kind: "pdf", mode: "FULL", blob: blobRejecting });

  // Resolves non-ArrayBuffer
  const blobNonAB = new Blob([new Uint8Array([1])]);
  blobNonAB.arrayBuffer = async () => "not an array buffer";
  cases.push({ kind: "pdf", mode: "FULL", blob: blobNonAB });

  for (const input of cases) {
    const r = await normalizeSecurePreviewResult(input);
    assert.equal(r.kind, "error",
      `normalizeSecurePreviewResult(${JSON.stringify(input)}) must return kind error`);
    assert.equal(r.pdfBuffer, null,
      "error result must not carry pdfBuffer");
    assert.equal(r.mode, null);
  }
});

test("normalize: PDF invalid mode → kind error", async () => {
  for (const mode of [null, undefined, "LOCKED", "UNKNOWN", ""]) {
    const blob = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])]);
    const r = await normalizeSecurePreviewResult({ kind: "pdf", blob, mode });
    assert.equal(r.kind, "error",
      `PDF mode ${JSON.stringify(mode)} must return kind error`);
    assert.equal(r.pdfBuffer, null);
  }
});

test("normalize: waiting malformed previewState → kind error", async () => {
  for (const ps of [null, undefined, "READY", "DEAD", "UNKNOWN", ""]) {
    const r = await normalizeSecurePreviewResult({ kind: "waiting", previewState: ps });
    assert.equal(r.kind, "error",
      `waiting previewState ${JSON.stringify(ps)} must return kind error`);
    assert.equal(r.pdfBuffer, null);
  }
});

test("normalize: null / undefined / primitive / unknown kind → kind error", async () => {
  const cases = [
    null,
    undefined,
    42,
    "string",
    true,
    { kind: "weird" },
    { kind: null },
    { kind: undefined },
  ];
  for (const input of cases) {
    const r = await normalizeSecurePreviewResult(input);
    assert.equal(r.kind, "error",
      `normalizeSecurePreviewResult(${JSON.stringify(input)}) must return kind error`);
    assert.equal(r.pdfBuffer, null);
  }
});

// ─────────────────────────────────────────────────────────────────
// 3. getSecurePreviewPresentation
// ─────────────────────────────────────────────────────────────────

test("presentation: loading=true → showLoading true, all others false", () => {
  const p = getSecurePreviewPresentation(null, true);
  assert.equal(p.showLoading, true);
  assert.equal(p.showViewer, false);
  assert.equal(p.showWaiting, false);
  assert.equal(p.showDead, false);
  assert.equal(p.showLocked, false);
  assert.equal(p.showError, false);
  assert.equal(p.kind, null);
  assert.equal(p.previewState, null);
  assert.equal(p.viewerMode, null);
  assert.equal(p.pdfBuffer, null);
  assert.equal(p.allowBuyCta, false);
  assert.equal(p.message, null);
});

test("presentation: preview=null, loading=false → showLoading true", () => {
  const p = getSecurePreviewPresentation(null, false);
  assert.equal(p.showLoading, true,
    "absent preview must render loading");
  assert.equal(p.kind, null);
});

test("presentation: valid FULL PDF → showViewer true, viewerMode FULL", () => {
  const buf = new ArrayBuffer(8);
  const p = getSecurePreviewPresentation(
    { kind: "pdf", mode: "FULL", pdfBuffer: buf, previewState: "READY", message: null, retryable: false },
    false
  );
  assert.equal(p.kind, "pdf");
  assert.equal(p.showViewer, true);
  assert.equal(p.showWaiting, false);
  assert.equal(p.showDead, false);
  assert.equal(p.showLocked, false);
  assert.equal(p.showError, false);
  assert.equal(p.viewerMode, "FULL");
  assert.ok(p.pdfBuffer instanceof ArrayBuffer);
  assert.equal(p.allowBuyCta, false);
});

test("presentation: valid LIMITED PDF → showViewer true, viewerMode LIMITED", () => {
  const buf = new ArrayBuffer(8);
  const p = getSecurePreviewPresentation(
    { kind: "pdf", mode: "LIMITED", pdfBuffer: buf, previewState: "READY", message: null, retryable: false },
    false
  );
  assert.equal(p.kind, "pdf");
  assert.equal(p.showViewer, true);
  assert.equal(p.viewerMode, "LIMITED");
  assert.ok(p.pdfBuffer instanceof ArrayBuffer);
  assert.equal(p.allowBuyCta, false);
});

test("presentation: malformed PDF mode or buffer → showError true, safe message", () => {
  // Group: mode null, mode LOCKED, mode undefined, mode unknown,
  // missing pdfBuffer, pdfBuffer null, pdfBuffer Blob.
  const blob = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])]);
  const cases = [
    { kind: "pdf", mode: null, pdfBuffer: new ArrayBuffer(8) },
    { kind: "pdf", mode: undefined, pdfBuffer: new ArrayBuffer(8) },
    { kind: "pdf", mode: "LOCKED", pdfBuffer: new ArrayBuffer(8) },
    { kind: "pdf", mode: "UNKNOWN", pdfBuffer: new ArrayBuffer(8) },
    { kind: "pdf", mode: "FULL" },                          // missing pdfBuffer
    { kind: "pdf", mode: "FULL", pdfBuffer: null },         // null pdfBuffer
    { kind: "pdf", mode: "FULL", pdfBuffer: blob },         // Blob
  ];
  for (const input of cases) {
    const p = getSecurePreviewPresentation(input, false);
    assert.equal(p.kind, "error",
      `presentation for ${JSON.stringify(input)} must be error`);
    assert.equal(p.showError, true);
    assert.equal(p.showViewer, false);
    assert.equal(p.message, "Phản hồi bản xem trước không hợp lệ",
      "malformed PDF must use safe fixed message");
  }
});

test("presentation: valid waiting PENDING / PROCESSING / RETRY → showWaiting true", () => {
  for (const ps of ["PENDING", "PROCESSING", "RETRY"]) {
    const p = getSecurePreviewPresentation(
      { kind: "waiting", previewState: ps, message: null, retryable: false },
      false
    );
    assert.equal(p.kind, "waiting",
      `waiting previewState ${ps} must map to kind waiting`);
    assert.equal(p.showWaiting, true);
    assert.equal(p.showViewer, false);
    assert.equal(p.allowBuyCta, false);
    assert.equal(p.previewState, ps,
      "presentation.previewState must carry the exact validated value");
    assert.equal(p.viewerMode, null);
  }
});

test("presentation: malformed waiting → showError true, raw message suppressed", () => {
  for (const ps of [null, undefined, "READY", "DEAD", "UNKNOWN", ""]) {
    const p = getSecurePreviewPresentation(
      { kind: "waiting", previewState: ps, message: "raw dangerous message" },
      false
    );
    assert.equal(p.kind, "error",
      `waiting previewState ${JSON.stringify(ps)} must be error`);
    assert.equal(p.showError, true);
    assert.equal(p.showWaiting, false);
    assert.notEqual(p.message, "raw dangerous message",
      "malformed waiting must not expose the raw input message");
    assert.equal(p.message, "Phản hồi bản xem trước không hợp lệ",
      "malformed waiting must use safe fixed message");
  }
});

test("presentation: locked → showLocked true, allowBuyCta true", () => {
  const p = getSecurePreviewPresentation(
    { kind: "locked", mode: "LOCKED", message: "Mua đi" },
    false
  );
  assert.equal(p.kind, "locked");
  assert.equal(p.showLocked, true);
  assert.equal(p.showViewer, false);
  assert.equal(p.allowBuyCta, true,
    "locked presentation must allow the purchase CTA");
  assert.equal(p.viewerMode, null);
});

test("presentation: dead → showDead true, allowBuyCta false", () => {
  const p = getSecurePreviewPresentation(
    { kind: "dead", previewState: "DEAD", message: "x" },
    false
  );
  assert.equal(p.kind, "dead");
  assert.equal(p.showDead, true);
  assert.equal(p.showViewer, false);
  assert.equal(p.allowBuyCta, false,
    "dead presentation must not allow the purchase CTA");
  assert.equal(p.viewerMode, null);
});

test("presentation: normalized error with sanitized message → showError true, message preserved", () => {
  const p = getSecurePreviewPresentation(
    { kind: "error", message: "Phiên truy cập đã hết hạn" },
    false
  );
  assert.equal(p.kind, "error");
  assert.equal(p.showError, true);
  assert.equal(p.allowBuyCta, false);
  assert.equal(p.message, "Phiên truy cập đã hết hạn",
    "a normalized error message must be preserved");
});

test("presentation: unknown kind → showError true, safe message", () => {
  const p = getSecurePreviewPresentation({ kind: "unknown" }, false);
  assert.equal(p.kind, "error");
  assert.equal(p.showError, true);
  assert.equal(p.message, "Phản hồi bản xem trước không hợp lệ");
});

// ─────────────────────────────────────────────────────────────────
// 4. normalizeSecurePreviewError
// ─────────────────────────────────────────────────────────────────

test("normalize error: 401 → kind error with auth message", () => {
  const r = normalizeSecurePreviewError({
    response: { status: 401 },
    message: "Request failed",
  });
  assert.equal(r.kind, "error");
  assert.match(r.message, /Phiên truy cập/);
});

test("normalize error: 403 → kind error with auth message", () => {
  const r = normalizeSecurePreviewError({
    response: { status: 403 },
    message: "Request failed",
  });
  assert.equal(r.kind, "error");
  assert.match(r.message, /Phiên truy cập/);
});

test("normalize error: 500 → kind error with server message", () => {
  const r = normalizeSecurePreviewError({
    response: { status: 500 },
    message: "boom",
  });
  assert.equal(r.kind, "error");
  assert.match(r.message, /Máy chủ/);
});

test("normalize error: network / unknown → kind error", () => {
  const r = normalizeSecurePreviewError({ message: "Network Error" });
  assert.equal(r.kind, "error");
  assert.equal(r.message, "Network Error");
});

test("normalize error: cancellation returns null (does NOT surface)", () => {
  assert.equal(
    normalizeSecurePreviewError({ name: "CanceledError" }),
    null,
    "CanceledError MUST be suppressed — unmount must not render an error"
  );
  assert.equal(
    normalizeSecurePreviewError({ code: "ERR_CANCELED" }),
    null
  );
});

test("normalize error: 401 / 403 / 500 NEVER carry pdfBuffer", () => {
  for (const status of [401, 403, 500]) {
    const r = normalizeSecurePreviewError({
      response: { status },
      message: "x",
    });
    assert.equal(r.kind, "error");
    assert.equal(r.pdfBuffer, null);
  }
});

// ─────────────────────────────────────────────────────────────────
// 5. isSecurePreviewTerminal
// ─────────────────────────────────────────────────────────────────

test("isTerminal: pdf / locked / dead / error are terminal", () => {
  for (const kind of ["pdf", "locked", "dead", "error"]) {
    assert.equal(isSecurePreviewTerminal({ kind }), true,
      `${kind} must be terminal`);
  }
});

test("isTerminal: waiting is NOT terminal", () => {
  assert.equal(
    isSecurePreviewTerminal({ kind: "waiting", previewState: "PENDING" }),
    false
  );
});

test("isTerminal: null is NOT terminal", () => {
  assert.equal(isSecurePreviewTerminal(null), false);
});

// ─────────────────────────────────────────────────────────────────
// 6. shouldPollSecurePreview
// ─────────────────────────────────────────────────────────────────

test("shouldPoll: waiting + PENDING → poll", () => {
  assert.equal(
    shouldPollSecurePreview({ kind: "waiting", previewState: "PENDING" }),
    true
  );
});

test("shouldPoll: waiting + PROCESSING → poll", () => {
  assert.equal(
    shouldPollSecurePreview({ kind: "waiting", previewState: "PROCESSING" }),
    true
  );
});

test("shouldPoll: waiting + RETRY → poll", () => {
  assert.equal(
    shouldPollSecurePreview({ kind: "waiting", previewState: "RETRY" }),
    true
  );
});

test("shouldPoll: waiting + DEAD → no poll (terminal)", () => {
  assert.equal(
    shouldPollSecurePreview({ kind: "waiting", previewState: "DEAD" }),
    false
  );
});

test("shouldPoll: pdf / locked / dead / error → no poll", () => {
  for (const kind of ["pdf", "locked", "dead", "error"]) {
    assert.equal(
      shouldPollSecurePreview({ kind }),
      false,
      `${kind} must NOT schedule another poll`
    );
  }
});
