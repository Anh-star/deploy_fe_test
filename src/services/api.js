import axiosClient from "../api/axiosClient";
import { getAccessToken } from "../api/tokenStorage";

function unwrapApiResponse(response) {
  const payload = response?.data;
  // Most endpoints follow { success, data, message, timestamp }
  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data;
  }
  return payload;
}

/**
 * Interpret a raw Axios response from /api/documents/{id}/preview into a
 * frontend-friendly model.
 *
 * The backend can reply with:
 *   - application/pdf  → full or limited preview bytes
 *   - application/json → locked preview descriptor
 *
 * We classify on Content-Type, peel off the custom preview headers, and
 * return a discriminated union so the consumer never has to reach into
 * raw Blob / JSON.
 *
 * The blob is intentionally NOT converted to a persistent object URL
 * here. That responsibility belongs to SecureDocumentPreview so the
 * lifecycle stays in one place.
 *
 * @param {{ data: any, headers: any, status: number }} res
 * @returns {PreviewBlobResult}
 */
async function interpretPreviewResponse(res) {
  const headers = res?.headers ?? {};
  const status = typeof res?.status === "number" ? res.status : 200;
  const contentTypeRaw =
    headers["content-type"] || headers["Content-Type"] || "";
  const contentType = String(contentTypeRaw).toLowerCase();

  const renderer = (
    (headers["x-preview-renderer"] || "").toString().toUpperCase() || ""
  ).trim();

  // Phase O4B: the backend returns a safe waiting-state descriptor
  // at HTTP 202 and a terminal DEAD descriptor at HTTP 409.
  //   202 →  waiting / state
  //   409 →  dead / terminal delivery error
  //
  // 409 MUST NOT be folded into the business "locked" branch —
  // locked means "you may purchase access", dead means "the
  // preview pipeline cannot deliver this document at all".
  if (status === 202) {
    const raw = await readJsonBody(res);
    const previewStateRaw =
      typeof raw?.status === "string"
        ? raw.status.toUpperCase()
        : "PENDING";
    return {
      kind: "waiting",
      previewState: previewStateRaw,
      message:
        typeof raw?.message === "string"
          ? raw.message
          : "Đang chờ tạo bản xem trước",
      retryable: raw?.retryable === true,
      status,
    };
  }

  if (status === 409) {
    // Phase O4B final: a 409 response is a terminal delivery error
    // ONLY when the safe payload explicitly carries
    // `status: "DEAD"`. We do NOT fold any other 409 into kind
    // "dead" — and we do NOT fold any 409 into kind "locked".
    //
    // Possible payloads:
    //   { status: "DEAD", retryable: false, message?: "..." }
    //   → kind "dead"
    //
    //   anything else, or malformed JSON
    //   → kind "error" (protocol violation / unexpected 409)
    let raw = null;
    try {
      raw = await readJsonBody(res);
    } catch {
      raw = null;
    }
    const payloadStatus =
      raw && typeof raw.status === "string" ? raw.status.toUpperCase() : null;
    if (payloadStatus === "DEAD") {
      return {
        kind: "dead",
        previewState: "DEAD",
        message:
          typeof raw?.message === "string"
            ? raw.message
            : "Bản xem trước không khả dụng",
        retryable: raw?.retryable === true,
        status,
      };
    }
    // 409 without status: "DEAD" is a protocol violation. Treat
    // it as a generic error so the operator gets a clear
    // indication; never map to kind "locked" or kind "dead".
    return {
      kind: "error",
      mode: null,
      previewState: null,
      pdfBuffer: null,
      message:
        "Bản xem trước không khả dụng (phản hồi 409 không hợp lệ)",
      retryable: false,
      status,
    };
  }

  if (contentType.includes("application/pdf")) {
    const blob = res?.data instanceof Blob ? res.data : new Blob([res?.data], { type: "application/pdf" });
    const mode = (headers["x-preview-mode"] || "").toString().toUpperCase() || "FULL";
    const visiblePages = toIntegerOrNull(headers["x-preview-pages"]);
    const totalPages = toIntegerOrNull(headers["x-total-pages"]);
    return {
      kind: "pdf",
      blob,
      mode: mode === "LIMITED" ? "LIMITED" : "FULL",
      visiblePages,
      totalPages,
      renderer: renderer || "PDF",
    };
  }

  // Phase O4B: the legacy DOCX / DOC HTML renderer branches are
  // retired. If the backend still surfaces those MIME types for an
  // Office document, fail closed to a locked state instead of
  // mounting DOCX bytes in the browser.
  const docxMime =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (contentType.includes(docxMime)) {
    return {
      kind: "locked",
      mode: "LOCKED",
      reason: "PREVIEW_UNAVAILABLE",
      message: "Bản xem trước DOC/DOCX đang được tạo. Vui lòng thử lại sau.",
    };
  }

  if (contentType.includes("text/html")) {
    // Phase O4B: legacy DOC HTML is retired under async Office
    // preview. Fail closed.
    return {
      kind: "locked",
      mode: "LOCKED",
      reason: "PREVIEW_UNAVAILABLE",
      message: "Bản xem trước DOC/DOCX đang được tạo. Vui lòng thử lại sau.",
    };
  }

  if (contentType.includes("application/json")) {
    const raw = await readJsonBody(res);
    const reason =
      typeof raw?.reason === "string" ? raw.reason.toUpperCase() : null;
    const message =
      typeof raw?.message === "string"
        ? raw.message
        : "Vui lòng mua tài liệu để có thể xem bản full";
    const mode = (raw?.mode || "").toString().toUpperCase() || "LOCKED";
    // Phase O4B: 200 LOCKED remains the existing authorized denial
    // shape; we do not introduce a new locked-reason for retired
    // Office branches here.
    return {
      kind: "locked",
      mode,
      reason,
      message,
    };
  }

  // Unknown payload — fail closed into the locked state so the UI never
  // accidentally mounts an arbitrary blob.
  return {
    kind: "locked",
    mode: "LOCKED",
    reason: "PREVIEW_UNAVAILABLE",
    message: "Không thể hiển thị bản xem trước",
  };
}

