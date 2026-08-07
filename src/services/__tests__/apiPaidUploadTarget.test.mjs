/**
 * Contract test for {@code documentService.createPaidUploadTarget}.
 *
 * <p>Validates the route URL and request/response shape by reading the
 * production source as text. Avoids pulling in {@code axiosClient} and
 * {@code tokenStorage} (which reference Vite-only {@code import.meta.env})
 * so the test stays free of any runtime environment requirement.
 *
 * <p>Run with: {@code node --test src/services/__tests__/apiPaidUploadTarget.test.mjs}
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const apiSource = readFileSync(join(here, "..", "api.js"), "utf8");

function between(source, startMarker, endMarker) {
  const i = source.indexOf(startMarker);
  if (i < 0) return "";
  const j = source.indexOf(endMarker, i + startMarker.length);
  if (j < 0) return "";
  return source.slice(i, j + endMarker.length);
}

test("createPaidUploadTarget POSTs to /my-documents/storage/paid-upload-target", () => {
  const block = between(apiSource, "createPaidUploadTarget", "updateMyDocument");
  assert.match(block, /"\/my-documents\/storage\/paid-upload-target"/);
});

test("createPaidUploadTarget sends only fileName, mimeType, sizeBytes", () => {
  const block = between(apiSource, "createPaidUploadTarget", "updateMyDocument");
  assert.match(block, /fileName\s*,\s*mimeType\s*,\s*sizeBytes/);
});

test("createPaidUploadTarget rejects invalid sizeBytes before calling axiosClient", () => {
  const block = between(apiSource, "createPaidUploadTarget", "updateMyDocument");
  assert.match(block, /sizeBytes\s*<=\s*0\s*\|\|\s*!Number\.isInteger/);
});

test("createPaidUploadTarget returns uploadId, bucket, path, token, expiresAt", () => {
  const block = between(apiSource, "createPaidUploadTarget", "updateMyDocument");
  for (const field of ["uploadId", "bucket", "path", "token", "expiresAt"]) {
    assert.match(block, new RegExp(`\\b${field}\\b`), `expected ${field} in helper`);
  }
});

test("createPaidUploadTarget requires non-blank fileName and mimeType", () => {
  const block = between(apiSource, "createPaidUploadTarget", "updateMyDocument");
  assert.match(block, /!fileName/);
  assert.match(block, /!mimeType/);
});

test("createPaidUploadTarget keeps service-role / sb_secret out of source", () => {
  const block = between(apiSource, "createPaidUploadTarget", "updateMyDocument");
  assert.doesNotMatch(block, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(block, /sb_secret/);
  assert.doesNotMatch(block, /service_role/);
  assert.doesNotMatch(block, /console\.log\((token|target)/);
});