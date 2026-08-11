/**
 * Phase S1-C2: source-consistent frontend UX validator for the document
 * file attached to the upload form.
 *
 * <p>Mirrors the backend {@code AllowedDocumentFileType} whitelist and the
 * 25 MB cap. This is NOT an authoritative validator — the backend re-runs
 * the same checks. It exists only to give the user a fast, friendly error
 * before any network round-trip.
 *
 * <p>The extension check is the PRIMARY gate so the helper does not block a
 * legitimate file when the browser leaves {@code file.type} empty.
 */
const ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "ppt", "pptx"];
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

/**
 * Canonical extension → MIME mapping. Mirrors the backend
 * {@code AllowedDocumentFileType} whitelist exactly. DO NOT widen.
 */
const EXTENSION_MIME_MAP = Object.freeze({
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
});

export const PAID_DOCUMENT_FILE_RULES = Object.freeze({
  allowedExtensions: ALLOWED_EXTENSIONS,
  maxBytes: MAX_DOCUMENT_BYTES,
});

/**
 * Build a structured validation error suitable for {@link resolveDocumentMimeType}.
 *
 * <p>Returned shape is identical to {@link validateDocumentFileForUpload} so
 * the submit layer can use one error-handling path.
 */
export class PaidDocumentMimeError extends Error {
  constructor(message) {
    super(message);
    this.name = "PaidDocumentMimeError";
  }
}

function fileExtension(name) {
  if (typeof name !== "string") return "";
  const i = name.lastIndexOf(".");
  if (i <= 0 || i === name.length - 1) return "";
  return name.slice(i + 1).toLowerCase();
}

export function isAllowedDocumentExtension(name) {
  const ext = fileExtension(name);
  return ext !== "" && ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * Resolve the canonical MIME type of a candidate upload file.
 *
 * <p>Rules:
 * <ol>
 *   <li>Take the lower-cased extension of {@code file.name}.</li>
 *   <li>If the extension is NOT in the whitelist → reject.</li>
 *   <li>If {@code file.type} is non-blank and exactly equals the canonical
 *       MIME for the extension → return the canonical MIME.</li>
 *   <li>If {@code file.type} is blank → return the canonical MIME
 *       derived from the extension (this is the source-consistent fix:
 *       a legitimate file whose browser leaves MIME empty is still
 *       uploadable).</li>
 *   <li>If {@code file.type} is non-blank but does NOT match the canonical
 *       MIME for the extension → reject. We do NOT trust a MIME the
 *       browser invented for an unsupported extension.</li>
 *   <li>If {@code file.name} has no extension → reject.</li>
 * </ol>
 *
 * @param {{ name: string, type?: string } | null | undefined} file
 * @returns {string} canonical MIME (one of the {@link EXTENSION_MIME_MAP} values)
 * @throws {PaidDocumentMimeError}
 */
export function resolveDocumentMimeType(file) {
  if (!file || typeof file !== "object") {
    throw new PaidDocumentMimeError("Thiếu tệp để xác định MIME.");
  }
  const name = file.name;
  if (typeof name !== "string" || name.trim() === "") {
    throw new PaidDocumentMimeError("Tên tệp không hợp lệ để xác định MIME.");
  }
  const ext = fileExtension(name);
  if (ext === "") {
    throw new PaidDocumentMimeError(
      "Tệp không có phần mở rộng. Chỉ chấp nhận PDF, DOC, DOCX, PPT, PPTX."
    );
  }
  const canonical = EXTENSION_MIME_MAP[ext];
  if (!canonical) {
    throw new PaidDocumentMimeError(
      "Định dạng tệp không được hỗ trợ. Chỉ chấp nhận PDF, DOC, DOCX, PPT, PPTX."
    );
  }
  const browserMime = typeof file.type === "string" ? file.type.trim() : "";
  if (browserMime === "") {
    // Browser left MIME empty — fall back to the canonical MIME derived
    // from the extension. This is the source-consistent path for valid
    // files whose OS / browser did not pre-fill `file.type`.
    return canonical;
  }
  if (browserMime !== canonical) {
    throw new PaidDocumentMimeError(
      "MIME của tệp không khớp với phần mở rộng. Vui lòng chọn lại tệp."
    );
  }
  return canonical;
}

/**
 * Validate a candidate document file for the upload flow.
 *
 * @param {File | null | undefined} file
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateDocumentFileForUpload(file) {
  if (!file) {
    return { ok: false, message: "Vui lòng chọn tệp tài liệu." };
  }
  if (typeof file.size !== "number" || !Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, message: "Tệp tài liệu trống hoặc không hợp lệ." };
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { ok: false, message: "Tệp tài liệu vượt quá 25 MB." };
  }
  if (!isAllowedDocumentExtension(file.name)) {
    return {
      ok: false,
      message: "Định dạng tệp không được hỗ trợ. Chỉ chấp nhận PDF, DOC, DOCX, PPT, PPTX.",
    };
  }
  return { ok: true };
}