async function readJsonBody(res) {
  let raw = res?.data;
  if (raw instanceof Blob) {
    try {
      const text = await raw.text();
      raw = text ? JSON.parse(text) : {};
    } catch {
      raw = {};
    }
  } else if (typeof raw === "string") {
    try {
      raw = raw ? JSON.parse(raw) : {};
    } catch {
      raw = {};
    }
  } else if (raw && typeof raw === "object") {
    // axios with responseType blob may pre-decode JSON; if the body
    // is already an object, use it as-is.
    return raw;
  } else {
    raw = {};
  }
  return raw;
}

function toIntegerOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toErrorMessage(err) {
  return (
    err?.response?.data?.message ||
    err?.message ||
    "Something went wrong. Please try again."
  );
}

/** Coalesce concurrent POST /view for the same id (e.g. React StrictMode double effect). */
const documentViewPostById = new Map();

function parseFilenameFromContentDisposition(header) {
  if (!header || typeof header !== "string") return null;
  const star = /filename\*=\s*UTF-8''([^;\s]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      return star[1].trim();
    }
  }
  const quoted = /filename\s*=\s*"((?:\\.|[^"\\])*)"/i.exec(header);
  if (quoted?.[1]) return quoted[1].replace(/\\(.)/g, "$1");
  const unquoted = /filename\s*=\s*([^;\s]+)/i.exec(header);
  if (unquoted?.[1]) return unquoted[1].replace(/^"|"$/g, "");
  return null;
}

function sanitizeDownloadBaseName(name) {
  const s = String(name || "download")
    .replace(/[/\\:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  return s || "download";
}

export function resolveApiUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";
  if (url.startsWith("/api/")) {
    const origin = apiBase.replace(/\/api\/?$/, "");
    return `${origin}${url}`;
  }
  const base = apiBase.endsWith("/") ? apiBase : `${apiBase}/`;
  const path = url.startsWith("/") ? url.slice(1) : url;
  return `${base}${path}`;
}

/**
 * Tải file qua fetch (có Bearer nếu đang có token), trigger download trình duyệt, không mở tab mới.
 * @param {string} fileUrl
 * @param {string} [suggestedFileName]
 */
export async function downloadFileViaFetch(fileUrl, suggestedFileName) {
  const resolvedUrl = resolveApiUrl(fileUrl);
  const headers = {};
  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(resolvedUrl, { method: "GET", headers });

  if (!response.ok) {
    throw new Error(`Không tải được file (${response.status}).`);
  }

  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("text/html")) {
    throw new Error("Không thể tải tài liệu (kết quả trả về trang HTML).");
  }

  const fromHeader = parseFilenameFromContentDisposition(
    response.headers.get("Content-Disposition")
  );
  const filename = (fromHeader || suggestedFileName || "tai-lieu.pdf").trim();

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(objectUrl);
}

/** Gợi ý tên file: title + đuôi từ fileType (vd: pdf). */
export function buildDocumentDownloadName(title, fileTypeOrExtension) {
  const base = sanitizeDownloadBaseName(title);
  if (!fileTypeOrExtension) return base;
  const ext = String(fileTypeOrExtension).replace(/^\./, "").toLowerCase();
  if (!ext) return base;
  if (base.toLowerCase().endsWith(`.${ext}`)) return base;
  return `${base}.${ext}`;
}

export const homepageService = {
  async getStatistics() {
    const res = await axiosClient.get("/homepage/statistics");
    return unwrapApiResponse(res);
  },
  async getLatestDocuments(limit = 4) {
    const res = await axiosClient.get("/homepage/latest-documents", {
      params: { limit },
    });
    return unwrapApiResponse(res);
  },
  async getTrendingDocuments(limit = 5) {
    const res = await axiosClient.get("/homepage/trending-documents", {
      params: { limit },
    });
    return unwrapApiResponse(res);
  },
};

export const leaderboardService = {
  async getLeaderboard(size = 10, sortBy = "views") {
    const res = await axiosClient.get("/leaderboard", {
      params: { size, sortBy },
    });
    return unwrapApiResponse(res);
  },
};

export const sidebarService = {
  async getCategories() {
    const res = await axiosClient.get("/categories");
    return unwrapApiResponse(res);
  },
  async getPopularTags() {
    const res = await axiosClient.get("/tags/popular");
    return unwrapApiResponse(res);
  },
};

