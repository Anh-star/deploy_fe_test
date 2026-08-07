/**
 * Phase O4B final: architecture-level wiring tests for the secure
 * preview hook + component.
 *
 * <p>These tests are SOURCE-INSPECTION based: they read the
 * production files and assert that the documented invariants hold
 * (e.g. the hook only calls documentService.getDocumentPreview,
 * imports the production helpers, and the component imports the
 * correct helpers).</p>
 *
 * <p>Behavioral tests live in
 * {@link secureResponseContract.test.mjs} and
 * {@link useSecureDocumentPreviewPolling.test.mjs}, which import
 * the production code directly. This file is the supplemental
 * architecture layer.</p>
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOOK_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "../../hooks/useSecureDocumentPreview.js"),
  "utf8"
);
const HELPERS_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "../../hooks/securePreviewHelpers.js"),
  "utf8"
);
const COMPONENT_SOURCE = fs.readFileSync(
  path.resolve(
    __dirname,
    "../../components/document/SecureDocumentPreview.jsx"
  ),
  "utf8"
);
const ADMIN_HOOK_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "../../hooks/useDocumentPreviewStatus.js"),
  "utf8"
);

// ─────────────────────────────────────────────────────────────────
// Balanced-brace source extractor
// ─────────────────────────────────────────────────────────────────

/**
 * Extracts a balanced-brace block starting at the opening brace of `start`.
 * Returns the full matched text including the opening and closing braces,
 * or null if no balanced closing brace is found.
 */
function extractBraceBlock(source, startPos) {
  if (source[startPos] !== "{") return null;
  let depth = 0;
  let i = startPos;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(startPos, i + 1);
    }
    i++;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Production helper module exports
// ─────────────────────────────────────────────────────────────────

test("securePreviewHelpers exports the documented helpers and does NOT export the removed helpers", () => {
  // Expected exports — helpers that are part of the approved contract.
  for (const name of [
    "securePreviewValidateStatus",
    "normalizeSecurePreviewResult",
    "normalizeSecurePreviewError",
    "isSecurePreviewTerminal",
    "shouldPollSecurePreview",
    "getSecurePreviewPresentation",
  ]) {
    assert.match(
      HELPERS_SOURCE,
      new RegExp(`export\\s+(?:async\\s+)?(?:function|const)\\s+${name}\\s*\\(`),
      `securePreviewHelpers must export ${name}`
    );
  }
  // Removed helpers must not be exported.
  assert.ok(
    !/export\s+(?:function|const)\s+decodeSecurePreviewPdfBuffer/.test(HELPERS_SOURCE),
    "decodeSecurePreviewPdfBuffer must not be exported — Blob decoding lives in normalizeSecurePreviewResult"
  );
  assert.ok(
    !/export\s+(?:function|const)\s+securePreviewViewModel/.test(HELPERS_SOURCE),
    "securePreviewViewModel must not be exported — replaced by getSecurePreviewPresentation"
  );
});

// ─────────────────────────────────────────────────────────────────
// Secure hook wiring
// ─────────────────────────────────────────────────────────────────

