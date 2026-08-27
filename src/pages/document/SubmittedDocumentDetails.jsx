import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useNotification } from "../../context/NotificationContext";
import { documentService, loadDocumentForEdit } from "../../services/api";
import {
  getDocumentThumbnailUrl,
  hasDocumentThumbnailValue,
  onDocumentThumbnailError,
} from "../../utils/documentThumbnail";
import SecureDocumentPreview from "../../components/document/SecureDocumentPreview";
import { ChevronRightIcon } from "../../components/icons";
import { parseApiDate } from "../../utils/dateUtils";
import "../../styles/submittedDocumentDetails.css";

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
);

const Trash2Icon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
);

function formatDateTime(value) {
  if (value == null) return "—";
  try {
    const d = parseApiDate(value);
    if (!d || Number.isNaN(d.getTime())) return String(value);
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

function AutoQuizGenerationCard({ generation, documentId, marker, isEditedReplacement }) {
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
          {isEditedReplacement ? (
            <span
              className="auto-quiz-edited-replacement-tag"
              data-marker="edited-replacement"
            >
              Đã chỉnh sửa
            </span>
          ) : null}
          {/* Phase 7B.4C — the user-visible "Hiện tại" badge is removed.
              The underlying `isCurrent` state, `markerFor` function,
              `latestGenerationId`, `replacementIds`, and
              `supersededIds` are all preserved (used elsewhere in
              lineage logic). Only this JSX span stops rendering. */}
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

// Phase 7B.4A — reproduce the read helper locally so the
// AutoQuizSection component has it in scope. The producer-side
// persist lives in UploadDocument.jsx and is not shared; this
// module reads only. The helper is a plain function with no
// React dependencies.
const REPLACEMENT_PAIRS_STORAGE_PREFIX = "studyit.autoQuiz.replacementPairs.";

function readReplacementPairsForDocument(documentId) {
  if (typeof window === "undefined" || !window.sessionStorage) return [];
  if (!documentId) return [];
  try {
    const raw = window.sessionStorage.getItem(
      REPLACEMENT_PAIRS_STORAGE_PREFIX + String(documentId)
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        (typeof entry.supersededGenerationId === "string" ||
          typeof entry.supersededGenerationId === "number") &&
        (typeof entry.replacementGenerationId === "string" ||
          typeof entry.replacementGenerationId === "number")
    );
  } catch (err) {
    return [];
  }
}

function AutoQuizSection({ documentId }) {
  const location = useLocation();
  // Phase 7B.4B — hooks must execute in the same order on every
  // render. The historical implementation called useState(false)
  // AFTER the (isLoading) and (isError) early returns below, so
  // the loading render invoked 2 hooks and the loaded render
  // invoked 3 hooks. React #310 ("Rendered more hooks than during
  // the previous render") fired exactly on the post-upload
  // navigation, which is the path where the useQuery starts in
  // isLoading=true and then transitions to data loaded. Hoisting
  // the useState above the early returns makes the hook count
  // stable across the loading → loaded transition.
  const [showHistory, setShowHistory] = useState(false);
  // Phase 7B.1 — lineage is sourced from THREE places, in order of
  // decreasing authority:
  //
  //   1. The "current navigation" state — valid only for the lifetime
  //      of the in-memory history entry. A hard refresh drops it.
  //   2. sessionStorage — persists exact OLD → NEW pairs across hard
  //      refreshes within the same browser tab / session. A new
  //      browser / device cannot reconstruct lineage without backend
  //      persistence; that is a documented limitation.
  //   3. Nothing — the detail page renders all generations with their
  //      natural chronological markers and no "Đã chỉnh sửa" tags.
  //
  // The persisted pairs are filtered against the BE list below so
  // stale mappings (whose ids no longer exist on this document) are
  // silently dropped — defence-in-depth against sessionStorage from a
  // previous document or a corrupted entry.
  // Phase 7B.2 — merge BOTH nav-state and sessionStorage so a
  // document that has accumulated multiple replacement operations
  // over time keeps all of them visible on a hard refresh. A
  // document that has 5 historical replacements across different
  // FAILED cards must show all 5 NEW cards (each tagged
  // "Đã chỉnh sửa") and hide all 5 OLD cards from the normal
  // list. The previous 7B.1 logic chose nav OR persisted; under
  // accumulation that loses pairs that the current nav-state does
  // not repeat.
  const navPairsRaw = Array.isArray(location?.state?.replacementPairs)
    ? location.state.replacementPairs
    : [];
  const navPairs = navPairsRaw.filter(
    (p) =>
      p &&
      typeof p === "object" &&
      (typeof p.supersededGenerationId === "string" ||
        typeof p.supersededGenerationId === "number") &&
      (typeof p.replacementGenerationId === "string" ||
        typeof p.replacementGenerationId === "number")
  );
  const persistedPairs = readReplacementPairsForDocument(documentId);

  // Normalise ids to strings and drop malformed / self-mapping
  // entries BEFORE the merge so both sources contribute on equal
  // footing.
  const normalise = (raw) => {
    const out = [];
    for (const p of raw) {
      const oldId = String(p.supersededGenerationId);
      const newId = String(p.replacementGenerationId);
      if (!oldId || !newId) continue;
      if (oldId === newId) continue;
      out.push({
        supersededGenerationId: oldId,
        replacementGenerationId: newId,
      });
    }
    return out;
  };

  const merged = new Map();
  // The persisted set is the long-lived baseline; the nav-state
  // carries the pairs from the just-completed operation and may
  // be a strict subset of (or identical to) the persisted set.
  // Loading persisted first and then overwriting with nav ensures
  // the latest write-wins semantics for the just-completed ops
  // without erasing prior persisted history.
  for (const p of normalise(persistedPairs)) {
    merged.set(
      p.supersededGenerationId + "->" + p.replacementGenerationId,
      p
    );
  }
  for (const p of normalise(navPairs)) {
    merged.set(
      p.supersededGenerationId + "->" + p.replacementGenerationId,
      p
    );
  }
  const allPairs = Array.from(merged.values());

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

  // Phase 7B.1 — exact OLD → NEW lineage via two Sets derived from
  // the validated replacementPairs:
  //
  //   replacementIds — exact NEW ids. The corresponding card gets
  //     the "Đã chỉnh sửa" tag.
  //   supersededIds  — exact OLD ids. The corresponding card is
  //     hidden from the normal detail list and surfaced via the
  //     "Xem lịch sử" toggle.
  //
  // We validate every id against the BE-returned list so stale
  // entries (from sessionStorage or a previous navigation) that
  // point at ids no longer on this document are silently dropped.
  // Unrelated quizzes that are not in the pair set remain visible.
  const liveIds = new Set();
  for (const gen of list) {
    if (gen?.generationId != null) {
      liveIds.add(String(gen.generationId));
    }
  }
  const replacementIds = new Set();
  const supersededIds = new Set();
  for (const pair of allPairs) {
    const oldId = String(pair.supersededGenerationId);
    const newId = String(pair.replacementGenerationId);
    if (!liveIds.has(oldId) || !liveIds.has(newId)) continue;
    if (oldId === newId) continue;
    replacementIds.add(newId);
    supersededIds.add(oldId);
  }

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

  // Phase 7B.1 — derived view models. The BE-supplied list is the
  // single source of truth (no mutation). We render the
  // visible list (suppressing EXACT superseded IDs from the pair
  // table) and the hidden list (shown only via the optional
  // "Xem lịch sử" toggle). Unrelated READY quizzes and unrelated
  // FAILED quizzes remain visible regardless of lineage state.
  const visibleList = list.filter(
    (gen) => !supersededIds.has(String(gen?.generationId))
  );
  const hiddenList = list.filter((gen) =>
    supersededIds.has(String(gen?.generationId))
  );

  // Phase 7B.2 — persist the validated merged pairs back to
  // sessionStorage so stale entries (whose ids no longer exist on
  // this document) are pruned after each detail-page render. We
  // write only the pairs whose OLD and NEW ids are both alive in
  // the current BE list, plus their pristine full record (we keep
  // the original pair object so the schema is preserved).
  const cleanedPairs = allPairs.filter((pair) => {
    const oldId = String(pair.supersededGenerationId);
    const newId = String(pair.replacementGenerationId);
    return liveIds.has(oldId) && liveIds.has(newId) && oldId !== newId;
  });
  // Re-derive byNew suppression: if two pairs share the same NEW
  // id, only the first (insertion-ordered) survives. This
  // matches the producer-side `persistReplacementPairsForDocument`
  // invariant.
  const cleanedDedup = [];
  const cleanedSeenNew = new Set();
  for (const p of cleanedPairs) {
    const newId = String(p.replacementGenerationId);
    if (cleanedSeenNew.has(newId)) continue;
    cleanedSeenNew.add(newId);
    cleanedDedup.push(p);
  }
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      const storageKey =
        "studyit.autoQuiz.replacementPairs." + String(documentId);
      const raw = window.sessionStorage.getItem(storageKey);
      let needsWrite = false;
      if (!raw && cleanedDedup.length > 0) {
        needsWrite = true;
      } else if (raw) {
        let existing = null;
        try {
          existing = JSON.parse(raw);
        } catch (e) {
          existing = null;
        }
        if (!Array.isArray(existing)) {
          needsWrite = true;
        } else if (existing.length !== cleanedDedup.length) {
          needsWrite = true;
        } else {
          for (let i = 0; i < existing.length; i += 1) {
            const a = existing[i];
            const b = cleanedDedup[i];
            if (
              !b ||
              String(a?.supersededGenerationId) !==
                String(b.supersededGenerationId) ||
              String(a?.replacementGenerationId) !==
                String(b.replacementGenerationId)
            ) {
              needsWrite = true;
              break;
            }
          }
        }
      }
      if (needsWrite) {
        if (cleanedDedup.length === 0) {
          // Prune stale / fully-orphaned entries so they do not
          // accumulate across sessions.
          window.sessionStorage.removeItem(storageKey);
        } else {
          window.sessionStorage.setItem(storageKey, JSON.stringify(cleanedDedup));
        }
      }
    } catch (e) {
      // Quota / disabled — silently drop.
    }
  }

  return (
    <section className="submitted-panel submitted-panel--auto-quiz">
      <h2 className="submitted-panel-title">Bài đánh giá tự động</h2>

      {visibleList.length === 0 ? (
        <div className="auto-quiz-empty">
          <p>Chưa có bài đánh giá tự động cho tài liệu này.</p>
        </div>
      ) : (
        <div className="auto-quiz-list">
          {visibleList.map((gen) => (
            <AutoQuizGenerationCard
              key={gen.generationId}
              generation={gen}
              documentId={documentId}
              marker={markerFor(gen)}
              isEditedReplacement={replacementIds.has(
                String(gen?.generationId)
              )}
            />
          ))}
        </div>
      )}

      {hiddenList.length > 0 ? (
        <div className="auto-quiz-history-toggle">
          <button
            type="button"
            className="auto-quiz-history-toggle-btn"
            aria-expanded={showHistory}
            onClick={() => setShowHistory((v) => !v)}
          >
            {showHistory
              ? "Ẩn lịch sử"
              : `Xem lịch sử (${hiddenList.length})`}
          </button>
          {showHistory ? (
            <div className="auto-quiz-list auto-quiz-list--history">
              {hiddenList.map((gen) => (
                <AutoQuizGenerationCard
                  key={gen.generationId}
                  generation={gen}
                  documentId={documentId}
                  marker={markerFor(gen)}
                  isEditedReplacement={false}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {isFetching && visibleList.length > 0 && (
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

  // Compact approval copy, status-aware. All four branches render the
  // SAME single line of approval-state copy used in the new top status
  // card. The legacy "Thông tin duyệt" / "Quy trình phê duyệt" blocks
  // were merged here to remove the redundant three-place display of
  // approval information while preserving every existing piece of
  // copy (REJECTED → từ chối reason is rendered separately above).
  const statusUpper = (status || "").toUpperCase();
  const approvalCopy =
    statusUpper === "APPROVED"
      ? "Tài liệu đã được duyệt và có thể hiển thị công khai trên hệ thống (theo cấu hình)."
      : statusUpper === "REJECTED"
        ? "Tài liệu chưa được duyệt. Vui lòng xem lý do từ chối phía trên và đăng tải lại sau khi chỉnh sửa."
        : "Tài liệu đang chờ quản trị viên kiểm tra. Kết quả xét duyệt sẽ được cập nhật tại đây.";

  return (
    <div className={`submitted-details-container ${statusUpper === "REJECTED" ? "submitted-details--rejected" : ""}`}>
      <div className="submitted-details-content">

        <nav className="breadcrumb">
          <Link to="/" className="breadcrumb-item">
            Trang chủ
          </Link>
          <ChevronRightIcon size={12} color="#64748b" />
          <Link to="/manage-documents" className="breadcrumb-item">
            Tài liệu của tôi
          </Link>
          <ChevronRightIcon size={12} color="#64748b" />
          <span className="breadcrumb-item active">{title || "—"}</span>
        </nav>

        {/* Status Card: Ultra-compact when REJECTED, standard when PENDING/APPROVED */}
        {statusUpper === "REJECTED" ? (
          <section className="submitted-hero-card submitted-hero-card--rejected-compact">
            <div className="submitted-hero-rejected-main">
              <div className="submitted-hero-rejected-header">
                <div className="submitted-hero-rejected-title-line">
                  <span className="submitted-hero-badge submitted-hero-badge--rejected">
                    Bị từ chối
                  </span>
                  <h1 className="submitted-hero-title submitted-hero-title--compact" title={title}>
                    {title}
                  </h1>
                </div>
                <div className="submitted-hero-actions submitted-hero-actions--compact">
                  <button
                    type="button"
                    className="submitted-hero-action-btn submitted-hero-action-btn--edit"
                    onClick={handleEditDocument}
                    disabled={isEditLoading}
                  >
                    <EditIcon /> {isEditLoading ? "Đang tải..." : "Sửa"}
                  </button>
                  <button
                    type="button"
                    className="submitted-hero-action-btn submitted-hero-action-btn--delete"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2Icon /> Xóa
                  </button>
                </div>
              </div>

              <div className="submitted-hero-rejected-subline">
                <span className="submitted-hero-code-inline">
                  Mã tài liệu: {documentCode}
                </span>
                <span className="submitted-hero-dot">•</span>
                <span className="submitted-hero-date">
                  Gửi lúc: <strong>{formatDateTime(createdAt)}</strong>
                </span>
              </div>

              {rejectReason?.trim() ? (
                <div className="submitted-hero-reject-bar">
                  <span className="submitted-hero-reject-tag">Lý do từ chối:</span>
                  <span className="submitted-hero-reject-text">
                    {rejectReason.trim()}
                  </span>
                </div>
              ) : null}
            </div>
          </section>
        ) : (
          <section className={`submitted-hero-card ${meta.heroClass}`}>
            <div className="submitted-hero-top">
              <div className="submitted-hero-copy">
                <div className="submitted-hero-meta-row">
                  <span className={`submitted-hero-badge ${meta.className}`}>
                    {meta.label}
                  </span>
                  <span className="submitted-hero-code-inline">
                    Mã tài liệu: {documentCode}
                  </span>
                </div>
                <h1 className="submitted-hero-title">{title}</h1>
                <p className="submitted-hero-date">
                  Gửi lúc: <strong>{formatDateTime(createdAt)}</strong>
                </p>
                <p className="submitted-hero-approval-copy">{approvalCopy}</p>
              </div>
              <div className="submitted-hero-actions">
                <button
                  type="button"
                  className="submitted-hero-action-btn submitted-hero-action-btn--edit"
                  onClick={handleEditDocument}
                  disabled={isEditLoading}
                >
                  <EditIcon /> {isEditLoading ? "Đang tải..." : "Sửa"}
                </button>
                <button
                  type="button"
                  className="submitted-hero-action-btn submitted-hero-action-btn--delete"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2Icon /> Xóa
                </button>
              </div>
            </div>
          </section>
        )}


        <div className="submitted-main-layout">
          {/* Left Column — dominant preview (title-less card to match
              the public document-detail page; the preview itself is
              the visual header of the card). */}
          <div className="submitted-left-column">
            <div className="submitted-preview-card">
              <div className="submitted-preview-frame">
                <FilePreviewSection
                  documentId={id}
                  fileUrl={documentUrl}
                  fileType={fileType}
                  fileName={fileName}
                  status={status}
                />
              </div>
            </div>
          </div>

          {/* Right Column — sidebar cards */}
          <div className="submitted-right-column">
            {statusUpper === "REJECTED" ? (
              <section className="submitted-panel submitted-panel--compact">
                {hasDocumentThumbnailValue(thumbnailUrl) && (
                  <div className="submitted-compact-thumb-wrap">
                    <img
                      src={getDocumentThumbnailUrl({ thumbnailUrl })}
                      alt=""
                      className="submitted-compact-thumb"
                      onError={onDocumentThumbnailError}
                    />
                  </div>
                )}
                <h2 className="submitted-panel-title">Thông tin tài liệu</h2>
                <div className="submitted-info-grid submitted-info-grid--compact">
                  <div className="submitted-info-cell">
                    <span className="submitted-info-label">Định dạng</span>
                    <strong>
                      {displayFileExtension(fileName, fileType) || "—"}
                    </strong>
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
                  <div className="submitted-info-cell">
                    <span className="submitted-info-label">Danh mục</span>
                    <span className="category-tag">{categoryName || "—"}</span>
                  </div>
                  <div className="submitted-info-cell">
                    <span className="submitted-info-label">Giá bán</span>
                    {isPaid ? (
                      <div className="submitted-compact-price">
                        <strong className="submitted-price-tag">{formatVnd(price)} ₫</strong>
                        <span className="submitted-net-hint">
                          (Nhận: {formatVnd(price - Math.floor((price * 10) / 100))} ₫)
                        </span>
                      </div>
                    ) : (
                      <span className="submitted-free-tag">Miễn phí</span>
                    )}
                  </div>
                  <div className="submitted-info-cell submitted-info-cell--wide">
                    <span className="submitted-info-label">Tên tệp</span>
                    <strong className="submitted-info-filename" title={fileName}>
                      {fileName || "—"}
                    </strong>
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
                          <span key={index} className="detail-tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="submitted-muted">Chưa có từ khóa</span>
                    )}
                  </div>
                </div>
              </section>
            ) : (
              <>
                <section className="submitted-panel">
                  <h2 className="submitted-panel-title">Thông tin tài liệu</h2>
                  <div className="submitted-info-grid">
                    <div className="submitted-info-cell">
                      <span className="submitted-info-label">Định dạng</span>
                      <strong>
                        {displayFileExtension(fileName, fileType) || "—"}
                      </strong>
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
                      <strong className="submitted-info-filename">
                        {fileName || "—"}
                      </strong>
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
                            <span key={index} className="detail-tag">
                              {tag}
                            </span>
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
              </>
            )}
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