export const documentService = {
  async getDocuments(params) {
    // openapi: tagIds is array, explode=true → ?tagIds=a&tagIds=b
    const res = await axiosClient.get("/documents", { params });
    return unwrapApiResponse(res);
  },
  async getDocumentById(documentId) {
    const res = await axiosClient.get(`/documents/${documentId}`);
    return unwrapApiResponse(res);
  },
  async getDocumentQuizzes(documentId, page = 0, size = 10) {
    const res = await axiosClient.get(`/documents/${documentId}/quizzes`, {
      params: { page, size },
    });
    return unwrapApiResponse(res);
  },
  async view(documentId) {
    const key = String(documentId);
    let pending = documentViewPostById.get(key);
    if (pending) {
      return pending;
    }
    pending = (async () => {
      try {
        const res = await axiosClient.post(`/documents/${documentId}/view`);
        return unwrapApiResponse(res);
      } finally {
        queueMicrotask(() => documentViewPostById.delete(key));
      }
    })();
    documentViewPostById.set(key, pending);
    return pending;
  },
  async download(documentId) {
    const res = await axiosClient.post(`/documents/${documentId}/download`);
    return unwrapApiResponse(res);
  },
  async getDocumentFileUrl(documentId) {
    const res = await axiosClient.get(`/documents/${documentId}/file`);
    return unwrapApiResponse(res);
  },
  /**
   * Fetch the secure preview blob for a document.
   *
   * <p>The backend route {@code GET /api/documents/{id}/preview} responds with
   * one of:</p>
   * <ul>
   *   <li>HTTP 200 + application/pdf — FULL or LIMITED PDF bytes.</li>
   *   <li>HTTP 202 + application/json — safe waiting-state descriptor
   *       (PENDING / PROCESSING / RETRY).</li>
   *   <li>HTTP 409 + application/json with `status: "DEAD"` — terminal
   *       delivery error.</li>
   *   <li>HTTP 409 + application/json WITHOUT `status: "DEAD"` — protocol
   *       violation; surface as a generic error (never as locked / dead).</li>
   *   <li>HTTP 200 + application/json — LOCKED authorization denial.</li>
   * </ul>
   *
   * <p>Axios rejects 4xx by default. To prevent HTTP 409 from being
   * turned into an unrelated generic network error before
   * {@link interpretPreviewResponse} can run, we configure
   * {@code validateStatus} to accept the 2xx range (including 202) and
   * 409. All other 4xx codes (401, 403, 404, 500, …) remain real axios
   * errors and are re-thrown so the hook's catch path can map them to
   * {@code kind: "error"}.</p>
   *
   * <p>This helper never falls back to {@code Document.fileUrl} for paid
   * documents, never logs the token, and never persists the blob.</p>
   *
   * @param {string} documentId
   * @param {{ signal?: AbortSignal, validateStatus?: (status:number)=>boolean }} [options]
   * @returns {Promise<PreviewBlobResult>}
   */
  async getDocumentPreview(documentId, options = {}) {
    // The secure preview endpoint contract:
    //   - 200 application/pdf → FULL or LIMITED PDF bytes.
    //   - 200 application/json LOCKED → existing business authorization
    //     denial (kind: locked).
    //   - 202 application/json → safe waiting-state descriptor
    //     (kind: waiting).
    //   - 409 application/json DEAD → terminal delivery error
    //     (kind: dead). This MUST be distinct from a 200 LOCKED
    //     business denial.
    //   - 401 / 403 / 500 → real axios errors that propagate to the
    //     hook's catch path; they do NOT become locked / dead /
    //     waiting states.
    //
    // The exact validateStatus used by this helper:
    //
    //   (status) => (status >= 200 && status < 300) || status === 409
    //
    // 202 is included via the 2xx range, so it reaches the
    // interpreter as a successful waiting response. 401, 403, and
    // 500 stay real errors and stop polling.
    const defaultValidateStatus = (status) =>
      (status >= 200 && status < 300) || status === 409;
    const config = {
      responseType: "blob",
      validateStatus: typeof options.validateStatus === "function"
        ? options.validateStatus
        : defaultValidateStatus,
      ...(options.signal ? { signal: options.signal } : {}),
    };
    const res = await axiosClient.get(
      `/documents/${documentId}/preview`,
      config
    );
    return interpretPreviewResponse(res);
  },

  async bookmark(documentId) {
    const res = await axiosClient.post(`/bookmarks/${documentId}`);
    return unwrapApiResponse(res);
  },
  async unbookmark(documentId) {
    const res = await axiosClient.delete(`/bookmarks/${documentId}`);
    return unwrapApiResponse(res);
  },
  async getMyBookmarks(page = 0, size = 10) {
    const res = await axiosClient.get("/bookmarks/me", {
      params: { page, size },
    });
    return unwrapApiResponse(res);
  },
  async getMyDocuments() {
    const res = await axiosClient.get("/my-documents");
    return unwrapApiResponse(res);
  },
  /** Chi tiết tài liệu của chính user (có rejectReason, documentUrl Supabase). */
  async getMyDocumentDetail(documentId) {
    const res = await axiosClient.get(`/my-documents/${documentId}`);
    return unwrapApiResponse(res);
  },
  /** Thông tin Auto Quiz của một tài liệu thuộc về owner. */
  async getMyDocumentAutoQuiz(documentId) {
    const res = await axiosClient.get(`/my-documents/${documentId}/auto-quiz`);
    return unwrapApiResponse(res);
  },
  /** Danh sách Quiz từ tài liệu của người dùng hiện tại. */
  async getMyDocumentQuizzes(page = 0, size = 10) {
    const res = await axiosClient.get("/my-documents/quizzes", {
      params: { page, size },
    });
    return unwrapApiResponse(res);
  },
  async createMyDocument(payload) {
    const res = await axiosClient.post("/my-documents", payload);
    return unwrapApiResponse(res);
  },
  /**
   * Phase S1-C2: request a Supabase signed-upload target for a PAID document.
   *
   * <p>POSTs {@code /api/my-documents/storage/paid-upload-target} with ONLY
   * the file metadata that the backend is willing to receive. The response
   * carries {@code uploadId, bucket, path, token, expiresAt} as resolved by
   * the backend — the frontend must NEVER fabricate bucket/path/token.
   *
   * <p>Auth and 401-refresh are handled by the shared {@link axiosClient}
   * interceptor, so no extra header plumbing is needed.
   *
   * <p>The optional {@link client} parameter exists so unit tests can
   * inject a stub without spinning up an axios interceptor; production
   * callers MUST omit it.
   *
   * @param {{ fileName: string, mimeType: string, sizeBytes: number }} input
   * @param {{ post: (url: string, body: any) => Promise<any> }} [client]
   * @returns {Promise<{
   *   uploadId: string,
   *   bucket: string,
   *   path: string,
   *   token: string,
   *   expiresAt: string
   * }>}
   */
  async createPaidUploadTarget(input, client = axiosClient) {
    const fileName = typeof input?.fileName === "string" ? input.fileName.trim() : "";
    const mimeType = typeof input?.mimeType === "string" ? input.mimeType.trim() : "";
    const sizeBytesRaw = input?.sizeBytes;
    const sizeBytes =
      typeof sizeBytesRaw === "number" && Number.isFinite(sizeBytesRaw) ? sizeBytesRaw : NaN;

    if (!fileName) throw new Error("Thiếu tên tệp khi tạo paid upload target.");
    if (!mimeType) throw new Error("Thiếu MIME type khi tạo paid upload target.");
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || !Number.isInteger(sizeBytes)) {
      throw new Error("Kích thước tệp không hợp lệ khi tạo paid upload target.");
    }

    const res = await client.post("/my-documents/storage/paid-upload-target", {
      fileName,
      mimeType,
      sizeBytes,
    });
    const data = unwrapApiResponse(res);

    // Strict response shape — never trust a token that doesn't look like one.
    if (!data || typeof data !== "object") {
      throw new Error("Phản hồi paid upload target không hợp lệ.");
    }
    const uploadId = typeof data.uploadId === "string" ? data.uploadId : data.uploadId?.toString?.();
    const bucket = typeof data.bucket === "string" ? data.bucket : "";
    const path = typeof data.path === "string" ? data.path : "";
    const token = typeof data.token === "string" ? data.token : "";
    const expiresAt = typeof data.expiresAt === "string" ? data.expiresAt : "";
    if (!uploadId || !bucket || !path || !token) {
      throw new Error("Phản hồi paid upload target thiếu trường bắt buộc.");
    }
    return { uploadId, bucket, path, token, expiresAt };
  },
  async updateMyDocument(documentId, payload) {
    const res = await axiosClient.put(`/my-documents/${documentId}`, payload);
    return unwrapApiResponse(res);
  },
  async deleteMyDocument(documentId) {
    const res = await axiosClient.delete(`/my-documents/${documentId}`);
    return unwrapApiResponse(res);
  },
  async reportDocument(documentId, payload) {
    const res = await axiosClient.post(`/documents/${documentId}/report`, payload);
    return unwrapApiResponse(res);
  },
  async getReportedDocuments(status, page = 0, size = 10) {
    const res = await axiosClient.get("/admin/documents/reports", {
      params: { status, page, size },
    });
    return unwrapApiResponse(res);
  },
  async resolveDocumentReport(reportId) {
    const res = await axiosClient.patch(`/admin/documents/reports/${reportId}/resolve`);
    return unwrapApiResponse(res);
  },
  async dismissDocumentReport(reportId) {
    const res = await axiosClient.patch(`/admin/documents/reports/${reportId}/dismiss`);
    return unwrapApiResponse(res);
  },
};

