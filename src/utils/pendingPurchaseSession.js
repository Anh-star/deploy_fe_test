/**
 * Pending-purchase session helper.
 *
 * <p>Lưu context cho luồng mua tài liệu — không bao gồm token,
 * refresh token, checkout URL, QR code, orderCode, paymentId, amount
 * hay bất kỳ thông tin nhạy cảm nào.
 *
 * <p>Tại sao helper này tồn tại:
 *  - Public DocumentDetail dùng helper để ghi context trước khi
 *    redirect sang PayOS checkout.
 *  - PaymentSuccessPage dùng helper để đọc context để biết
 *    documentId nào cần poll access + tải file.
 *  - PaymentCancelPage dùng helper để clear context sau khi user
 *    hủy giao dịch.
 *
 * <p>Fail-closed: helper KHÔNG throw ra ngoài — chỉ trả null hoặc
 * ghi sessionStorage với giá trị đã sanitize. JSON hỏng, thiếu field,
 * sai kiểu, quá TTL đều bị coi là mất context và clear luôn.
 */

const SESSION_KEY = "studyit.payment.pendingPurchase";

/** TTL 24 giờ (ms). Context quá hạn bị coi là hỏng và clear. */
const PENDING_PURCHASE_TTL_MS = 24 * 60 * 60 * 1000;

/** Pattern UUID v4-style / v1-style được backend dùng. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PENDING_PURCHASE_STORAGE_KEY = SESSION_KEY;

/**
 * Chỉ chấp nhận internal relative path:
 *  - Bắt đầu bằng đúng một dấu "/".
 *  - Không bắt đầu bằng "//".
 *  - Không chứa backslash.
 *  - Resolve về cùng origin với window.location.origin.
 *  - Không chứa control characters.
 *
 * @param {unknown} raw
 * @returns {string|null} internal path an toàn hoặc null nếu reject.
 */
export function sanitizeInternalReturnUrl(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Reject protocol schemes.
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:")
  ) {
    return null;
  }

  // Reject backslashes (một số trình duyệt hiểu \\foo là //foo).
  if (trimmed.includes("\\")) return null;

  // Reject control characters.
  for (let i = 0; i < trimmed.length; i += 1) {
    const code = trimmed.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return null;
  }

  // Bắt đầu bằng đúng một "/", không phải "//".
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null;

  // Resolve về window.location.origin. Không dùng được khi SSR; helper
  // này chỉ chạy ở browser.
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(trimmed, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    // Reconstruct path + search để tránh URL mang hash từ phía input.
    let safe = url.pathname + url.search;
    if (!safe.startsWith("/")) safe = `/${safe}`;
    return safe || "/";
  } catch {
    return null;
  }
}

/**
 * Validate documentId theo UUID format project đang dùng.
 * @param {unknown} raw
 * @returns {string|null}
 */
export function sanitizeDocumentId(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!UUID_PATTERN.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

/**
 * @typedef {Object} PendingPurchase
 * @property {string} documentId
 * @property {string} returnUrl
 * @property {number} purchaseStartedAt
 */

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isFinitePositiveInteger(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value > 0
  );
}

/**
 * @param {unknown} value
 * @returns {value is PendingPurchase}
 */
function isValidPendingPurchaseShape(value) {
  if (!value || typeof value !== "object") return false;
  const obj = value;
  const docId = sanitizeDocumentId(obj.documentId);
  if (!docId) return false;
  const returnUrl = sanitizeInternalReturnUrl(obj.returnUrl);
  if (!returnUrl) return false;
  if (!isFinitePositiveInteger(obj.purchaseStartedAt)) return false;
  return true;
}

/**
 * Ghi pending purchase context. Trả `true` nếu ghi thành công, `false`
 * nếu input bị reject (không throw). Helper này KHÔNG throw — gọi an
 * toàn từ handler/UI handler.
 *
 * @param {object} input
 * @param {string} input.documentId
 * @param {string} input.returnUrl
 * @param {number} [input.purchaseStartedAt] Mặc định `Date.now()`.
 * @returns {boolean}
 */
export function savePendingPurchase(input) {
  if (typeof window === "undefined") return false;
  const docId = sanitizeDocumentId(input?.documentId);
  if (!docId) return false;
  const returnUrl = sanitizeInternalReturnUrl(input?.returnUrl);
  if (!returnUrl) return false;
  const purchaseStartedAt =
    typeof input?.purchaseStartedAt === "number" &&
    Number.isFinite(input.purchaseStartedAt)
      ? Math.floor(input.purchaseStartedAt)
      : Date.now();
  const payload = {
    documentId: docId,
    returnUrl,
    purchaseStartedAt,
  };
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Đọc pending purchase context.
 *
 * - Trả `null` nếu session không có hoặc giá trị hỏng.
 * - Tự động clear nếu JSON hỏng, thiếu field, sai kiểu, quá TTL.
 * - Không throw.
 *
 * @returns {PendingPurchase|null}
 */
export function readPendingPurchase() {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearPendingPurchase();
    return null;
  }
  if (!isValidPendingPurchaseShape(parsed)) {
    clearPendingPurchase();
    return null;
  }
  // Re-derive sanitized values to guarantee types.
  const documentId = sanitizeDocumentId(parsed.documentId);
  const returnUrl = sanitizeInternalReturnUrl(parsed.returnUrl);
  if (!documentId || !returnUrl) {
    clearPendingPurchase();
    return null;
  }
  const purchaseStartedAt = parsed.purchaseStartedAt;
  if (Date.now() - purchaseStartedAt > PENDING_PURCHASE_TTL_MS) {
    clearPendingPurchase();
    return null;
  }
  return { documentId, returnUrl, purchaseStartedAt };
}

/**
 * Xóa pending purchase context. Không throw.
 * @returns {void}
 */
export function clearPendingPurchase() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}