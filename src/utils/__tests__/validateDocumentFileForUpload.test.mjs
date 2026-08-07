/**
 * Validator tests — pure logic, no network.
 *
 * <p>Run with: {@code node --test src/utils/__tests__/validateDocumentFileForUpload.test.mjs}
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  validateDocumentFileForUpload,
  isAllowedDocumentExtension,
  PAID_DOCUMENT_FILE_RULES,
} from "../validateDocumentFileForUpload.js";

function fakeFile(name, size = 1024, type = "application/pdf") {
  return { name, size, type };
}

test("rejects null file", () => {
  const r = validateDocumentFileForUpload(null);
  assert.equal(r.ok, false);
});

test("rejects empty file (size 0)", () => {
  const r = validateDocumentFileForUpload(fakeFile("a.pdf", 0));
  assert.equal(r.ok, false);
});

test("rejects file larger than 25 MB", () => {
  const r = validateDocumentFileForUpload(fakeFile("a.pdf", 26 * 1024 * 1024));
  assert.equal(r.ok, false);
});

test("rejects disallowed extension", () => {
  const r = validateDocumentFileForUpload(fakeFile("malware.exe", 100));
  assert.equal(r.ok, false);
});

test("accepts allowed extensions even when browser leaves MIME empty", () => {
  for (const ext of PAID_DOCUMENT_FILE_RULES.allowedExtensions) {
    const r = validateDocumentFileForUpload(fakeFile(`doc.${ext}`, 100, ""));
    assert.equal(r.ok, true, `expected .${ext} to be accepted`);
  }
});

test("isAllowedDocumentExtension covers the full whitelist", () => {
  for (const ext of PAID_DOCUMENT_FILE_RULES.allowedExtensions) {
    assert.equal(isAllowedDocumentExtension(`foo.${ext}`), true);
  }
  assert.equal(isAllowedDocumentExtension("foo.exe"), false);
  assert.equal(isAllowedDocumentExtension("noextension"), false);
});