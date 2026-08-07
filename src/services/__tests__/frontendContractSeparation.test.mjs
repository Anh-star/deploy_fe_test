/**
 * Phase O4B final: contract separation tests.
 *
 * Proves the two frontend endpoints are completely isolated:
 *
 *   A. Admin status endpoint — GET /api/admin/documents/{id}/preview-status
 *      - Called only by useDocumentPreviewStatus.
 *      - Axios default rejection behavior (no validateStatus whitelist).
 *      - 401 / 403 / 500 propagate as real errors.
 *      - Never processes PDF bytes.
 *
 *   B. Secure preview endpoint — GET /api/documents/{id}/preview
 *      - Called only by useSecureDocumentPreview.
 *      - Narrow validateStatus whitelist: 2xx + 409 only.
 *      - 401 / 403 / 500 remain real errors.
 *      - Mounts StudyItPdfViewer only for kind === 'pdf' + pdfBuffer.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../../..");

const HOOK_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "../../hooks/useDocumentPreviewStatus.js"),
  "utf8"
);
const SECURE_HOOK_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "../../hooks/useSecureDocumentPreview.js"),
  "utf8"
);
const SECURE_HELPERS_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "../../hooks/securePreviewHelpers.js"),
  "utf8"
);
const COMPONENT_SOURCE = fs.readFileSync(
  path.resolve(__dirname,
    "../../components/document/SecureDocumentPreview.jsx"),
  "utf8"
);
const ADMIN_API_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "../../api/adminDocumentApi.js"),
  "utf8"
);
const SERVICE_API_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "../../services/api.js"),
  "utf8"
);

/**
 * Extracts a balanced-brace block starting at `bracePos` (opening brace).
 */
function extractBlock(source, bracePos) {
  if (source[bracePos] !== "{") return null;
  let depth = 0;
  let i = bracePos;
  while (i < source.length) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(bracePos, i + 1);
    }
    i++;
  }
  return null;
}

/**
 * Extracts the complete catch(err) { ... } block from the secure hook source
 * using balanced-brace extraction (replaces the non-greedy regex).
 */
function extractSecureHookCatch() {
  const catchIdx = SECURE_HOOK_SOURCE.indexOf("} catch (err) {");
  if (catchIdx < 0) return null;
  const brace = SECURE_HOOK_SOURCE.indexOf("{", catchIdx);
  return extractBlock(SECURE_HOOK_SOURCE, brace);
}

// ─────────────────────────────────────────────────────────────────
// A. Admin status endpoint contract
// ─────────────────────────────────────────────────────────────────

