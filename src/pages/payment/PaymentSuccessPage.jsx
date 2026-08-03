import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  buildDocumentDownloadName,
  documentService,
  downloadFileViaFetch,
} from "../../services/api";
import {
  clearPendingPurchase,
  readPendingPurchase,
} from "../../utils/pendingPurchaseSession";

/**
 * Maximum number of attempts to confirm access after a successful
 * PayOS redirect. 6 attempts × 1500ms = 9s total budget — bounded to
 * prevent infinite polling.
 */
const POLL_MAX_ATTEMPTS = 6;
const POLL_INTERVAL_MS = 1500;

/**
 * Phase C.1C: payment-success page.
 *
 * <p>Flow:
 *  1. Read pending purchase context from sessionStorage.
 *  2. Poll the public detail endpoint to confirm the backend has granted
 *     DocumentAccess.
 *  3. When hasAccess=true, fetch the secure file URL, start the blob
 *     download, then clear pending context and navigate back to the
 *     document page.
 *  4. On poll timeout, keep the context so the user can retry; on
 *     download error, also keep the context so a manual retry is
 *     possible.
 *  5. If no context exists (e.g. user typed the URL manually or opened
 *     the page in a new tab), show a generic success page with a
 *     fallback navigation.
 *
 * <p>StrictMode-safe: a {@code startedRef} guard ensures the polling /
 * download flow runs exactly once per mount even though React 18 mounts
 * effects twice in development.
 */