export const commentService = {
  /** @param {string} documentId */
  async getComments(documentId, page = 0) {
    const res = await axiosClient.get(`/documents/${documentId}/comments`, {
      params: { page },
    });
    return unwrapApiResponse(res);
  },
  /** @param {string} commentId */
  async getReplies(commentId) {
    const res = await axiosClient.get(`/comments/${commentId}/replies`);
    return unwrapApiResponse(res);
  },
  /** @param {string} documentId @param {string} body */
  async postComment(documentId, body) {
    const res = await axiosClient.post(`/documents/${documentId}/comments`, {
      body,
    });
    return unwrapApiResponse(res);
  },
  /** @param {string} parentCommentId @param {string} body */
  async postReply(parentCommentId, body) {
    const res = await axiosClient.post(`/comments/${parentCommentId}/reply`, {
      body,
    });
    return unwrapApiResponse(res);
  },
  /** @param {string} commentId */
  async voteComment(commentId, voteType = "UPVOTE") {
    const res = await axiosClient.post(`/comments/${commentId}/vote?type=${voteType}`);
    return unwrapApiResponse(res);
  },
  /** @param {string} commentId */
  async toggleLike(commentId) {
    return this.voteComment(commentId, "UPVOTE");
  },
};

export const paymentService = {
  async getMyHistory() {
    const res = await axiosClient.get("/payments/my-history");
    return unwrapApiResponse(res);
  },

  /**
   * Phase C.1C: create a payment for a paid document the buyer has not yet
   * purchased. The backend is the source of truth for {@code amount}
   * (derived from {@code Document.price}), so the request body only carries
   * the document id.
   *
   * <p>Strict response validation is the caller's job — this service
   * intentionally only unwraps the envelope and returns the raw payload.
   * See {@link validateCreatePaymentResponse} below.
   */
  async createPayment(documentId) {
    if (typeof documentId !== "string" || !documentId.trim()) {
      throw new Error("Document id không hợp lệ.");
    }
    const res = await axiosClient.post("/payments/create", {
      documentId: documentId.trim(),
    });
    return unwrapApiResponse(res);
  },
};

