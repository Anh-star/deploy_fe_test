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

/**
 * Tải file qua fetch (có Bearer nếu đang có token), trigger download trình duyệt, không mở tab mới.
 * @param {string} fileUrl
 * @param {string} [suggestedFileName]
 */
export async function downloadFileViaFetch(fileUrl, suggestedFileName) {
  const headers = {};
  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(fileUrl, { method: "GET", headers });

  if (!response.ok) {
    throw new Error(`Không tải được file (${response.status}).`);
  }

  const fromHeader = parseFilenameFromContentDisposition(
    response.headers.get("Content-Disposition")
  );
  const filename = (fromHeader || suggestedFileName || "").trim();

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
  async createMyDocument(payload) {
    const res = await axiosClient.post("/my-documents", payload);
    return unwrapApiResponse(res);
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