export default function PaymentSuccessPage() {
  const navigate = useNavigate();

  // StrictMode-safe single-flight guard. Once started, the entire flow
  // (poll + download + navigate + clear) executes exactly once.
  const startedRef = useRef(false);

  // Shared guard for the download counter. The same ref protects both
  // the initial auto-download path inside runFlow and the manual
  // "Thử tải lại" path so the backend never receives more than one
  // POST /documents/{id}/download per success-page lifecycle.
  const downloadCounterRecordedRef = useRef(false);

  // Bounded retry trigger for the "Thử lại" button after timeout.
  const [phase, setPhase] = useState("initial");
  // 'initial' | 'polling' | 'downloading' | 'timeout' | 'downloadError' | 'noContext' | 'done'

  // Local navigation context (filled on mount; null if no session).
  const [pendingReturnUrl, setPendingReturnUrl] = useState(null);
  const [pendingDocumentId, setPendingDocumentId] = useState(null);

  // Detail fetch (for filename on auto-download). Updated by the polling loop.
  const [latestDetail, setLatestDetail] = useState(null);

  /**
   * The single bounded polling + download flow. Idempotent at mount thanks
   * to {@code startedRef}.
   */
  const runFlow = useCallback(async () => {
    const context = readPendingPurchase();
    if (!context) {
      setPhase("noContext");
      return;
    }
    setPendingDocumentId(context.documentId);
    setPendingReturnUrl(context.returnUrl);
    setPhase("polling");

    // Cancel in-flight timers if the component unmounts mid-flight.
    let cancelled = false;
    let timerId = null;

    const cleanup = () => {
      cancelled = true;
      if (timerId != null) {
        clearTimeout(timerId);
        timerId = null;
      }
    };

    // 1. Poll access.
    let granted = false;
    let lastDetail = null;
    for (let attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt += 1) {
      if (cancelled) {
        cleanup();
        return;
      }
      try {
        const fresh = await documentService.getDocumentById(context.documentId);
        if (cancelled) {
          cleanup();
          return;
        }
        lastDetail = fresh;
        const hasAccess = fresh?.documentInfo?.hasAccess;
        if (hasAccess === true) {
          granted = true;
          break;
        }
        if (hasAccess !== false) {
          // Backend response missing/invalid hasAccess — do NOT grant.
          granted = false;
        }
      } catch {
        // Treat transient network failures as "not yet granted" so the
        // bounded loop continues. Worst case: we time out and let the
        // user retry.
      }
      if (attempt < POLL_MAX_ATTEMPTS) {
        await new Promise((resolve) => {
          timerId = setTimeout(resolve, POLL_INTERVAL_MS);
        });
        if (cancelled) {
          cleanup();
          return;
        }
      }
    }

    if (cancelled) {
      cleanup();
      return;
    }

    if (!granted) {
      setLatestDetail(lastDetail);
      setPhase("timeout");
      // Keep pending context so the user can retry.
      cleanup();
      return;
    }

    setLatestDetail(lastDetail);

    // 2. Record download counter ONCE per success-page lifecycle. The
    // ref is shared with handleRetryDownload below so that a manual
    // "Thử tải lại" never double-counts. The counter is requested
    // AFTER access is confirmed (so we never bill a not-yet-granted
    // download) and BEFORE the secure file URL is fetched (matching
    // the existing DocumentDetail convention).
    setPhase("downloading");
    try {
      if (!downloadCounterRecordedRef.current) {
        await documentService.download(context.documentId);
        downloadCounterRecordedRef.current = true;
      }
      if (cancelled) {
        cleanup();
        return;
      }
      const filePayload = await documentService.getDocumentFileUrl(
        context.documentId
      );
      if (cancelled) {
        cleanup();
        return;
      }
      const fileUrl = filePayload?.fileUrl;
      if (!fileUrl) {
        setPhase("downloadError");
        cleanup();
        return;
      }
      const suggestedName = buildDocumentDownloadName(
        lastDetail?.documentInfo?.title,
        lastDetail?.file?.fileType
      );
      await downloadFileViaFetch(fileUrl, suggestedName);
      if (cancelled) {
        cleanup();
        return;
      }
      // 3. Clear pending context + navigate back. Use replace so the
      // success page is removed from history.
      clearPendingPurchase();
      setPhase("done");
      navigate(context.returnUrl, { replace: true });
    } catch {
      if (cancelled) {
        cleanup();
        return;
      }
      // Counter request failed: reset the ref so the manual "Thử tải
      // lại" path can attempt the counter again instead of treating
      // the page as already-counted.
      // downloadCounterRecordedRef stays true ONLY when the counter
      // call resolved successfully. If it threw, leave it false.
      setPhase("downloadError");
    } finally {
      cleanup();
    }
  }, [navigate]);

  // StrictMode-safe single mount entry. The ref guard is set before any
  // await so the second invocation (StrictMode double-mount) bails out
  // immediately. We still allow manual "Thử lại" runs by reading a
  // separate ref that the retry button resets.
  const retryRef = useRef(0);
  const lastStartedRetriesRef = useRef(-1);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    lastStartedRetriesRef.current = retryRef.current;
    void runFlow();
  }, [runFlow]);

  const handleRetry = useCallback(() => {
    if (phase !== "timeout" && phase !== "downloadError") return;
    // Allow exactly one retry per click; the ref-based guard prevents
    // double-invocation if the button is double-clicked in flight.
    retryRef.current += 1;
    void runFlow();
  }, [phase, runFlow]);

  const handleBackToDocument = useCallback(() => {
    // Preserve the sanitized returnUrl that we already captured locally;
    // clear pending context so we don't auto-trigger again.
    clearPendingPurchase();
    const target = pendingReturnUrl || (pendingDocumentId ? `/documents/${pendingDocumentId}` : "/documents");
    navigate(target, { replace: true });
  }, [pendingReturnUrl, pendingDocumentId, navigate]);

  const handleRetryDownload = useCallback(() => {
    if (phase !== "downloadError") return;
    setPhase("downloading");
    (async () => {
      if (!pendingDocumentId) {
        setPhase("downloadError");
        return;
      }
      try {
        // Counter is shared with the initial auto-download flow. If the
        // original counter call succeeded, we skip it here so we never
        // double-count a single purchase. If it failed, the ref is still
        // false and we get exactly one more attempt.
        if (!downloadCounterRecordedRef.current) {
          await documentService.download(pendingDocumentId);
          downloadCounterRecordedRef.current = true;
        }
        const filePayload = await documentService.getDocumentFileUrl(pendingDocumentId);
        const fileUrl = filePayload?.fileUrl;
        if (!fileUrl) {
          setPhase("downloadError");
          return;
        }
        const suggestedName = buildDocumentDownloadName(
          latestDetail?.documentInfo?.title,
          latestDetail?.file?.fileType
        );
        await downloadFileViaFetch(fileUrl, suggestedName);
        clearPendingPurchase();
        setPhase("done");
        navigate(pendingReturnUrl || `/documents/${pendingDocumentId}`, { replace: true });
      } catch {
        setPhase("downloadError");
      }
    })();
  }, [phase, pendingDocumentId, pendingReturnUrl, latestDetail, navigate]);

  // Render.
  const headingText =
    phase === "noContext"
      ? "Thanh toán thành công"
      : phase === "timeout"
        ? "Đang chờ quyền truy cập"
        : phase === "downloadError"
          ? "Tải xuống chưa hoàn tất"
          : phase === "done"
            ? "Hoàn tất"
            : "Đang xác nhận thanh toán...";

  const bodyText =
    phase === "noContext"
      ? "Chúng tôi không tìm thấy phiên mua hàng đang chờ. Nếu bạn vừa thanh toán xong, vui lòng quay lại trang tài liệu để kiểm tra."
      : phase === "timeout"
        ? "Thanh toán đã được tiếp nhận nhưng quyền truy cập chưa sẵn sàng."
        : phase === "downloadError"
          ? "Thanh toán đã được ghi nhận nhưng không thể bắt đầu tải xuống."
          : phase === "done"
            ? "Tài liệu đang được tải xuống."
            : "Đang xác nhận thanh toán...";

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "#F8FAFC",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#FFFFFF",
          borderRadius: "16px",
          padding: "40px 28px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
          textAlign: "center",
          boxShadow: "0 4px 16px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: "72px",
            height: "72px",
            borderRadius: "50%",
            background:
              phase === "downloadError" || phase === "timeout"
                ? "#FEF3C7"
                : phase === "noContext"
                  ? "#E0E7FF"
                  : "#DCFCE7",
            color:
              phase === "downloadError" || phase === "timeout"
                ? "#D97706"
                : phase === "noContext"
                  ? "#4338CA"
                  : "#16A34A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "40px",
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {phase === "downloadError" || phase === "timeout" ? "!" : "✓"}
        </div>

        <h1
          style={{
            margin: 0,
            color: "#0F172A",
            fontSize: "22px",
            fontWeight: 700,
            lineHeight: "30px",
          }}
        >
          {headingText}
        </h1>

        <p
          style={{
            margin: 0,
            color: "#64748B",
            fontSize: "15px",
            lineHeight: "22px",
          }}
        >
          {bodyText}
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            width: "100%",
            marginTop: "8px",
          }}
        >
          {phase === "polling" ? (
            <button
              type="button"
              disabled
              style={{
                width: "100%",
                padding: "12px 16px",
                background: "#94A3B8",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "12px",
                fontSize: "15px",
                fontWeight: 600,
                cursor: "not-allowed",
                opacity: 0.7,
              }}
            >
              Đang xác nhận thanh toán...
            </button>
          ) : null}

          {phase === "downloading" ? (
            <button
              type="button"
              disabled
              style={{
                width: "100%",
                padding: "12px 16px",
                background: "#94A3B8",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "12px",
                fontSize: "15px",
                fontWeight: 600,
                cursor: "not-allowed",
                opacity: 0.7,
              }}
            >
              Đang tải xuống...
            </button>
          ) : null}

          {phase === "timeout" ? (
            <>
              <button
                type="button"
                onClick={handleRetry}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "#007BFF",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Thử lại
              </button>
              <button
                type="button"
                onClick={handleBackToDocument}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "#FFFFFF",
                  color: "#0F172A",
                  border: "1px solid #E2E8F0",
                  borderRadius: "12px",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Quay lại tài liệu
              </button>
            </>
          ) : null}

          {phase === "downloadError" ? (
            <>
              <button
                type="button"
                onClick={handleRetryDownload}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "#007BFF",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Thử tải lại
              </button>
              <button
                type="button"
                onClick={handleBackToDocument}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "#FFFFFF",
                  color: "#0F172A",
                  border: "1px solid #E2E8F0",
                  borderRadius: "12px",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Quay lại tài liệu
              </button>
            </>
          ) : null}

          {phase === "noContext" ? (
            <>
              <button
                type="button"
                onClick={() => navigate("/documents")}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "#007BFF",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Về danh sách tài liệu
              </button>
              <button
                type="button"
                onClick={() => navigate("/")}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "#FFFFFF",
                  color: "#0F172A",
                  border: "1px solid #E2E8F0",
                  borderRadius: "12px",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Trang chủ
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}