test("useSecureDocumentPreview exists and exports as a named function", () => {
  assert.match(
    HOOK_SOURCE,
    /export\s+function\s+useSecureDocumentPreview\s*\(/
  );
});

test("useSecureDocumentPreview imports the production helpers", () => {
  // The hook MUST import from ./securePreviewHelpers.
  assert.match(
    HOOK_SOURCE,
    /from\s+["']\.\/securePreviewHelpers["']/,
    "hook must import from ./securePreviewHelpers"
  );
  // Must import normalizeSecurePreviewResult.
  assert.match(
    HOOK_SOURCE,
    /normalizeSecurePreviewResult/,
    "hook must import normalizeSecurePreviewResult"
  );
  // Must NOT import the deleted helpers.
  assert.ok(
    !/decodeSecurePreviewPdfBuffer/.test(HOOK_SOURCE),
    "hook must not import decodeSecurePreviewPdfBuffer"
  );
  assert.ok(
    !/securePreviewViewModel/.test(HOOK_SOURCE),
    "hook must not import securePreviewViewModel"
  );
});

test("useSecureDocumentPreview calls only documentService.getDocumentPreview", () => {
  assert.match(
    HOOK_SOURCE,
    /documentService\.getDocumentPreview\s*\(/,
    "hook must call documentService.getDocumentPreview"
  );
  assert.ok(
    !/\/admin\/documents\//.test(HOOK_SOURCE),
    "hook must NOT hit any /admin/documents/ path"
  );
  assert.ok(
    !/getDocumentPreviewStatus\s*\(/.test(HOOK_SOURCE),
    "hook must NOT call getDocumentPreviewStatus"
  );
  assert.ok(
    !/useDocumentPreviewStatus/.test(HOOK_SOURCE.replace(/\/\*\*[\s\S]*?\*\//g, "")),
    "hook must NOT reference the admin hook"
  );
  assert.ok(
    !/axiosClient\.get\s*\(/.test(HOOK_SOURCE),
    "hook must NOT call axiosClient.get directly"
  );
});

test("useSecureDocumentPreview passes securePreviewValidateStatus to the request", () => {
  assert.match(
    HOOK_SOURCE,
    /validateStatus:\s*securePreviewValidateStatus/
  );
});

test("useSecureDocumentPreview owns its own timer / abort / fetching", () => {
  assert.match(HOOK_SOURCE, /abortRef\.current\s*===\s*controller/);
  assert.match(HOOK_SOURCE, /clearTimer/);
  assert.match(HOOK_SOURCE, /fetchingRef\.current\s*=\s*false/);
});

test("useSecureDocumentPreview stops polling on terminal / 401 / 403 / 500", () => {
  const catchPos = HOOK_SOURCE.indexOf("} catch (err) {");
  assert.ok(catchPos >= 0, "expected catch block");
  const catchBrace = HOOK_SOURCE.indexOf("{", catchPos);
  assert.ok(catchBrace >= 0, "expected opening brace of catch block");
  const catchBlock = extractBraceBlock(HOOK_SOURCE, catchBrace);
  assert.ok(catchBlock, "expected balanced-brace catch block");
  // Cancellation returns early without surfacing.
  assert.match(catchBlock, /normalizeSecurePreviewError/);
  // Active errors: clear timer and surface.
  assert.match(catchBlock, /clearTimer\(\)/);
  // The catch path must NOT schedule a follow-up setTimeout.
  assert.ok(
    !/timerRef\.current\s*=\s*setTimeout/.test(catchBlock),
    "catch path MUST NOT schedule a follow-up timer"
  );
});

test("useSecureDocumentPreview treats unmount as request cancellation", () => {
  // Find the cleanup arrow function: locate "return () => {", then its opening brace.
  const cleanupTokenStart = HOOK_SOURCE.indexOf("return () => {");
  assert.ok(cleanupTokenStart >= 0, "expected cleanup callback");
  const cleanupBrace = HOOK_SOURCE.indexOf("{", cleanupTokenStart);
  assert.ok(cleanupBrace >= 0, "expected cleanup opening brace");
  const cleanupBody = extractBraceBlock(HOOK_SOURCE, cleanupBrace);
  assert.ok(cleanupBody !== null, "expected complete cleanup block");
  assert.ok(/activeRef\.current\s*=\s*false/.test(cleanupBody),
    "cleanup must set activeRef.current to false");
  assert.ok(/clearTimer\(\)/.test(cleanupBody),
    "cleanup must call clearTimer()");
  assert.ok(
    /if\s*\(\s*abortRef\.current\s*\)/.test(cleanupBody) ||
    /abortRef\.current\s*\?/.test(cleanupBody),
    "cleanup must check abortRef.current"
  );
  assert.ok(
    /abortRef\.current\.abort\(\)/.test(cleanupBody) ||
    /abortRef\.current\?\.\s*abort\(\)/.test(cleanupBody),
    "cleanup must call abortRef.current.abort()"
  );
  assert.ok(/abortRef\.current\s*=\s*null/.test(cleanupBody),
    "cleanup must clear abortRef.current to null");
  assert.ok(/fetchingRef\.current\s*=\s*false/.test(cleanupBody),
    "cleanup must set fetchingRef.current to false");
});

test("useSecureDocumentPreview uses isSecurePreviewTerminal + shouldPollSecurePreview", () => {
  assert.match(HOOK_SOURCE, /isSecurePreviewTerminal\s*\(/);
  assert.match(HOOK_SOURCE, /shouldPollSecurePreview\s*\(/);
});

// ─────────────────────────────────────────────────────────────────
// Component wiring
// ─────────────────────────────────────────────────────────────────

test("SecureDocumentPreview imports the presentation helper (not securePreviewViewModel)", () => {
  assert.match(
    COMPONENT_SOURCE,
    /from\s+["']\.\.\/\.\.\/hooks\/useSecureDocumentPreview["']/
  );
  assert.match(
    COMPONENT_SOURCE,
    /from\s+["']\.\.\/\.\.\/hooks\/securePreviewHelpers["']/
  );
  assert.match(
    COMPONENT_SOURCE,
    /getSecurePreviewPresentation\s*\(/
  );
  assert.ok(
    !/securePreviewViewModel/.test(COMPONENT_SOURCE),
    "SecureDocumentPreview must not call securePreviewViewModel"
  );
});

test("SecureDocumentPreview does not invoke the admin-status hook", () => {
  assert.ok(
    !/useDocumentPreviewStatus/.test(COMPONENT_SOURCE),
    "component must NOT use the admin preview-status hook"
  );
  assert.ok(
    !/adminDocumentApi/.test(COMPONENT_SOURCE),
    "component must NOT import adminDocumentApi"
  );
});

test("SecureDocumentPreview does not own a polling timer", () => {
  assert.ok(!/setTimeout\s*\(/.test(COMPONENT_SOURCE),
    "component must NOT use setTimeout (polling lives in the hook)");
  assert.ok(!/setInterval\s*\(/.test(COMPONENT_SOURCE));
  assert.ok(!/AbortController\s*\(\s*\)/.test(COMPONENT_SOURCE),
    "component must NOT own an AbortController");
  assert.ok(!/abortRef/.test(COMPONENT_SOURCE));
});

test("SecureDocumentPreview does not render DOCX or DOC HTML", () => {
  assert.ok(
    !/docx-preview/.test(COMPONENT_SOURCE),
    "component must not import docx-preview"
  );
  assert.ok(
    !/kind\s*===\s*["']docHtml["']/.test(COMPONENT_SOURCE),
    "component must not branch on docHtml kind"
  );
  assert.ok(
    !/kind\s*===\s*["']docx["']/.test(COMPONENT_SOURCE),
    "component must not branch on docx kind"
  );
});

test("SecureDocumentPreview branches on the unified kind (no derived status enum)", () => {
  // Must call getSecurePreviewPresentation.
  assert.match(COMPONENT_SOURCE,
    /getSecurePreviewPresentation\s*\(\s*preview\s*,\s*loading\s*\)/);
  // vm.state must not exist.
  assert.ok(
    !/vm\.state/.test(COMPONENT_SOURCE),
    "component must not use vm.state"
  );
  // Old derived enum values must not exist.
  assert.ok(
    !/pdf-full/.test(COMPONENT_SOURCE),
    "component must not use pdf-full"
  );
  assert.ok(
    !/pdf-limited/.test(COMPONENT_SOURCE),
    "component must not use pdf-limited"
  );
  assert.ok(
    !/idle/.test(COMPONENT_SOURCE),
    "component must not use idle"
  );
  // No second derived status enum introduced.
  assert.ok(
    !/derived\.status/.test(COMPONENT_SOURCE),
    "component must not introduce a second derived status enum"
  );
});

test("SecureDocumentPreview gates StudyItPdfViewer through presentation.showViewer with arrayBuffer and mode", () => {
  // presentation.showViewer must gate the viewer adapter call.
  assert.ok(
    /presentation\.showViewer/.test(COMPONENT_SOURCE),
    "component must use presentation.showViewer to gate the viewer"
  );
  // presentation.pdfBuffer is passed as the first argument to renderStudyItPdf.
  assert.ok(
    /renderStudyItPdf\s*\(\s*presentation\.pdfBuffer/.test(COMPONENT_SOURCE),
    "pdfBuffer must be passed as the first argument to renderStudyItPdf"
  );
  // presentation.viewerMode is passed as the second argument.
  assert.ok(
    /renderStudyItPdf\s*\([^)]*,\s*presentation\.viewerMode/.test(COMPONENT_SOURCE),
    "viewerMode must be passed as the second argument to renderStudyItPdf"
  );
  // The adapter passes buffer to arrayBuffer and viewerMode to mode.
  assert.ok(
    /arrayBuffer\s*=\s*\{buffer\}/.test(COMPONENT_SOURCE),
    "renderStudyItPdf must pass buffer to arrayBuffer"
  );
  assert.ok(
    /mode\s*=\s*\{viewerMode\}/.test(COMPONENT_SOURCE),
    "renderStudyItPdf must pass viewerMode to mode"
  );
  // Component must not supply a fallback mode="FULL".
  assert.ok(
    !/mode\s*=\s*"FULL"/.test(COMPONENT_SOURCE),
    "SecureDocumentPreview must not default mode to FULL — viewerMode comes from presentation"
  );
});

test("waiting / dead / locked / error states do NOT mount StudyItPdfViewer", () => {
  // Verify each branch calls its matching renderer and that only showViewer
  // reaches renderStudyItPdf.
  assert.ok(
    /if\s*\(\s*presentation\.showWaiting\s*\)/.test(COMPONENT_SOURCE),
    "showWaiting must be a branch"
  );
  assert.ok(
    /if\s*\(\s*presentation\.showDead\s*\)/.test(COMPONENT_SOURCE),
    "showDead must be a branch"
  );
  assert.ok(
    /if\s*\(\s*presentation\.showLocked\s*\)/.test(COMPONENT_SOURCE),
    "showLocked must be a branch"
  );
  assert.ok(
    /if\s*\(\s*presentation\.showError\s*\)/.test(COMPONENT_SOURCE),
    "showError must be a branch"
  );
  // Only showViewer reaches renderStudyItPdf.
  const viewerSection = COMPONENT_SOURCE.match(
    /else\s+if\s*\(\s*presentation\.showViewer\s*\)([\s\S]*)/
  );
  if (viewerSection) {
    assert.ok(
      /renderStudyItPdf/.test(viewerSection[1]),
      "showViewer must call renderStudyItPdf"
    );
  }
  // Verify the render functions do NOT mount StudyItPdfViewer.
  // renderWaiting uses block-body arrow: () => { ... };
  // renderLocked uses block-body arrow: () => { ... };
  // renderLoading uses concise arrow: () => ( ... );
  // Extract each from its declaration to the next declaration boundary.
  const renderWaitingEnd = COMPONENT_SOURCE.indexOf("const renderLocked = () => {");
  const renderLockedEnd = COMPONENT_SOURCE.indexOf("const renderLoading = () => (");
  const renderLoadingEnd = COMPONENT_SOURCE.indexOf("let body;");
  if (renderWaitingEnd >= 0) {
    const slice = COMPONENT_SOURCE.slice(
      COMPONENT_SOURCE.indexOf("const renderWaiting = "),
      renderWaitingEnd
    );
    assert.ok(!/StudyItPdfViewer/.test(slice), "renderWaiting must NOT mount StudyItPdfViewer");
  }
  if (renderLockedEnd >= 0) {
    const slice = COMPONENT_SOURCE.slice(
      COMPONENT_SOURCE.indexOf("const renderLocked = () => {"),
      renderLockedEnd
    );
    assert.ok(!/StudyItPdfViewer/.test(slice), "renderLocked must NOT mount StudyItPdfViewer");
  }
  if (renderLoadingEnd >= 0) {
    const slice = COMPONENT_SOURCE.slice(
      COMPONENT_SOURCE.indexOf("const renderLoading = () => ("),
      renderLoadingEnd
    );
    assert.ok(!/StudyItPdfViewer/.test(slice), "renderLoading must NOT mount StudyItPdfViewer");
  }
});

test("dead renderer renders 'Không thể tạo bản xem trước' and no buy CTA", () => {
  // renderDead uses concise arrow JSX: const renderDead = () => (
  const deadStart = COMPONENT_SOURCE.indexOf("const renderDead = () => (");
  assert.ok(deadStart >= 0, "renderDead must be declared");
  const deadEnd = COMPONENT_SOURCE.indexOf("const renderLocked = () => {");
  assert.ok(deadEnd >= 0, "expected renderLocked as the next declaration");
  const deadExpr = COMPONENT_SOURCE.slice(deadStart, deadEnd);
  // Verify the specific dead message is rendered.
  assert.ok(
    /Không thể tạo bản xem trước/.test(deadExpr),
    "renderDead must render 'Không thể tạo bản xem trước'"
  );
  // Verify refresh is wired in renderDead.
  assert.ok(/refresh/.test(deadExpr), "renderDead must wire refresh");
  // Verify renderBuyCta is NOT inside renderDead.
  assert.ok(
    !/renderBuyCta/.test(deadExpr),
    "terminal delivery error MUST NOT display a purchase CTA"
  );
  // Verify StudyItPdfViewer is NOT inside renderDead.
  assert.ok(
    !/StudyItPdfViewer/.test(deadExpr),
    "renderDead must NOT mount StudyItPdfViewer"
  );
});

test("error renderer does NOT display the purchase CTA", () => {
  // renderError uses concise arrow JSX: const renderError = () => (
  const errorStart = COMPONENT_SOURCE.indexOf("const renderError = () => (");
  assert.ok(errorStart >= 0, "renderError must be declared");
  // Slice up to the next non-expression region — the branch orchestration
  // starts at "let body;" which is far enough to isolate renderError.
  const bodyStart = COMPONENT_SOURCE.indexOf("let body;", errorStart);
  assert.ok(bodyStart >= 0, "expected branch orchestration after renderError");
  const errorExpr = COMPONENT_SOURCE.slice(errorStart, bodyStart);
  // Verify the error message is rendered.
  assert.ok(
    /presentation\.message/.test(errorExpr),
    "renderError must render an error message"
  );
  // Verify refresh is wired in renderError.
  assert.ok(/refresh/.test(errorExpr), "renderError must wire refresh");
  // Verify renderBuyCta is NOT inside renderError.
  assert.ok(
    !/renderBuyCta/.test(errorExpr),
    "401 / 403 / 500 errors MUST NOT display the purchase CTA"
  );
  // Verify StudyItPdfViewer is NOT inside renderError.
  assert.ok(
    !/StudyItPdfViewer/.test(errorExpr),
    "renderError must NOT mount StudyItPdfViewer"
  );
});

// ─────────────────────────────────────────────────────────────────
// Ref isolation between the two hooks
// ─────────────────────────────────────────────────────────────────

test("admin and secure hooks do not share refs", () => {
  const adminRefs = [
    /abortRef\.current\s*===\s*controller/.test(ADMIN_HOOK_SOURCE),
    /timerRef/.test(ADMIN_HOOK_SOURCE),
    /fetchingRef/.test(ADMIN_HOOK_SOURCE),
  ];
  const secureRefs = [
    /abortRef\.current\s*===\s*controller/.test(HOOK_SOURCE),
    /timerRef/.test(HOOK_SOURCE),
    /fetchingRef/.test(HOOK_SOURCE),
  ];
  for (const flag of [...adminRefs, ...secureRefs]) {
    assert.ok(flag, "expected the ref pattern to exist in each hook");
  }
  assert.ok(
    HOOK_SOURCE !== ADMIN_HOOK_SOURCE,
    "the two hooks are separate modules"
  );
});

test("admin hook continues to use the admin endpoint", () => {
  assert.match(ADMIN_HOOK_SOURCE, /getDocumentPreviewStatus\s*\(/);
  assert.match(ADMIN_HOOK_SOURCE, /\/admin\/documents\//);
  assert.ok(
    !/documentService\.getDocumentPreview\s*\(/.test(ADMIN_HOOK_SOURCE),
    "admin hook must NOT call documentService.getDocumentPreview"
  );
});
