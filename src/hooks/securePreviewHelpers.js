/**
 * Pure, side-effect-free helpers that encode the secure-preview
 * wire contract. These are imported by BOTH {@link useSecureDocumentPreview}
 * and the test suite so the tests exercise the real production
 * policy, not a copied re-implementation.
 *
 * <h2>Wire contract</h2>
 *
 * The secure binary preview endpoint {@code GET /api/documents/{id}/preview}
 * answers with the following statuses:
 *
 * <ul>
 *   <li>200 application/pdf (FULL or LIMITED) — {@code kind: "pdf"} with a
 *       Blob. The hook decodes the Blob into an ArrayBuffer.</li>
 *   <li>200 application/json LOCKED — {@code kind: "locked"} (business
 *       denial; may render the buy CTA).</li>
 *   <li>202 application/json — {@code kind: "waiting"} with
 *       {@code previewState} in {PENDING, PROCESSING, RETRY}.</li>
 *   <li>409 application/json whose body has {@code status: "DEAD"} —
 *       {@code kind: "dead"} (terminal delivery error).</li>
 *   <li>409 application/json without {@code status: "DEAD"} — a protocol
 *       violation; {@code kind: "error"}.</li>
 *   <li>401 / 403 / 500 — axios rejects. Mapped to {@code kind: "error"}.</li>
 * </ul>
 *
 * <h2>Polling policy</h2>
 *
 * <ul>
 *   <li>Polling stops on terminal kinds ({@code pdf}, {@code locked},
 *       {@code dead}, {@code error}).</li>
 *   <li>Polling continues only for {@code waiting} with a polling-eligible
 *       {@code previewState} (PENDING / PROCESSING / RETRY).</li>
 *   <li>401 / 403 / 500 schedule zero follow-up timers. Manual refresh
 *       may issue exactly one new operator-initiated request.</li>
 * </ul>
 *
 * <h2>Component presentation</h2>
 *
 * {@link getSecurePreviewPresentation} maps the final normalized result
 * into the JSX rendering flags used by {@link SecureDocumentPreview}.
 * Every branch returns the complete presentation shape.
 */

// ─────────────────────────────────────────────────────────────────
// validateStatus — exact whitelist required by Phase O4B final
// ─────────────────────────────────────────────────────────────────

/**
 * Axios `validateStatus` for the secure binary preview endpoint.
 * Accepts 2xx (including 202) and 409 only.
 *
 * @param {number} status
 * @returns {boolean}
 */
export function securePreviewValidateStatus(status) {
  return (status >= 200 && status < 300) || status === 409;
}

// ─────────────────────────────────────────────────────────────────
// normalizeSecurePreviewResult — single final async normalizer
//
// This is the ONLY function that may decode a Blob into an ArrayBuffer.
// The raw service result may contain Blob; the final result never does.
// ─────────────────────────────────────────────────────────────────

/**
 * Final async normalizer for secure preview raw results.
 * Converts raw Blob to ArrayBuffer for PDF results.
 * Only returns kind "pdf" after Blob is decoded and verified.
 *
 * @param {any} rawResult
 * @returns {Promise<{
 *   kind: "pdf"|"waiting"|"locked"|"dead"|"error",
 *   mode: "FULL"|"LIMITED"|"LOCKED"|null,
 *   previewState: "PENDING"|"PROCESSING"|"RETRY"|"READY"|"DEAD"|null,
 *   pdfBuffer: ArrayBuffer|null,
 *   message: string|null,
 *   retryable: boolean
 * }>}
 */