/**
 * Phase C.1C: strict validator for the create-payment response payload.
 * Accepts ONLY the exact backend contract:
 *
 * <ul>
 *   <li>{@code paymentId} — non-empty string.</li>
 *   <li>{@code orderCode} — non-empty string.</li>
 *   <li>{@code checkoutUrl} — non-empty string; URL-safe per PayOS contract.</li>
 *   <li>{@code amount} — finite positive integer.</li>
 *   <li>{@code paymentUrl} — optional legacy alias of checkoutUrl; accepted
 *       only when checkoutUrl is missing and the value passes the same URL
 *       check.</li>
 * </ul>
 *
 * Returns the validated payload so the caller can read whichever fields
 * it needs without re-validating. Returns `null` when ANY required field
 * is missing or invalid (does not throw).
 */
export function validateCreatePaymentResponse(raw) {
  if (!raw || typeof raw !== "object") return null;
  const paymentIdRaw = raw.paymentId;
  const orderCodeRaw = raw.orderCode;
  const checkoutUrlRaw = raw.checkoutUrl;
  const paymentUrlRaw = raw.paymentUrl;
  const amountRaw = raw.amount;

  const paymentId = typeof paymentIdRaw === "string" ? paymentIdRaw.trim() : "";
  const orderCode = typeof orderCodeRaw === "string" ? orderCodeRaw.trim() : "";
  const checkoutUrlCandidate =
    typeof checkoutUrlRaw === "string" ? checkoutUrlRaw.trim() : "";
  const paymentUrlCandidate =
    typeof paymentUrlRaw === "string" ? paymentUrlRaw.trim() : "";

  if (!paymentId) return null;
  if (!orderCode) return null;

  let resolvedCheckoutUrl = "";
  if (checkoutUrlCandidate) {
    resolvedCheckoutUrl = isPayOsSafeUrl(checkoutUrlCandidate) ? checkoutUrlCandidate : "";
  }
  if (!resolvedCheckoutUrl && paymentUrlCandidate) {
    // Legacy alias fallback — only when checkoutUrl is missing AND the
    // legacy value passes the same URL check.
    resolvedCheckoutUrl = isPayOsSafeUrl(paymentUrlCandidate) ? paymentUrlCandidate : "";
  }
  if (!resolvedCheckoutUrl) return null;

  if (
    typeof amountRaw !== "number" ||
    !Number.isFinite(amountRaw) ||
    !Number.isInteger(amountRaw) ||
    amountRaw <= 0
  ) {
    return null;
  }

  return {
    paymentId,
    orderCode,
    checkoutUrl: resolvedCheckoutUrl,
    amount: amountRaw,
  };
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isPayOsSafeUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    return false;
  }
  // PayOS checkout is an external HTTPS redirect. Reject every other
  // protocol (http, javascript, data, file, blob, protocol-relative).
  if (parsed.protocol !== "https:") return false;
  if (typeof parsed.hostname !== "string" || parsed.hostname.trim().length === 0) {
    return false;
  }
  // Reject protocol-relative payloads that survived URL parsing by
  // accident (defensive: hostname would still be set, but the URL would
  // look internal — block anything that is not a real https://host/path).
  if (parsed.username || parsed.password) return false;
  return true;
}

export const quizService = {
  async getQuizPreview(quizId) {
    const res = await axiosClient.get(`/quizzes/${quizId}/preview`);
    return unwrapApiResponse(res);
  },
  async startQuiz(quizId) {
    const res = await axiosClient.post(`/quizzes/${quizId}/start`);
    return unwrapApiResponse(res);
  },
  async submitQuiz(body) {
    const res = await axiosClient.post(`/quizzes/submit`, body);
    return unwrapApiResponse(res);
  },
  async getQuizResult(attemptId) {
    const res = await axiosClient.get(`/quizzes/attempts/${attemptId}`);
    return unwrapApiResponse(res);
  },
  /** @param {{ page?: number, size?: number }} params */
  async getQuizHistory(params = {}) {
    const res = await axiosClient.get("/quizzes/history", { params });
    return unwrapApiResponse(res);
  },
  /**
   * Owner-only. Returns the full quiz payload including the correct-answer
   * flag on each option. Only the document owner is allowed to call this.
   */
  async getOwnerQuizEditor(quizId) {
    const res = await axiosClient.get(`/my-quizzes/${quizId}/editor`);
    return unwrapApiResponse(res);
  },
  /** Owner-only. Replaces the editable subset of the quiz atomically. */
  async saveOwnerQuizEditor(quizId, payload) {
    const res = await axiosClient.put(`/my-quizzes/${quizId}/editor`, payload);
    return unwrapApiResponse(res);
  },
};

