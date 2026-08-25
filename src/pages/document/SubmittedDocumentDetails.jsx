import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useNotification } from "../../context/NotificationContext";
import { documentService, loadDocumentForEdit } from "../../services/api";
import {
  getDocumentThumbnailUrl,
  hasDocumentThumbnailValue,
  onDocumentThumbnailError,
} from "../../utils/documentThumbnail";
import SecureDocumentPreview from "../../components/document/SecureDocumentPreview";
import "../../styles/submittedDocumentDetails.css";

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
);

const Trash2Icon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
);

const ArrowLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"></path></svg>
);

function formatDateTime(value) {
  if (value == null) return "—";
  try {
    let d;
    if (Array.isArray(value)) {
      const [y, mo, day, h = 0, mi = 0, s = 0] = value;
      d = new Date(y, mo - 1, day, h, mi, s);
    } else {
      d = new Date(value);
    }
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatFileSize(bytes) {
  if (bytes == null || bytes === "") return null;
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(n < 10240 ? 0 : 1)} KB`;
  }
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Phase O4B: derive the user-visible extension from the original
 * filename when available. Falling back to the fileType enum keeps
 * the display truthful when the original extension was the only
 * authoritative source.
 */
function displayFileExtension(fileName, fileType) {
  const fromName = typeof fileName === "string"
    ? fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
    : null;
  if (fromName === "docx") return "DOCX";
  if (fromName === "doc") return "DOC";
  if (fromName === "pdf") return "PDF";
  if (fromName === "pptx") return "PPTX";
  if (fromName === "ppt") return "PPT";
  if (typeof fileType === "string" && fileType) {
    return fileType.toUpperCase();
  }
  return null;
}

function formatVnd(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "0";
  return n.toLocaleString("vi-VN");
}

/**
 * Renders the document description with a 3-line CSS clamp by default.
 * Only shows the "Xem thêm" / "Thu gọn" toggle if the text actually
 * overflows (measured via ref + scrollHeight > clientHeight after layout).
 * Toggle uses `type="button"` and no `dangerouslySetInnerHTML`.
 */
function DescriptionCell({ description }) {
  const text = (description || "").trim();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const textRef = useRef(null);

  const measureOverflow = () => {
    const el = textRef.current;
    if (!el) return;
    // 1px tolerance to avoid floating-point rounding false-positives.
    setIsOverflowing(el.scrollHeight - el.clientHeight > 1);
  };

  // Measure on first render and whenever the text changes.
  useLayoutEffect(() => {
    measureOverflow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // Re-measure when window resizes (font / column width can change overflow).
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = () => measureOverflow();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!text) {
    return <span className="submitted-muted">—</span>;
  }

  return (
    <div className="submitted-description-cell">
      <p
        ref={textRef}
        className={`submitted-description${isExpanded ? "" : " submitted-description--clamped"}`}
      >
        {text}
      </p>
      {isOverflowing || isExpanded ? (
        <button
          type="button"
          className="submitted-description-toggle"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          {isExpanded ? "Thu gọn" : "Xem thêm"}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Strict lock-data normaliser for the read-only submitted detail view.
 * Mirrors the FE api.js guard but is duplicated here so this view can
 * render against any raw payload (state-based navigation or directly
 * fetched owner detail) without going through the edit validator.
 */
function normalizeLockDataForDisplay(pricingLockedRaw, successfulPurchaseCountRaw) {
  const lockedValid = typeof pricingLockedRaw === "boolean";
  const countValid =
    typeof successfulPurchaseCountRaw === "number" &&
    Number.isFinite(successfulPurchaseCountRaw) &&
    Number.isInteger(successfulPurchaseCountRaw) &&
    successfulPurchaseCountRaw >= 0;
  if (!lockedValid || !countValid) {
    return { dataValid: false };
  }
  return {
    dataValid: true,
    pricingLocked: pricingLockedRaw === true,
    successfulPurchaseCount: successfulPurchaseCountRaw,
  };
}

/**
 * Owner pricing block. Reads isPaid + price from the normalised document.
 * Phase C.1B1 only renders the gross / fee / net breakdown; pricing-lock
 * status and successful purchase count will be added in Phase C.1B2.
 *
 * <p>Phase C.1B2: also renders the "Trạng thái giá" panel driven by the
 * strict lock-data guard above. Lock data is sourced from the owner
 * detail API, never from location.state.
 */
function PricingSection({ document }) {
  const isPaid = document?.isPaid === true;
  const price = Number(document?.price);
  const safePrice = Number.isFinite(price) && price > 0 ? price : 0;
  const lockData = normalizeLockDataForDisplay(
    document?.pricingLocked,
    document?.successfulPurchaseCount
  );

  const lockBadge =
    !lockData.dataValid
      ? { label: "Chưa xác định", className: "submitted-lock-badge--unknown" }
      : lockData.pricingLocked
        ? { label: "Đã khóa giá", className: "submitted-lock-badge--locked" }
        : { label: "Có thể chỉnh sửa", className: "submitted-lock-badge--editable" };
  const lockNote =
    !lockData.dataValid
      ? "Chưa xác định trạng thái khóa giá."
      : lockData.pricingLocked
        ? "Đã khóa vì tài liệu đã có người mua"
        : "Chưa có lượt mua thành công";
  const purchaseCountLabel = !lockData.dataValid
    ? "Chưa xác định"
    : String(lockData.successfulPurchaseCount);

  const lockPanel = (
    <div className="submitted-lock-panel">
      <div className="submitted-lock-row">
        <span className="submitted-lock-label">Trạng thái giá</span>
        <span className={`submitted-lock-badge ${lockBadge.className}`}>
          {lockBadge.label}
        </span>
      </div>
      <p className="submitted-lock-note">{lockNote}</p>
      <div className="submitted-lock-row">
        <span className="submitted-lock-label">Số lượt mua thành công</span>
        <strong className="submitted-lock-value">{purchaseCountLabel}</strong>
      </div>
    </div>
  );

  if (!isPaid) {
    return (
      <section className="submitted-panel submitted-panel--pricing">
        <h2 className="submitted-panel-title">Giá trị tài liệu</h2>
        <div className="submitted-pricing-free">
          <span className="submitted-pricing-free-badge">Miễn phí</span>
          <p className="submitted-pricing-free-note">
            Tài liệu này được chia sẻ miễn phí cho cộng đồng.
          </p>
        </div>
        {lockPanel}
      </section>
    );
  }

  const platformFee = Math.floor((safePrice * 10) / 100);
  const sellerNet = safePrice - platformFee;

  return (
    <section className="submitted-panel submitted-panel--pricing">
      <h2 className="submitted-panel-title">Giá trị tài liệu</h2>
      <div className="submitted-pricing-grid">
        <div className="submitted-pricing-row">
          <span className="submitted-pricing-label">Người mua thanh toán:</span>
          <strong className="submitted-pricing-value">{formatVnd(safePrice)} ₫</strong>
        </div>
        <div className="submitted-pricing-row">
          <span className="submitted-pricing-label">Phí nền tảng 10%:</span>
          <strong className="submitted-pricing-value">{formatVnd(platformFee)} ₫</strong>
        </div>
        <div className="submitted-pricing-row">
          <span className="submitted-pricing-label">Bạn nhận sau phí:</span>
          <strong className="submitted-pricing-value">{formatVnd(sellerNet)} ₫</strong>
        </div>
      </div>
      {lockPanel}
    </section>
  );
}

function normalizeFromApi(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    documentUrl: raw.documentUrl,
    thumbnailUrl: raw.thumbnailUrl,
    fileName: raw.fileName,
    fileType: raw.fileType,
    fileSizeBytes: raw.fileSizeBytes,
    categoryName: raw.categoryName,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    status: raw.status,
    rejectReason: raw.rejectReason ?? null,
    createdAt: raw.createdAt,
    // Phase C.1B1: owner detail now carries pricing fields directly.
    // Strict boolean + finite positive integer validation; fall through to
    // Free (with explicit false) when the backend omitted them, so the UI
    // renders "Miễn phí" instead of guessing.
    isPaid: raw.isPaid === true,
    price: typeof raw.price === "number" && Number.isFinite(raw.price) ? raw.price : 0,
    // Phase C.1B2: pass-through raw fields. The UI uses these to render the
    // "Trạng thái giá" + "Số lượt mua thành công" panel. We do NOT coerce
    // invalid types here so the panel can render "Chưa xác định" when the
    // backend response is malformed.
    pricingLocked: raw.pricingLocked,
    successfulPurchaseCount: raw.successfulPurchaseCount,
  };
}

function normalizeFromState(d) {
  if (!d) return null;
  return {
    id: d.id,
    title: d.title,
    description: d.description,
    documentUrl: d.documentUrl,
    thumbnailUrl: d.thumbnailUrl,
    fileName: d.fileName,
    fileType: d.fileType,
    fileSizeBytes: d.fileSizeBytes ?? d.fileSize,
    categoryName: d.categoryName || d.category,
    tags: Array.isArray(d.tags) ? d.tags : [],
    status: d.status,
    rejectReason: d.rejectReason ?? null,
    createdAt: d.createdAt ?? d.uploadDate,
    isPaid: d.isPaid === true,
    price: typeof d.price === "number" && Number.isFinite(d.price) ? d.price : 0,
    // Pass-through; will be undefined for legacy state-based navigations.
    pricingLocked: d.pricingLocked,
    successfulPurchaseCount: d.successfulPurchaseCount,
  };
}

function statusMeta(status) {
  const s = (status || "").toUpperCase();
  if (s === "APPROVED") {
    return {
      label: "Đã được duyệt",
      className: "submitted-hero-badge--approved",
      heroClass: "submitted-hero--approved",
    };
  }
  if (s === "REJECTED") {
    return {
      label: "Bị từ chối",
      className: "submitted-hero-badge--rejected",
      heroClass: "submitted-hero--rejected",
    };
  }
  return {
    label: "Đang chờ duyệt",
    className: "submitted-hero-badge--pending",
    heroClass: "submitted-hero--pending",
  };
}

function FilePreviewSection({ documentId, fileUrl, fileType, fileName, status }) {
  return (
    <SecureDocumentPreview
      documentId={documentId}
      fileType={fileType}
      fileName={fileName}
      status={status}
    />
  );
}

const POLLING_INTERVAL_MS = 4000;

const TERMINAL_STATUSES = new Set(["READY", "FAILED", "CANCELLED"]);

const STATUS_LABELS = {
  WAITING_SOURCE: "Đang chuẩn bị tài liệu",
  QUEUED: "Đang chờ tạo",
  PROCESSING: "Đang tạo câu hỏi",
  READY: "Sẵn sàng",
  FAILED: "Tạo thất bại",
  CANCELLED: "Đã hủy",
};

function statusBadgeMeta(status) {
  const s = (status || "").toUpperCase();
  if (s === "WAITING_SOURCE" || s === "QUEUED") {
    return { className: "auto-quiz-status--waiting" };
  }
  if (s === "PROCESSING") {
    return { className: "auto-quiz-status--processing" };
  }
  if (s === "READY") {
    return { className: "auto-quiz-status--ready" };
  }
  if (s === "FAILED") {
    return { className: "auto-quiz-status--failed" };
  }
  if (s === "CANCELLED") {
    return { className: "auto-quiz-status--cancelled" };
  }
  return { className: "auto-quiz-status--waiting" };
}

function AutoQuizGenerationCard({ generation, documentId, marker }) {
  const navigate = useNavigate();

  const status = generation.status;
  const s = (status || "").toUpperCase();
  const badge = statusBadgeMeta(status);

  const handlePreview = () => {
    const quizId = generation.quiz?.quizId;
    if (!quizId) return;
    navigate(`/quiz/${quizId}/preview?from=submitted&documentId=${documentId}`);
  };

  const focusTopic = generation.focusTopic;
  const hasFocus = typeof focusTopic === "string" && focusTopic.trim().length > 0;
  const focusDisplay = hasFocus ? focusTopic.trim() : "Toàn bộ tài liệu";

  const questionCount = generation.quiz?.totalQuestions ?? generation.requestedQuestionCount ?? 0;
  const title = generation.quiz?.title;

  // Phase 7A.4: the FAILED-card "Trọng tâm" line below is preserved
  // verbatim (we never delete history), but when this card has been
  // superseded by any strictly newer generation attempt (regardless
  // of whether that newer attempt itself succeeded, is still in
  // flight, or also failed), we dim its focus row to make it
  // visually obvious that the value is HISTORICAL, not the current
  // configuration the owner is editing. Otherwise the owner could
  // read "ahaha" again on the detail page and believe the retry
  // never happened. The chronology is decided in AutoQuizSection
  // (list[0] = latest; older FAILED rows are marked superseded).
  const superseded = marker === "superseded";
  const isCurrent = marker === "current";

  let innerContent = null;

  if (s === "WAITING_SOURCE" || s === "QUEUED") {
    innerContent = (
      <div className={`auto-quiz-status-badge ${badge.className}`}>
        <div className="auto-quiz-spinner" />
        <span>{STATUS_LABELS[s]}</span>
      </div>
    );
  } else if (s === "PROCESSING") {
    innerContent = (
      <div className={`auto-quiz-status-badge ${badge.className}`}>
        <div className="auto-quiz-spinner" />
        <span>{STATUS_LABELS[s]}</span>
      </div>
    );
  } else if (s === "READY") {
    innerContent = (
      <>
        <div className="auto-quiz-ready-header">
          <span className="auto-quiz-ready-icon">&#10003;</span>
          <span className="auto-quiz-ready-label">{STATUS_LABELS.READY}</span>
        </div>
        <p className="auto-quiz-info">{questionCount} câu hỏi</p>
        <button type="button" className="auto-quiz-preview-btn" onClick={handlePreview}>
          Xem trước
        </button>
      </>
    );
  } else if (s === "FAILED") {
    innerContent = superseded ? (
      <>
        <div className={`auto-quiz-status-badge ${badge.className}`}>
          <span>Không thể tạo bài đánh giá.</span>
        </div>
        <p className="auto-quiz-superseded-detail-note">
          Đã được thay thế bằng một bài đánh giá mới bên dưới. Bài cũ được giữ lại trong lịch sử.
        </p>
      </>
    ) : (
      <div className={`auto-quiz-status-badge ${badge.className}`}>
        <span>Không thể tạo bài đánh giá. Vui lòng thử tạo lại.</span>
      </div>
    );
  } else if (s === "CANCELLED") {
    innerContent = (
      <div className={`auto-quiz-status-badge ${badge.className}`}>
        <span>{STATUS_LABELS.CANCELLED}</span>
      </div>
    );
  }

  const cardClassName =
    "auto-quiz-generation-card"
    + (superseded ? " auto-quiz-generation-card--superseded" : "")
    + (isCurrent ? " auto-quiz-generation-card--current" : "");

  return (
    <div className={cardClassName} key={generation.generationId}>
      <div className="auto-quiz-card-top">
        <div className="auto-quiz-card-title-row">
          <span className="auto-quiz-card-title">
            {title || "Bài đánh giá"}
          </span>
          {isCurrent ? (
            <span className="auto-quiz-current-tag" data-marker="current">
              Hiện tại
            </span>
          ) : null}
          {superseded ? (
            <span className="auto-quiz-superseded-tag" data-marker="superseded">
              Lịch sử
            </span>
          ) : null}
          <span className={`auto-quiz-status-badge ${badge.className}`}>
            {STATUS_LABELS[s] ?? status}
          </span>
        </div>
        <p
          className={
            "auto-quiz-card-focus"
            + (superseded ? " auto-quiz-card-focus--historical" : "")
          }
        >
          Trọng tâm: <strong>{focusDisplay}</strong>
          {superseded ? (
            <span className="auto-quiz-focus-historical-label">
              {" "}— (giá trị lịch sử, không còn là cấu hình hiện hành)
            </span>
          ) : null}
        </p>
      </div>
      <div className="auto-quiz-card-body">{innerContent}</div>
    </div>
  );
}

function AutoQuizSection({ documentId }) {
  const {
    data: generations,
    isLoading,
    isError,
    isFetching,
  } = useQuery({
    queryKey: ["my-document-auto-quizzes", documentId],
    queryFn: () => documentService.getMyDocumentAutoQuizzes(documentId),
    enabled: Boolean(documentId),
    select: (data) => (Array.isArray(data) ? data : []),
    refetchInterval: (query) => {
      const items = query.state.data ?? [];
      const shouldPoll = items.some(
        (item) => !TERMINAL_STATUSES.has(String(item?.status || "").toUpperCase())
      );
      return shouldPoll ? POLLING_INTERVAL_MS : false;
    },
  });

  if (isLoading) {
    return (
      <section className="submitted-panel submitted-panel--auto-quiz">
        <h2 className="submitted-panel-title">Bài đánh giá tự động</h2>
        <div className="auto-quiz-loading">Đang tải...</div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="submitted-panel submitted-panel--auto-quiz">
        <h2 className="submitted-panel-title">Bài đánh giá tự động</h2>
        <div className="auto-quiz-error">Không thể tải danh sách bài đánh giá.</div>
      </section>
    );
  }

  const list = generations ?? [];

  // Phase 7A.3: chronological classification (replaces the
  // status-preference rule from 7A.1/7A.2 which incorrectly marked
  // an older READY as "Hiện tại" when a newer FAILED existed).
  //
  // Contract:
  //  - The BE list is `findAllByDocument_IdOrderByRequestedAtDesc`,
  //    so list[0] is the latest attempt by `requestedAt` regardless
  //    of status (READY / WAITING_SOURCE / QUEUED / PROCESSING /
  //    FAILED / CANCELLED).
  //  - list[0] ALWAYS carries the "current" / "Hiện tại" marker
  //    when the list is non-empty. There is no per-status privilege
  //    in this rule.
  //  - Every OTHER FAILED row is marked "superseded" ONLY when a
  //    generation with strictly newer `requestedAt` exists. We
  //    identify "strictly newer" by list position: list[0] is newer
  //    than list[1], etc. We further validate via parsed
  //    `requestedAt` timestamps when both sides have parseable
  //    values, so a clock-skew or partial date does not flip the
  //    ordering silently.
  //  - When there is only one FAILED generation, it is the current
  //    latest attempt and is NEVER marked "Lịch sử".
  const latestGenerationId = (() => {
    if (list.length === 0) return null;
    return list[0]?.generationId ?? null;
  })();

  const markerFor = (gen) => {
    if (!gen) return null;
    if (gen.generationId === latestGenerationId) return "current";

    const gs = String(gen?.status || "").toUpperCase();
    if (gs !== "FAILED") {
      // Non-FAILED, non-latest rows: leave unmarked. They are
      // older attempts and visually sit in their natural order;
      // we do not attach extra "history" labels because they are
      // not FAILED and therefore not the source of confusion
      // the "superseded" tag was designed to address.
      return null;
    }

    // FAILED row that is not the latest. It qualifies as
    // "superseded" only when list[0] has a strictly newer
    // requestedAt. We fall back to position-only comparison when
    // either side has no parseable requestedAt.
    const ownRequestedAt =
      typeof gen?.requestedAt === "string" ? gen.requestedAt : null;
    const ownMs = ownRequestedAt ? Date.parse(ownRequestedAt) : NaN;
    const latest = list[0];
    const latestRequestedAt =
      typeof latest?.requestedAt === "string"
        ? latest.requestedAt
        : null;
    const latestMs = latestRequestedAt
      ? Date.parse(latestRequestedAt)
      : NaN;
    if (Number.isFinite(ownMs) && Number.isFinite(latestMs)) {
      return latestMs > ownMs ? "superseded" : null;
    }
    // Position-only fallback: list[0] is always strictly newer.
    return "superseded";
  };

  return (
    <section className="submitted-panel submitted-panel--auto-quiz">
      <h2 className="submitted-panel-title">Bài đánh giá tự động</h2>

      {list.length === 0 ? (
        <div className="auto-quiz-empty">
          <p>Chưa có bài đánh giá tự động cho tài liệu này.</p>
        </div>
      ) : (
        <div className="auto-quiz-list">
          {list.map((gen) => (
            <AutoQuizGenerationCard
              key={gen.generationId}
              generation={gen}
              documentId={documentId}
              marker={markerFor(gen)}
            />
          ))}
        </div>
      )}

      {isFetching && list.length > 0 && (
        <div className="auto-quiz-fetching-indicator" aria-live="polite" />
      )}
    </section>
  );
}

export default function SubmittedDocumentDetails() {
  const { submissionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const notification = useNotification();
  const stateDoc = location.state?.document;

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditLoading, setIsEditLoading] = useState(false);

  const effectiveId = submissionId || stateDoc?.id;

  const {
    data: apiRaw,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["my-document-detail", submissionId],
    queryFn: () => documentService.getMyDocumentDetail(submissionId),
    enabled: Boolean(submissionId),
  });

  const document = useMemo(() => {
    if (submissionId) {
      if (apiRaw) return normalizeFromApi(apiRaw);
      return null;
    }
    return normalizeFromState(stateDoc);
  }, [submissionId, apiRaw, stateDoc]);

  const meta = statusMeta(document?.status);

  if (!effectiveId) {
    return (
      <div className="no-data-container">
        <h2>Không tìm thấy tài liệu</h2>
        <p>Vui lòng mở từ trang &quot;Tài liệu của tôi&quot; hoặc đăng tải tài liệu mới.</p>
        <button type="button" onClick={() => navigate("/manage-documents")}>
          Về danh sách tài liệu
        </button>
      </div>
    );
  }

  if (submissionId && isLoading && !apiRaw) {
    return (
      <div className="submitted-details-container">
        <div className="submitted-details-content">
          <p className="submitted-loading-text">Đang tải thông tin tài liệu…</p>
        </div>
      </div>
    );
  }

  if (submissionId && isError) {
    return (
      <div className="submitted-details-container">
        <div className="submitted-details-content">
          <p className="submitted-error-text">
            {error?.response?.data?.message || error?.message || "Không tải được tài liệu."}
          </p>
          <button type="button" className="submitted-btn-secondary" onClick={() => refetch()}>
            Thử lại
          </button>
          <button type="button" className="submitted-btn-ghost" onClick={() => navigate("/manage-documents")}>
            Về danh sách
          </button>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="no-data-container">
        <h2>Không có dữ liệu</h2>
        <button type="button" onClick={() => navigate("/manage-documents")}>Quay lại</button>
      </div>
    );
  }

  const {
    id,
    title,
    description,
    documentUrl,
    thumbnailUrl,
    fileName,
    fileType,
    fileSizeBytes,
    categoryName,
    tags,
    status,
    rejectReason,
    createdAt,
    isPaid,
    price,
  } = document;

  const documentCode = id ? `#DOC-${String(id).slice(0, 8).toUpperCase()}` : "—";

  const handleDeleteDocument = async () => {
    try {
      setIsDeleting(true);
      await documentService.deleteMyDocument(id);
      notification.success("Đã xóa tài liệu.");
      navigate("/manage-documents");
    } catch (err) {
      notification.error(err?.response?.data?.message || "Không thể xóa tài liệu.");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleEditDocument = async () => {
    if (!id) return;
    if (isEditLoading) return;
    setIsEditLoading(true);
    try {
      const documentToEdit = await loadDocumentForEdit(id);
      navigate("/upload-document", { state: { documentToEdit } });
    } catch (err) {
      const message = err?.message || "Không thể tải dữ liệu tài liệu để chỉnh sửa.";
      notification.error(message);
    } finally {
      setIsEditLoading(false);
    }
  };

  const statusUpper = (status || "").toUpperCase();

  return (
    <div className="submitted-details-container">
      <div className="submitted-details-content">
        <button type="button" className="details-back-link" onClick={() => navigate("/manage-documents")}>
          <ArrowLeftIcon />
          Quay lại danh sách tài liệu
        </button>

        <header className={`submitted-hero-card ${meta.heroClass}`}>
          <div className="submitted-hero-top">
            <div>
              <span className={`submitted-hero-badge ${meta.className}`}>{meta.label}</span>
              <p className="submitted-hero-code">Mã tài liệu: {documentCode}</p>
              <h1 className="submitted-hero-title">{title}</h1>
              <p className="submitted-hero-date">
                Gửi lúc: <strong>{formatDateTime(createdAt)}</strong>
              </p>
            </div>
            <div className="submitted-hero-actions">
              <button
                type="button"
                className="action-btn edit"
                onClick={handleEditDocument}
                disabled={isEditLoading}
              >
                <EditIcon /> {isEditLoading ? "Đang tải..." : "Chỉnh sửa"}
              </button>
              <button type="button" className="action-btn delete" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2Icon /> Xóa
              </button>
            </div>
          </div>
        </header>

        <div className="submitted-two-col">
          <section className="submitted-panel submitted-panel--preview">
            <h2 className="submitted-panel-title">Xem trước tệp</h2>
            <FilePreviewSection
              documentId={id}
              fileUrl={documentUrl}
              fileType={fileType}
              fileName={fileName}
              status={status}
            />
          </section>

          <div className="submitted-side-stack">
            <section className="submitted-panel">
              <h2 className="submitted-panel-title">Thông tin duyệt</h2>
              {statusUpper === "REJECTED" && rejectReason?.trim() ? (
                <div className="submitted-moderation rejected">
                  <h3>Tài liệu chưa được duyệt</h3>
                  <p className="submitted-moderation-label">Lý do từ chối</p>
                  <p className="submitted-reject-reason">{rejectReason.trim()}</p>
                </div>
              ) : null}
              {statusUpper === "APPROVED" ? (
                <div className="submitted-moderation approved">
                  <h3>Đã duyệt</h3>
                  <p>Tài liệu đã được duyệt và có thể hiển thị công khai trên hệ thống (theo cấu hình).</p>
                </div>
              ) : null}
              {statusUpper === "PENDING" ? (
                <div className="submitted-moderation pending">
                  <h3>Đang chờ</h3>
                  <p>Tài liệu đang chờ admin kiểm duyệt. Bạn sẽ thấy cập nhật trạng thái tại đây sau khi có kết quả.</p>
                </div>
              ) : null}
            </section>

            <section className="submitted-panel">
              <h2 className="submitted-panel-title">Thông tin tệp</h2>
              <div className="submitted-info-grid">
                <div className="submitted-info-cell">
                  <span className="submitted-info-label">Định dạng</span>
                  <strong>{displayFileExtension(fileName, fileType) || "—"}</strong>
                </div>
                <div className="submitted-info-cell">
                  <span className="submitted-info-label">Kích thước</span>
                  <strong>
                    {(() => {
                      const formatted = formatFileSize(fileSizeBytes);
                      if (formatted == null) return "Chưa xác định";
                      return formatted;
                    })()}
                  </strong>
                </div>
                <div className="submitted-info-cell submitted-info-cell--wide">
                  <span className="submitted-info-label">Tên tệp</span>
                  <strong className="submitted-info-filename">{fileName || "—"}</strong>
                </div>
                <div className="submitted-info-cell submitted-info-cell--wide">
                  <span className="submitted-info-label">Danh mục</span>
                  <span className="category-tag">{categoryName || "—"}</span>
                </div>
                <div className="submitted-info-cell submitted-info-cell--wide">
                  <span className="submitted-info-label">Mô tả</span>
                  <DescriptionCell description={description} />
                </div>
                <div className="submitted-info-cell submitted-info-cell--wide">
                  <span className="submitted-info-label">Từ khóa</span>
                  {(tags || []).length ? (
                    <div className="tags-container">
                      {tags.map((tag, index) => (
                        <span key={index} className="detail-tag">{tag}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="submitted-muted">Chưa có từ khóa</span>
                  )}
                </div>
              </div>
            </section>

            <PricingSection document={{ isPaid, price }} />

            <AutoQuizSection documentId={id} />

            {hasDocumentThumbnailValue(thumbnailUrl) ? (
              <section className="submitted-panel submitted-panel--thumb">
                <h2 className="submitted-panel-title">Ảnh bìa</h2>
                <img
                  src={getDocumentThumbnailUrl({ thumbnailUrl })}
                  alt=""
                  className="submitted-cover-thumb"
                  onError={onDocumentThumbnailError}
                />
              </section>
            ) : null}
          </div>
        </div>

        <div className="process-info-box">
          <div className="info-text">
            <h4>Quy trình phê duyệt</h4>
            <p>Đội ngũ kiểm duyệt sẽ xem xét tài liệu. Kết quả được phản ánh bằng trạng thái và (nếu bị từ chối) lý do cụ thể phía trên.</p>
          </div>
        </div>
      </div>

      {showDeleteConfirm ? (
        <div className="confirmation-modal-overlay">
          <div className="confirmation-modal-content" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Xác nhận xóa tài liệu</h3>
            <p>Bạn có chắc muốn xóa tài liệu này? Hành động không thể hoàn tác.</p>
            <div className="modal-actions">
              <button type="button" className="modal-btn confirm" onClick={handleDeleteDocument} disabled={isDeleting}>
                {isDeleting ? "Đang xóa…" : "Xóa"}
              </button>
              <button type="button" className="modal-btn cancel" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
                Hủy
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