export async function normalizeSecurePreviewResult(rawResult) {
  if (!rawResult || typeof rawResult !== "object") {
    return {
      kind: "error",
      mode: null,
      previewState: null,
      pdfBuffer: null,
      message: "Phản hồi bản xem trước không hợp lệ",
      retryable: false,
    };
  }

  switch (rawResult.kind) {
    case "pdf": {
      const mode = rawResult.mode;
      if (mode !== "FULL" && mode !== "LIMITED") {
        return {
          kind: "error",
          mode: null,
          previewState: null,
          pdfBuffer: null,
          message: "Phản hồi bản xem trước không hợp lệ",
          retryable: false,
        };
      }
      if (!(rawResult.blob instanceof Blob)) {
        return {
          kind: "error",
          mode: null,
          previewState: null,
          pdfBuffer: null,
          message: "Phản hồi bản xem trước không hợp lệ",
          retryable: false,
        };
      }
      if (typeof rawResult.blob.arrayBuffer !== "function") {
        return {
          kind: "error",
          mode: null,
          previewState: null,
          pdfBuffer: null,
          message: "Phản hồi bản xem trước không hợp lệ",
          retryable: false,
        };
      }
      let decoded;
      try {
        decoded = await rawResult.blob.arrayBuffer();
      } catch {
        return {
          kind: "error",
          mode: null,
          previewState: null,
          pdfBuffer: null,
          message: "Phản hồi bản xem trước không hợp lệ",
          retryable: false,
        };
      }
      if (!(decoded instanceof ArrayBuffer)) {
        return {
          kind: "error",
          mode: null,
          previewState: null,
          pdfBuffer: null,
          message: "Phản hồi bản xem trước không hợp lệ",
          retryable: false,
        };
      }
      return {
        kind: "pdf",
        mode,
        previewState: "READY",
        pdfBuffer: decoded,
        message: null,
        retryable: false,
      };
    }

    case "waiting": {
      const ps = rawResult.previewState;
      if (ps !== "PENDING" && ps !== "PROCESSING" && ps !== "RETRY") {
        return {
          kind: "error",
          mode: null,
          previewState: null,
          pdfBuffer: null,
          message: "Phản hồi bản xem trước không hợp lệ",
          retryable: false,
        };
      }
      const message =
        typeof rawResult.message === "string" && rawResult.message
          ? rawResult.message
          : null;
      return {
        kind: "waiting",
        mode: null,
        previewState: ps,
        pdfBuffer: null,
        message,
        retryable: rawResult.retryable === true,
      };
    }

    case "locked": {
      const message =
        typeof rawResult.message === "string" && rawResult.message
          ? rawResult.message
          : "Vui lòng mua tài liệu để có thể xem bản full";
      return {
        kind: "locked",
        mode: "LOCKED",
        previewState: null,
        pdfBuffer: null,
        message,
        retryable: false,
      };
    }

    case "dead": {
      const message =
        typeof rawResult.message === "string" && rawResult.message
          ? rawResult.message
          : "Bản xem trước không khả dụng";
      return {
        kind: "dead",
        mode: null,
        previewState: "DEAD",
        pdfBuffer: null,
        message,
        retryable: false,
      };
    }

    case "error": {
      const message =
        typeof rawResult.message === "string" && rawResult.message
          ? rawResult.message
          : "Đã xảy ra lỗi";
      return {
        kind: "error",
        mode: null,
        previewState: null,
        pdfBuffer: null,
        message,
        retryable: false,
      };
    }

    default:
      return {
        kind: "error",
        mode: null,
        previewState: null,
        pdfBuffer: null,
        message: "Phản hồi bản xem trước không hợp lệ",
        retryable: false,
      };
  }
}

// ─────────────────────────────────────────────────────────────────
// Normalize an axios error into the unified `error` kind. The only
// axios errors we expect for the secure binary endpoint are 401, 403
// and 500 — all other statuses are rejected by validateStatus. We
// still treat the result defensively.
// ─────────────────────────────────────────────────────────────────

/**
 * Convert a rejected axios error into the unified error result.
 *
 * Returns `null` for cancellation (component unmount / abort) so
 * that transient unmounts do NOT surface an error to the user.
 *
 * @param {any} err
 * @returns {{kind: "error", mode: null, previewState: null, pdfBuffer: null, message: string, retryable: boolean} | null}
 */