export async function getComments(documentId, page) {
  return commentService.getComments(documentId, page);
}

export async function getReplies(commentId) {
  return commentService.getReplies(commentId);
}

export async function postComment(documentId, body) {
  return commentService.postComment(documentId, body);
}

export async function postReply(parentCommentId, body) {
  return commentService.postReply(parentCommentId, body);
}

export async function toggleLike(commentId) {
  return commentService.toggleLike(commentId);
}

// Base message (reusable): prompt auth then redirect
export function requireAuthOrPrompt({ isAuthenticated, navigate, redirectTo }) {
  if (isAuthenticated) return true;

  const goLogin = window.confirm(
    "Bạn cần đăng nhập để thực hiện thao tác này.\n\nNhấn OK để đi tới trang Đăng nhập."
  );
  if (goLogin) {
    const next = redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : "";
    navigate(`/login${next}`);
    return false;
  }

  const goSignUp = window.confirm(
    "Bạn chưa có tài khoản?\n\nNhấn OK để đi tới trang Đăng ký."
  );
  if (goSignUp) {
    const next = redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : "";
    navigate(`/sign-up${next}`);
  }
  return false;
}

export function getApiErrorMessage(err) {
  return toErrorMessage(err);
}

/**
 * Minimum paid-document price in VND. Must stay in sync with backend
 * `DocumentUpdateRequestDto.MIN_PAID_DOCUMENT_PRICE` (3,000 VND).
 *
 * <p>Floor is derived from the contributor-net requirement: after a 10%
 * platform fee the contributor must net at least 2,700 VND. With
 * {@code platformFee = Math.floor(price * 10 / 100)} and
 * {@code sellerNet = price - platformFee}, the smallest integer
 * {@code price} giving {@code sellerNet >= 2700} is 3,000
 * (fee = 300, net = 2,700).
 *
 * <p>Legacy documents priced below this minimum under the previous 2,222 VND
 * floor are accepted on the read paths (owner list / owner detail) and on
 * metadata-only updates; the minimum-vs-pricing-changed rule is enforced by
 * `getValidatedUpdatePrice` and by `DocumentServiceImpl#updateDocument`.
 */
export const MIN_PAID_DOCUMENT_PRICE = 3000;

export const MIN_PAID_DOCUMENT_PRICE_VALIDATION_MESSAGE =
  "Giá bán tài liệu có phí phải từ 3.000 VND trở lên.";

export const EDIT_PRICING_DATA_INVALID_MESSAGE =
  "Dữ liệu giá bán tài liệu không hợp lệ.";

export const EDIT_DOCUMENT_DATA_ERROR_MESSAGE =
  "Không thể chỉnh sửa vì thông tin tài liệu chưa đầy đủ. Vui lòng tải lại trang hoặc liên hệ quản trị viên.";

/** Error code thrown by helpers below; callers branch on `err.code`. */
export const EDIT_ERROR_CODES = Object.freeze({
  PRICING_INVALID: "EDIT_PRICING_INVALID",
  DATA_INVALID: "EDIT_DOCUMENT_DATA_INVALID",
  NOT_FOUND: "EDIT_NOT_FOUND",
  FORBIDDEN: "EDIT_FORBIDDEN",
  NETWORK: "EDIT_NETWORK_ERROR",
});

export function createEditError(code, message) {
  const err = new Error(message);
  err.code = code;
  err.isEditError = true;
  return err;
}

/**
 * Strict type guard for the pricing-lock payload returned by the owner-detail
 * endpoint. Accepts ONLY the exact boolean (for {@code pricingLocked}) and a
 * finite non-negative integer (for {@code successfulPurchaseCount}); any other
 * type (null, undefined, "true", 1, "1", -1, NaN, ...) is treated as invalid
 * and the lock data is reported as unavailable so the UI can fail-closed
 * without rejecting the entire edit payload.
 *
 * <p>This is intentionally separate from {@link normalizeEditPricing}: that
 * helper validates the immutable price shape used to round-trip a metadata
 * edit, while this helper validates the runtime lock status used to decide
 * whether the contributor can still change pricing.
 */
export function normalizeLockData(pricingLockedRaw, successfulPurchaseCountRaw) {
  const lockedValid = typeof pricingLockedRaw === "boolean";
  const countValid =
    typeof successfulPurchaseCountRaw === "number" &&
    Number.isFinite(successfulPurchaseCountRaw) &&
    Number.isInteger(successfulPurchaseCountRaw) &&
    successfulPurchaseCountRaw >= 0;

  if (!lockedValid || !countValid) {
    return {
      pricingLockDataValid: false,
      pricingLocked: null,
      successfulPurchaseCount: null,
    };
  }
  return {
    pricingLockDataValid: true,
    pricingLocked: pricingLockedRaw === true,
    successfulPurchaseCount: successfulPurchaseCountRaw,
  };
}

