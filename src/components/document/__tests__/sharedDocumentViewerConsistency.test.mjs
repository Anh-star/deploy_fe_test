/**
 * Phase V-CONSIST: Free and paid documents must render through the
 * SAME shared PDF viewer shell, so the UI never diverges by
 * payment status.
 *
 * <p>Source-level assertions on:
 * <ul>
 *   <li>{@link DocumentPreview.jsx} — routes free and paid docs
 *       through the shared viewer family.</li>
 *   <li>{@link SharedFreeDocumentPdfViewer.jsx} — wires the free
 *       PDF branch to {@code StudyItPdfViewer} with the FULL
 *       chrome.</li>
 *   <li>{@link useFreeDocumentPdfBytes.js} — exposes a
 *       shape-compatible hook for the free PDF bytes.</li>
 *   <li>{@link SecureDocumentPreview.jsx} — keeps a single canonical
 *       centred loading message regardless of preview state.</li>
 * </ul>
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COMPONENTS_DIR = path.resolve(__dirname, "..");

const DOCUMENT_PREVIEW_SOURCE = fs.readFileSync(
  path.join(COMPONENTS_DIR, "DocumentPreview.jsx"),
  "utf8",
);
const SHARED_FREE_SOURCE = fs.readFileSync(
  path.join(COMPONENTS_DIR, "SharedFreeDocumentPdfViewer.jsx"),
  "utf8",
);
const SECURE_PREVIEW_SOURCE = fs.readFileSync(
  path.join(COMPONENTS_DIR, "SecureDocumentPreview.jsx"),
  "utf8",
);
const FREE_HOOK_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "..", "..", "..", "hooks", "useFreeDocumentPdfBytes.js"),
  "utf8",
);

// ────────────────────────────────────────────────────────────────
// 1. Shared viewer — DocumentPreview routing
// ────────────────────────────────────────────────────────────────

test("DocumentPreview routes free PDFs through the shared viewer family, not a duplicate component", () => {
  assert.match(
    DOCUMENT_PREVIEW_SOURCE,
    /import\s+SharedFreeDocumentPdfViewer\s+from\s+["']\.\/SharedFreeDocumentPdfViewer["']/,
    "DocumentPreview must import the shared free viewer"
  );
  assert.match(
    DOCUMENT_PREVIEW_SOURCE,
    /SharedFreeDocumentPdfViewer\s+documentId=\{documentId\}\s+fileUrl=\{fileUrl\}\s+fileName=\{fileName\}/,
    "DocumentPreview must wire the shared viewer with documentId + fileUrl + fileName"
  );
  // The PDF branch must NOT use the legacy free PDF iframe path.
  // We allow the gview fallback (DOC/PPT) to keep its iframe
  // because that is a different format with no shared viewer.
  const codeOnly = DOCUMENT_PREVIEW_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(
    codeOnly,
    /mode\s*===\s*["']pdf["'][\s\S]{0,200}?iframe/,
    "free PDF branch must NOT render an iframe"
  );
  // PDF branch must delegate to the shared viewer (and not
  // directly to a custom canvas / iframe).
  assert.match(
    codeOnly,
    /mode\s*===\s*["']pdf["'][\s\S]{0,200}?SharedFreeDocumentPdfViewer/,
  );
});

test("DocumentPreview routes paid documents through SecureDocumentPreview unchanged", () => {
  assert.match(
    DOCUMENT_PREVIEW_SOURCE,
    /isPaidDoc[\s\S]{0,200}?SecureDocumentPreview/,
    "DocumentPreview must delegate paid docs to SecureDocumentPreview when isPaidDoc"
  );
  // The paid branch passes `isPaid` to SecureDocumentPreview.
  assert.match(
    DOCUMENT_PREVIEW_SOURCE,
    /<SecureDocumentPreview[\s\S]{0,200}?isPaid\b/,
    "paid branch must pass `isPaid` to SecureDocumentPreview"
  );
});

// ────────────────────────────────────────────────────────────────
// 2. SharedFreeDocumentPdfViewer — viewer chrome contract
// ────────────────────────────────────────────────────────────────

test("SharedFreeDocumentPdfViewer mounts StudyItPdfViewer in FULL mode with toolbar + thumbnails", () => {
  assert.match(
    SHARED_FREE_SOURCE,
    /import\s+StudyItPdfViewer\s+from\s+["']\.\/StudyItPdfViewer["']/,
  );
  // The viewer is mounted with arrayBuffer from decoded bytes
  // and mode="FULL" so the toolbar / thumbnails / download /
  // print are always visible for free PDFs.
  assert.match(
    SHARED_FREE_SOURCE,
    /<StudyItPdfViewer\s+[\s\S]{0,400}?mode=(?:\{"FULL"\}|"FULL")/,
    "shared free viewer must mount StudyItPdfViewer with mode=FULL"
  );
  assert.match(
    SHARED_FREE_SOURCE,
    /<StudyItPdfViewer\s+[\s\S]{0,400}?arrayBuffer=\{viewerBuffer\}/,
    "shared free viewer must pass arrayBuffer from the decoded bytes"
  );
  // Toolbar + thumbnails are owned by StudyItPdfViewer. We do
  // NOT render an iframe / image / fallback inside the shared
  // free viewer — those are fallbacks only for non-PDF free
  // formats in the parent DocumentPreview.
  const codeOnly = SHARED_FREE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(codeOnly, /<iframe/);
  assert.doesNotMatch(codeOnly, /<img/);
});

test("SharedFreeDocumentPdfViewer must NOT show a lock or purchase CTA", () => {
  const codeOnly = SHARED_FREE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(codeOnly, /mode=["']LIMITED["']/);
  assert.doesNotMatch(codeOnly, /renderBuyCta/);
  assert.doesNotMatch(codeOnly, /studyit-pdf-lock-anchor/);
  assert.doesNotMatch(codeOnly, /showLocked/);
});

test("SharedFreeDocumentPdfViewer download / print are wired", () => {
  assert.match(SHARED_FREE_SOURCE, /onDownload=\{handleDownload\}/);
  assert.match(SHARED_FREE_SOURCE, /onPrint=\{handlePrint\}/);
  assert.match(
    SHARED_FREE_SOURCE,
    /StudyItPdfViewer[\s\S]{0,400}?mode=(?:\{"FULL"\}|"FULL")/,
  );
});

// ────────────────────────────────────────────────────────────────
// 3. Free bytes hook — shape parity with the secure hook
// ────────────────────────────────────────────────────────────────

test("useFreeDocumentPdfBytes returns shape compatible with the secure preview hook", () => {
  // The hook takes documentId (not url) so it can call the preview endpoint.
  assert.match(
    FREE_HOOK_SOURCE,
    /export\s+function\s+useFreeDocumentPdfBytes\s*\(\s*documentId\s*\)/,
    "hook must take documentId to call the preview endpoint"
  );
  // Same return shape: { preview, loading, refresh }.
  assert.match(FREE_HOOK_SOURCE, /return\s*\{\s*preview\s*,\s*loading\s*,\s*refresh\s*\}/);
  // The hook calls documentService.getDocumentPreview — the same endpoint
  // used by SecureDocumentPreview — so free docs use the same bytes as paid.
  assert.match(
    FREE_HOOK_SOURCE,
    /documentService\.getDocumentPreview\s*\(/,
    "hook must call documentService.getDocumentPreview for the preview endpoint"
  );
  // Final preview is always kind "pdf" with mode "FULL" — no
  // accidental LIMITED remap for free documents.
  assert.match(FREE_HOOK_SOURCE, /kind:\s*["']pdf["']/);
  assert.match(FREE_HOOK_SOURCE, /mode:\s*["']FULL["']/);
  // No polling — free documents do not have a polling contract.
  assert.doesNotMatch(FREE_HOOK_SOURCE, /setTimeout/);
  assert.doesNotMatch(FREE_HOOK_SOURCE, /setInterval/);
  // Cancellation must not surface as an error.
  assert.match(FREE_HOOK_SOURCE, /AbortError/);
});

test("normalizeFreePreviewResult normalises service pdf result to FULL mode", () => {
  // Test the pure normalizer logic by simulating its source inline.
  // The function checks result.kind === "pdf" and maps to the FULL shape.
  assert.match(
    FREE_HOOK_SOURCE,
    /result\.kind\s*===\s*["']pdf["'][\s\S]{0,200}?kind:\s*["']pdf["']/,
    "pdf result kind normalises to kind:pdf"
  );
  assert.match(
    FREE_HOOK_SOURCE,
    /mode:\s*result\.mode\s*\|\|\s*["']FULL["']/,
    "pdf result uses mode from service or defaults to FULL"
  );
  assert.match(
    FREE_HOOK_SOURCE,
    /previewState:\s*["']READY["']/,
    "pdf result normalises to previewState: READY"
  );
});

test("normalizeFreePreviewResult maps non-pdf service results to kind error", () => {
  // The normalizer returns kind "error" for any non-pdf result
  // (waiting / dead / locked / error / null).
  // Strip comments so doc examples of kind:"locked" don't false-pass.
  const codeOnly = FREE_HOOK_SOURCE
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.match(
    codeOnly,
    /result\.kind\s*===\s*["']pdf["'][\s\S]{0,200}?return\s*\{[\s\S]{0,100}?kind:\s*["']pdf["']/,
    "only kind pdf returns pdf shape"
  );
  // Fallback error path must set kind:"error" and pdfBuffer:null.
  assert.match(
    codeOnly,
    /kind:\s*["']error["'][\s\S]{0,100}?pdfBuffer:\s*null/,
    "non-pdf results return kind error with null pdfBuffer"
  );
  // Must NOT return kind "locked" for free documents.
  assert.doesNotMatch(
    codeOnly,
    /kind:\s*["']locked["']/,
    "normalizer must not return kind locked for free documents"
  );
});

// ────────────────────────────────────────────────────────────────
// 4. Submitted-document flow — single loading message
// ────────────────────────────────────────────────────────────────

test("submitted PROCESSING state shows exactly one centred loading message", () => {
  // Extract renderWaiting body and assert it does NOT contain
  // the legacy clock-icon or per-state label.
  const waitingMatch = SECURE_PREVIEW_SOURCE.match(
    /(?:const|let)\s+renderWaiting\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\n\s*\};/,
  );
  assert.ok(waitingMatch, "expected renderWaiting");
  // Strip ALL comment forms before asserting so the test does
  // not false-fail on the very doc that explains the legacy
  // behaviour.
  const body = waitingMatch[0]
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.match(body, /Đang tải bản xem trước…/);
  // The legacy clock-icon block must be gone.
  assert.doesNotMatch(body, /Đang chuyển đổi DOC\/DOCX sang PDF/);
  assert.doesNotMatch(body, /Hệ thống đang thử xử lý lại/);
  assert.doesNotMatch(body, /Đang chờ tạo bản xem trước/);
  assert.doesNotMatch(body, /secure-document-preview-waiting-icon/);
});

test("submitted RETRY / FAILED / READY each render exactly one block, no duplicates", () => {
  // Strip comments before extracting each renderer block so
  // the doc comments don't leak into the assertions.
  const clean = SECURE_PREVIEW_SOURCE
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  // Waiting: renderWaiting must be exactly ONE block with role=status.
  const waitingMatch = clean.match(
    /(?:const|let)\s+renderWaiting\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\n\s*\};/,
  );
  assert.ok(waitingMatch, "renderWaiting not found");
  const waitingBlocks = (waitingMatch[0].match(/role=["']status["']/g) || []).length;
  assert.equal(waitingBlocks, 1, "renderWaiting must render exactly one status block");

  // Dead: renderDead must be exactly ONE block with role=alert.
  const deadMatch = clean.match(
    /(?:const|let)\s+renderDead\s*=\s*\(\)\s*=>\s*\([\s\S]*?\)\s*;/,
  );
  assert.ok(deadMatch, "renderDead not found");
  const deadBlocks = (deadMatch[0].match(/role=["']alert["']/g) || []).length;
  assert.equal(deadBlocks, 1, "renderDead must render exactly one alert block");

  // Error: renderError must be exactly ONE block.
  const errorMatch = clean.match(
    /(?:const|let)\s+renderError\s*=\s*\(\)\s*=>\s*\([\s\S]*?\)\s*;/,
  );
  assert.ok(errorMatch, "renderError not found");
  const errorBlocks = (errorMatch[0].match(/role=["']alert["']/g) || []).length;
  assert.equal(errorBlocks, 1, "renderError must render exactly one alert block");

  // Loading: renderLoading must be exactly ONE block.
  const loadingMatch = clean.match(
    /(?:const|let)\s+renderLoading\s*=\s*\(\)\s*=>\s*\([\s\S]*?\)\s*;/,
  );
  assert.ok(loadingMatch, "renderLoading not found");
  const loadingBlocks = (loadingMatch[0].match(/aria-live=["']polite["']/g) || []).length;
  assert.equal(loadingBlocks, 1, "renderLoading must render exactly one polite block");
});

test("submitted READY transitions to PDF renderer (StudyItPdfViewer) and loading state disappears", () => {
  // The orchestration block branches: showViewer mounts StudyItPdfViewer.
  const bodyIdx = SECURE_PREVIEW_SOURCE.indexOf("let body;");
  assert.ok(bodyIdx >= 0);
  const returnIdx = SECURE_PREVIEW_SOURCE.indexOf("return (", bodyIdx);
  const orchBlock = SECURE_PREVIEW_SOURCE.slice(bodyIdx, returnIdx);
  // showViewer wins over showWaiting / showLoading.
  assert.match(orchBlock, /showViewer[\s\S]{0,200}?renderStudyItPdf\(/);
  // showLoading / showWaiting / showLocked / showDead / showError
  // are mutually exclusive branches — none of the non-viewer
  // branches mounts the viewer.
  const branches = [
    /if\s*\(\s*presentation\.showLoading\s*\)\s*\{[\s\S]*?\}\s*else\s*if/,
    /else\s+if\s*\(\s*presentation\.showWaiting\s*\)\s*\{[\s\S]*?\}\s*else\s*if/,
    /else\s+if\s*\(\s*presentation\.showDead\s*\)\s*\{[\s\S]*?\}\s*else\s*if/,
    /else\s+if\s*\(\s*presentation\.showLocked\s*\)\s*\{[\s\S]*?\}\s*else\s*if/,
    /else\s+if\s*\(\s*presentation\.showError\s*\)\s*\{/,
  ];
  for (const re of branches) {
    const m = orchBlock.match(re);
    assert.ok(m, "branch must exist");
    const head = m[0].split("else if")[0];
    assert.doesNotMatch(
      head,
      /renderStudyItPdf\(/,
      "non-viewer branches must not mount the viewer"
    );
  }
});

// ────────────────────────────────────────────────────────────────
// 5. Paid unpurchased — LIMITED + lock overlay preserved
// ────────────────────────────────────────────────────────────────

test("paid unpurchased READY still renders LIMITED mode with the lock overlay", () => {
  // The StudyItPdfViewer must keep LIMITED-mode behavior: lock
  // anchor and disabled download/print.
  const viewerSource = fs.readFileSync(
    path.join(COMPONENTS_DIR, "StudyItPdfViewer.jsx"),
    "utf8",
  );
  // Strip ALL comment forms (block + line) so we test real code
  // only, not doc comments that might mention the same words.
  const codeOnly = viewerSource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.match(codeOnly, /isLimited\s*=\s*mode\s*===\s*["']LIMITED["']/);
  assert.match(codeOnly, /shouldRenderLockCard\s*=\s*isLimited\b/);
  // Lock anchor only renders when shouldRenderLockCard is true
  // (i.e. LIMITED mode). Lock is gated on isLimited, not on FULL.
  assert.match(codeOnly, /shouldRenderLockCard\s*&&/);
  assert.match(codeOnly, /studyit-pdf-lock-anchor/);
  // Download / print are disabled in LIMITED mode.
  assert.match(codeOnly, /disabled=\{isLimited\s*\|\|\s*disabled\}/);
  assert.match(codeOnly, /Mua tài liệu/);
});

test("paid owner / purchaser / staff READY renders FULL mode, no lock", () => {
  const viewerSource = fs.readFileSync(
    path.join(COMPONENTS_DIR, "StudyItPdfViewer.jsx"),
    "utf8",
  );
  const codeOnly = viewerSource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  // Lock anchor must NOT render when isLimited is false (FULL).
  // shouldRenderLockCard = isLimited, so the lock block is gated
  // on isLimited being true.
  assert.match(codeOnly, /shouldRenderLockCard\s*=\s*isLimited\b/);
  // Download/print handlers return early in LIMITED; proceed in FULL.
  assert.match(codeOnly, /if\s*\(\s*isLimited\s*\)\s*return\s*;[\s\S]{0,100}?onDownload/);
  assert.match(codeOnly, /if\s*\(\s*isLimited\s*\)\s*return\s*;[\s\S]{0,100}?onPrint/);
  assert.match(codeOnly, /disabled=\{isLimited\s*\|\|\s*disabled\}/);
});