export function normalizeSecurePreviewError(err) {
  if (!err) return null;
  if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") {
    return null;
  }
  const status = err?.response?.status;
  if (status === 401 || status === 403) {
    return {
      kind: "error",
      mode: null,
      previewState: null,
      pdfBuffer: null,
      message: "Phiên truy cập đã hết hạn hoặc không đủ quyền",
      retryable: false,
    };
  }
  if (status === 500) {
    return {
      kind: "error",
      mode: null,
      previewState: null,
      pdfBuffer: null,
      message: "Máy chủ đang gặp sự cố. Vui lòng thử lại sau.",
      retryable: false,
    };
  }
  return {
    kind: "error",
    mode: null,
    previewState: null,
    pdfBuffer: null,
    message:
      typeof err?.message === "string" && err.message
        ? err.message
        : "Đã xảy ra lỗi kết nối",
    retryable: false,
  };
}

// ─────────────────────────────────────────────────────────────────
// Terminal + polling helpers
// ─────────────────────────────────────────────────────────────────

/**
 * A normalized result is terminal if no further polling is needed.
 *
 * @param {{kind: string}|null|undefined} result
 * @returns {boolean}
 */
export function isSecurePreviewTerminal(result) {
  if (!result) return false;
  return (
    result.kind === "pdf" ||
    result.kind === "locked" ||
    result.kind === "dead" ||
    result.kind === "error"
  );
}

/**
 * A normalized result requires another poll if and only if it is
 * a waiting state whose previewState is one of PENDING, PROCESSING
 * or RETRY.
 *
 * @param {{kind: string, previewState?: string|null}|null|undefined} result
 * @returns {boolean}
 */
export function shouldPollSecurePreview(result) {
  if (!result) return false;
  if (result.kind !== "waiting") return false;
  const ps =
    typeof result.previewState === "string" ? result.previewState : null;
  return ps === "PENDING" || ps === "PROCESSING" || ps === "RETRY";
}

// ─────────────────────────────────────────────────────────────────
// Adaptive polling cadence for the secure preview endpoint.
//
// The cadence is intentionally a pure function so the polling
// policy can be unit-tested without instantiating React hooks or
// mocking timers. The phase-1 speed budget maps elapsed-milliseconds
// since the FIRST poll of the current session to the next delay:
//
//   elapsedMs < 15_000   →  1_000 ms
//   elapsedMs < 30_000   →  2_000 ms
//   elapsedMs ≥ 30_000   →  3_000 ms
//
// After READY / DEAD / LOCKED / error the hook clears the timer
// before this function is ever called again, so the cadence is
// only consulted while the result is a waiting state.
// ─────────────────────────────────────────────────────────────────

/**
 * Map elapsed-since-first-poll milliseconds to the next poll delay.
 *
 * The function is floor-clamped at 1_000 ms and ceiling-clamped at
 * 3_000 ms so a manual override in the future cannot degrade the
 * responsiveness. Negative `elapsedMs` is treated as 0.
 *
 * @param {number} elapsedMs
 * @returns {number} delay in ms; one of 1000 | 2000 | 3000.
 */
export function computeAdaptiveCadenceMs(elapsedMs) {
  const safe = typeof elapsedMs === "number" && Number.isFinite(elapsedMs) && elapsedMs > 0
    ? elapsedMs
    : 0;
  if (safe < 15000) return 1000;
  if (safe < 30000) return 2000;
  return 3000;
}

/**
 * @param {number} documentId - update the session start when the
 *   document changes (route change A → B).
 * @returns {number} tolerance used by the cadence policy.
 */
export const ADAPTIVE_CADENCE_STEP_MS = 1000;

// ─────────────────────────────────────────────────────────────────
// Component presentation helper
//
// This is the SINGLE place where the final normalized result is
// mapped to the JSX rendering flags used by SecureDocumentPreview.
// Every branch returns the complete presentation shape.
// ─────────────────────────────────────────────────────────────────

/**
 * Maps the final normalized result and loading flag into the JSX
 * rendering decision. Only ever receives final normalized data.
 *
 * @param {object|null|undefined} preview
 * @param {boolean} loading
 * @returns {{
 *   kind: "pdf"|"waiting"|"locked"|"dead"|"error"|null,
 *   previewState: "PENDING"|"PROCESSING"|"RETRY"|null,
 *   showLoading: boolean,
 *   showViewer: boolean,
 *   showWaiting: boolean,
 *   showDead: boolean,
 *   showLocked: boolean,
 *   showError: boolean,
 *   viewerMode: "FULL"|"LIMITED"|null,
 *   pdfBuffer: ArrayBuffer|null,
 *   allowBuyCta: boolean,
 *   message: string|null
 * }}
 */