/**
 * Strict type guard for the pricing section of the owner-detail response.
 *
 * <p>Accepts ONLY the exact boolean values; any other type (null, undefined,
 * "true", 1, etc.) is treated as invalid and fails closed. Does NOT enforce
 * {@link MIN_PAID_DOCUMENT_PRICE} here — legacy prices below the minimum are
 * still a valid shape, and the UI must be able to render / round-trip them
 * for metadata-only edits. Returns {@code isLegacyBelowMinimum} so callers
 * can decide whether to display a legacy warning.
 */
export function normalizeEditPricing(isPaidRaw, priceRaw) {
  if (isPaidRaw === true) {
    if (
      typeof priceRaw !== "number" ||
      !Number.isFinite(priceRaw) ||
      !Number.isInteger(priceRaw) ||
      priceRaw <= 0
    ) {
      throw createEditError(EDIT_ERROR_CODES.PRICING_INVALID, EDIT_PRICING_DATA_INVALID_MESSAGE);
    }
    return {
      isPaid: true,
      price: priceRaw,
      isLegacyBelowMinimum: priceRaw < MIN_PAID_DOCUMENT_PRICE,
    };
  }
  if (isPaidRaw === false) {
    if (priceRaw === null || priceRaw === undefined || priceRaw === 0) {
      return { isPaid: false, price: 0, isLegacyBelowMinimum: false };
    }
    throw createEditError(EDIT_ERROR_CODES.PRICING_INVALID, EDIT_PRICING_DATA_INVALID_MESSAGE);
  }
  throw createEditError(EDIT_ERROR_CODES.PRICING_INVALID, EDIT_PRICING_DATA_INVALID_MESSAGE);
}

function isNonBlankString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Strict validator for the full PUT payload required by `DocumentUpdateRequestDto`.
 * Throws `EDIT_DOCUMENT_DATA_INVALID` on the first missing/invalid field.
 * NO fallbacks — empty values are not coerced into valid ones.
 *
 * <p>Pricing is now sourced from the owner-detail response (which carries
 * {@code isPaid} and {@code price} after Phase C.1B1). The previous public-detail
 * round-trip has been removed; this validator no longer needs a `publicDetail`
 * argument.
 */
export function validateEditDocument(myDetail) {
  if (!myDetail || typeof myDetail !== "object") {
    throw createEditError(EDIT_ERROR_CODES.DATA_INVALID, EDIT_DOCUMENT_DATA_ERROR_MESSAGE);
  }
  if (!isNonBlankString(myDetail.id)) {
    throw createEditError(EDIT_ERROR_CODES.DATA_INVALID, EDIT_DOCUMENT_DATA_ERROR_MESSAGE);
  }
  if (!isNonBlankString(myDetail.title)) {
    throw createEditError(EDIT_ERROR_CODES.DATA_INVALID, EDIT_DOCUMENT_DATA_ERROR_MESSAGE);
  }
  if (!isNonBlankString(myDetail.description)) {
    throw createEditError(EDIT_ERROR_CODES.DATA_INVALID, EDIT_DOCUMENT_DATA_ERROR_MESSAGE);
  }
  if (!isNonBlankString(myDetail.categoryName)) {
    throw createEditError(EDIT_ERROR_CODES.DATA_INVALID, EDIT_DOCUMENT_DATA_ERROR_MESSAGE);
  }
  if (!isNonBlankString(myDetail.documentUrl)) {
    throw createEditError(EDIT_ERROR_CODES.DATA_INVALID, EDIT_DOCUMENT_DATA_ERROR_MESSAGE);
  }
  if (!isNonBlankString(myDetail.thumbnailUrl)) {
    throw createEditError(EDIT_ERROR_CODES.DATA_INVALID, EDIT_DOCUMENT_DATA_ERROR_MESSAGE);
  }
  if (!isNonBlankString(myDetail.fileName)) {
    throw createEditError(EDIT_ERROR_CODES.DATA_INVALID, EDIT_DOCUMENT_DATA_ERROR_MESSAGE);
  }
  const fileSizeBytes = myDetail.fileSizeBytes;
  if (
    typeof fileSizeBytes !== "number" ||
    !Number.isFinite(fileSizeBytes) ||
    !Number.isInteger(fileSizeBytes) ||
    fileSizeBytes < 0
  ) {
    throw createEditError(EDIT_ERROR_CODES.DATA_INVALID, EDIT_DOCUMENT_DATA_ERROR_MESSAGE);
  }
  const tags = myDetail.tags;
  if (!Array.isArray(tags) || tags.length === 0) {
    throw createEditError(EDIT_ERROR_CODES.DATA_INVALID, EDIT_DOCUMENT_DATA_ERROR_MESSAGE);
  }
  for (const t of tags) {
    if (typeof t !== "string" || !t.trim()) {
      throw createEditError(EDIT_ERROR_CODES.DATA_INVALID, EDIT_DOCUMENT_DATA_ERROR_MESSAGE);
    }
  }

  const pricing = normalizeEditPricing(myDetail.isPaid, myDetail.price);
  const lockData = normalizeLockData(myDetail.pricingLocked, myDetail.successfulPurchaseCount);

  return {
    id: myDetail.id,
    title: myDetail.title,
    description: myDetail.description,
    category: myDetail.categoryName,
    tags,
    documentUrl: myDetail.documentUrl,
    thumbnailUrl: myDetail.thumbnailUrl,
    fileName: myDetail.fileName,
    fileSizeBytes,
    isPaid: pricing.isPaid,
    price: pricing.price,
    isLegacyBelowMinimum: pricing.isLegacyBelowMinimum === true,
    storagePath: null,
    pricingLocked: lockData.pricingLocked,
    successfulPurchaseCount: lockData.successfulPurchaseCount,
    pricingLockDataValid: lockData.pricingLockDataValid === true,
  };
}

