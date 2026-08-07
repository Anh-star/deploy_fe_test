/**
 * Phase O4B final: behavioral tests for SecureDocumentPreview.
 *
 * <p>Tests rely on source-level inspection of SecureDocumentPreview.jsx
 * because the JSX module requires a browser environment to render.
 * This is consistent with the existing frontend test conventions in
 * this repository (Node's built-in test runner with `assert`).</p>
 *
 * <p>Behavioral assertions about the production presentation helper
 * {@link ../../hooks/securePreviewHelpers.getSecurePreviewPresentation}
 * live in
 * {@link ../../hooks/__tests__/secureResponseContract.test.mjs}.</p>
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SECURE_PREVIEW_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "../SecureDocumentPreview.jsx"),
  "utf8"
);

// ─────────────────────────────────────────────────────────────────
// Renderer branch removal
// ─────────────────────────────────────────────────────────────────

test("DOCX renderer branch is removed from SecureDocumentPreview", () => {
  assert.ok(
    !/import\s*\(\s*["']docx-preview["']\s*\)/.test(SECURE_PREVIEW_SOURCE),
    "docx-preview import must be removed"
  );
  assert.ok(
    !/kind\s*===\s*["']docx["']/.test(SECURE_PREVIEW_SOURCE),
    "docx result kind branch must be removed"
  );
});

test("DOC HTML renderer branch is removed from SecureDocumentPreview", () => {
  assert.ok(
    !/kind\s*===\s*["']docHtml["']/.test(SECURE_PREVIEW_SOURCE),
    "docHtml result kind branch must be removed"
  );
});

// ─────────────────────────────────────────────────────────────────
// PDF rendering — unified branch
// ─────────────────────────────────────────────────────────────────

test("FULL and LIMITED PDF both use one pdf presentation branch; showViewer controls it, viewerMode distinguishes modes, pdf-full/pdf-limited absent", () => {
  // The component must call getSecurePreviewPresentation.
  assert.match(
    SECURE_PREVIEW_SOURCE,
    /getSecurePreviewPresentation\s*\(\s*preview\s*,\s*loading\s*\)/
  );
  // showViewer must be used to control the viewer path.
  assert.ok(
    /presentation\.showViewer/.test(SECURE_PREVIEW_SOURCE),
    "component must use presentation.showViewer to gate the viewer path"
  );
  // viewerMode must be passed through.
  assert.ok(
    /presentation\.viewerMode/.test(SECURE_PREVIEW_SOURCE),
    "component must use presentation.viewerMode"
  );
  // pdf-full and pdf-limited must not exist.
  assert.ok(
    !/pdf-full/.test(SECURE_PREVIEW_SOURCE),
    "pdf-full must not exist in the component"
  );
  assert.ok(
    !/pdf-limited/.test(SECURE_PREVIEW_SOURCE),
    "pdf-limited must not exist in the component"
  );
});

// ─────────────────────────────────────────────────────────────────
// StudyItPdfViewer mounting
// ─────────────────────────────────────────────────────────────────

test("StudyItPdfViewer mounts through presentation.showViewer; pdfBuffer through arrayBuffer; viewerMode through mode; malformed presentation does not mount", () => {
  // presentation.showViewer must gate the mount.
  assert.ok(
    /presentation\.showViewer/.test(SECURE_PREVIEW_SOURCE),
    "presentation.showViewer must gate the viewer mount"
  );
  // presentation.pdfBuffer is the first argument to renderStudyItPdf.
  assert.ok(
    /renderStudyItPdf\s*\(\s*presentation\.pdfBuffer/.test(SECURE_PREVIEW_SOURCE),
    "pdfBuffer must be passed as the first argument to renderStudyItPdf"
  );
  // presentation.viewerMode is the second argument to renderStudyItPdf.
  assert.ok(
    /renderStudyItPdf\s*\([^)]*,\s*presentation\.viewerMode/.test(SECURE_PREVIEW_SOURCE),
    "viewerMode must be passed as the second argument to renderStudyItPdf"
  );
  // The adapter passes buffer to arrayBuffer and viewerMode to mode.
  assert.ok(
    /arrayBuffer\s*=\s*\{buffer\}/.test(SECURE_PREVIEW_SOURCE),
    "renderStudyItPdf must pass buffer to arrayBuffer"
  );
  assert.ok(
    /mode\s*=\s*\{viewerMode\}/.test(SECURE_PREVIEW_SOURCE),
    "renderStudyItPdf must pass viewerMode to mode"
  );
  // The component must not supply a fallback mode="FULL".
  assert.ok(
    !/mode\s*=\s*"FULL"/.test(SECURE_PREVIEW_SOURCE),
    "SecureDocumentPreview must not default mode to FULL — viewerMode comes from presentation"
  );
  // pdf-full and pdf-limited patterns must not gate the viewer.
  assert.ok(
    !/case\s*["']pdf-full["']/.test(SECURE_PREVIEW_SOURCE),
    "pdf-full must not gate the viewer"
  );
  assert.ok(
    !/case\s*["']pdf-limited["']/.test(SECURE_PREVIEW_SOURCE),
    "pdf-limited must not gate the viewer"
  );
});

// ─────────────────────────────────────────────────────────────────
// Presentation helper usage
// ─────────────────────────────────────────────────────────────────

test("component uses getSecurePreviewPresentation, not securePreviewViewModel; vm.state and derived enums absent", () => {
  assert.match(
    SECURE_PREVIEW_SOURCE,
    /getSecurePreviewPresentation\s*\(\s*preview\s*,\s*loading\s*\)/
  );
  assert.ok(
    !/securePreviewViewModel/.test(SECURE_PREVIEW_SOURCE),
    "securePreviewViewModel must not be called"
  );
  assert.ok(
    !/vm\.state/.test(SECURE_PREVIEW_SOURCE),
    "vm.state must not exist"
  );
  assert.ok(
    !/derived\.status/.test(SECURE_PREVIEW_SOURCE),
    "no second derived status enum must be introduced"
  );
  assert.ok(
    !/idle/.test(SECURE_PREVIEW_SOURCE),
    "idle must not exist"
  );
});

// ─────────────────────────────────────────────────────────────────
// State renderers
// ─────────────────────────────────────────────────────────────────

test("waiting state renders with one canonical centred message; clock-icon block removed; no per-state label; no viewer, no purchase CTA", () => {
  const waitingMatch = SECURE_PREVIEW_SOURCE.match(
    /(?:const|let)\s+renderWaiting\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\n\s*\};/
  );
  assert.ok(waitingMatch, "expected renderWaiting");
  // Strip ALL comment forms before asserting so the test does
  // not false-fail on the doc comments that describe the legacy
  // behaviour (they contain the same legacy strings).
  const body = waitingMatch[0]
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.ok(
    !/StudyItPdfViewer/.test(body),
    "renderWaiting must NOT mount StudyItPdfViewer"
  );
  assert.ok(
    !/renderBuyCta/.test(body),
    "renderWaiting must NOT show the purchase CTA"
  );
  assert.match(body, /Đang tải bản xem trước…/, "renderWaiting must use the single canonical text");
  assert.doesNotMatch(body, /Đang chuyển đổi DOC\/DOCX sang PDF/, "renderWaiting must NOT carry the PROCESSING DOCX label");
  assert.doesNotMatch(body, /Hệ thống đang thử xử lý lại/, "renderWaiting must NOT carry the RETRY-specific label");
  assert.doesNotMatch(body, /Đang chờ tạo bản xem trước/, "renderWaiting must NOT carry the PENDING-specific label");
  assert.doesNotMatch(body, /secure-document-preview-waiting-icon/, "renderWaiting must NOT use the legacy clock-icon class");
  // presentation.showWaiting must gate the branch.
  assert.ok(
    /presentation\.showWaiting/.test(SECURE_PREVIEW_SOURCE),
    "presentation.showWaiting must gate the waiting branch"
  );
});

test("DEAD state displays failure UI; no viewer, no purchase CTA", () => {
  // renderDead uses concise arrow: const renderDead = () => ( ... );
  const deadMatch = SECURE_PREVIEW_SOURCE.match(
    /(?:const|let)\s+renderDead\s*=\s*\(\)\s*=>\s*\([\s\S]*?\)\s*;/
  );
  assert.ok(deadMatch, "expected renderDead");
  assert.ok(
    !/StudyItPdfViewer/.test(deadMatch[0]),
    "renderDead must NOT mount StudyItPdfViewer"
  );
  assert.ok(
    !/renderBuyCta/.test(deadMatch[0]),
    "renderDead must NOT display the purchase CTA"
  );
  assert.match(deadMatch[0], /Không thể tạo bản xem trước/);
  assert.match(deadMatch[0], /Thử lại/);
});

test("error state does NOT display buy CTA or StudyItPdfViewer", () => {
  // renderError uses concise arrow: const renderError = () => ( ... );
  const errorMatch = SECURE_PREVIEW_SOURCE.match(
    /(?:const|let)\s+renderError\s*=\s*\(\)\s*=>\s*\([\s\S]*?\)\s*;/
  );
  assert.ok(errorMatch, "expected renderError");
  assert.ok(
    !/StudyItPdfViewer/.test(errorMatch[0]),
    "renderError must NOT mount StudyItPdfViewer"
  );
  assert.ok(
    !/renderBuyCta/.test(errorMatch[0]),
    "renderError must NOT display the buy CTA"
  );
});

test("locked state renders with showLocked and allowBuyCta; no viewer, locked text uses presentation.message", () => {
  const lockedMatch = SECURE_PREVIEW_SOURCE.match(
    /(?:const|let)\s+renderLocked\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*\};/
  );
  assert.ok(lockedMatch, "expected renderLocked");
  assert.ok(
    !/StudyItPdfViewer/.test(lockedMatch[0]),
    "renderLocked must NOT mount StudyItPdfViewer"
  );
  // allowBuyCta controls the CTA display.
  assert.ok(
    /presentation\.allowBuyCta/.test(SECURE_PREVIEW_SOURCE),
    "presentation.allowBuyCta must gate the purchase CTA"
  );
  // Locked text must use presentation.message, never presentation.viewerMode.
  assert.ok(
    !/presentation\.viewerMode/.test(lockedMatch[0]),
    "renderLocked must not use presentation.viewerMode for the locked reason"
  );
  // Locked message must use presentation.message.
  assert.ok(
    /presentation\.message/.test(lockedMatch[0]),
    "renderLocked must use presentation.message for the locked text"
  );
});

// ─────────────────────────────────────────────────────────────────
// Polling and refresh
// ─────────────────────────────────────────────────────────────────

test("polling ownership lives in useSecureDocumentPreview, not the component", () => {
  assert.ok(
    !/setTimeout\s*\(/.test(SECURE_PREVIEW_SOURCE),
    "component must NOT use setTimeout (polling lives in the hook)"
  );
  assert.ok(
    !/setInterval\s*\(/.test(SECURE_PREVIEW_SOURCE),
    "component must NOT use setInterval"
  );
  assert.ok(
    !/AbortController\s*\(\s*\)/.test(SECURE_PREVIEW_SOURCE),
    "component must NOT own an AbortController"
  );
  assert.match(
    SECURE_PREVIEW_SOURCE,
    /useSecureDocumentPreview\s*\(\s*documentId\s*\)/,
    "component must invoke useSecureDocumentPreview(documentId)"
  );
});

test("component must not import useDocumentPreviewStatus (admin hook is exclusive)", () => {
  assert.ok(
    !/useDocumentPreviewStatus/.test(SECURE_PREVIEW_SOURCE),
    "component must NOT use the admin preview-status hook"
  );
  assert.ok(
    !/adminDocumentApi/.test(SECURE_PREVIEW_SOURCE),
    "component must NOT import adminDocumentApi"
  );
  assert.ok(
    !/getDocumentPreviewStatus/.test(SECURE_PREVIEW_SOURCE),
    "component must NOT call getDocumentPreviewStatus"
  );
  assert.ok(
    !/\/admin\/documents\//.test(SECURE_PREVIEW_SOURCE),
    "component must NOT hit any /admin/documents/ path"
  );
});

test("manual refresh wires through the hook's refresh callback", () => {
  assert.match(SECURE_PREVIEW_SOURCE, /useSecureDocumentPreview\s*\(/);
  assert.match(SECURE_PREVIEW_SOURCE, /refresh/);
});

// ─────────────────────────────────────────────────────────────────
// iframe exclusion
// ─────────────────────────────────────────────────────────────────

test("component does not fall back to legacy free-doc fallback for paid docs", () => {
  assert.ok(
    !/iframe[\s\S]{0,200}?publicFileUrl/.test(SECURE_PREVIEW_SOURCE),
    "SecureDocumentPreview must NOT mount an iframe from publicFileUrl"
  );
});