export function getSecurePreviewPresentation(preview, loading) {
  if (loading || !preview) {
    return {
      kind: null,
      previewState: null,
      showLoading: true,
      showViewer: false,
      showWaiting: false,
      showDead: false,
      showLocked: false,
      showError: false,
      viewerMode: null,
      pdfBuffer: null,
      allowBuyCta: false,
      message: null,
    };
  }

  const kind = preview.kind;

  // ── pdf ──────────────────────────────────────────────────────
  if (kind === "pdf") {
    const validPdf =
      preview.pdfBuffer instanceof ArrayBuffer &&
      (preview.mode === "FULL" || preview.mode === "LIMITED");
    if (validPdf) {
      return {
        kind: "pdf",
        previewState: null,
        showLoading: false,
        showViewer: true,
        showWaiting: false,
        showDead: false,
        showLocked: false,
        showError: false,
        viewerMode: preview.mode,
        pdfBuffer: preview.pdfBuffer,
        allowBuyCta: false,
        message: null,
      };
    }
    return {
      kind: "error",
      previewState: null,
      showLoading: false,
      showViewer: false,
      showWaiting: false,
      showDead: false,
      showLocked: false,
      showError: true,
      viewerMode: null,
      pdfBuffer: null,
      allowBuyCta: false,
      message: "Phản hồi bản xem trước không hợp lệ",
    };
  }

  // ── waiting ─────────────────────────────────────────────────
  if (kind === "waiting") {
    const validWaiting =
      preview.previewState === "PENDING" ||
      preview.previewState === "PROCESSING" ||
      preview.previewState === "RETRY";
    if (validWaiting) {
      return {
        kind: "waiting",
        previewState: preview.previewState,
        showLoading: false,
        showViewer: false,
        showWaiting: true,
        showDead: false,
        showLocked: false,
        showError: false,
        viewerMode: null,
        pdfBuffer: null,
        allowBuyCta: false,
        message: preview.message ?? null,
      };
    }
    return {
      kind: "error",
      previewState: null,
      showLoading: false,
      showViewer: false,
      showWaiting: false,
      showDead: false,
      showLocked: false,
      showError: true,
      viewerMode: null,
      pdfBuffer: null,
      allowBuyCta: false,
      message: "Phản hồi bản xem trước không hợp lệ",
    };
  }

  // ── locked ───────────────────────────────────────────────────
  if (kind === "locked") {
    return {
      kind: "locked",
      previewState: null,
      showLoading: false,
      showViewer: false,
      showWaiting: false,
      showDead: false,
      showLocked: true,
      showError: false,
      viewerMode: null,
      pdfBuffer: null,
      allowBuyCta: true,
      message: preview.message ?? null,
    };
  }

  // ── dead ─────────────────────────────────────────────────────
  if (kind === "dead") {
    return {
      kind: "dead",
      previewState: null,
      showLoading: false,
      showViewer: false,
      showWaiting: false,
      showDead: true,
      showLocked: false,
      showError: false,
      viewerMode: null,
      pdfBuffer: null,
      allowBuyCta: false,
      message: preview.message ?? null,
    };
  }

  // ── error ────────────────────────────────────────────────────
  if (kind === "error") {
    return {
      kind: "error",
      previewState: null,
      showLoading: false,
      showViewer: false,
      showWaiting: false,
      showDead: false,
      showLocked: false,
      showError: true,
      viewerMode: null,
      pdfBuffer: null,
      allowBuyCta: false,
      message: preview.message ?? null,
    };
  }

  // ── unknown kind ─────────────────────────────────────────────
  return {
    kind: "error",
    previewState: null,
    showLoading: false,
    showViewer: false,
    showWaiting: false,
    showDead: false,
    showLocked: false,
    showError: true,
    viewerMode: null,
    pdfBuffer: null,
    allowBuyCta: false,
    message: "Phản hồi bản xem trước không hợp lệ",
  };
}
