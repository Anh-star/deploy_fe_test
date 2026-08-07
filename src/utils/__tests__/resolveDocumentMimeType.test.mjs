/**
 * MIME resolver tests — Phase S1-C2 source-consistent layer.
 *
 * <p>Pins the exact behaviour of {@link resolveDocumentMimeType} so the
 * paid submit flow can rely on it for both target creation and the
 * Supabase signed upload content type.
 *
 * <p>Run with: {@code node --test src/utils/__tests__/resolveDocumentMimeType.test.mjs}
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveDocumentMimeType,
  PaidDocumentMimeError,
} from "../validateDocumentFileForUpload.js";

function fakeFile(name, type = "") {
  return { name, type };
}

test("PDF with matching MIME returns canonical PDF MIME", () => {
  const r = resolveDocumentMimeType(
    fakeFile("doc.pdf", "application/pdf")
  );
  assert.equal(r, "application/pdf");
});

test("PDF with empty browser MIME returns canonical PDF MIME", () => {
  const r = resolveDocumentMimeType(fakeFile("doc.pdf", ""));
  assert.equal(r, "application/pdf");
});

test("DOC with empty browser MIME returns canonical DOC MIME", () => {
  const r = resolveDocumentMimeType(fakeFile("doc.doc", ""));
  assert.equal(r, "application/msword");
});

test("DOCX with empty browser MIME returns canonical DOCX MIME", () => {
  const r = resolveDocumentMimeType(fakeFile("doc.docx", ""));
  assert.equal(
    r,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
});

test("PPT with empty browser MIME returns canonical PPT MIME", () => {
  const r = resolveDocumentMimeType(fakeFile("slides.ppt", ""));
  assert.equal(r, "application/vnd.ms-powerpoint");
});

test("PPTX with empty browser MIME returns canonical PPTX MIME", () => {
  const r = resolveDocumentMimeType(fakeFile("slides.pptx", ""));
  assert.equal(
    r,
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  );
});

test("Uppercase extension is normalized and resolves to canonical MIME", () => {
  const r = resolveDocumentMimeType(fakeFile("Doc.PDF", ""));
  assert.equal(r, "application/pdf");
});

test("Mixed-case extension with matching MIME succeeds", () => {
  const r = resolveDocumentMimeType(
    fakeFile("Doc.DoCx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
  );
  assert.equal(
    r,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
});

test("Extension/MIME mismatch rejects (PDF extension + DOCX MIME)", () => {
  assert.throws(
    () =>
      resolveDocumentMimeType(
        fakeFile("doc.pdf", "application/msword")
      ),
    PaidDocumentMimeError
  );
});

test("Unsupported extension rejects", () => {
  assert.throws(
    () => resolveDocumentMimeType(fakeFile("malware.exe", "")),
    PaidDocumentMimeError
  );
});

test("File without extension rejects", () => {
  assert.throws(
    () => resolveDocumentMimeType(fakeFile("noextension", "")),
    PaidDocumentMimeError
  );
});

test("Null / undefined / empty file rejects", () => {
  assert.throws(() => resolveDocumentMimeType(null), PaidDocumentMimeError);
  assert.throws(
    () => resolveDocumentMimeType(undefined),
    PaidDocumentMimeError
  );
  assert.throws(
    () => resolveDocumentMimeType(fakeFile("", "")),
    PaidDocumentMimeError
  );
});

test("Whitespace-only browser MIME is treated as empty", () => {
  const r = resolveDocumentMimeType(fakeFile("doc.pdf", "   "));
  assert.equal(r, "application/pdf");
});