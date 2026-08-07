import { useCallback, useEffect, useMemo } from "react";
import { useSecureDocumentPreview } from "../../hooks/useSecureDocumentPreview";
import { getSecurePreviewPresentation } from "../../hooks/securePreviewHelpers";
import StudyItPdfViewer from "./StudyItPdfViewer";

/**
 * Phase O4B final: shared secure document preview.
 *
 * <p>The component delegates polling, AbortController, fetching
 * and terminal-state detection to {@link useSecureDocumentPreview}.
 * It then calls {@link getSecurePreviewPresentation} to map the
 * final {@code preview} object into rendering flags. The JSX
 * branches on those flags directly — there is no parallel
 * "derived" status enum.</p>
 *
 * <h2>Renderer contract</h2>
 *
 * <ul>
 *   <li>{@code kind: "pdf"} + {@code pdfBuffer instanceof ArrayBuffer}
 *       + valid mode → {@code <StudyItPdfViewer/>}.
 *       FULL and LIMITED both use {@code kind: "pdf"};
 *       {@code viewerMode} differentiates them.</li>
 *   <li>{@code kind: "waiting"} + valid previewState →
 *       waiting panel. Polling only for PENDING / PROCESSING / RETRY
 *       (handled by the hook).</li>
 *   <li>{@code kind: "locked"} → locked UI. Buy CTA only when
 *       {@code allowBuyCta} is true.</li>
 *   <li>{@code kind: "dead"} → "Không thể tạo bản xem trước".
 *       No buy CTA, no viewer.</li>
 *   <li>{@code kind: "error"} → error panel. No buy CTA, no
 *       viewer. Manual refresh allowed.</li>
 * </ul>
 *
 * waiting / locked / dead / error NEVER carry a pdfBuffer. The
 * viewer mount condition is checked by the renderer, not asserted
 * via state plumbing.
 */