/**
 * Shared edit-loader. Fetches the owner detail (`/api/my-documents/{id}`)
 * — which now exposes `isPaid` and `price` directly — and runs fail-closed
 * validation. The resolved value is the exact `documentToEdit` shape
 * consumed by `UploadDocument`.
 *
 * <p>Phase C.1B1 simplified this from a {@code Promise.all} against both the
 * owner-detail and the public-detail endpoints to a single owner-detail call,
 * since the owner detail now carries the same pricing fields.
 *
 * <p>Throws `Error` with `code` ∈ EDIT_ERROR_CODES on any failure. NEVER falls
 * back to Free on missing pricing, and NEVER coerces invalid paid prices.
 */
export async function loadDocumentForEdit(documentId) {
  if (!isNonBlankString(documentId)) {
    throw createEditError(EDIT_ERROR_CODES.DATA_INVALID, EDIT_DOCUMENT_DATA_ERROR_MESSAGE);
  }
  let myDetail;
  try {
    myDetail = await documentService.getMyDocumentDetail(documentId);
  } catch (err) {
    const status = err?.response?.status;
    if (status === 404) {
      throw createEditError(EDIT_ERROR_CODES.NOT_FOUND, "Không tìm thấy tài liệu.");
    }
    if (status === 403) {
      throw createEditError(EDIT_ERROR_CODES.FORBIDDEN, "Bạn không có quyền chỉnh sửa tài liệu này.");
    }
    throw createEditError(
      EDIT_ERROR_CODES.NETWORK,
      err?.response?.data?.message || err?.message || "Không thể tải thông tin tài liệu."
    );
  }
  return validateEditDocument(myDetail);
}

/**
 * Strict validator for the **create** path. Paid requests must meet the
 * 3,000 VND minimum; free always returns 0. Runs BEFORE any Supabase upload
 * or backend API call so a bad paid price never creates storage garbage and
 * never silently coerces to 3,000.
 */
export function getValidatedCreatePrice(isPaid, price) {
  if (isPaid === false) {
    return 0;
  }
  if (isPaid !== true) {
    throw new Error("Trạng thái giá tài liệu không hợp lệ.");
  }
  if (
    typeof price !== "number" ||
    !Number.isFinite(price) ||
    !Number.isInteger(price) ||
    price < MIN_PAID_DOCUMENT_PRICE
  ) {
    throw new Error(MIN_PAID_DOCUMENT_PRICE_VALIDATION_MESSAGE);
  }
  return price;
}

/**
 * Strict validator for the **update** path. Same shape guard as the create
 * helper, but the minimum-vs-pricing-changed rule is more permissive: a
 * legacy paid price below the minimum is allowed to round-trip as long as
 * the request does not change pricing (e.g. metadata-only PUT). When the
 * request does change pricing to a new paid value below 3,000, the same
 * minimum error as create is thrown.
 *
 * <p>Inputs are strict:
 * <ul>
 *   <li>{@code isPaid} must be the boolean {@code true} or {@code false}.</li>
 *   <li>Paid {@code price} must be a strictly positive integer.</li>
 *   <li>Free {@code price} is ignored — output is 0.</li>
 * </ul>
 *
 * @param {object} args
 * @param {boolean} args.isPaid
 * @param {number|undefined|null} args.price
 * @param {boolean} args.initialIsPaid - Paid flag stored on the document
 *   before this update. Pass {@code false} for create flows.
 * @param {number} args.initialPrice - Price stored on the document before
 *   this update; ignored unless {@code initialIsPaid === true}.
 * @returns {number} The validated price (0 for free).
 */
export function getValidatedUpdatePrice({ isPaid, price, initialIsPaid, initialPrice }) {
  if (isPaid === false) {
    return 0;
  }
  if (isPaid !== true) {
    throw new Error("Trạng thái giá tài liệu không hợp lệ.");
  }
  if (
    typeof price !== "number" ||
    !Number.isFinite(price) ||
    !Number.isInteger(price) ||
    price <= 0
  ) {
    throw new Error(EDIT_PRICING_DATA_INVALID_MESSAGE);
  }

  const normalizedInitialIsPaid = initialIsPaid === true;
  const normalizedInitialPrice =
    normalizedInitialIsPaid && typeof initialPrice === "number" && Number.isFinite(initialPrice)
      ? initialPrice
      : 0;

  const pricingChanged =
    normalizedInitialIsPaid !== isPaid || normalizedInitialPrice !== price;

  if (pricingChanged && price < MIN_PAID_DOCUMENT_PRICE) {
    throw new Error(MIN_PAID_DOCUMENT_PRICE_VALIDATION_MESSAGE);
  }

  return price;
}

/**
 * @deprecated Use {@link getValidatedCreatePrice} or {@link getValidatedUpdatePrice}.
 * Kept as a thin alias to the create helper so any out-of-tree callers do not
 * break during this transition. Will be removed once the upload module is
 * updated to call the two new helpers directly.
 */
export const getValidatedPaidPrice = getValidatedCreatePrice;