test("admin status hook calls only /admin/documents/{id}/preview-status", () => {
  assert.match(
    ADMIN_API_SOURCE,
    /\/admin\/documents\/\$\{documentId\}\/preview-status/,
    "adminDocumentApi must expose /admin/documents/{id}/preview-status"
  );
  assert.match(
    HOOK_SOURCE,
    /getDocumentPreviewStatus\s*\(/,
    "hook must call getDocumentPreviewStatus"
  );
  assert.ok(
    !/\/documents\/\$\{documentId\}\/preview/.test(HOOK_SOURCE),
    "admin hook MUST NOT call the secure binary endpoint"
  );
  assert.ok(
    !/getDocumentPreview\s*\(/.test(HOOK_SOURCE),
    "admin hook MUST NOT call getDocumentPreview"
  );
});

test("admin status hook uses default axios rejection (no whitelist)", () => {
  const hookCallsAdmin = (() => {
    const start = HOOK_SOURCE.indexOf("getDocumentPreviewStatus(");
    if (start < 0) return "";
    return HOOK_SOURCE.slice(start, start + 1000);
  })();
  assert.ok(hookCallsAdmin.length > 0);
  assert.ok(
    !/validateStatus\s*:/.test(hookCallsAdmin),
    "admin hook MUST NOT override validateStatus"
  );
  assert.ok(
    !/responseType\s*:\s*["']arraybuffer["']/.test(HOOK_SOURCE),
    "admin hook MUST NOT request arraybuffer"
  );
  assert.ok(
    !/responseType\s*:\s*["']blob["']/.test(HOOK_SOURCE),
    "admin hook MUST NOT request blob"
  );
});

test("admin status hook treats 401/403 as real errors and stops polling", () => {
  assert.match(
    HOOK_SOURCE,
    /err\?\.response\?\.status\s*===\s*401/,
    "admin hook MUST recognize 401 as auth failure"
  );
  assert.match(
    HOOK_SOURCE,
    /err\?\.response\?\.status\s*===\s*403/,
    "admin hook MUST recognize 403 as auth failure"
  );
  assert.match(
    HOOK_SOURCE,
    /consecutiveErrorsRef\.current\s*=\s*maxRetries\s*\+\s*1/,
    "admin hook MUST bypass retries on 401/403"
  );
});

test("admin status hook never processes PDF bytes", () => {
  assert.ok(
    !/createObjectURL\s*\(/.test(HOOK_SOURCE),
    "admin hook MUST NOT create object URLs from a PDF"
  );
  assert.ok(
    !/%PDF-/.test(HOOK_SOURCE),
    "admin hook MUST NOT inspect PDF magic"
  );
  assert.ok(
    !/StudyItPdfViewer/.test(HOOK_SOURCE),
    "admin hook MUST NOT mount StudyItPdfViewer"
  );
});

// ─────────────────────────────────────────────────────────────────
// B. Secure preview endpoint contract
// ─────────────────────────────────────────────────────────────────

test("secure preview hook calls only documentService.getDocumentPreview", () => {
  assert.match(
    SECURE_HOOK_SOURCE,
    /documentService\.getDocumentPreview\s*\(/,
    "secure hook must call documentService.getDocumentPreview"
  );
  assert.ok(
    !/getDocumentPreviewStatus\s*\(/.test(SECURE_HOOK_SOURCE),
    "secure hook MUST NOT call getDocumentPreviewStatus"
  );
  assert.ok(
    !/\/admin\/documents\//.test(SECURE_HOOK_SOURCE),
    "secure hook MUST NOT hit any /admin/ path"
  );
});

test("secure preview uses narrow validateStatus whitelist (2xx + 409 only)", () => {
  const helperBody = (() => {
    const fnStart = SERVICE_API_SOURCE.indexOf("async getDocumentPreview(documentId");
    if (fnStart < 0) return "";
    // Find ') {' that opens the function body.
    const bodyOpen = SERVICE_API_SOURCE.indexOf(") {", fnStart);
    if (bodyOpen < 0) return "";
    const bracePos = bodyOpen + 1;
    let depth = 0;
    let i = bracePos;
    while (i < SERVICE_API_SOURCE.length) {
      const ch = SERVICE_API_SOURCE[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return SERVICE_API_SOURCE.slice(bracePos + 1, i);
      }
      i++;
    }
    return "";
  })();
  assert.ok(helperBody.length > 0);
  assert.match(helperBody,
    /\([\s\n]*status[\s\n]*>=[\s\n]*200[\s\n]*&&[\s\n]*status[\s\n]*<[\s\n]*300[\s\n]*\)[\s\n]*\|\|[\s\n]*status[\s\n]*===\s*409/);
  assert.ok(!/status\s*===\s*401/.test(helperBody));
  assert.ok(!/status\s*===\s*403/.test(helperBody));
  assert.ok(!/status\s*===\s*500/.test(helperBody));
});

test("secure preview hook narrows validateStatus to 2xx + 409 (includes 202)", () => {
  // The hook MUST pass the production securePreviewValidateStatus
  // helper as the validateStatus argument.
  assert.match(
    SECURE_HOOK_SOURCE,
    /validateStatus:\s*securePreviewValidateStatus/
  );
});

test("secure preview hook imports the production helpers", () => {
  assert.match(
    SECURE_HOOK_SOURCE,
    /from\s+["']\.\/securePreviewHelpers["']/
  );
  assert.match(SECURE_HELPERS_SOURCE, /export\s+function\s+securePreviewValidateStatus/);
});

test("secure preview treats 401/403/500 as real errors and stops polling", () => {
  // The hook delegates error mapping to normalizeSecurePreviewError.
  assert.match(
    SECURE_HOOK_SOURCE,
    /normalizeSecurePreviewError\s*\(/
  );
  // Extract the complete catch(err) { ... } block with balanced braces.
  const catchBlock = extractSecureHookCatch();
  assert.ok(catchBlock, "expected catch block");
  // The catch path must NOT schedule a follow-up timer.
  assert.ok(
    !/timerRef\.current\s*=\s*setTimeout/.test(catchBlock),
    "catch path MUST NOT schedule a follow-up"
  );
  assert.match(catchBlock, /clearTimer\(\)/);
});

test("only PDF response mounts StudyItPdfViewer", () => {
  // presentation.showViewer gates the viewer adapter.
  assert.ok(
    /presentation\.showViewer/.test(COMPONENT_SOURCE),
    "showViewer must gate the viewer"
  );
  // presentation.pdfBuffer is passed as the first argument.
  assert.ok(
    /renderStudyItPdf\s*\(\s*presentation\.pdfBuffer/.test(COMPONENT_SOURCE),
    "pdfBuffer must be passed as the first argument to renderStudyItPdf"
  );
  // presentation.viewerMode is passed as the second argument.
  assert.ok(
    /renderStudyItPdf\s*\([^)]*,\s*presentation\.viewerMode/.test(COMPONENT_SOURCE),
    "viewerMode must be passed as the second argument"
  );
  // The adapter passes buffer to arrayBuffer and viewerMode to mode.
  assert.ok(
    /arrayBuffer\s*=\s*\{buffer\}/.test(COMPONENT_SOURCE),
    "adapter must pass buffer to arrayBuffer"
  );
  assert.ok(
    /mode\s*=\s*\{viewerMode\}/.test(COMPONENT_SOURCE),
    "adapter must pass viewerMode to mode"
  );
  // No fallback mode="FULL" default.
  assert.ok(
    !/mode\s*=\s*"FULL"/.test(COMPONENT_SOURCE),
    "SecureDocumentPreview must not default mode to FULL"
  );
});

test("admin metadata MUST NOT be routed to StudyItPdfViewer", () => {
  assert.ok(
    !/StudyItPdfViewer[\s\S]{0,200}?officeDocument/.test(COMPONENT_SOURCE),
    "StudyItPdfViewer MUST NOT mount from officeDocument admin metadata"
  );
});

test("secure preview endpoint path does not collide with admin endpoint path", () => {
  const adminPath = "/admin/documents/${documentId}/preview-status";
  const securePath = "/documents/${documentId}/preview";
  assert.ok(ADMIN_API_SOURCE.includes(adminPath),
    "admin endpoint path is registered");
  assert.ok(SERVICE_API_SOURCE.includes(securePath),
    "secure endpoint path is registered");
  assert.notEqual(adminPath, securePath);
});

test("useSecureDocumentPreview manages its own timer/abort/ownership", () => {
  assert.match(SECURE_HOOK_SOURCE, /abortRef\.current\s*===\s*controller/);
  assert.match(SECURE_HOOK_SOURCE, /clearTimer/);
  assert.match(SECURE_HOOK_SOURCE, /fetchingRef\.current\s*=\s*false/);
});

test("useDocumentPreviewStatus admin hook owns its timer/abort independently", () => {
  assert.match(HOOK_SOURCE, /abortRef\.current\s*===\s*controller/);
  assert.match(HOOK_SOURCE, /clearTimer/);
  assert.match(HOOK_SOURCE, /abortRef\.current\s*=\s*null/);
});