export default function SecureDocumentPreview({
  documentId,
  fileType,
  fileName,
  isPaid = false,
  status,
  publicFileUrl,
  renderBuyCta,
  className,
  isAuthenticated: externalIsAuthenticated,
  formattedPrice: formattedPriceProp,
  onLoginRequested,
  onDownloadRequested,
  onPrintRequested,
  /**
   * Optional callback fired when the preview state transitions to
   * DEAD. The parent can decide whether to surface additional
   * recovery actions.
   */
  onDeadPreview,
}) {
  const { preview, loading, refresh } = useSecureDocumentPreview(documentId);

  // ─────────────────────────────────────────────────────────────────
  // Single point of presentation conversion. The renderer branches
  // directly on `presentation.show*` flags.
  // ─────────────────────────────────────────────────────────────────
  const presentation = getSecurePreviewPresentation(preview, loading);

  const limitedViewerAuth = useMemo(() => {
    if (typeof externalIsAuthenticated === "boolean") {
      return externalIsAuthenticated;
    }
    try {
      return Boolean(window?.localStorage?.getItem("accessToken"));
    } catch {
      return false;
    }
  }, [externalIsAuthenticated]);

  const limitedViewerPrice = useMemo(() => {
    if (typeof formattedPriceProp === "string" && formattedPriceProp) {
      return formattedPriceProp;
    }
    return "";
  }, [formattedPriceProp]);

  const handleLimitedPurchase = useCallback(
    (payload) => {
      if (typeof renderBuyCta === "function") {
        renderBuyCta(payload);
      }
    },
    [renderBuyCta]
  );

  const handleLimitedLogin = useCallback(
    (payload) => {
      if (typeof onLoginRequested === "function") {
        onLoginRequested(payload);
      }
    },
    [onLoginRequested]
  );

  const renderStudyItPdf = (buffer, viewerMode) => (
    <div
      className="secure-document-preview-inner secure-document-preview-pdf"
      data-mode={viewerMode}
    >
      <StudyItPdfViewer
        arrayBuffer={buffer}
        mode={viewerMode}
        documentId={documentId}
        fileName={fileName}
        formattedPrice={limitedViewerPrice}
        isAuthenticated={limitedViewerAuth}
        onDownload={
          viewerMode === "FULL" && typeof onDownloadRequested === "function"
            ? () => onDownloadRequested({ documentId, fileName })
            : undefined
        }
        onPrint={
          viewerMode === "FULL" && typeof onPrintRequested === "function"
            ? () => onPrintRequested({ documentId, fileName })
            : undefined
        }
        onPurchase={handleLimitedPurchase}
        onLogin={handleLimitedLogin}
      />
    </div>
  );

  /**
   * @param {string|null} validatedPreviewState — already validated by
   *   getSecurePreviewPresentation; only PENDING / PROCESSING / RETRY
   *   reaches this renderer.
   */
  const renderWaiting = (validatedPreviewState) => {
    // Single canonical message regardless of validatedPreviewState.
    // The block previously showed a clock icon + per-state label
    // ("Đang chuyển đổi DOC/DOCX sang PDF" / "Hệ thống đang thử xử
    // lý lại" / "Đang chờ tạo bản xem trước") at the upper-left of the
    // preview area while another "Đang tải bản xem trước…" was shown
    // in the centre, producing two simultaneous loading messages on
    // the Contributor submitted detail page. The fix collapses all
    // three states into ONE centred spinner + ONE canonical text.
    void validatedPreviewState;
    return (
      <div
        className="secure-document-preview-waiting"
        role="status"
        data-state={validatedPreviewState || "PENDING"}
      >
        <div className="secure-document-preview-waiting-spinner" aria-hidden="true">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2a10 10 0 0 1 10 10" opacity="0.3" />
            <path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
        </div>
        <p className="secure-document-preview-waiting-title">
          Đang tải bản xem trước…
        </p>
      </div>
    );
  };

  const renderDead = () => (
    <div
      className="secure-document-preview-dead"
      role="alert"
      data-renderer="DEAD"
    >
      <p className="secure-document-preview-dead-title">
        Không thể tạo bản xem trước
      </p>
      <p className="secure-document-preview-dead-message">
        {presentation.message || "Bản xem trước DOC/DOCX không khả dụng."}
      </p>
      <button type="button" onClick={refresh}>
        Thử lại
      </button>
    </div>
  );

  const renderLocked = () => {
    const defaultMessage =
      presentation.message ||
      "Vui lòng mua tài liệu để có thể xem bản full";
    const showBuyCta =
      presentation.allowBuyCta && typeof renderBuyCta === "function";
    return (
      <div className="secure-document-preview-locked" role="status">
        <p className="secure-document-preview-locked-message">{defaultMessage}</p>
        {showBuyCta ? (
          <div className="secure-document-preview-locked-cta">
            {renderBuyCta({ reason: presentation.message })}
          </div>
        ) : null}
      </div>
    );
  };

  const renderLoading = () => (
    <div
      className="secure-document-preview-loading"
      aria-live="polite"
      data-renderer="LOADING"
    >
      <div className="secure-document-preview-loading-spinner" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a10 10 0 0 1 10 10" opacity="0.3" />
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
      </div>
      <p className="secure-document-preview-loading-text">
        Đang tải bản xem trước…
      </p>
    </div>
  );

  const renderError = () => (
    <div className="secure-document-preview-error" role="alert">
      <p>{presentation.message || "Đã xảy ra lỗi"}</p>
      <button type="button" onClick={refresh}>
        Thử lại
      </button>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────
  // Branch on presentation flags in the required order.
  // ─────────────────────────────────────────────────────────────────
  let body;
  if (presentation.showLoading) {
    body = renderLoading();
  } else if (presentation.showViewer) {
    body = renderStudyItPdf(presentation.pdfBuffer, presentation.viewerMode);
  } else if (presentation.showWaiting) {
    body = renderWaiting(presentation.previewState);
  } else if (presentation.showDead) {
    body = renderDead();
  } else if (presentation.showLocked) {
    body = renderLocked();
  } else if (presentation.showError) {
    body = renderError();
  } else {
    // Defensive fallback — malformed input never reaches renderWaiting,
    // but this guards against any future gaps.
    body = renderError();
  }

  // Fire onDeadPreview once per dead transition.
  const deadFlag = presentation.showDead;
  useEffect(() => {
    if (deadFlag && typeof onDeadPreview === "function") {
      try {
        onDeadPreview({ message: presentation.message });
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadFlag, presentation.message]);

  return (
    <div
      className={
        "secure-document-preview" + (className ? ` ${className}` : "")
      }
      data-status={status || ""}
      data-mode={presentation.viewerMode || ""}
      data-renderer={
        presentation.showWaiting
          ? "WAITING"
          : presentation.showDead
            ? "DEAD"
            : presentation.showViewer
              ? "PDF"
              : presentation.showLocked
                ? "LOCKED"
                : presentation.showError
                  ? "ERROR"
                  : presentation.showLoading
                    ? "LOADING"
                    : "UNKNOWN"
      }
    >
      {body}
    </div>
  );
}
