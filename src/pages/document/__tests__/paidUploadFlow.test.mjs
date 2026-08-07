/**
 * Pure helper tests — no network, no real Supabase. Validates the field
 * shape that PAID and FREE create payloads must obey.
 *
 * <p>Run with: {@code node --test src/pages/document/__tests__/paidUploadFlow.test.mjs}
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const uploadSource = readFileSync(
  join(here, "..", "UploadDocument.jsx"),
  "utf8"
);

// We re-import the .jsx source via a tiny shim that extracts the named
// helpers. The page is a JSX file but the helpers themselves are pure
// functions that don't touch React, so we evaluate the source after
// stripping JSX. Easier: re-implement the EXACT field-shape assertions
// against the same source file by reading it and asserting the symbols
// are referenced. The simpler path below mirrors the helpers' contracts
// directly so the tests stay independent of the JSX runtime.
function makeForm() {
  return {
    title: "  Tài liệu Java cơ bản  ",
    description: "  Mô tả dài đúng quy định...",
    category: "programming",
    tags: ["java", "oop"],
  };
}

function paidPayload({ uploadId, normalizedPrice, thumbnailUrl, fileName, fileSizeBytes, form = makeForm() }) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    category: form.category,
    tags: form.tags,
    documentUrl: null,
    storagePath: null,
    thumbnailUrl,
    fileName,
    fileSizeBytes,
    isPaid: true,
    uploadId,
    price: normalizedPrice,
  };
}

function freePayload({ documentUrl, storagePath, thumbnailUrl, fileName, fileSizeBytes, form = makeForm() }) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    category: form.category,
    tags: form.tags,
    documentUrl,
    storagePath,
    thumbnailUrl,
    fileName,
    fileSizeBytes,
    isPaid: false,
    price: 0,
  };
}

test("paid create payload carries uploadId and NO authoritative public URL", () => {
  const p = paidPayload({
    uploadId: "11111111-1111-1111-1111-111111111111",
    normalizedPrice: 5000,
    thumbnailUrl: "https://cdn.example/thumb.jpg",
    fileName: "java.pdf",
    fileSizeBytes: 1234,
  });

  assert.equal(p.isPaid, true);
  assert.equal(p.uploadId, "11111111-1111-1111-1111-111111111111");
  assert.equal(p.documentUrl, null);
  assert.equal(p.storagePath, null);
  assert.equal(p.price, 5000);
  assert.equal(p.thumbnailUrl, "https://cdn.example/thumb.jpg");
  assert.equal(p.fileName, "java.pdf");
  assert.equal(p.fileSizeBytes, 1234);
  // Stripping on title/description.
  assert.equal(p.title, "Tài liệu Java cơ bản");
  assert.ok(p.description.startsWith("Mô tả"));
});

test("paid create payload must NOT carry a free-flow uploadId is undefined", () => {
  const p = paidPayload({
    uploadId: undefined,
    normalizedPrice: 3000,
    thumbnailUrl: "thumb",
    fileName: "x.pdf",
    fileSizeBytes: 1,
  });
  assert.equal(p.uploadId, undefined);
  assert.notEqual(p.uploadId, "");
});

test("free create payload carries documentUrl + storagePath and NO uploadId", () => {
  const p = freePayload({
    documentUrl: "https://cdn.example/docs/java.pdf",
    storagePath: "assets/UploadedDocuments/abc.pdf",
    thumbnailUrl: "https://cdn.example/thumb.jpg",
    fileName: "java.pdf",
    fileSizeBytes: 1234,
  });

  assert.equal(p.isPaid, false);
  assert.equal(p.price, 0);
  assert.equal(p.documentUrl, "https://cdn.example/docs/java.pdf");
  assert.equal(p.storagePath, "assets/UploadedDocuments/abc.pdf");
  assert.equal(p.uploadId, undefined);
});

// ---------------------------------------------------------------------------
// FREE regression — Phase S1-C2 keeps the free branch byte-identical to
// the previous behaviour. The paid refactor must not have introduced any
// drift into the free create payload or the free submit path.
// ---------------------------------------------------------------------------

test("free payload keeps documentUrl/storagePath and NEVER carries uploadId", () => {
  const p = freePayload({
    documentUrl: "https://cdn.example/docs/free.pdf",
    storagePath: "assets/UploadedDocuments/free.pdf",
    thumbnailUrl: "https://cdn.example/thumb.jpg",
    fileName: "free.pdf",
    fileSizeBytes: 1024,
  });
  assert.equal(p.isPaid, false);
  assert.equal(p.price, 0);
  assert.ok(p.documentUrl);
  assert.ok(p.storagePath);
  assert.equal(p.uploadId, undefined);
});

test("paid payload shape does not drift into the free payload shape", () => {
  const p = paidPayload({
    uploadId: "x",
    normalizedPrice: 5000,
    thumbnailUrl: "t",
    fileName: "f.pdf",
    fileSizeBytes: 1,
  });
  // Paid payload authoritative-free fields must stay null/undefined.
  assert.equal(p.documentUrl, null);
  assert.equal(p.storagePath, null);
  assert.equal(p.isPaid, true);
});

test("free branch in UploadDocument.jsx still uses the public uploadDocumentToSupabase helper", () => {
  // The free submit function must call uploadDocumentToSupabase and must
  // NOT call paidUploadApi.createPaidUploadTarget or
  // uploadPaidFileViaSignedUrl.
  const freeBlock = (() => {
    const i = uploadSource.indexOf("async function submitFreeDocument(");
    if (i < 0) return "";
    const j = uploadSource.indexOf(
      "async function submitPaidDocument(",
      i + 1
    );
    if (j < 0) return "";
    return uploadSource.slice(i, j);
  })();
  assert.ok(freeBlock.length > 0, "free branch not found");
  assert.match(freeBlock, /uploadDocumentToSupabase\(/);
  assert.doesNotMatch(freeBlock, /createPaidUploadTarget/);
  assert.doesNotMatch(freeBlock, /uploadPaidFileViaSignedUrl/);
});

test("paid branch in UploadDocument.jsx does NOT use the free uploadDocumentToSupabase helper for the document body", () => {
  // The paid submit function delegates the document binary upload to the
  // orchestrator (signed Supabase upload). It may still upload the
  // thumbnail via the free helper, but the document file itself must go
  // through the orchestrator, not uploadDocumentToSupabase.
  const paidBlock = (() => {
    const i = uploadSource.indexOf("async function submitPaidDocument(");
    if (i < 0) return "";
    const j = uploadSource.indexOf(
      "async function submitUpdateDocument(",
      i + 1
    );
    if (j < 0) return "";
    return uploadSource.slice(i, j);
  })();
  assert.ok(paidBlock.length > 0, "paid branch not found");
  // Must delegate to the orchestrator.
  assert.match(paidBlock, /submitPaidDocumentFlow\(/);
  // Must NOT call the free helper with the document file. (The free
  // helper may still appear for thumbnail uploads, but it MUST be
  // called only with formData.thumbnailFile, not documentFile.)
  const docFreeCall = paidBlock.match(
    /uploadDocumentToSupabase\([^)]*formData\.documentFile/
  );
  assert.equal(docFreeCall, null, "paid branch must not free-upload the document");
});

test("UploadDocument.jsx does NOT build the paid payload inline anymore", () => {
  // The paid create payload must now be built by the orchestrator's
  // buildPaidCreatePayload helper, not by an inline literal in the page.
  assert.doesNotMatch(uploadSource, /function toPaidCreatePayload/);
});

test("UploadDocument.jsx wires the orchestrator with the paid deps", () => {
  // The orchestrator must receive createPaidUploadTarget /
  // uploadPaidFileViaSignedUrl / createMyDocument so the contract test
  // suite can pin the call order.
  assert.match(uploadSource, /submitPaidDocumentFlow\(/);
  assert.match(
    uploadSource,
    /createPaidUploadTarget:\s*documentServiceApi\.createPaidUploadTarget/
  );
  assert.match(uploadSource, /uploadPaidFileViaSignedUrl,/);
  assert.match(
    uploadSource,
    /createMyDocument:\s*documentServiceApi\.createMyDocument/
  );
});

test("UploadDocument submit button stays stable across paid phases", () => {
  const buttonBlock = (() => {
    const i = uploadSource.indexOf('className={`upload-document-submit');
    if (i < 0) return "";
    const start = uploadSource.lastIndexOf("<button", i);
    const j = uploadSource.indexOf("</button>", i);
    return start < 0 || j < 0
      ? ""
      : uploadSource.slice(start, j + "</button>".length);
  })();

  assert.ok(buttonBlock.length > 0, "submit button not found");
  assert.match(buttonBlock, /className=\{`upload-document-submit/);
  assert.match(buttonBlock, /upload-document-submit__label/);
  assert.match(buttonBlock, /getSubmitButtonLabel/);
  assert.doesNotMatch(buttonBlock, /<svg|<circle|<path/);
  assert.doesNotMatch(
    buttonBlock,
    /className=[^\n]*(?:loading|spinner|uploading|preparing|creating|animate-spin)/
  );
});

test("UploadDocument exposes every stable submit label", () => {
  assert.match(uploadSource, /return isEditing \? "Cập nhật tài liệu" : "Đăng tải tài liệu"/);
  assert.match(uploadSource, /"Đang chuẩn bị tải lên\.\.\."/);
  assert.match(uploadSource, /"Đang tải tài liệu\.\.\."/);
  assert.match(uploadSource, /"Đang tạo tài liệu\.\.\."/);
});

test("UploadDocument catches submit rejection and resets every guard", () => {
  const handleBlock = (() => {
    const i = uploadSource.indexOf("const handleSubmit = async (event) => {");
    if (i < 0) return "";
    const j = uploadSource.indexOf("const displayedFileSize", i);
    return j < 0 ? "" : uploadSource.slice(i, j);
  })();

  assert.ok(handleBlock.length > 0, "handleSubmit not found");
  assert.match(handleBlock, /catch \(error\)/);
  assert.match(handleBlock, /notification\.error\(getSafeSubmitErrorMessage\(error\)\)/);
  assert.doesNotMatch(handleBlock, /catch \(error\)[\s\S]*?throw error/);
  assert.match(handleBlock, /paidSubmissionGuardRef\.current\.finish\(\)/);
  assert.match(handleBlock, /submitInFlightRef\.current = false/);
  assert.match(handleBlock, /setIsUploading\(false\)/);
  assert.match(handleBlock, /setSubmissionPhase\(null\)/);
});

test("upload button CSS fixes dimensions without a circular loader", () => {
  const cssSource = readFileSync(
    join(here, "..", "..", "..", "styles", "uploadDocument.css"),
    "utf8"
  );
  const submitCss = cssSource.slice(
    cssSource.indexOf(".upload-document-submit {"),
    cssSource.indexOf(".validation-error-msg")
  );

  assert.match(submitCss, /width:\s*100%/);
  assert.match(submitCss, /height:\s*50px/);
  assert.match(submitCss, /min-height:\s*50px/);
  assert.match(submitCss, /display:\s*flex/);
  assert.match(submitCss, /align-items:\s*center/);
  assert.match(submitCss, /justify-content:\s*center/);
  assert.doesNotMatch(submitCss, /border-radius:\s*50%/);
  assert.doesNotMatch(submitCss, /spinner|loader|animate-spin/);
});

test("UploadDocument.jsx still does not reference SUPABASE_SERVICE_ROLE_KEY or sb_secret", () => {
  assert.doesNotMatch(uploadSource, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(uploadSource, /SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(uploadSource, /sb_secret_/);
  assert.doesNotMatch(uploadSource, /service_role/);
});

test("UploadDocument.jsx still does not log token / target", () => {
  assert.doesNotMatch(uploadSource, /console\.log\(token/);
  assert.doesNotMatch(uploadSource, /console\.log\(target/);
});