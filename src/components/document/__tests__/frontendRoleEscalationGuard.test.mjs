/**
 * Source-contract test for the frontend role-escalation guard.
 *
 * <p>Validates that the secure preview components and the wrapper used
 * by the public detail page never derive {@code FULL / LIMITED / LOCKED}
 * from a locally cached role. The mode is exclusively the value the
 * backend response carries.</p>
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

function readSource(relPath) {
  // Tests live in src/<area>/__tests__/. We need to climb two levels to
  // reach src/, then descend along the relative project path. This
  // keeps the helper portable if we add more tests in nested folders.
  return readFileSync(join(here, "..", "..", "..", relPath), "utf8");
}

const secureSource = readSource(
  "components/document/SecureDocumentPreview.jsx"
);
const wrapperSource = readSource(
  "components/document/DocumentPreview.jsx"
);
const detailSource = readSource("pages/document/DocumentDetail.jsx");

test("SecureDocumentPreview never inspects useAuth / roles to set mode", () => {
  assert.doesNotMatch(
    secureSource,
    /useAuth|from\s+["']\.\.\/\.\.\/context\/AuthContext/,
    "SecureDocumentPreview must not consume auth context to elevate access"
  );
  assert.doesNotMatch(secureSource, /\.roles\b/);
  assert.doesNotMatch(secureSource, /isAuthenticated\(\)/);
  assert.doesNotMatch(secureSource, /hasAuthority|hasRole/);
});

function extractBlock(source, startIdx) {
  let depth = 0;
  let i = startIdx;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(startIdx, i + 1);
    }
    i += 1;
  }
  return null;
}

function extractBalancedParens(source, openIdx) {
  let depth = 0;
  let i = openIdx;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return source.slice(openIdx, i + 1);
    }
    i += 1;
  }
  return null;
}

test("SecureDocumentPreview only sets state.mode from getDocumentPreview result", () => {
  // Phase O4B: SecureDocumentPreview delegates presentation to the
  // getSecurePreviewPresentation helper. No direct mode assignment from result.
  // The helper derives mode from preview.mode.
  assert.match(secureSource, /getSecurePreviewPresentation/);
  // Both FULL and LIMITED PDF use presentation.showViewer + viewerMode.
  assert.match(secureSource, /presentation\.showViewer/);
  assert.match(secureSource, /presentation\.viewerMode/);

  // ── Read the four approved production files (local reads only). ─────────
  const hookSource = readSource("hooks/useSecureDocumentPreview.js");
  const helpersSource = readSource("hooks/securePreviewHelpers.js");
  const componentSource = secureSource;
  const viewerSourceLocal = readSource("components/document/StudyItPdfViewer.jsx");

  // ──────────────────────────────────────────────────────────────────────────
  // A. Hook normalization connection
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Bounded triggerFetch region containing both required anchors.
    const triggerIdx = hookSource.indexOf("const triggerFetch = useCallback(async () => {");
    assert.ok(triggerIdx >= 0, "triggerFetch callback must exist on disk");
    const tryIdx = hookSource.indexOf("try {", triggerIdx);
    assert.ok(tryIdx >= 0, "triggerFetch must contain a try block");
    const rawIdx = hookSource.indexOf("const rawResult =", tryIdx);
    assert.ok(rawIdx >= 0, "rawResult must be assigned from getDocumentPreview");
    const callIdx = hookSource.indexOf("documentService.getDocumentPreview(", rawIdx);
    assert.ok(callIdx >= 0, "rawResult must come from documentService.getDocumentPreview");
    const fetchBlock = extractBlock(hookSource, tryIdx);
    assert.ok(fetchBlock, "triggerFetch try block must be balanced");

    // The rawResult identifier must be passed unchanged to the normalizer.
    const rawAssignMatch = hookSource
      .slice(rawIdx, rawIdx + 400)
      .match(/const\s+rawResult\s*=\s*await\s+documentService\.getDocumentPreview\s*\(/);
    assert.ok(rawAssignMatch, "rawResult must be assigned from awaited getDocumentPreview");
    const normalizerCallIdx = hookSource.indexOf(
      "await normalizeSecurePreviewResult(rawResult)",
      rawIdx
    );
    assert.ok(normalizerCallIdx >= 0, "rawResult must be passed unchanged into the awaited normalizer");
    // The exact identifier `rawResult` must reach the normalizer.
    const normalizerSlice = hookSource.slice(normalizerCallIdx, normalizerCallIdx + 200);
    assert.match(normalizerSlice, /normalizeSecurePreviewResult\(rawResult\)/);

    // setPreview(finalResult) must follow the active/abort re-check.
    const abortCheckIdx = hookSource.indexOf(
      "if (!isActive() || controller.signal.aborted) return;",
      normalizerCallIdx
    );
    assert.ok(abortCheckIdx >= 0, "active/abort re-check must follow the normalizer");
    const setPreviewIdx = hookSource.indexOf("setPreview(finalResult);", abortCheckIdx);
    assert.ok(setPreviewIdx >= 0, "setPreview(finalResult) must occur after the active/abort re-check");
    assert.ok(
      setPreviewIdx > abortCheckIdx,
      "setPreview(finalResult) must come after the active/abort re-check"
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // B. PDF normalizer — balanced `case "pdf": { ... }` block
  // ──────────────────────────────────────────────────────────────────────────
  {
    const caseIdx = helpersSource.indexOf('case "pdf": {');
    assert.ok(caseIdx >= 0, 'case "pdf": block must exist on disk');
    const braceIdx = helpersSource.indexOf("{", caseIdx);
    assert.ok(braceIdx >= 0, "case pdf opening brace must exist");
    const pdfBlock = extractBlock(helpersSource, braceIdx);
    assert.ok(pdfBlock, "case pdf block must be balanced");

    // FULL and LIMITED are accepted.
    assert.match(pdfBlock, /mode\s*!==\s*["']FULL["']\s*&&\s*mode\s*!==\s*["']LIMITED["']/);
    // Every other mode returns terminal error.
    assert.match(
      pdfBlock,
      /kind:\s*["']error["'],\s*mode:\s*null,\s*previewState:\s*null,\s*pdfBuffer:\s*null/
    );
    // rawResult.blob must be a Blob.
    assert.match(pdfBlock, /rawResult\.blob\s+instanceof\s+Blob/);
    // blob.arrayBuffer must be callable.
    assert.match(pdfBlock, /typeof\s+rawResult\.blob\.arrayBuffer\s*!==\s*["']function["']/);
    // rawResult.blob.arrayBuffer() is awaited.
    assert.match(pdfBlock, /decoded\s*=\s*await\s+rawResult\.blob\.arrayBuffer\(\)/);
    // arrayBuffer rejection returns kind "error".
    assert.match(pdfBlock, /try\s*\{[\s\S]*?decoded\s*=\s*await[\s\S]*?\}\s*catch/);
    // decoded non-ArrayBuffer returns kind "error".
    assert.match(pdfBlock, /decoded\s+instanceof\s+ArrayBuffer/);
    // The valid PDF return has kind "pdf".
    assert.match(pdfBlock, /kind:\s*["']pdf["']/);
    // pdfBuffer is decoded.
    assert.match(pdfBlock, /pdfBuffer:\s*decoded/);
    // mode is copied unchanged.
    assert.match(pdfBlock, /kind:\s*["']pdf["'],\s*mode,/);
    // No FULL fallback (no `mode || "FULL"` style default).
    assert.doesNotMatch(pdfBlock, /\|\|\s*["']FULL["']/);
    // No Blob is assigned to final pdfBuffer.
    assert.doesNotMatch(pdfBlock, /pdfBuffer:\s*rawResult\.blob\b/);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // C. Presentation PDF branch — balanced `if (kind === "pdf") { ... }`
  // ──────────────────────────────────────────────────────────────────────────
  {
    const kindIdx = helpersSource.indexOf('if (kind === "pdf") {');
    assert.ok(kindIdx >= 0, 'pdf presentation branch must exist');
    const braceIdx = helpersSource.indexOf("{", kindIdx);
    assert.ok(braceIdx >= 0, "pdf presentation opening brace must exist");
    const presBlock = extractBlock(helpersSource, braceIdx);
    assert.ok(presBlock, "pdf presentation block must be balanced");

    // validPdf requires ArrayBuffer.
    assert.match(presBlock, /preview\.pdfBuffer\s+instanceof\s+ArrayBuffer/);
    // validPdf requires explicit FULL or LIMITED.
    assert.match(presBlock, /preview\.mode\s*===\s*["']FULL["']\s*\|\|\s*preview\.mode\s*===\s*["']LIMITED["']/);
    // Only the valid return sets showViewer: true.
    assert.match(presBlock, /showViewer:\s*true/);
    // viewerMode is preview.mode.
    assert.match(presBlock, /viewerMode:\s*preview\.mode/);
    // pdfBuffer is preview.pdfBuffer.
    assert.match(presBlock, /pdfBuffer:\s*preview\.pdfBuffer/);
    // Invalid PDF returns kind "error".
    assert.match(presBlock, /kind:\s*["']error["']/);
    // Invalid PDF has showViewer: false.
    assert.match(presBlock, /showViewer:\s*false/);
    // Invalid PDF has viewerMode: null.
    assert.match(presBlock, /viewerMode:\s*null/);
    // Invalid PDF has pdfBuffer: null.
    assert.match(presBlock, /pdfBuffer:\s*null/);
    // Unknown mode does not default to FULL.
    assert.doesNotMatch(presBlock, /\|\|\s*["']FULL["']/);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // D. Complete component adapter call (including closing paren and ;)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const bodyIdx = componentSource.indexOf("let body;");
    assert.ok(bodyIdx >= 0, "let body; must exist");
    const returnIdx = componentSource.indexOf("return (", bodyIdx);
    assert.ok(returnIdx >= 0, "component JSX return must exist after let body;");
    assert.ok(returnIdx > bodyIdx, "return must come after let body;");

    // Locate the complete renderStudyItPdf call.
    const callIdx = componentSource.indexOf("renderStudyItPdf(", bodyIdx);
    assert.ok(callIdx >= 0 && callIdx < returnIdx, "renderStudyItPdf call must exist within the body orchestration region");
    const callText = extractBalancedParens(componentSource, callIdx);
    assert.ok(callText, "renderStudyItPdf call must have balanced parentheses");
    assert.match(callText, /renderStudyItPdf\(\s*presentation\.pdfBuffer\s*,\s*presentation\.viewerMode\s*\)/);
    // The closing semicolon must follow.
    const afterCallIdx = callIdx + callText.length;
    const tail = componentSource.slice(afterCallIdx, afterCallIdx + 5);
    assert.match(tail, /^\s*;/, "renderStudyItPdf call must be terminated by a semicolon");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // E. Viewer prop mapping — bounded renderStudyItPdf declaration
  // ──────────────────────────────────────────────────────────────────────────
  {
    const adapterIdx = componentSource.indexOf("const renderStudyItPdf = (buffer, viewerMode) =>");
    assert.ok(adapterIdx >= 0, "renderStudyItPdf declaration must exist");
    // The next component-level renderer is renderWaiting.
    const nextRendererIdx = componentSource.indexOf("const renderWaiting = ", adapterIdx);
    assert.ok(nextRendererIdx >= 0, "next renderer declaration must exist after renderStudyItPdf");
    assert.ok(nextRendererIdx > adapterIdx, "next renderer must start after renderStudyItPdf");
    const adapterBlock = componentSource.slice(adapterIdx, nextRendererIdx);

    // StudyItPdfViewer is mounted.
    assert.match(adapterBlock, /StudyItPdfViewer/);
    // arrayBuffer receives buffer.
    assert.match(adapterBlock, /arrayBuffer=\{buffer\}/);
    // mode receives viewerMode.
    assert.match(adapterBlock, /mode=\{viewerMode\}/);
    // No `mode || "FULL"` fallback.
    assert.doesNotMatch(adapterBlock, /mode\s*\|\|\s*["']FULL["']/);
    // No hardcoded FULL fallback.
    assert.doesNotMatch(adapterBlock, /mode:\s*["']FULL["']/);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // F. No frontend role elevation — bounded mode/request/presentation regions
  // ──────────────────────────────────────────────────────────────────────────
  {
    // Build the bounded hook region: from the hook function header to its closing brace.
    const hookHeaderIdx = hookSource.indexOf("export function useSecureDocumentPreview(");
    assert.ok(hookHeaderIdx >= 0, "hook header must exist");
    const hookBlock = extractBlock(hookSource, hookSource.indexOf("{", hookHeaderIdx));
    assert.ok(hookBlock, "hook body must be balanced");

    // Build the bounded component region: from the component function header to its closing brace.
    const compHeaderIdx = componentSource.indexOf(
      "export default function SecureDocumentPreview("
    );
    assert.ok(compHeaderIdx >= 0, "component header must exist");
    const compBlock = extractBlock(
      componentSource,
      componentSource.indexOf("{", compHeaderIdx)
    );
    assert.ok(compBlock, "component body must be balanced");

    const regions = [hookBlock, compBlock];
    const roleWords = [
      "role",
      "roles",
      "permission",
      "permissions",
      "admin",
      "moderator",
      "isAdmin",
      "isModerator",
      "hasRole",
    ];

    for (const region of regions) {
      for (const word of roleWords) {
        // The word may appear in comments or strings; assert that NO
        // statement assigns FULL, viewerMode, showViewer, or remaps
        // LIMITED→FULL based on the role-derived identifier.
        const assignFullRe = new RegExp(
          `${word}[\\s\\S]{0,80}?=\\s*["']FULL["']`
        );
        assert.doesNotMatch(
          region,
          assignFullRe,
          `role identifier "${word}" must not assign FULL`
        );
        const ternaryFullRe = new RegExp(
          `${word}[\\s\\S]{0,80}?\\?\\s*["']FULL["']`
        );
        assert.doesNotMatch(
          region,
          ternaryFullRe,
          `role identifier "${word}" must not select FULL via ternary`
        );
        const assignViewerRe = new RegExp(
          `${word}[\\s\\S]{0,80}?=\\s*viewerMode`
        );
        assert.doesNotMatch(
          region,
          assignViewerRe,
          `role identifier "${word}" must not assign viewerMode`
        );
        const showViewerRe = new RegExp(
          `${word}[\\s\\S]{0,80}?=\\s*showViewer`
        );
        assert.doesNotMatch(
          region,
          showViewerRe,
          `role identifier "${word}" must not set showViewer`
        );
        const limitedRemapRe = new RegExp(
          `${word}[\\s\\S]{0,80}?LIMITED[\\s\\S]{0,40}?FULL`
        );
        assert.doesNotMatch(
          region,
          limitedRemapRe,
          `role identifier "${word}" must not remap LIMITED to FULL`
        );
        const defaultFullRe = new RegExp(
          `mode\\s*\\|\\|\\s*["']FULL["']`
        );
        assert.doesNotMatch(
          region,
          defaultFullRe,
          "missing mode must not default to FULL"
        );
      }
    }
  }
});

test("DocumentPreview wrapper delegates paid preview to SecureDocumentPreview", () => {
  assert.match(wrapperSource, /SecureDocumentPreview/);
  // No role-based branching that would override the backend mode.
  assert.doesNotMatch(wrapperSource, /USER_MODERATOR/);
  assert.doesNotMatch(wrapperSource, /CONTENT_MODERATOR\s*\?/);
  assert.doesNotMatch(wrapperSource, /isAdmin/);
});

test("DocumentDetail page does not override backend preview mode", () => {
  // The page must NEVER set isFullPreview / isLimitedPreview from a
  // local role; the wrapped SecureDocumentPreview drives its own
  // rendering from the backend result.
  assert.doesNotMatch(detailSource, /isFullPreview\s*=/);
  assert.doesNotMatch(detailSource, /isLimitedPreview\s*=/);
});

test("Locked JSON for paid unpaid contains the buy-now CTA placeholder", () => {
  // The preview path for paid unlocked users MUST surface the buy-now
  // CTA. The frontend must NEVER auto-elevate from LIMITED to FULL
  // based on a locally stored role.
  //
  // This declaration relies ONLY on the bounded region beginning at:
  //   const renderLocked = () => {
  // and ending at the verified next component-level renderer declaration.
  // No stale `lockedMessage` regex is used; `lockedMessage` does not
  // exist in current production source.

  // ── Bounded renderLocked renderer body ───────────────────────────────────
  const renderLockedIdx = secureSource.indexOf("const renderLocked = () => {");
  assert.ok(renderLockedIdx >= 0, "renderLocked declaration must exist on disk");
  const renderLockedBraceIdx = secureSource.indexOf("{", renderLockedIdx);
  assert.ok(renderLockedBraceIdx >= 0, "renderLocked opening brace must exist");
  // Determine the nearest following component-level renderer declaration.
  const nextRendererMatch = secureSource
    .slice(renderLockedBraceIdx + 1)
    .match(/const\s+(render\w+)\s*=\s*\(/);
  assert.ok(nextRendererMatch, "next component-level renderer declaration must exist");
  const nextRendererIdx =
    renderLockedBraceIdx + 1 + secureSource.slice(renderLockedBraceIdx + 1).indexOf(nextRendererMatch[0]);
  assert.ok(nextRendererIdx > renderLockedIdx, "next renderer must start after renderLocked");
  // Balanced-brace extraction: walk braces from the renderLocked opening brace.
  let depth = 0;
  let endIdx = -1;
  for (let i = renderLockedBraceIdx; i < secureSource.length; i += 1) {
    const ch = secureSource[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }
  assert.ok(endIdx >= 0, "renderLocked body must be balanced");
  const renderLockedBalanced = secureSource.slice(renderLockedIdx, endIdx + 1);
  assert.ok(renderLockedBalanced.length > 0, "renderLocked bounded slice must be non-empty");

  // presentation.message is used.
  assert.match(renderLockedBalanced, /presentation\.message/);
  // The safe Vietnamese purchase fallback is present.
  assert.match(renderLockedBalanced, /Vui lòng mua tài liệu để có thể xem bản full/);
  // presentation.allowBuyCta gates the CTA.
  assert.match(renderLockedBalanced, /presentation\.allowBuyCta/);
  // Raw error messages and stacks are absent.
  assert.doesNotMatch(renderLockedBalanced, /err\.message/);
  assert.doesNotMatch(renderLockedBalanced, /error\.stack/);
  assert.doesNotMatch(renderLockedBalanced, /\.stack\b/);
  // renderStudyItPdf is absent.
  assert.doesNotMatch(renderLockedBalanced, /renderStudyItPdf/);
  // StudyItPdfViewer is absent.
  assert.doesNotMatch(renderLockedBalanced, /StudyItPdfViewer/);
  // No role condition selects FULL.
  assert.doesNotMatch(renderLockedBalanced, /=\s*["']FULL["']/);
  assert.doesNotMatch(renderLockedBalanced, /\|\|\s*["']FULL["']/);
  // No mode condition unlocks the PDF viewer.
  assert.doesNotMatch(renderLockedBalanced, /showViewer:\s*true/);
});

test("Sidebar empty-group correction remains in place (regression guard)", () => {
  // The previous task's sidebar fix must not be reverted by this
  // correction. Re-check the pruneEmptyMenuGroups wiring — it now
  // lives in menuTree.js and AdminLayout.jsx imports it from there.
  const layoutSource = readSource("layouts/admin/AdminLayout.jsx");
  const menuTreeSource = readSource("layouts/admin/menuTree.js");
  assert.match(layoutSource, /from\s+["']\.\/menuTree["']/);
  assert.match(
    menuTreeSource,
    /export\s+function\s+pruneEmptyMenuGroups\s*\(/
  );
  assert.match(
    menuTreeSource,
    /export\s+function\s+filterAdminSidebarForModerator\s*\(/
  );
  // AdminLayout runs the moderator filter OR the prune-empty-group
  // helper depending on the user role. Both branches must call
  // normalizeMenuTree first.
  assert.match(layoutSource, /isModeratorRole/);
  assert.match(layoutSource, /filterAdminSidebarForModerator/);
  assert.match(layoutSource, /pruneEmptyMenuGroups/);
});

test("AdminDocumentDetailPage no longer reads detail.fileUrl for preview", () => {
  const adminSource = readSource("pages/admin/AdminDocumentDetailPage.jsx");
  assert.doesNotMatch(adminSource, /detail\.fileUrl/);
  assert.match(adminSource, /SecureDocumentPreview/);
});