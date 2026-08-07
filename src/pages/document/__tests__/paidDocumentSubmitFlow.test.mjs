/**
 * Paid submit orchestrator tests — Phase S1-C2.
 *
 * <p>Pins the EXACT success / failure contract of
 * {@link submitPaidDocumentFlow} without rendering React, calling
 * Supabase, or hitting the network. All collaborators are
 * dependency-injected stubs.
 *
 * <p>Run with: {@code node --test src/pages/document/__tests__/paidDocumentSubmitFlow.test.mjs}
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  submitPaidDocumentFlow,
  buildPaidCreatePayload,
  createPaidSubmissionGuard,
} from "../paidDocumentSubmitFlow.js";

function fakeFile(name, size = 1024, type = "") {
  return { name, size, type };
}

function makeForm() {
  return {
    title: "  Tài liệu Java cơ bản  ",
    description: "  Mô tả dài đúng quy định.",
    category: "programming",
    tags: ["java", "oop"],
  };
}

function makeLogger() {
  const calls = {
    createPaidUploadTarget: [],
    uploadPaidFileViaSignedUrl: [],
    createMyDocument: [],
    phases: [],
    getPublicUrl: 0,
    uploadDocumentToSupabase: 0,
  };
  return {
    calls,
    deps: {
      createPaidUploadTarget: async (input) => {
        calls.createPaidUploadTarget.push(input);
        return {
          uploadId: "upload-123",
          bucket: "paid-docs",
          path: "user/abc/java.pdf",
          token: "signed-token-xyz",
        };
      },
      uploadPaidFileViaSignedUrl: async (file, target, options) => {
        calls.uploadPaidFileViaSignedUrl.push({ file, target, options });
        return { path: target.path, fullPath: `${target.bucket}/${target.path}` };
      },
      createMyDocument: async (payload) => {
        calls.createMyDocument.push(payload);
        return { id: "doc-1", ...payload };
      },
      onPhaseChange: (phase) => {
        calls.phases.push(phase);
      },
    },
  };
}

test("A. Success ordering is exactly target → upload → create", async () => {
  const { deps, calls } = makeLogger();
  await submitPaidDocumentFlow({
    file: fakeFile("doc.pdf", 1024, "application/pdf"),
    form: makeForm(),
    thumbnailUrl: "https://cdn.example/thumb.jpg",
    normalizedPrice: 5000,
    deps,
  });

  assert.equal(calls.createPaidUploadTarget.length, 1);
  assert.equal(calls.uploadPaidFileViaSignedUrl.length, 1);
  assert.equal(calls.createMyDocument.length, 1);
  assert.equal(calls.phases.join(","), "preparing,uploading,creating");
});

test("B. Target request uses file.name, resolved canonical MIME, file.size", async () => {
  const { deps, calls } = makeLogger();
  // Browser leaves MIME empty — orchestrator must derive canonical PDF MIME.
  await submitPaidDocumentFlow({
    file: fakeFile("doc.pdf", 4096, ""),
    form: makeForm(),
    thumbnailUrl: "https://cdn.example/thumb.jpg",
    normalizedPrice: 5000,
    deps,
  });

  const req = calls.createPaidUploadTarget[0];
  assert.equal(req.fileName, "doc.pdf");
  assert.equal(req.mimeType, "application/pdf");
  assert.equal(req.sizeBytes, 4096);
});

test("C. Signed upload uses exact bucket / path / token from backend response", async () => {
  const { deps, calls } = makeLogger();
  await submitPaidDocumentFlow({
    file: fakeFile("doc.pdf", 1024, "application/pdf"),
    form: makeForm(),
    thumbnailUrl: "thumb",
    normalizedPrice: 5000,
    deps,
  });

  const up = calls.uploadPaidFileViaSignedUrl[0];
  assert.equal(up.target.bucket, "paid-docs");
  assert.equal(up.target.path, "user/abc/java.pdf");
  assert.equal(up.target.token, "signed-token-xyz");
  assert.equal(up.options.contentType, "application/pdf");
});

test("D. Paid create payload has uploadId + isPaid=true and NO authoritative public URL fields", async () => {
  const { deps, calls } = makeLogger();
  await submitPaidDocumentFlow({
    file: fakeFile("doc.pdf", 1024, ""),
    form: makeForm(),
    thumbnailUrl: "https://cdn.example/thumb.jpg",
    normalizedPrice: 5000,
    deps,
  });

  const p = calls.createMyDocument[0];
  assert.equal(p.isPaid, true);
  assert.equal(p.uploadId, "upload-123");
  assert.equal(p.documentUrl, null);
  assert.equal(p.storagePath, null);
  // Authoritative fields that MUST never appear on the PAID create payload:
  for (const forbidden of ["bucket", "path", "token", "userId"]) {
    assert.equal(p[forbidden], undefined, `paid payload must not carry ${forbidden}`);
  }
});

test("E. Target failure stops the chain (no upload, no create)", async () => {
  const calls = { createMyDocument: 0, uploadPaidFileViaSignedUrl: 0, phases: [] };
  let thrown = null;
  try {
    await submitPaidDocumentFlow({
      file: fakeFile("doc.pdf", 1024, "application/pdf"),
      form: makeForm(),
      thumbnailUrl: "thumb",
      normalizedPrice: 5000,
      deps: {
        createPaidUploadTarget: async () => {
          throw new Error("backend-503");
        },
        uploadPaidFileViaSignedUrl: async () => {
          calls.uploadPaidFileViaSignedUrl += 1;
          return { path: "" };
        },
        createMyDocument: async () => {
          calls.createMyDocument += 1;
          return {};
        },
        onPhaseChange: (p) => calls.phases.push(p),
      },
    });
  } catch (e) {
    thrown = e;
  }
  assert.ok(thrown, "expected target failure to throw");
  assert.match(thrown.message, /backend-503/);
  assert.equal(calls.uploadPaidFileViaSignedUrl, 0);
  assert.equal(calls.createMyDocument, 0);
});

test("F. Storage failure stops the chain (no create)", async () => {
  const calls = { createMyDocument: 0, createPaidUploadTarget: 0, phases: [] };
  let thrown = null;
  try {
    await submitPaidDocumentFlow({
      file: fakeFile("doc.pdf", 1024, "application/pdf"),
      form: makeForm(),
      thumbnailUrl: "thumb",
      normalizedPrice: 5000,
      deps: {
        createPaidUploadTarget: async () => {
          calls.createPaidUploadTarget += 1;
          return {
            uploadId: "upload-123",
            bucket: "paid-docs",
            path: "p",
            token: "t",
          };
        },
        uploadPaidFileViaSignedUrl: async () => {
          throw new Error("supabase-storage-failure");
        },
        createMyDocument: async () => {
          calls.createMyDocument += 1;
          return {};
        },
        onPhaseChange: (p) => calls.phases.push(p),
      },
    });
  } catch (e) {
    thrown = e;
  }
  assert.ok(thrown);
  assert.match(thrown.message, /supabase-storage-failure/);
  assert.equal(calls.createPaidUploadTarget, 1);
  assert.equal(calls.createMyDocument, 0);
});

test("G. Document-create failure rejects and does not silently swallow", async () => {
  let thrown = null;
  try {
    await submitPaidDocumentFlow({
      file: fakeFile("doc.pdf", 1024, "application/pdf"),
      form: makeForm(),
      thumbnailUrl: "thumb",
      normalizedPrice: 5000,
      deps: {
        createPaidUploadTarget: async () => ({
          uploadId: "upload-123",
          bucket: "paid-docs",
          path: "p",
          token: "t",
        }),
        uploadPaidFileViaSignedUrl: async () => ({ path: "p" }),
        createMyDocument: async () => {
          throw new Error("create-422");
        },
      },
    });
  } catch (e) {
    thrown = e;
  }
  assert.ok(thrown);
  assert.match(thrown.message, /create-422/);
});

test("G2. Document-create failure does not re-target and does not re-upload", async () => {
  let createCalls = 0;
  let targetCalls = 0;
  let uploadCalls = 0;
  try {
    await submitPaidDocumentFlow({
      file: fakeFile("doc.pdf", 1024, "application/pdf"),
      form: makeForm(),
      thumbnailUrl: "thumb",
      normalizedPrice: 5000,
      deps: {
        createPaidUploadTarget: async () => {
          targetCalls += 1;
          return {
            uploadId: "upload-123",
            bucket: "paid-docs",
            path: "p",
            token: "t",
          };
        },
        uploadPaidFileViaSignedUrl: async () => {
          uploadCalls += 1;
          return { path: "p" };
        },
        createMyDocument: async () => {
          createCalls += 1;
          throw new Error("create-422");
        },
      },
    });
  } catch {
    // expected
  }
  assert.equal(targetCalls, 1, "must not re-target");
  assert.equal(uploadCalls, 1, "must not re-upload");
  assert.equal(createCalls, 1, "must call create only once");
});

test("H. Target API is called exactly once per submit", async () => {
  const { deps, calls } = makeLogger();
  await submitPaidDocumentFlow({
    file: fakeFile("doc.pdf", 1024, "application/pdf"),
    form: makeForm(),
    thumbnailUrl: "thumb",
    normalizedPrice: 5000,
    deps,
  });
  assert.equal(calls.createPaidUploadTarget.length, 1);
});

test("I. Double-submit guard allows exactly one in-flight run", async () => {
  const guard = createPaidSubmissionGuard();
  assert.equal(guard.tryStart(), true);
  assert.equal(guard.isRunning(), true);
  // second concurrent submit attempt is rejected
  assert.equal(guard.tryStart(), false);
  assert.equal(guard.tryStart(), false);
  // finishing releases the lock for the next legitimate submit
  guard.finish();
  assert.equal(guard.isRunning(), false);
  assert.equal(guard.tryStart(), true);
});

test("I2. Two concurrent submitPaidDocumentFlow calls backed by one guard run only once", async () => {
  const { deps, calls } = makeLogger();
  const guard = createPaidSubmissionGuard();

  const runner = () =>
    guard.tryStart()
      ? submitPaidDocumentFlow({
          file: fakeFile("doc.pdf", 1024, "application/pdf"),
          form: makeForm(),
          thumbnailUrl: "thumb",
          normalizedPrice: 5000,
          deps,
        }).finally(() => guard.finish())
      : Promise.reject(new Error("double-submit-blocked"));

  const [a, b] = await Promise.allSettled([runner(), runner()]);
  const fulfilled = [a, b].filter((r) => r.status === "fulfilled");
  const rejected = [a, b].filter((r) => r.status === "rejected");
  assert.equal(fulfilled.length, 1, "exactly one flow runs");
  assert.equal(rejected.length, 1, "exactly one flow is blocked");
  assert.match(rejected[0].reason.message, /double-submit-blocked/);
  assert.equal(calls.createPaidUploadTarget.length, 1);
});

test("J. Paid submit helper does NOT call getPublicUrl / uploadDocumentToSupabase", async () => {
  // Stub helpers that should never be reached.
  const forbidden = {
    getPublicUrl: () => {
      forbidden.__hits += 1;
    },
    uploadDocumentToSupabase: () => {
      forbidden.__hits += 1;
    },
    __hits: 0,
  };

  const { deps } = makeLogger();
  // The orchestrator only accepts createPaidUploadTarget /
  // uploadPaidFileViaSignedUrl / createMyDocument / onPhaseChange. We
  // attach the forbidden helpers to the deps object so we can prove the
  // orchestrator never references them. The orchestrator simply doesn't
  // know they exist.
  deps.getPublicUrl = forbidden.getPublicUrl;
  deps.uploadDocumentToSupabase = forbidden.uploadDocumentToSupabase;

  await submitPaidDocumentFlow({
    file: fakeFile("doc.pdf", 1024, "application/pdf"),
    form: makeForm(),
    thumbnailUrl: "thumb",
    normalizedPrice: 5000,
    deps,
  });

  assert.equal(forbidden.__hits, 0);
});

test("MIME mismatch on file rejects flow before any network call", async () => {
  let createPaidUploadTargetCalls = 0;
  await assert.rejects(
    () =>
      submitPaidDocumentFlow({
        file: fakeFile("doc.pdf", 1024, "application/msword"),
        form: makeForm(),
        thumbnailUrl: "thumb",
        normalizedPrice: 5000,
        deps: {
          createPaidUploadTarget: async () => {
            createPaidUploadTargetCalls += 1;
            return {};
          },
          uploadPaidFileViaSignedUrl: async () => ({}),
          createMyDocument: async () => ({}),
        },
      }),
    /MIME/
  );
  assert.equal(createPaidUploadTargetCalls, 0);
});

test("Empty browser MIME still produces a successful paid submit", async () => {
  const { deps, calls } = makeLogger();
  const r = await submitPaidDocumentFlow({
    file: fakeFile("doc.pdf", 1024, ""), // empty browser MIME
    form: makeForm(),
    thumbnailUrl: "thumb",
    normalizedPrice: 5000,
    deps,
  });
  assert.equal(calls.createPaidUploadTarget[0].mimeType, "application/pdf");
  assert.equal(calls.uploadPaidFileViaSignedUrl[0].options.contentType, "application/pdf");
  assert.equal(r.id, "doc-1");
});

test("Unsupported extension rejects before any network call", async () => {
  let called = 0;
  await assert.rejects(
    () =>
      submitPaidDocumentFlow({
        file: fakeFile("malware.exe", 1024, ""),
        form: makeForm(),
        thumbnailUrl: "thumb",
        normalizedPrice: 5000,
        deps: {
          createPaidUploadTarget: async () => {
            called += 1;
            return {};
          },
          uploadPaidFileViaSignedUrl: async () => ({}),
          createMyDocument: async () => ({}),
        },
      }),
    /định dạng|extension|MIME/i
  );
  assert.equal(called, 0);
});

test("buildPaidCreatePayload: documentUrl/storagePath are null and NO authoritative fields", () => {
  const p = buildPaidCreatePayload({
    form: makeForm(),
    uploadId: "abc",
    normalizedPrice: 5000,
    thumbnailUrl: "thumb",
    fileName: "doc.pdf",
    fileSizeBytes: 1024,
  });
  assert.equal(p.documentUrl, null);
  assert.equal(p.storagePath, null);
  assert.equal(p.isPaid, true);
  assert.equal(p.uploadId, "abc");
  for (const forbidden of ["bucket", "path", "token", "userId"]) {
    assert.equal(p[forbidden], undefined);
  }
});