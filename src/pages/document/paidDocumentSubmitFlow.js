/**
 * Pure orchestrator for the PAID document submit flow — Phase S1-C2.
 *
 * <p>Extracted from {@code UploadDocument.jsx} so it can be exercised by
 * {@code node --test} without rendering the React tree. The orchestrator
 * itself holds NO module-level state: the signed token and every
 * intermediate value stay in the local closure of the single
 * {@link submitPaidDocumentFlow} call.
 *
 * <p>Exact phase order (asserted by the test suite):
 * <ol>
 *   <li>Validate + resolve the canonical MIME from the file extension
 *       via {@link resolveDocumentMimeType}.</li>
 *   <li>{@code onPhaseChange("preparing")} → call
 *       {@link deps.createPaidUploadTarget} with
 *       {@code fileName, mimeType: resolvedMimeType, sizeBytes}.</li>
 *   <li>{@code onPhaseChange("uploading")} → call
 *       {@link deps.uploadPaidFileViaSignedUrl} with the file, the
 *       backend-supplied {@code bucket/path/token}, and
 *       {@code contentType: resolvedMimeType}.</li>
 *   <li>{@code onPhaseChange("creating")} → call
 *       {@link deps.createMyDocument} with the PAID payload
 *       ({@code isPaid=true}, {@code uploadId}, NO public
 *       {@code documentUrl}/{@code storagePath}).</li>
 * </ol>
 *
 * <p>Failures short-circuit the chain. The orchestrator NEVER calls
 * {@code getPublicUrl} and NEVER calls the free-flow
 * {@code uploadDocumentToSupabase} helper. Double-submit guarding is
 * the caller's responsibility (see the {@code submitInFlightRef}
 * pattern used in {@code UploadDocument.jsx}).
 *
 * @typedef {Object} PaidSubmitDeps
 * @property {(input: { fileName: string, mimeType: string, sizeBytes: number }) =>
 *   Promise<{ uploadId: string, bucket: string, path: string, token: string }>}
 *   createPaidUploadTarget
 * @property {(file: File, target: { bucket: string, path: string, token: string },
 *   options?: { contentType?: string }) => Promise<{ path: string, fullPath?: string }>}
 *   uploadPaidFileViaSignedUrl
 * @property {(payload: object) => Promise<object>} createMyDocument
 * @property {(phase: "preparing" | "uploading" | "creating" | null) => void}
 *   [onPhaseChange]
 */

import { resolveDocumentMimeType } from "../../utils/validateDocumentFileForUpload.js";

/**
 * Build the exact PAID create payload. Factored out so the test can pin
 * the field shape that MUST stay authoritative-free.
 *
 * @param {object} args
 * @param {{ title: string, description: string, category: string, tags: string[] }} args.form
 * @param {string} args.uploadId
 * @param {number} args.normalizedPrice
 * @param {string} args.thumbnailUrl
 * @param {string} args.fileName
 * @param {number} args.fileSizeBytes
 * @param {{ generateQuiz?: boolean, quizQuestionCount?: number | null, quizFocusTopic?: string | null }} [args.quizOptions]
 */
export function buildPaidCreatePayload({
  form,
  uploadId,
  normalizedPrice,
  thumbnailUrl,
  fileName,
  fileSizeBytes,
  quizOptions,
}) {
  const generateQuiz = Boolean(quizOptions?.generateQuiz);
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
    generateQuiz,
    quizQuestionCount: generateQuiz
      ? quizOptions.quizQuestionCount
      : null,
    quizFocusTopic: generateQuiz
      ? (
          typeof quizOptions.quizFocusTopic === "string"
            ? quizOptions.quizFocusTopic.trim()
            : ""
        )
      : null,
  };
}

/**
 * Run the PAID submit flow.
 *
 * @param {object} args
 * @param {File} args.file
 * @param {{ title: string, description: string, category: string, tags: string[] }} args.form
 * @param {string} args.thumbnailUrl
 * @param {number} args.normalizedPrice
 * @param {PaidSubmitDeps} args.deps
 * @returns {Promise<object>} the resolved create-document response
 */
export async function submitPaidDocumentFlow({
  file,
  form,
  thumbnailUrl,
  normalizedPrice,
  quizOptions,
  deps,
}) {
  if (!file) {
    throw new Error("Vui lòng chọn tệp tài liệu để tải lên.");
  }
  if (!form || typeof form !== "object") {
    throw new Error("Thiếu thông tin biểu mẫu tài liệu.");
  }
  if (typeof thumbnailUrl !== "string" || !thumbnailUrl.trim()) {
    throw new Error("Thiếu ảnh minh họa tài liệu.");
  }
  if (
    typeof deps.createPaidUploadTarget !== "function" ||
    typeof deps.uploadPaidFileViaSignedUrl !== "function" ||
    typeof deps.createMyDocument !== "function"
  ) {
    throw new Error("Thiếu dependency của paid submit flow.");
  }

  // (1) Resolve the canonical MIME from the file extension. This is the
  //     SINGLE source of truth for both the target request body and the
  //     signed-upload content type.
  const resolvedMimeType = resolveDocumentMimeType(file);

  const onPhaseChange =
    typeof deps.onPhaseChange === "function"
      ? (phase) => deps.onPhaseChange(phase)
      : () => {};

  // (2) Request the signed-upload target.
  onPhaseChange("preparing");
  const target = await deps.createPaidUploadTarget({
    fileName: file.name,
    mimeType: resolvedMimeType,
    sizeBytes: file.size,
  });

  // (3) Upload the file binary to the backend-supplied target. The
  //     token stays in this local closure; it is never stored on the
  //     module, in component state, or in persistent storage.
  onPhaseChange("uploading");
  await deps.uploadPaidFileViaSignedUrl(file, target, {
    contentType: resolvedMimeType,
  });

  // (4) Create the document only after storage upload succeeded.
  onPhaseChange("creating");
  const payload = buildPaidCreatePayload({
    form,
    uploadId: target.uploadId,
    normalizedPrice,
    thumbnailUrl,
    fileName: file.name,
    fileSizeBytes: file.size,
    quizOptions,
  });
  return deps.createMyDocument(payload);
}

/**
 * Build a single-flight guard for the PAID submit flow.
 *
 * <p>Returns an object whose {@link PaidSubmissionGuard.tryStart} returns
 * {@code true} exactly once between resets. Subsequent calls return
 * {@code false} until {@link PaidSubmissionGuard.finish} is invoked.
 * This is the in-process mechanism that prevents a double-click (or a
 * React StrictMode double-effect) from launching two paid upload
 * flows. The orchestrator itself stays stateless; the guard is a
 * lightweight wrapper the caller composes into the React submit
 * handler.
 *
 * @typedef {Object} PaidSubmissionGuard
 * @property {() => boolean} tryStart
 * @property {() => void} finish
 * @property {() => boolean} isRunning
 */
export function createPaidSubmissionGuard() {
  let inFlight = false;
  return {
    tryStart() {
      if (inFlight) return false;
      inFlight = true;
      return true;
    },
    finish() {
      inFlight = false;
    },
    isRunning() {
      return inFlight;
    },
  };
}