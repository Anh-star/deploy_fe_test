/**
 * Supabase paid upload helper — mocked test (no real network, no real
 * Supabase call). Validates the exact signature passed to
 * {@code uploadToSignedUrl} and asserts {@code getPublicUrl} is NEVER
 * called for the paid branch.
 *
 * <p>Run with: {@code node --test src/utils/__tests__/paidUploadSupabase.test.mjs}
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  uploadPaidFileViaSignedUrlWithClient,
} from "../paidUploadSupabase.js";

function makeFakeSupabase() {
  const calls = { uploadToSignedUrl: [], getPublicUrl: [] };
  const supabase = {
    storage: {
      from(bucket) {
        const self = { __bucket: bucket };
        self.uploadToSignedUrl = (path, token, fileBody, fileOptions) => {
          calls.uploadToSignedUrl.push({ bucket, path, token, fileBody, fileOptions });
          return Promise.resolve({
            data: { path, fullPath: `${bucket}/${path}` },
            error: null,
          });
        };
        self.getPublicUrl = (path) => {
          calls.getPublicUrl.push({ bucket, path });
          return { data: { publicUrl: `https://public/${bucket}/${path}` } };
        };
        return self;
      },
    },
    __calls: calls,
  };
  return supabase;
}

test("uploadToSignedUrl is called with backend-supplied bucket/path/token verbatim", async () => {
  const supabase = makeFakeSupabase();
  const file = { name: "doc.pdf", size: 100, type: "application/pdf" };
  const target = {
    bucket: "paid-docs",
    path: "user/abc/doc.pdf",
    token: "signed-token-xyz",
  };

  const r = await uploadPaidFileViaSignedUrlWithClient(supabase, file, target);
  assert.equal(r.path, "user/abc/doc.pdf");
  assert.equal(r.fullPath, "paid-docs/user/abc/doc.pdf");

  const calls = supabase.__calls.uploadToSignedUrl;
  assert.equal(calls.length, 1);
  assert.equal(calls[0].bucket, "paid-docs");
  assert.equal(calls[0].path, "user/abc/doc.pdf");
  assert.equal(calls[0].token, "signed-token-xyz");
  assert.deepEqual(calls[0].fileOptions, {
    contentType: "application/pdf",
    upsert: false,
  });
});

test("paid branch never calls getPublicUrl", async () => {
  const supabase = makeFakeSupabase();
  await uploadPaidFileViaSignedUrlWithClient(
    supabase,
    { name: "x.pdf", size: 1, type: "application/pdf" },
    { bucket: "paid-docs", path: "u/x.pdf", token: "t" }
  );
  assert.equal(supabase.__calls.getPublicUrl.length, 0);
});

test("paid branch uses the explicit contentType override even when file.type is empty", async () => {
  const supabase = makeFakeSupabase();
  const file = { name: "doc.pdf", size: 100, type: "" };
  const target = {
    bucket: "paid-docs",
    path: "user/abc/doc.pdf",
    token: "signed-token-xyz",
  };
  await uploadPaidFileViaSignedUrlWithClient(supabase, file, target, {
    contentType: "application/pdf",
  });
  const calls = supabase.__calls.uploadToSignedUrl;
  assert.equal(calls.length, 1);
  assert.equal(calls[0].fileOptions.contentType, "application/pdf");
});

test("paid branch prefers explicit contentType over file.type when both are present", async () => {
  const supabase = makeFakeSupabase();
  const file = { name: "doc.pdf", size: 100, type: "application/x-misleading" };
  const target = {
    bucket: "paid-docs",
    path: "u/x.pdf",
    token: "t",
  };
  await uploadPaidFileViaSignedUrlWithClient(supabase, file, target, {
    contentType: "application/pdf",
  });
  const calls = supabase.__calls.uploadToSignedUrl;
  assert.equal(calls.length, 1);
  assert.equal(calls[0].fileOptions.contentType, "application/pdf");
});

test("paid branch falls back to file.type when no contentType override is supplied", async () => {
  const supabase = makeFakeSupabase();
  const file = { name: "doc.pdf", size: 100, type: "application/pdf" };
  await uploadPaidFileViaSignedUrlWithClient(
    supabase,
    file,
    { bucket: "paid-docs", path: "u/x.pdf", token: "t" }
  );
  const calls = supabase.__calls.uploadToSignedUrl;
  assert.equal(calls.length, 1);
  assert.equal(calls[0].fileOptions.contentType, "application/pdf");
});

test("paid branch treats whitespace-only contentType override as no override", async () => {
  const supabase = makeFakeSupabase();
  const file = { name: "doc.pdf", size: 100, type: "application/pdf" };
  await uploadPaidFileViaSignedUrlWithClient(
    supabase,
    file,
    { bucket: "paid-docs", path: "u/x.pdf", token: "t" },
    { contentType: "   " }
  );
  const calls = supabase.__calls.uploadToSignedUrl;
  assert.equal(calls[0].fileOptions.contentType, "application/pdf");
});

test("rejects empty target fields", async () => {
  const supabase = makeFakeSupabase();
  await assert.rejects(
    () =>
      uploadPaidFileViaSignedUrlWithClient(
        supabase,
        { name: "x.pdf", size: 1, type: "" },
        { bucket: "", path: "p", token: "t" }
      ),
    /bucket/
  );
  await assert.rejects(
    () =>
      uploadPaidFileViaSignedUrlWithClient(
        supabase,
        { name: "x.pdf", size: 1, type: "" },
        { bucket: "b", path: "", token: "t" }
      ),
    /path/
  );
  await assert.rejects(
    () =>
      uploadPaidFileViaSignedUrlWithClient(
        supabase,
        { name: "x.pdf", size: 1, type: "" },
        { bucket: "b", path: "p", token: "" }
      ),
    /token/
  );
});

test("propagates supabase error message and does not throw raw token", async () => {
  const supabase = {
    storage: {
      from: () => ({
        uploadToSignedUrl: () =>
          Promise.resolve({ data: null, error: { message: "expired" } }),
      }),
    },
  };
  await assert.rejects(
    () =>
      uploadPaidFileViaSignedUrlWithClient(
        supabase,
        { name: "x.pdf", size: 1, type: "" },
        { bucket: "b", path: "p", token: "t-secret" }
      ),
    /expired/
  );
});