import React from "react";
import "../../styles/admin/adminComponents.css";

/**
 * Derives whether a moderator can approve an Office document.
 * The decision is driven entirely by the backend `fullStatus` field.
 *
 * @param {import('../api/types/documentPreview').DocumentPreviewStatus|null} status
 * @returns {'CAN_APPROVE'|'CANNOT_APPROVE'|'NOT_OFFICE'|null}
 */
export function computeApprovalStatus(status) {
  if (!status) return null;
  if (!status.officeDocument) return "NOT_OFFICE";
  if (status.fullStatus === "READY") return "CAN_APPROVE";
  return "CANNOT_APPROVE";
}

/**
 * Vietnamese label for each artifact status.
 * Unknown statuses are handled safely — no crash.
 */
const STATUS_LABELS = {
  PENDING: "Đang chờ tạo bản xem trước",
  PROCESSING: "Đang chuyển đổi DOC/DOCX sang PDF",
  READY: "Bản xem trước đã sẵn sàng",
  RETRY: "Hệ thống đang thử xử lý lại",
  DEAD: "Không thể tạo bản xem trước",
};

/** @param {string|null|undefined} status */
function statusLabel(status) {
  if (!status) return "—";
  return STATUS_LABELS[status] ?? status;
}

/** @param {string|null|undefined} lastError */
function shortError(lastError) {
  if (!lastError) return null;
  return lastError.trim();
}

// Inline SVG spinner — no emoji, no external dependency.
function SpinnerIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 2a10 10 0 0 1 10 10" opacity="0.3" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

// Inline SVG alert icon.
function AlertIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

// Inline SVG check icon.
function CheckIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * Renders a status badge for an artifact status.
 * @param {{ status: string|null|undefined, variant?: 'pending'|'processing'|'ready'|'retry'|'dead' }} props
 */
function ArtifactStatusBadge({ status, variant }) {
  const v = variant ?? "pending";
  return (
    <span className={`preview-status-badge preview-status-badge--${v}`}>
      {v === "processing" || v === "pending" ? (
        <SpinnerIcon size={12} />
      ) : v === "ready" ? (
        <CheckIcon size={12} />
      ) : (
        <AlertIcon size={12} />
      )}
      {statusLabel(status)}
    </span>
  );
}

/**
 * Preview status indicator for the moderator review page.
 *
 * Shows the async Office-to-PDF conversion state while it is
 * PENDING, PROCESSING, or RETRY; shows the READY confirmation when
 * the artifact is ready; shows a bounded failure message when DEAD.
 *
 * The parent component uses this to display the status badge and
 * decide whether the approve button is enabled.
 *
 * Props:
 *   status  — the resolved DocumentPreviewStatus object (null while loading)
 *   loading — true while the initial fetch is in flight
 *   httpError — error message string when polling exhausted retries
 *   onRefresh — called when the user clicks "Làm mới"
 *
 * @param {{
 *   status: import('../api/types/documentPreview').DocumentPreviewStatus|null,
 *   loading: boolean,
 *   httpError: string|null,
 *   onRefresh: () => void,
 * }} props
 */
export default function DocumentPreviewStatusIndicator({
  status,
  loading,
  httpError,
  onRefresh,
}) {
  if (!status && loading) {
    return (
      <div className="preview-status-indicator preview-status-indicator--loading" role="status" aria-live="polite">
        <SpinnerIcon size={14} />
        <span>Đang kiểm tra trạng thái bản xem trước…</span>
      </div>
    );
  }

  if (!status && !loading) {
    return null; // No document ID yet — nothing to show.
  }

  const { officeDocument, fullStatus, lastError } = status;

  // Non-Office document — no preview status to show.
  if (!officeDocument) {
    return null;
  }

  // HTTP / network error after exhausting retries.
  if (httpError) {
    return (
      <div className="preview-status-indicator preview-status-indicator--error" role="alert">
        <AlertIcon size={14} />
        <span className="preview-status-indicator__message">{httpError}</span>
        <button type="button" className="preview-status-indicator__refresh" onClick={onRefresh}>
          Làm mới
        </button>
      </div>
    );
  }

  // Terminal states.
  if (fullStatus === "READY") {
    return (
      <div
        className="preview-status-indicator preview-status-indicator--ready"
        role="status"
        aria-live="polite"
      >
        <ArtifactStatusBadge status={fullStatus} variant="ready" />
      </div>
    );
  }

  if (fullStatus === "DEAD") {
    return (
      <div
        className="preview-status-indicator preview-status-indicator--dead"
        role="alert"
        aria-live="assertive"
      >
        <ArtifactStatusBadge status={fullStatus} variant="dead" />
        {lastError ? (
          <p className="preview-status-indicator__error-detail">
            {shortError(lastError)}
          </p>
        ) : null}
        <button type="button" className="preview-status-indicator__refresh" onClick={onRefresh}>
          Làm mới
        </button>
      </div>
    );
  }

  // Active states: PENDING / PROCESSING / RETRY.
  const variant = fullStatus === "RETRY" ? "retry" : fullStatus === "PROCESSING" ? "processing" : "pending";

  return (
    <div
      className="preview-status-indicator preview-status-indicator--active"
      role="status"
      aria-live="polite"
    >
      <ArtifactStatusBadge status={fullStatus} variant={variant} />
    </div>
  );
}
