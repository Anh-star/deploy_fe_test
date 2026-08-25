import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useNotification } from "../../context/NotificationContext";
import {
  documentService,
  sidebarService,
  getValidatedCreatePrice,
  getValidatedUpdatePrice,
  MIN_PAID_DOCUMENT_PRICE,
  MIN_PAID_DOCUMENT_PRICE_VALIDATION_MESSAGE,
  EDIT_PRICING_DATA_INVALID_MESSAGE,
} from "../../services/api";
import "../../styles/uploadDocument.css";
import { uploadDocumentToSupabase } from "../../utils/uploadDocumentSupabase";
import { uploadPaidFileViaSignedUrl } from "../../utils/paidUploadSupabase";
import { validateDocumentFileForUpload } from "../../utils/validateDocumentFileForUpload";
import {
  submitPaidDocumentFlow,
  createPaidSubmissionGuard,
} from "./paidDocumentSubmitFlow";

const POLLING_INTERVAL_MS = 4000;
const TERMINAL_STATUSES = new Set(["READY", "FAILED", "CANCELLED"]);

const EDIT_QUIZ_STATUS_LABELS = {
  WAITING_SOURCE: "Đang chuẩn bị tài liệu",
  QUEUED: "Đang chờ tạo",
  PROCESSING: "Đang tạo câu hỏi",
  READY: "Sẵn sàng",
  FAILED: "Tạo thất bại",
  CANCELLED: "Đã hủy",
};

const FAILED_FOCUS_MISMATCH = "FOCUS_TOPIC_MISMATCH";

const PAID_SUBMIT_FAILURE_TARGET_MESSAGE =
  "Không thể chuẩn bị tải lên tệp. Vui lòng thử lại.";
const PAID_SUBMIT_FAILURE_STORAGE_MESSAGE =
  "Tải tệp lên bộ nhớ thất bại. Vui lòng thử lại sau.";
const PAID_SUBMIT_FAILURE_TARGET_EXPIRED_MESSAGE =
  "Phiên tải lên đã hết hạn. Vui lòng thử lại.";
const PAID_SUBMIT_FAILURE_CREATE_MESSAGE =
  "Không thể tạo tài liệu. Vui lòng thử lại.";

function getSubmitButtonLabel({ isUploading, submissionPhase, isEditing }) {
  if (!isUploading) {
    return isEditing ? "Cập nhật tài liệu" : "Đăng tải tài liệu";
  }
  if (submissionPhase === "preparing") return "Đang chuẩn bị tải lên...";
  if (submissionPhase === "uploading") return "Đang tải tài liệu...";
  if (submissionPhase === "creating") return "Đang tạo tài liệu...";
  return isEditing ? "Đang cập nhật..." : "Đang đăng tải...";
}

function getSafeSubmitErrorMessage(error) {
  const message = error?.response?.data?.message || error?.message;
  return typeof message === "string" && message.trim()
    ? message
    : PAID_SUBMIT_FAILURE_CREATE_MESSAGE;
}

const FileUploadIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="12" y1="18" x2="12" y2="12"></line>
    <polyline points="9 15 12 12 15 15"></polyline>
  </svg>
);

const ImageIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <circle cx="8.5" cy="8.5" r="1.5"></circle>
    <polyline points="21 15 16 10 5 21"></polyline>
  </svg>
);

const TrashIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

const PdfIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <text x="7" y="18" fontSize="6" fontWeight="bold" fill="currentColor" stroke="none">PDF</text>
  </svg>
);

const EMPTY_FORM = {
  title: "",
  description: "",
  category: "",
  tags: [],
  documentFile: null,
  thumbnailFile: null,
  confirmed: false,
  isEditing: false,
  existingDocumentUrl: null,
  existingThumbnailUrl: null,
  existingFileName: null,
  existingFileSize: null,
  existingFileSizeBytes: null,
  existingStoragePath: null,
};

function toMb(sizeBytes) {
  return ((sizeBytes || 0) / (1024 * 1024)).toFixed(1);
}

function formatVnd(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return value.toLocaleString("vi-VN");
}

const QUICK_PRICES = [3000, 5000, 10000, 20000, 50000];
const PRICE_SLIDER_MIN = MIN_PAID_DOCUMENT_PRICE;
const PRICE_SLIDER_MAX = 500000;
const PRICE_SLIDER_STEP = 1000;

// Quiz auto-generation options. Only the value "CUSTOM" is sent through
// the count field — the resolved integer is set as quizQuestionCount.
// Valid range is global: every integer in [QUIZ_COUNT_MIN, QUIZ_COUNT_MAX]
// is accepted, regardless of whether the user picks a preset chip or
// types a custom value. The preset list is intentionally a subset of the
// valid range so the chip set always stays inside the legal window.
const QUIZ_COUNT_OPTIONS = [10, 15, 20, 30, 50];
// Global valid range for Auto Quiz question count. Single source of
// truth shared by:
//   - the chip preset list,
//   - the backend @Min/@Max guards (DocumentCreateRequestDto),
//   - the backend service-layer range guard
//     (QuizGenerationServiceImpl#enqueueForDocument).
// The range is [10, 50] inclusive — values below 10 do not provide
// meaningful quiz coverage and values above 50 exceed the per-quiz
// budget. The <input> element is also capped at maxLength={2} so the
// user cannot type a 3-digit number (e.g. "123") in the first place.
//
// IMPORTANT: this is the range the BACKEND accepts. The custom UI
// applies a narrower subset of this range (see QUIZ_CUSTOM_MIN /
// QUIZ_CUSTOM_MAX below) — presets 10 and 50 are still legitimate
// and continue to round-trip through the backend unchanged.
const QUIZ_COUNT_MIN = 10;
const QUIZ_COUNT_MAX = 50;
// Narrower range for the "Tùy chỉnh" custom input. The custom chip
// is a UX gate so users don't bypass the bulk presets (10/50) just to
// type a number; the inner range [11, 49] sits strictly inside the
// global [10, 50] range so every valid custom value is also a valid
// payload value. These constants are ONLY consulted by the custom
// <input> validation, placeholder, and error message — never by the
// preset chips or the backend.
const QUIZ_CUSTOM_MIN = 11;
const QUIZ_CUSTOM_MAX = 49;
const QUIZ_COUNT_MESSAGE = "Số câu hỏi phải từ 10 đến 50.";
// Custom-only error message. Uses the custom range [11, 49] because
// the user is editing the custom input — not picking a preset chip.
const QUIZ_CUSTOM_RANGE_MESSAGE =
  "Số câu hỏi tùy chỉnh phải từ 11 đến 49.";
// Shown when Auto Quiz is ON and the user has selected "Tùy chỉnh"
// but has not typed anything yet. Submit is blocked while this is
// visible.
const QUIZ_CUSTOM_BLANK_MESSAGE = "Vui lòng nhập số câu hỏi.";

// Auto Quiz V1 only supports PDF / DOC / DOCX. PPT / PPTX uploads are
// still allowed for storage, but the Auto Quiz toggle is disabled with
// this helper text. The Vietnamese message is intentionally identical
// to the backend's UNSUPPORTED_AUTO_QUIZ_MESSAGE so the UI error
// matches the 400 payload the user would see if the guard were bypassed.
const QUIZ_AUTO_SUPPORTED_EXTENSIONS = ["pdf", "doc", "docx"];
const QUIZ_AUTO_UNSUPPORTED_MESSAGE =
  "Tự động tạo Quiz hiện chỉ hỗ trợ PDF, DOC và DOCX.";

function getFileExtension(name) {
  if (typeof name !== "string") return "";
  const i = name.lastIndexOf(".");
  if (i <= 0 || i === name.length - 1) return "";
  return name.slice(i + 1).toLowerCase();
}

function isQuizAutoSupported(fileName) {
  const ext = getFileExtension(fileName);
  return ext !== "" && QUIZ_AUTO_SUPPORTED_EXTENSIONS.includes(ext);
}

function isQuizCountPresetValue(value) {
  if (typeof value !== "number" || !Number.isInteger(value)) return false;
  return QUIZ_COUNT_OPTIONS.includes(value);
}

// ── Module-level helpers ────────────────────────────────────────────────────
// resolveQuizCount and isQuizConfigValid are defined at module scope so
// submitFreeDocument / createAdditionalQuizGenerations (module-level functions)
// can call them without needing to receive them as arguments.
function resolveQuizCount(questionCount, customSelected, customCount) {
  if (!customSelected) return questionCount;
  const raw = typeof customCount === "string" ? customCount : "";
  if (raw.trim() === "") return null;
  const parsed = Number(raw);
  if (
    Number.isInteger(parsed) &&
    parsed >= QUIZ_CUSTOM_MIN &&
    parsed <= QUIZ_CUSTOM_MAX
  ) {
    return parsed;
  }
  return null;
}

function isQuizConfigValid(config) {
  if (!config) return false;
  return resolveQuizCount(config.questionCount, config.customSelected, config.customCount) !== null;
}

function toCreatePayload(
  formData,
  documentUrl,
  thumbnailUrl,
  fileName,
  fileSizeBytes,
  storagePath,
  isPaid,
  price,
  quizOptions
) {
  const normalizedPrice = getValidatedCreatePrice(isPaid, price);
  return {
    title: formData.title.trim(),
    description: formData.description.trim(),
    category: formData.category,
    tags: formData.tags,
    documentUrl,
    storagePath: storagePath ?? "",
    thumbnailUrl,
    fileName,
    fileSizeBytes,
    isPaid,
    price: normalizedPrice,
    generateQuiz: Boolean(quizOptions?.generateQuiz),
    quizQuestionCount: quizOptions?.generateQuiz
      ? quizOptions.quizQuestionCount
      : null,
    quizFocusTopic: quizOptions?.generateQuiz
      ? (
          typeof quizOptions.quizFocusTopic === "string"
            ? quizOptions.quizFocusTopic.trim()
            : ""
        )
      : null,
  };
}

function toUpdatePayload(
  formData,
  documentUrl,
  thumbnailUrl,
  fileName,
  fileSizeBytes,
  storagePath,
  isPaid,
  price,
  initialIsPaid,
  initialPrice
) {
  const normalizedPrice = getValidatedUpdatePrice({
    isPaid,
    price,
    initialIsPaid,
    initialPrice,
  });
  return {
    title: formData.title.trim(),
    description: formData.description.trim(),
    category: formData.category,
    tags: formData.tags,
    documentUrl,
    storagePath,
    thumbnailUrl,
    fileName,
    fileSizeBytes,
    isPaid,
    price: normalizedPrice,
  };
}

/**
 * Pure helper that mirrors the FREE create-payload shape used before
 * Phase S1-C2. Re-exported so unit tests can pin the exact fields that
 * must NEVER drift into a paid create.
 */
function toFreeCreatePayload(
  formData,
  documentUrl,
  thumbnailUrl,
  fileName,
  fileSizeBytes,
  storagePath,
  isPaid,
  normalizedPrice,
  quizOptions
) {
  return toCreatePayload(
    formData,
    documentUrl,
    thumbnailUrl,
    fileName,
    fileSizeBytes,
    storagePath,
    isPaid,
    normalizedPrice,
    quizOptions
  );
}

/**
 * Fire POST /api/my-documents/{documentId}/auto-quizzes for every config
 * beyond the first one (config[0] was already included in the create
 * document payload). Uses Promise.allSettled so partial failures are
 * reported gracefully without blocking navigation.
 */
async function createAdditionalQuizGenerations({
  documentId,
  quizConfigs,
  documentService,
  notification,
}) {
  const extras = quizConfigs.slice(1);
  if (extras.length === 0) return;

  const results = await Promise.allSettled(
    extras.map((config) =>
        documentService.createMyDocumentAutoQuiz(documentId, {
        requestedQuestionCount: resolveQuizCount(
          config.questionCount,
          config.customSelected,
          config.customCount
        ),
        focusTopic: config.focusTopic,
      })
    )
  );

  const failures = results.filter(
    (result) =>
      result.status === "rejected" ||
      !result.value?.generationId
  );
  if (failures.length > 0) {
    notification.warning(
      `Tài liệu đã được đăng, nhưng ${failures.length}/${extras.length} bài đánh giá chưa thể tạo. Bạn có thể kiểm tra lại trạng thái trong trang chi tiết.`
    );
  }
}

/**
 * FREE document submit — Phase S1-C2 keeps this branch byte-identical to
 * the previous behaviour so existing free-upload users do not regress.
 *
 * <p>Order:
 * <ol>
 *   <li>upload document file → public bucket (returns public URL + path);</li>
 *   <li>upload thumbnail (same helper);</li>
 *   <li>POST /api/my-documents with {@code documentUrl}, {@code storagePath},
 *       {@code isPaid=false}, {@code price=0}, no {@code uploadId}.</li>
 *   <li>(Phase 4C) POST additional quiz generations for configs[1..N].</li>
 * </ol>
 */
async function submitFreeDocument({
  formData,
  notification,
  navigate,
  quizConfigs,
  documentService,
}) {
  notification.success("Đang tải tài liệu và gửi lên hệ thống...");

  let docUrl = formData.existingDocumentUrl;
  let docStoragePath = formData.existingStoragePath;
  let thumbUrl = formData.existingThumbnailUrl;
  let docFileName = formData.existingFileName;
  let docFileSizeBytes = formData.existingFileSizeBytes;

  if (formData.documentFile) {
    const docResult = await uploadDocumentToSupabase(
      formData.documentFile,
      "assets/UploadedDocuments"
    );
    docUrl = docResult.url;
    docStoragePath = docResult.path;
    docFileName = formData.documentFile.name;
    docFileSizeBytes = formData.documentFile.size;
  }

  if (formData.thumbnailFile) {
    const thumbResult = await uploadDocumentToSupabase(
      formData.thumbnailFile,
      "assets/UploadedDocuments"
    );
    thumbUrl = thumbResult.url;
  }

  if (!docUrl || !thumbUrl || !docFileName) {
    throw new Error("Thiếu dữ liệu tài liệu sau khi tải file lên.");
  }
  if (!docStoragePath || String(docStoragePath).trim() === "") {
    throw new Error("Thiếu storage path sau khi upload (cần cho DocumentFile).");
  }

  const firstConfig = quizConfigs[0];
  const generateQuiz = Boolean(firstConfig);
  const quizOptions = generateQuiz
    ? {
        generateQuiz: true,
        quizQuestionCount: resolveQuizCount(
          firstConfig.questionCount,
          firstConfig.customSelected,
          firstConfig.customCount
        ),
        quizFocusTopic:
          typeof firstConfig.focusTopic === "string"
            ? firstConfig.focusTopic.trim()
            : "",
      }
    : { generateQuiz: false, quizQuestionCount: null, quizFocusTopic: null };

  const payload = toFreeCreatePayload(
    formData,
    docUrl,
    thumbUrl,
    docFileName,
    docFileSizeBytes || 0,
    docStoragePath,
    false,
    0,
    quizOptions
  );

  const savedDocument = await documentService.createMyDocument(payload);

  const sid = savedDocument?.id;

  // Phase 4C: fire additional quiz generations for configs[1..N]
  if (generateQuiz && sid) {
    await createAdditionalQuizGenerations({
      documentId: sid,
      quizConfigs,
      documentService,
      notification,
    });
  }

  notification.success("Đăng tải tài liệu thành công!");
  if (sid) {
    navigate(`/documents/submitted/${sid}`);
  } else {
    navigate("/submitted-document-details", { state: { document: savedDocument } });
  }
}

/**
 * PAID document submit — Phase S1-C2.
 *
 * <p>This function is now a thin React-aware wrapper that delegates the
 * strict ordered protocol to the pure
 * {@link submitPaidDocumentFlow} orchestrator. The orchestrator owns:
 * <ul>
 *   <li>MIME resolution from the file extension,</li>
 *   <li>exact call order
 *       (target → signed upload → document create),</li>
 *   <li>the canonical MIME used for both target creation and the
 *       Supabase signed upload content type.</li>
 * </ul>
 *
 * <p>This wrapper owns only the React-side concerns:
 * <ul>
 *   <li>local UX validation (size + extension whitelist) BEFORE any
 *       network call,</li>
 *   <li>mapping orchestrator exceptions to friendly Vietnamese
 *       messages,</li>
 *   <li>uploading the thumbnail via the free-flow
 *       {@code uploadDocumentToSupabase} helper (thumbnails are
 *       public-bucket and unchanged from before Phase S1-C2),</li>
 *   <li>post-success navigation.</li>
 * </ul>
 */
async function submitPaidDocument({
  formData,
  normalizedPrice,
  notification,
  navigate,
  setSubmissionPhase,
  documentService,
  quizConfigs,
}) {
  const documentFile = formData.documentFile;
  if (!documentFile) {
    throw new Error("Vui lòng chọn tệp tài liệu để tải lên.");
  }

  // (1) Front-end UX validation BEFORE any network call. The MIME
  //     resolution that follows is re-checked by the orchestrator.
  const validation = validateDocumentFileForUpload(documentFile);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  // (2) Thumbnail upload uses the existing free-flow helper. The
  //     thumbnail bucket is intentionally separate from the paid
  //     document bucket.
  let thumbUrl = formData.existingThumbnailUrl;
  if (formData.thumbnailFile) {
    const thumbResult = await uploadDocumentToSupabase(
      formData.thumbnailFile,
      "assets/UploadedDocuments"
    );
    thumbUrl = thumbResult.url;
  }
  if (!thumbUrl) {
    throw new Error("Thiếu ảnh minh họa tài liệu.");
  }

  notification.success("Đang chuẩn bị tải lên...");

  // Phase 4C: resolve first config into quizOptions before the paid flow.
  const firstConfig = quizConfigs[0];
  const generateQuiz = Boolean(firstConfig);
  const quizOptions = generateQuiz
    ? {
        generateQuiz: true,
        quizQuestionCount: resolveQuizCount(
          firstConfig.questionCount,
          firstConfig.customSelected,
          firstConfig.customCount
        ),
        quizFocusTopic:
          typeof firstConfig.focusTopic === "string"
            ? firstConfig.focusTopic.trim()
            : "",
      }
    : { generateQuiz: false, quizQuestionCount: null, quizFocusTopic: null };

  // (3) Delegate the strict ordered protocol to the orchestrator.
  //     The orchestrator resolves the canonical MIME once and uses it
  //     for both the target request body and the Supabase signed upload
  //     content type.
  let savedDocument;
  try {
    savedDocument = await submitPaidDocumentFlow({
      file: documentFile,
      form: {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        tags: formData.tags,
      },
      thumbnailUrl: thumbUrl,
      normalizedPrice,
      quizOptions,
      deps: {
        createPaidUploadTarget: documentService.createPaidUploadTarget,
        uploadPaidFileViaSignedUrl,
        createMyDocument: documentService.createMyDocument,
        onPhaseChange: (phase) => {
          setSubmissionPhase(phase);
          if (phase === "uploading") notification.success("Đang tải tệp...");
          else if (phase === "creating") notification.success("Đang tạo tài liệu...");
        },
      },
    });
  } catch (err) {
    if (/expired/i.test(err?.message || "")) {
      throw new Error(PAID_SUBMIT_FAILURE_TARGET_EXPIRED_MESSAGE);
    }
    // Map orchestrator phase failures to the same user-facing strings
    // that existed before the orchestrator refactor.
    if (/paid upload target|MIME/i.test(err?.message || "")) {
      throw new Error(
        err?.response?.data?.message || err?.message || PAID_SUBMIT_FAILURE_TARGET_MESSAGE
      );
    }
    if (/tải lên|storage|supabase/i.test(err?.message || "")) {
      throw new Error(
        err?.response?.data?.message || err?.message || PAID_SUBMIT_FAILURE_STORAGE_MESSAGE
      );
    }
    throw new Error(
      err?.response?.data?.message || err?.message || PAID_SUBMIT_FAILURE_CREATE_MESSAGE
    );
  }

  const sid = savedDocument?.id;

  // Phase 4C: fire additional quiz generations for configs[1..N]
  if (generateQuiz && sid) {
    await createAdditionalQuizGenerations({
      documentId: sid,
      quizConfigs,
      documentService,
      notification,
    });
  }

  notification.success("Đăng tải tài liệu thành công!");
  if (sid) {
    navigate(`/documents/submitted/${sid}`);
  } else {
    navigate("/submitted-document-details", { state: { document: savedDocument } });
  }
}

/**
 * Edit-mode submit — Phase S1-C2 keeps the legacy metadata-only round-trip
 * flow intact. Paid edit replacement is NOT in this milestone.
 *
 * <p>Phase 7A.2: this function now <strong>returns the saved
 * {@code savedDocument}</strong> instead of calling {@code navigate()}
 * internally, so that {@link handleSubmit} can orchestrate the
 * dirty-Auto-Quiz retries between the document save and the final
 * navigation. Navigation is performed once at the end of
 * {@code handleSubmit}.</p>
 *
 * <p>Phase 7A.4: this function <strong>no longer emits any user-facing
 * success notification</strong>. The previous implementation fired
 * {@code notification.success("Cập nhật tài liệu thành công!")}
 * immediately after the PATCH succeeded, which was premature when a
 * dirty Auto-Quiz retry followed. The final notification is now chosen
 * by {@code handleSubmit} based on the combined result of the document
 * save AND every dirty retry POST. The only user-facing signal this
 * function still emits is a brief info-level "in progress" message so
 * the owner sees that the submit is acknowledged before the network
 * round-trip resolves.</p>
 */
async function submitUpdateDocument({
  formData,
  documentToEdit,
  isPaid,
  normalizedPrice,
  initialIsPaid,
  initialPrice,
  documentService,
  notification,
}) {
  notification.info("Đang cập nhật tài liệu...");

  let docUrl = formData.existingDocumentUrl;
  let docStoragePath = formData.existingStoragePath;
  let thumbUrl = formData.existingThumbnailUrl;
  let docFileName = formData.existingFileName;
  let docFileSizeBytes = formData.existingFileSizeBytes;

  if (formData.documentFile) {
    const docResult = await uploadDocumentToSupabase(
      formData.documentFile,
      "assets/UploadedDocuments"
    );
    docUrl = docResult.url;
    docStoragePath = docResult.path;
    docFileName = formData.documentFile.name;
    docFileSizeBytes = formData.documentFile.size;
  }

  if (formData.thumbnailFile) {
    const thumbResult = await uploadDocumentToSupabase(
      formData.thumbnailFile,
      "assets/UploadedDocuments"
    );
    thumbUrl = thumbResult.url;
  }

  if (!docUrl || !thumbUrl || !docFileName) {
    throw new Error("Thiếu dữ liệu tài liệu sau khi tải file lên.");
  }

  const updateStoragePath = formData.documentFile
    ? (docStoragePath ?? null)
    : null;

  const payload = toUpdatePayload(
    formData,
    docUrl,
    thumbUrl,
    docFileName,
    docFileSizeBytes || 0,
    updateStoragePath,
    isPaid,
    normalizedPrice,
    initialIsPaid,
    initialPrice
  );

  const savedDocument = documentToEdit?.id
    ? await documentService.updateMyDocument(documentToEdit.id, payload)
    : await documentService.createMyDocument(payload);

  return savedDocument;
}

export default function UploadDocument() {
  const navigate = useNavigate();
  const location = useLocation();
  const notification = useNotification();
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const { documentToEdit } = location.state || {};

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isUploading, setIsUploading] = useState(false);
  const [submissionPhase, setSubmissionPhase] = useState(null); // null | "preparing" | "uploading" | "creating"
  const submitInFlightRef = useRef(false);
  // Source-consistent single-flight guard for the submit handler. The
  // orchestrator itself is stateless; this guard is the React-side
  // mechanism that prevents two concurrent submit clicks from launching
  // two paid upload flows.
  const paidSubmissionGuardRef = useRef(createPaidSubmissionGuard());
  const [allTags, setAllTags] = useState([]);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const tagDropdownRef = useRef(null);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const categoryDropdownRef = useRef(null);
  const [categories, setCategories] = useState([]);
  const [isPaid, setIsPaid] = useState(false);
  const [priceDigits, setPriceDigits] = useState("");
  const [editGuardError, setEditGuardError] = useState("");
  const [generateQuiz, setGenerateQuiz] = useState(false);
  const [quizConfigs, setQuizConfigs] = useState([]);

  // Phase 6D: edit-mode existing quiz generations
  const [existingQuizGenerations, setExistingQuizGenerations] = useState([]);
  const [isQuizGenerationsLoading, setIsQuizGenerationsLoading] = useState(false);
  const [quizGenerationsError, setQuizGenerationsError] = useState("");
  const [retryingGenerationId, setRetryingGenerationId] = useState(null);
  const [deletingGenerationId, setDeletingGenerationId] = useState(null);
  const [showQuizDraft, setShowQuizDraft] = useState(false);

  // Edit mode: draft config for "+ Thêm bài đánh giá"
  const [quizDraftCount, setQuizDraftCount] = useState(10);
  const [quizDraftCustomSelected, setQuizDraftCustomSelected] = useState(false);
  const [quizDraftCustomCount, setQuizDraftCustomCount] = useState("");
  const [quizDraftFocus, setQuizDraftFocus] = useState("");
  const [isCreatingDraftQuiz, setIsCreatingDraftQuiz] = useState(false);

  // Edit mode: per-FAILED generation editing (local state)
  const [failedEditValues, setFailedEditValues] = useState({}); // { [generationId]: { questionCount, customSelected, customCount, focusTopic } }

  const QUIZ_FOCUS_MAX_LENGTH = 500;

  // ── Quiz config factory ──────────────────────────────────────────────────
  function createDefaultQuizConfig() {
    return {
      localId: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
      questionCount: 10,
      customSelected: false,
      customCount: "",
      focusTopic: "",
    };
  }

  // isQuizConfigValid checks the count without reading generateQuiz.
  // The outer areQuizConfigsValid guards that generateQuiz must be true.
  const isQuizConfigValid = (config) =>
    resolveQuizCount(config.questionCount, config.customSelected, config.customCount) !== null;

  const areQuizConfigsValid =
    !generateQuiz ||
    (quizConfigs.length > 0 && quizConfigs.every(isQuizConfigValid));

  useEffect(() => {
    if (!documentToEdit) {
      setFormData(EMPTY_FORM);
      setIsPaid(false);
      setPriceDigits("");
      setEditGuardError("");
      setGenerateQuiz(false);
      setQuizConfigs([]);
      return;
    }

    // Re-validate ALL required fields before letting the user touch the form.
    // Direct navigation to /upload-document with malformed documentToEdit is
    // also blocked here.
    const titleVal = documentToEdit.title;
    const descVal = documentToEdit.description;
    const categoryVal = documentToEdit.category || documentToEdit.categoryName;
    const documentUrlVal = documentToEdit.documentUrl;
    const thumbnailUrlVal = documentToEdit.thumbnailUrl;
    const fileNameVal = documentToEdit.fileName;
    const fileSizeBytesVal = documentToEdit.fileSizeBytes;

    const textFieldsValid = [titleVal, descVal, categoryVal, documentUrlVal, thumbnailUrlVal, fileNameVal]
      .every((v) => typeof v === "string" && v.trim().length > 0);
    const tagsValid = Array.isArray(documentToEdit.tags) && documentToEdit.tags.length > 0
      && documentToEdit.tags.every((t) => typeof t === "string" && t.trim().length > 0);
    const sizeValid = typeof fileSizeBytesVal === "number"
      && Number.isFinite(fileSizeBytesVal)
      && Number.isInteger(fileSizeBytesVal)
      && fileSizeBytesVal >= 0;

    if (!textFieldsValid || !tagsValid || !sizeValid) {
      setEditGuardError("Không thể tải tài liệu để chỉnh sửa. Vui lòng quay lại trang trước và thử lại.");
      setFormData({ ...EMPTY_FORM, isEditing: true });
      setIsPaid(false);
      setPriceDigits("");
      return;
    }

    // Pricing — strict boolean check (no Number coercion).
    if (documentToEdit.isPaid !== true && documentToEdit.isPaid !== false) {
      setEditGuardError("Không thể tải tài liệu để chỉnh sửa. Vui lòng quay lại trang trước và thử lại.");
      setFormData({ ...EMPTY_FORM, isEditing: true });
      setIsPaid(false);
      setPriceDigits("");
      return;
    }
    if (documentToEdit.isPaid === true) {
      const p = documentToEdit.price;
      if (
        typeof p !== "number" ||
        !Number.isFinite(p) ||
        !Number.isInteger(p) ||
        p <= 0
      ) {
        setEditGuardError("Không thể tải tài liệu để chỉnh sửa. Vui lòng quay lại trang trước và thử lại.");
        setFormData({ ...EMPTY_FORM, isEditing: true });
        setIsPaid(false);
        setPriceDigits("");
        return;
      }
      setIsPaid(true);
      setPriceDigits(String(p));
    } else {
      if (documentToEdit.price != null && documentToEdit.price !== 0) {
        setEditGuardError("Không thể tải tài liệu để chỉnh sửa. Vui lòng quay lại trang trước và thử lại.");
        setFormData({ ...EMPTY_FORM, isEditing: true });
        setIsPaid(false);
        setPriceDigits("");
        return;
      }
      setIsPaid(false);
      setPriceDigits("");
    }
    setEditGuardError("");

    setFormData({
      title: titleVal,
      description: descVal,
      category: categoryVal,
      tags: documentToEdit.tags,
      documentFile: null,
      thumbnailFile: null,
      confirmed: true,
      isEditing: true,
      existingDocumentUrl: documentUrlVal,
      existingThumbnailUrl: thumbnailUrlVal,
      existingFileName: fileNameVal,
      existingFileSize: documentToEdit.fileSize || null,
      existingFileSizeBytes: fileSizeBytesVal,
      existingStoragePath: documentToEdit.storagePath || null,
    });
  }, [documentToEdit]);

  // Load existing quiz generations when entering edit mode.
  const editDocId = documentToEdit?.id;
  useEffect(() => {
    if (!editDocId) return;
    let cancelled = false;
    setIsQuizGenerationsLoading(true);
    setQuizGenerationsError("");
    documentService.getMyDocumentAutoQuizzes(editDocId)
      .then((data) => {
        if (cancelled) return;
        setExistingQuizGenerations(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setQuizGenerationsError(err?.response?.data?.message || "Không thể tải danh sách bài đánh giá.");
        setExistingQuizGenerations([]);
      })
      .finally(() => {
        if (!cancelled) setIsQuizGenerationsLoading(false);
      });
    return () => { cancelled = true; };
  }, [editDocId]);

  // Polling: while any non-terminal generation exists, keep refreshing.
  useEffect(() => {
    if (!editDocId) return;
    if (!isQuizGenerationsLoading && existingQuizGenerations.length > 0) {
      const hasActive = existingQuizGenerations.some(
        (g) => !TERMINAL_STATUSES.has(String(g?.status || "").toUpperCase())
      );
      if (!hasActive) return;
    }
    const interval = setInterval(() => {
      documentService.getMyDocumentAutoQuizzes(editDocId)
        .then((data) => setExistingQuizGenerations(Array.isArray(data) ? data : []))
        .catch(() => {});
    }, POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [editDocId, isQuizGenerationsLoading, existingQuizGenerations]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let isMounted = true;

    const fetchCategoriesAndTags = async () => {
      try {
        const catData = await sidebarService.getCategories();
        if (!isMounted) return;
        setCategories(Array.isArray(catData) ? catData : []);
      } catch (error) {
        if (!isMounted) return;
        setCategories([]);
        notification.error(
          error?.response?.data?.message || "Không thể tải danh mục tài liệu."
        );
      }

      try {
        const tagData = await sidebarService.getTags();
        if (!isMounted) return;
        setAllTags(Array.isArray(tagData) ? tagData : []);
      } catch {
        if (!isMounted) return;
        try {
          const popTags = await sidebarService.getPopularTags();
          if (!isMounted) return;
          setAllTags(Array.isArray(popTags) ? popTags : []);
        } catch {
          setAllTags([]);
        }
      }
    };

    fetchCategoriesAndTags();
    return () => {
      isMounted = false;
    };
  }, [notification]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target)) {
        setIsTagDropdownOpen(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const MIN_TITLE_LENGTH = 15;
  const MAX_TITLE_LENGTH = 30;
  const MIN_DESCRIPTION_LENGTH = 80;
  const MAX_DESCRIPTION_LENGTH = 160;

  // Single-source price derivation.
  const numericPrice = priceDigits === "" ? null : Number(priceDigits);
  const formattedPrice =
    priceDigits === ""
      ? ""
      : Number(priceDigits).toLocaleString("vi-VN");

  // Edit-mode initial pricing snapshot. Only read after the edit-prefill guard
  // has succeeded, so `documentToEdit` already passed strict type validation.
  const isEditing = formData.isEditing === true;
  const initialIsPaid =
    isEditing && documentToEdit?.isPaid === true;
  const initialPrice =
    initialIsPaid === true &&
    typeof documentToEdit?.price === "number" &&
    Number.isFinite(documentToEdit.price)
      ? documentToEdit.price
      : 0;

  // Derived pricing-changed flag. NOT stored in React state — recomputed from
  // the current pricing snapshot and the edit-mode initial snapshot every
  // render so quick-price chips, slider drags, and manual typing all behave
  // consistently without extra effects.
  const currentNormalizedPrice = isPaid && typeof numericPrice === "number" && Number.isFinite(numericPrice)
    ? numericPrice
    : 0;
  const pricingChanged = isEditing
    && (initialIsPaid !== isPaid || initialPrice !== currentNormalizedPrice);

  // Pricing-lock state (Phase C.1B2). Derived from documentToEdit so the
  // React state cannot drift from the server-side owner-detail response.
  // When lock data is missing or malformed we force-lock the pricing controls
  // — the backend still rejects any real attempt via 409, and the UI must
  // never let the user believe they can change pricing while the lock state
  // is unknown.
  const pricingLockDataValid =
    isEditing && documentToEdit?.pricingLockDataValid === true;
  const pricingLocked =
    isEditing
    && (
      pricingLockDataValid
        ? documentToEdit.pricingLocked === true
        : true
    );
  const lockDataMissing = isEditing && !pricingLockDataValid;
  const successfulPurchaseCount =
    pricingLockDataValid
      ? documentToEdit.successfulPurchaseCount
      : null;

  // Inline price error. Suppress for legacy edit prices that the user has not
  // touched yet — the legacy warning notice carries that information instead
  // and the update-path validator will only reject if the request actually
  // changes pricing.
  const priceError = (() => {
    if (!isPaid) return "";
    if (priceDigits === "") return "Vui lòng nhập giá hợp lệ.";
    if (
      typeof numericPrice !== "number" ||
      !Number.isFinite(numericPrice) ||
      !Number.isInteger(numericPrice) ||
      numericPrice <= 0
    ) {
      return EDIT_PRICING_DATA_INVALID_MESSAGE;
    }
    // Edit mode + unchanged legacy below minimum: no red error, just the
    // amber legacy notice handled in the JSX below.
    if (isEditing && !pricingChanged && numericPrice < MIN_PAID_DOCUMENT_PRICE) {
      return "";
    }
    if (numericPrice < MIN_PAID_DOCUMENT_PRICE) {
      return MIN_PAID_DOCUMENT_PRICE_VALIDATION_MESSAGE;
    }
    return "";
  })();

  // Unchanged-legacy flag drives the legacy warning notice. Strict numeric
  // gate: the initial snapshot must be a positive integer below the minimum
  // and the user must not have touched pricing yet.
  const isUnchangedLegacyPrice =
    isEditing
    && initialIsPaid === true
    && typeof initialPrice === "number"
    && Number.isFinite(initialPrice)
    && initialPrice > 0
    && initialPrice < MIN_PAID_DOCUMENT_PRICE
    && pricingChanged === false;

  // Preview 90/10 — reads numericPrice only.
  const previewPrice =
    typeof numericPrice === "number" && Number.isFinite(numericPrice)
      ? numericPrice
      : 0;
  const platformFee = Math.floor((previewPrice * 10) / 100);
  const sellerNet = previewPrice - platformFee;

  // Slider value — never re-snaps the user's manual input.
  const sliderValue =
    typeof numericPrice === "number" && Number.isFinite(numericPrice)
      ? Math.min(Math.max(numericPrice, PRICE_SLIDER_MIN), PRICE_SLIDER_MAX)
      : PRICE_SLIDER_MIN;

  const isTitleValid =
    formData.title.trim().length >= MIN_TITLE_LENGTH &&
    formData.title.trim().length <= MAX_TITLE_LENGTH;
  const isDescriptionValid =
    formData.description.trim().length >= MIN_DESCRIPTION_LENGTH &&
    formData.description.trim().length <= MAX_DESCRIPTION_LENGTH;

  const isPricingValid =
    !isPaid ||
    (typeof numericPrice === "number" &&
      Number.isFinite(numericPrice) &&
      Number.isInteger(numericPrice) &&
      numericPrice > 0 &&
      (pricingChanged
        ? numericPrice >= MIN_PAID_DOCUMENT_PRICE
        : true));

  // Quiz auto-generation validation (Phase 4C: per-config, array-based).
  // Auto Quiz OFF → always valid.
  // Auto Quiz ON → each config must have a resolved question count in range.
  // focusTopic is always optional.

  // Auto Quiz V1 guard: PDF / DOC / DOCX only. PPT / PPTX uploads are
  // still allowed for storage, but the Auto Quiz toggle is disabled and
  // any previously selected quiz state is forced back to off. The
  // backend remains authoritative; this is a UX guard only.
  const selectedDocumentFileName =
    formData.documentFile?.name || formData.existingFileName || "";
  const isQuizAutoSupportedForFile = isQuizAutoSupported(selectedDocumentFileName);
  const showQuizUnsupportedHint =
    selectedDocumentFileName !== "" && !isQuizAutoSupportedForFile;

  // If the selected file changes to an unsupported type (or back to a
  // supported one), force the Auto Quiz state back to the OFF defaults.
  // Switching back to a supported type does NOT re-enable the toggle —
  // the user must explicitly opt in again.
  useEffect(() => {
    if (selectedDocumentFileName === "") {
      return;
    }
    if (!isQuizAutoSupportedForFile && generateQuiz) {
      setGenerateQuiz(false);
      setQuizConfigs([]);
    }
  }, [selectedDocumentFileName, isQuizAutoSupportedForFile, generateQuiz]);

  // Phase 4C: removed auto-focus for "Tùy chỉnh" custom input
  // because multiple configs make it ambiguous which input to focus.


  const canSubmit =
    isTitleValid &&
    isDescriptionValid &&
    formData.category.trim() !== "" &&
    formData.tags.length > 0 &&
    (formData.documentFile !== null || formData.existingDocumentUrl !== null) &&
    (formData.thumbnailFile !== null || formData.existingThumbnailUrl !== null) &&
    formData.confirmed === true &&
    !isUploading &&
    isPricingValid &&
    !priceError &&
    !editGuardError &&
    areQuizConfigsValid;

  // ── Edit-mode quiz helpers ────────────────────────────────────────────────
  function resolveQuizDraftCount() {
    if (!quizDraftCustomSelected) return quizDraftCount;
    const raw = typeof quizDraftCustomCount === "string" ? quizDraftCustomCount.trim() : "";
    if (raw === "") return null;
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed >= QUIZ_CUSTOM_MIN && parsed <= QUIZ_CUSTOM_MAX) return parsed;
    return null;
  }

  /**
   * Phase 7A.2 — pure helper that normalises a focus topic value
   * coming from either the user's draft or the persisted baseline
   * so that the dirty check is symmetry-safe. Blank / whitespace
   * / null / undefined all collapse to {@code null}. Non-blank
   * input is trimmed before comparison.
   */
  function normaliseFocusDraft(raw) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  function isQuizDraftConfigValid() {
    return resolveQuizDraftCount() !== null;
  }

  function handleRetryGeneration(generationId) {
    const edits = failedEditValues[generationId];
    const count = edits
      ? (edits.customSelected
        ? resolveQuizCount(edits.questionCount, true, edits.customCount)
        : edits.questionCount)
      : null;

    // Phase 7A: send explicit `null` (not empty string) when the owner
    // cleared the focus textarea. The backend service normalises both
    // `""` and whitespace-only to `null` (see
    // QuizGenerationServiceImpl.normaliseFocusTopic), but sending `null`
    // removes any contract ambiguity and matches the API's documented
    // "null = whole document, no focus" semantic.
    const rawFocus = edits ? edits.focusTopic : "";
    const trimmedFocus =
      typeof rawFocus === "string" ? rawFocus.trim() : "";
    const focus = trimmedFocus.length > 0 ? trimmedFocus : null;

    if (count === null) {
      notification.error(QUIZ_COUNT_MESSAGE);
      return;
    }

    if (!window.confirm(
      "Bạn có chắc muốn tạo lại bài đánh giá này?\n" +
      "Bài cũ sẽ được giữ lại trong lịch sử."
    )) return;

    setRetryingGenerationId(generationId);
    documentService.createMyDocumentAutoQuiz(editDocId, {
      requestedQuestionCount: count,
      focusTopic: focus,
    })
      .then(() => {
        notification.success("Đang tạo bài đánh giá mới...");
        return documentService.getMyDocumentAutoQuizzes(editDocId);
      })
      .then((data) => {
        setExistingQuizGenerations(Array.isArray(data) ? data : []);
        setFailedEditValues((prev) => {
          const next = { ...prev };
          delete next[generationId];
          return next;
        });
      })
      .catch((err) => {
        notification.error(err?.response?.data?.message || "Không thể tạo lại bài đánh giá.");
      })
      .finally(() => {
        setRetryingGenerationId(null);
      });
  }

  function handleDeleteGeneration(generationId) {
    if (!window.confirm(
      "Bạn có chắc muốn xóa bài đánh giá này?\n" +
      "Nếu muốn thay đổi số câu hoặc nội dung trọng tâm,\n" +
      "bạn cần xóa bài hiện tại rồi tạo bài mới."
    )) return;

    setDeletingGenerationId(generationId);
    documentService.deleteMyDocumentAutoQuiz(editDocId, generationId)
      .then(() => {
        setExistingQuizGenerations((prev) => prev.filter((g) => g.generationId !== generationId));
        notification.success("Đã xóa bài đánh giá.");
      })
      .catch((err) => {
        const msg = err?.response?.data?.message || "Không thể xóa bài đánh giá.";
        notification.error(msg);
      })
      .finally(() => {
        setDeletingGenerationId(null);
      });
  }

  /**
   * Phase 7A.2 — Direction A orchestrator.
   *
   * After a successful edit-mode document save, iterate over every
   * existing {@code FAILED} generation and POST a new
   * {@code QuizGeneration} <strong>only</strong> when its draft
   * focus / count is genuinely different from the persisted baseline.
   * The user can therefore either:
   *
   * <ol>
   *   <li>Keep the existing FAILED card and click its per-card
   *       "Tạo lại bài đánh giá" button (legacy path).</li>
   *   <li>Edit the focus / count on the FAILED card and press the
   *       global "Cập nhật tài liệu" — this path will create a
   *       fresh generation on success.</li>
   *   <li>Edit only document metadata and press save — no
   *       generation is created (Case 1 of the spec).</li>
   * </ol>
   *
   * <p>Draft vs persisted comparison normalises blank / whitespace
   * focus to {@code null}, so that clearing "ahaha" → blank is
   * recognised as dirty even though both look blank to the user.</p>
   *
   * <p>Failure handling: if some retries succeed and some fail the
   * owner sees a single combined toast. <strong>We never roll back
   * the document save.</strong> The owner can re-attempt the failed
   * generation from the detail page (or via the per-card Retry
   * button on the surviving FAILED cards).</p>
   */
  async function applyDirtyAutoQuizRetriesForGlobalSave({
    editDocId,
    documentService,
    notification,
  }) {
    if (!editDocId) {
      // Defensive: no document id at all. Caller is responsible for
      // its own final toast — this path is unreachable from
      // handleSubmit because savedDocument is checked first.
      return { hadDirtyRetries: false };
    }

    const dirtyRetries = collectDirtyFailedGenerationRetries();
    if (dirtyRetries.length === 0) {
      // Case 1: nothing changed on Auto-Quiz side. No new
      // generation. The caller emits the final success toast.
      return { hadDirtyRetries: false };
    }

    const total = dirtyRetries.length;
    let successCount = 0;
    const failedGenerationIds = [];

    for (const retry of dirtyRetries) {
      try {
        await documentService.createMyDocumentAutoQuiz(editDocId, {
          requestedQuestionCount: retry.count,
          focusTopic: retry.focus,
        });
        successCount += 1;
      } catch (err) {
        failedGenerationIds.push(retry.generationId);
      }
    }

    // Refresh the local generations list so a subsequent navigate
    // lands on a detail page that already shows the new generation
    // at the top and the superseded styling on old FAILED rows.
    try {
      const data = await documentService.getMyDocumentAutoQuizzes(editDocId);
      setExistingQuizGenerations(Array.isArray(data) ? data : []);
    } catch (err) {
      // Silent: the detail page fetches its own list on mount.
    }

    // Clear the dirty drafts whose generation has already been
    // re-attempted, even if the API call partially failed. This
    // keeps a subsequent Save from re-firing duplicates once the
    // user navigates back to the edit form.
    setFailedEditValues((prev) => {
      const next = { ...prev };
      for (const r of dirtyRetries) {
        delete next[r.generationId];
      }
      return next;
    });

    if (failedGenerationIds.length === 0) {
      // All retries succeeded. Single final toast — covers BOTH
      // the document update and the retry creation.
      notification.success(
        total === 1
          ? "Cập nhật tài liệu và tạo lại 1 bài đánh giá thành công."
          : `Cập nhật tài liệu và tạo lại ${total} bài đánh giá thành công.`
      );
    } else if (successCount === 0) {
      // Phase 7A.3: detail page has NO retry action — only the edit
      // page ("Chỉnh sửa") hosts the per-card Tạo lại button. The
      // message must therefore point the owner at Chỉnh sửa, NOT at
      // "trang chi tiết" (which would falsely imply a retry exists
      // there).
      notification.error(
        "Tài liệu đã được cập nhật, nhưng tạo lại bài đánh giá thất bại. "
        + "Bạn có thể mở Chỉnh sửa để thử lại bài đánh giá."
      );
    } else {
      notification.warning(
        `Tài liệu đã được cập nhật. `
        + `${successCount}/${total} bài đánh giá đã được tạo lại, `
        + `${failedGenerationIds.length} thất bại. `
        + `Bạn có thể mở Chỉnh sửa để thử lại những bài còn lại.`
      );
    }

    return { hadDirtyRetries: true };
  }

  /**
   * Inspect every FAILED generation and return the list of retries
   * whose draft focus / count differs from the persisted baseline.
   * Pure function over component state; no side effects.
   */
  function collectDirtyFailedGenerationRetries() {
    const dirty = [];
    for (const gen of existingQuizGenerations) {
      const s = String(gen?.status || "").toUpperCase();
      if (s !== "FAILED") continue;

      const generationId = gen.generationId;
      if (!generationId) continue;

      // Draft (post-edit) values. Use the same getters the FAILED
      // card uses for rendering, so what the user SEES is what gets
      // compared.
      const draftFocusRaw = getFailedFocusTopic(generationId, gen);
      const draftCountRaw = getFailedQuestionCount(generationId, gen);

      // Baseline (persisted). These are also normalised so a
      // baseline of "" or null on the BE side compares equal to a
      // baseline of "" on the FE side.
      const baselineFocus = gen.focusTopic ?? null;
      const baselineCount = gen.requestedQuestionCount ?? null;

      const normalisedDraftFocus = normaliseFocusDraft(draftFocusRaw);
      const normalisedBaselineFocus = normaliseFocusDraft(baselineFocus);

      // Phase 7A.3: dirty comparison MUST use the global Auto Quiz
      // range [QUIZ_COUNT_MIN, QUIZ_COUNT_MAX] = [10, 50], NOT the
      // narrower custom-text range [QUIZ_CUSTOM_MIN, QUIZ_CUSTOM_MAX]
      // = [11, 49]. The custom-min/max pair is a UX gate on the
      // "Tùy chỉnh" <input> only — it intentionally excludes the
      // boundary presets 10 and 50. The persisted requestedQuestionCount
      // value can legitimately be 10 or 50 (because the BE accepts
      // [10, 50] and the preset chips post those exact values), and a
      // dirty comparison must recognise a transition across those
      // boundaries as dirty. Examples that must be classified as
      // dirty: 10→20, 20→50, 50→20, 10→50, 50→10. 20→20 must be clean.
      const draftCountIsValid =
        Number.isInteger(draftCountRaw) &&
        draftCountRaw >= QUIZ_COUNT_MIN &&
        draftCountRaw <= QUIZ_COUNT_MAX;
      const baselineCountIsValid =
        Number.isInteger(baselineCount) &&
        baselineCount >= QUIZ_COUNT_MIN &&
        baselineCount <= QUIZ_COUNT_MAX;

      const focusDirty = normalisedDraftFocus !== normalisedBaselineFocus;
      const countDirty =
        draftCountIsValid &&
        baselineCountIsValid &&
        draftCountRaw !== baselineCount;

      if (focusDirty || countDirty) {
        dirty.push({
          generationId,
          count: draftCountIsValid ? draftCountRaw : baselineCount,
          focus: normalisedDraftFocus,
        });
      }
    }
    return dirty;
  }

  function handleCreateDraftQuiz() {
    const count = resolveQuizDraftCount();
    if (count === null) {
      notification.error(QUIZ_COUNT_MESSAGE);
      return;
    }
    // Phase 7A: same null-not-"" semantics as handleRetryGeneration.
    const trimmedDraftFocus =
      typeof quizDraftFocus === "string" ? quizDraftFocus.trim() : "";
    const focus = trimmedDraftFocus.length > 0 ? trimmedDraftFocus : null;
    setIsCreatingDraftQuiz(true);
    documentService.createMyDocumentAutoQuiz(editDocId, {
      requestedQuestionCount: count,
      focusTopic: focus,
    })
      .then(() => {
        setShowQuizDraft(false);
        setQuizDraftCount(10);
        setQuizDraftCustomSelected(false);
        setQuizDraftCustomCount("");
        setQuizDraftFocus("");
        notification.success("Đang tạo bài đánh giá mới...");
        return documentService.getMyDocumentAutoQuizzes(editDocId);
      })
      .then((data) => {
        setExistingQuizGenerations(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        notification.error(err?.response?.data?.message || "Không thể tạo bài đánh giá.");
      })
      .finally(() => {
        setIsCreatingDraftQuiz(false);
      });
  }

  function getFailedEdit(generationId) {
    return failedEditValues[generationId] || null;
  }

  function setFailedEdit(generationId, patch) {
    setFailedEditValues((prev) => ({
      ...prev,
      [generationId]: { ...(prev[generationId] || {}), ...patch },
    }));
  }

  function getFailedQuestionCount(generationId, generation) {
    const edit = failedEditValues[generationId];
    if (edit) {
      if (edit.customSelected) {
        const raw = typeof edit.customCount === "string" ? edit.customCount.trim() : "";
        if (raw !== "") {
          const parsed = Number(raw);
          if (Number.isInteger(parsed) && parsed >= QUIZ_CUSTOM_MIN && parsed <= QUIZ_CUSTOM_MAX) return parsed;
        }
        return edit.questionCount;
      }
      return edit.questionCount;
    }
    return generation.requestedQuestionCount || 10;
  }

  function getFailedFocusTopic(generationId, generation) {
    const edit = failedEditValues[generationId];
    return edit ? (edit.focusTopic ?? generation.focusTopic ?? "") : (generation.focusTopic ?? "");
  }

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;

    if (type === "checkbox") {
      setFormData((prev) => ({ ...prev, [name]: checked }));
      return;
    }

    if (name === "title" && value.length > MAX_TITLE_LENGTH) return;
    if (name === "description" && value.length > MAX_DESCRIPTION_LENGTH) return;

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleTag = (tagName) => {
    if (isUploading) return;
    setFormData((prev) => {
      const exists = prev.tags.includes(tagName);
      if (exists) {
        return { ...prev, tags: prev.tags.filter((t) => t !== tagName) };
      } else {
        return { ...prev, tags: [...prev.tags, tagName] };
      }
    });
  };

  const removeTag = (tagToRemove) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const selectCategory = (categoryName) => {
    if (isUploading) return;
    setFormData((prev) => ({ ...prev, category: categoryName }));
    setIsCategoryDropdownOpen(false);
    setCategorySearchQuery("");
  };

  const filteredCategories = categories.filter((c) =>
    (c.name || "").toLowerCase().includes(categorySearchQuery.trim().toLowerCase())
  );

  const filteredTags = allTags.filter((t) =>
    (t.name || "").toLowerCase().includes(tagSearchQuery.trim().toLowerCase())
  );

  const handleFileChange = (event, field) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFormData((prev) => ({
      ...prev,
      [field]: file,
      ...(field === "documentFile"
        ? {
            existingDocumentUrl: null,
            existingFileName: null,
            existingFileSize: null,
            existingFileSizeBytes: null,
            existingStoragePath: null,
          }
        : {
            existingThumbnailUrl: null,
          }),
    }));
  };

  const removeFile = (field) => {
    setFormData((prev) => ({
      ...prev,
      [field]: null,
      ...(field === "documentFile"
        ? {
            existingDocumentUrl: null,
            existingFileName: null,
            existingFileSize: null,
            existingFileSizeBytes: null,
            existingStoragePath: null,
          }
        : {
            existingThumbnailUrl: null,
          }),
    }));
  };

  const handlePricingModeChange = (nextIsPaid) => {
    if (pricingLocked) return;
    if (nextIsPaid === isPaid) return;
    if (nextIsPaid) {
      // User-initiated Free → Paid: if the current numeric price is invalid
      // or below the current minimum price (3,000 VND), snap to the minimum.
      // This is the only allowed automatic minimum-price assignment.
      setIsPaid(true);
      const next =
        typeof numericPrice === "number" &&
        Number.isFinite(numericPrice) &&
        Number.isInteger(numericPrice) &&
        numericPrice >= MIN_PAID_DOCUMENT_PRICE
          ? numericPrice
          : MIN_PAID_DOCUMENT_PRICE;
      setPriceDigits(String(next));
    } else {
      setIsPaid(false);
      setPriceDigits("");
    }
  };

  // Quiz auto-generation toggle.
  // ON  → add one default config if list is empty.
  // OFF → clear all configs.
  const handleGenerateQuizChange = (event) => {
    const checked = Boolean(event.target.checked);
    setGenerateQuiz(checked);
    if (checked) {
      setQuizConfigs((prev) =>
        prev.length === 0 ? [createDefaultQuizConfig()] : prev
      );
    } else {
      setQuizConfigs([]);
    }
  };

  // Per-config custom count change handler — defined inline in JSX via closures
  // so each config card gets its own bound localId.

  const handlePriceInputChange = (event) => {
    if (pricingLocked) return;
    const nextDigits = String(event.target.value).replace(/[^\d]/g, "");
    setPriceDigits(nextDigits);
  };

  const handleSliderChange = (event) => {
    if (pricingLocked) return;
    const raw = Number(event.target.value);
    if (!Number.isFinite(raw) || !Number.isInteger(raw)) return;
    setPriceDigits(String(raw));
  };

  const applyQuickPrice = (value) => {
    if (pricingLocked) return;
    setIsPaid(true);
    setPriceDigits(String(value));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    // 0. Double-submit guard (works even before setState flushes on the
    //    first click; covers React 19's concurrent rendering too).
    if (submitInFlightRef.current || isUploading) {
      return;
    }

    // 1. Edit guard — pre-fill validation produced an error.
    if (editGuardError) {
      notification.error(editGuardError);
      return;
    }

    // 2. Pricing validation — STRICT. Runs BEFORE any Supabase upload or
    //    backend API call so a bad paid price never creates storage garbage
    //    and never silently coerces to 3,000. Create / update have separate
    //    helpers: create always enforces the minimum, update allows a
    //    metadata-only round-trip of a legacy price below the minimum.
    let normalizedPrice;
    try {
      normalizedPrice = formData.isEditing
        ? getValidatedUpdatePrice({
            isPaid,
            price: numericPrice,
            initialIsPaid,
            initialPrice,
          })
        : getValidatedCreatePrice(isPaid, numericPrice);
    } catch (e) {
      notification.error(e.message);
      return;
    }

    // 3. Inline price error guard (derived from priceDigits). For edit mode
    //    with unchanged legacy pricing this stays empty so the user is not
    //    blocked from a metadata-only save.
    if (priceError) {
      notification.error(priceError);
      return;
    }

    // 4. Existing canSubmit conditions.
    if (!canSubmit) {
      notification.error("Vui lòng điền đầy đủ thông tin và xác nhận điều khoản trước khi đăng tải.");
      return;
    }

    submitInFlightRef.current = true;
    setIsUploading(true);

    // Branch the submit flow by pricing mode so the two paths never share
    // any Supabase upload step or any create-document payload field. The
    // FREE branch is unchanged from before Phase S1-C2; the PAID branch is
    // new and never falls through to the free branch.
    if (!paidSubmissionGuardRef.current.tryStart()) {
      // Another submit is already in flight — silently ignore.
      return;
    }
    try {
      if (isPaid && !formData.isEditing) {
        await submitPaidDocument({
          formData,
          normalizedPrice,
          notification,
          navigate,
          setSubmissionPhase,
          documentService,
          quizConfigs,
        });
      } else if (formData.isEditing) {
        const savedDocument = await submitUpdateDocument({
          formData,
          documentToEdit,
          isPaid,
          normalizedPrice,
          initialIsPaid,
          initialPrice,
          documentService,
          notification,
        });

        // Phase 7A.2 — Direction A: when the user has edited a FAILED
        // Auto-Quiz config and pressed the global Save, create a fresh
        // QuizGeneration for every FAILED row whose draft focus /
        // count differs from the persisted baseline. The historical
        // FAILED row stays untouched. If nothing is dirty (the user
        // only edited title / description / category), no retry is
        // fired.
        let hadDirtyRetries = false;
        if (savedDocument) {
          const result = await applyDirtyAutoQuizRetriesForGlobalSave({
            editDocId: documentToEdit?.id,
            documentService,
            notification,
          });
          hadDirtyRetries = result.hadDirtyRetries;
        }

        // Phase 7A.4 — final notification policy.
        // submitUpdateDocument no longer fires the "Cập nhật tài liệu
        // thành công!" success toast itself, because doing so before
        // the dirty-retry orchestration produced a premature success
        // that contradicted any later partial-failure warning. The
        // orchestrator above is the SOLE emitter of a success,
        // warning, or error toast for the edit-mode flow:
        //   - hadDirtyRetries === false   → orchestrator emitted
        //     nothing for the Auto-Quiz side, so we MUST emit exactly
        //     one "Cập nhật tài liệu thành công!" toast here.
        //   - hadDirtyRetries === true    → orchestrator already
        //     emitted the combined result toast (success / warning /
        //     error). We must NOT emit another success here, or the
        //     owner sees two contradictory messages.
        if (savedDocument && !hadDirtyRetries) {
          notification.success("Cập nhật tài liệu thành công!");
        }

        // Navigation happens AFTER dirty retries + refetch so the
        // detail page renders the freshly created generation at the
        // top of the history and the superseded pill on the old
        // FAILED card.
        const sid = savedDocument?.id || documentToEdit?.id;
        if (sid) {
          navigate(`/documents/submitted/${sid}`);
        } else {
          navigate("/submitted-document-details", {
            state: { document: savedDocument },
          });
        }
      } else {
        await submitFreeDocument({
          formData,
          notification,
          navigate,
          quizConfigs,
          documentService,
        });
      }
    } catch (error) {
      notification.error(getSafeSubmitErrorMessage(error));
    } finally {
      paidSubmissionGuardRef.current.finish();
      submitInFlightRef.current = false;
      setIsUploading(false);
      setSubmissionPhase(null);
    }
  };

  const displayedFileSize = formData.documentFile
    ? toMb(formData.documentFile.size)
    : formData.existingFileSize;

  if (editGuardError) {
    return (
      <div className="upload-document-container">
        <div className="upload-document-content">
          <div className="upload-header">
            <h1 className="upload-title">Không thể chỉnh sửa</h1>
            <p className="upload-subtitle">Đã xảy ra sự cố khi tải dữ liệu tài liệu.</p>
          </div>
          <div className="upload-form-card edit-guard-card">
            <h2 className="edit-guard-card__title">Không thể tải tài liệu để chỉnh sửa</h2>
            <p className="edit-guard-card__message">{editGuardError}</p>
            <div className="edit-guard-card__actions">
              <button type="button" className="cancel-btn" onClick={() => navigate(-1)}>
                Quay lại
              </button>
              <button
                type="button"
                className="submit-btn"
                onClick={() => navigate("/manage-documents")}
              >
                Quản lý tài liệu
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="upload-document-container">
      <div className="upload-document-content">
        <div className="upload-header">
          <h1 className="upload-title">
            {formData.isEditing ? "Chỉnh sửa tài liệu" : "Đăng tải tài liệu mới"}
          </h1>
          <p className="upload-subtitle">
            {formData.isEditing
              ? "Cập nhật thông tin tài liệu của bạn."
              : "Chia sẻ kiến thức của bạn với cộng đồng StudyIT."}
          </p>
        </div>

        <div className="upload-form-card">
          <form onSubmit={handleSubmit}>
            <div className="form-section">
              <label className="form-label">Tiêu đề tài liệu</label>
              <input
                type="text"
                name="title"
                className="form-input"
                placeholder="Ví dụ: Tài liệu C# cơ bản"
                value={formData.title}
                onChange={handleInputChange}
                required
                disabled={isUploading}
              />
              {formData.title.trim().length === 0 && (
                <p className="form-hint error">Vui lòng nhập tiêu đề tài liệu.</p>
              )}
              {formData.title.trim().length > 0 &&
                formData.title.trim().length < MIN_TITLE_LENGTH && (
                  <p className="form-hint error">
                    Tiêu đề phải có ít nhất {MIN_TITLE_LENGTH} ký tự.
                  </p>
                )}
            </div>

            <div className="form-section">
              <label className="form-label">Mô tả tài liệu</label>
              <textarea
                name="description"
                className="form-textarea"
                placeholder="Mô tả ngắn gọn về nội dung, đối tượng phù hợp hoặc những lưu ý khi sử dụng tài liệu này..."
                value={formData.description}
                onChange={handleInputChange}
                required
                disabled={isUploading}
              ></textarea>
              {formData.description.trim().length === 0 && (
                <p className="form-hint error">Vui lòng nhập mô tả tài liệu.</p>
              )}
              {formData.description.trim().length > 0 &&
                formData.description.trim().length < MIN_DESCRIPTION_LENGTH && (
                  <p className="form-hint error">
                    Mô tả phải có ít nhất {MIN_DESCRIPTION_LENGTH} ký tự.
                  </p>
                )}
            </div>

            <div className="form-row form-section">
              <div>
                <label className="form-label">
                  Danh mục <span className="required-star">*</span>
                </label>
                <div className="tags-picker-wrapper" ref={categoryDropdownRef}>
                  <div
                    className={`tags-input-container ${isCategoryDropdownOpen ? "active" : ""}`}
                    onClick={() => !isUploading && setIsCategoryDropdownOpen((prev) => !prev)}
                    tabIndex={0}
                  >
                    <div className="tags-chips-area">
                      {formData.category ? (
                        <span className="selected-single-value">{formData.category}</span>
                      ) : (
                        <span className="tags-placeholder">Chọn danh mục phù hợp...</span>
                      )}
                    </div>
                    <span className={`tags-dropdown-arrow ${isCategoryDropdownOpen ? "open" : ""}`}>
                      ▼
                    </span>
                  </div>

                  {isCategoryDropdownOpen && !isUploading && (
                    <div className="tags-dropdown-menu">
                      <div className="tags-search-header" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          className="tags-search-input"
                          placeholder="Tìm kiếm danh mục..."
                          value={categorySearchQuery}
                          onChange={(e) => setCategorySearchQuery(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <div className="tags-list-container">
                        {filteredCategories.length > 0 ? (
                          filteredCategories.map((cat) => {
                            const isSelected = formData.category === cat.name;
                            return (
                              <div
                                key={cat.id || cat.name}
                                className={`tag-dropdown-option ${isSelected ? "selected" : ""}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectCategory(cat.name);
                                }}
                              >
                                <div className="tag-option-label">
                                  <span>{cat.name}</span>
                                </div>
                                {isSelected && <span className="picker-check-badge">✓</span>}
                              </div>
                            );
                          })
                        ) : (
                          <div className="tag-empty-message">Không tìm thấy danh mục phù hợp</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {formData.category.trim() === "" && (
                  <p className="form-hint error">Vui lòng chọn danh mục phù hợp.</p>
                )}
              </div>
              <div>
                <label className="form-label">Thẻ (Tags)</label>
                <div className="tags-picker-wrapper" ref={tagDropdownRef}>
                  <div
                    className={`tags-input-container ${isTagDropdownOpen ? "active" : ""}`}
                    onClick={() => !isUploading && setIsTagDropdownOpen((prev) => !prev)}
                    tabIndex={0}
                  >
                    <div className="tags-chips-area">
                      {formData.tags.map((tag) => (
                        <span key={tag} className="tag-item">
                          {tag}
                          <span
                            className="tag-remove"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isUploading) removeTag(tag);
                            }}
                          >
                            ×
                          </span>
                        </span>
                      ))}
                      {formData.tags.length === 0 && (
                        <span className="tags-placeholder">Nhấp để chọn thẻ...</span>
                      )}
                    </div>
                    <span className={`tags-dropdown-arrow ${isTagDropdownOpen ? "open" : ""}`}>
                      ▼
                    </span>
                  </div>

                  {isTagDropdownOpen && !isUploading && (
                    <div className="tags-dropdown-menu">
                      <div className="tags-search-header" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          className="tags-search-input"
                          placeholder="Tìm kiếm thẻ..."
                          value={tagSearchQuery}
                          onChange={(e) => setTagSearchQuery(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <div className="tags-list-container">
                        {filteredTags.length > 0 ? (
                          filteredTags.map((t) => {
                            const isSelected = formData.tags.includes(t.name);
                            return (
                              <div
                                key={t.id || t.name}
                                className={`tag-dropdown-option ${isSelected ? "selected" : ""}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTag(t.name);
                                }}
                              >
                                <div className="tag-option-label">
                                  <span className={`tag-checkbox ${isSelected ? "checked" : ""}`}>
                                    {isSelected ? "✓" : ""}
                                  </span>
                                  <span>{t.name}</span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="tag-empty-message">Không tìm thấy thẻ phù hợp</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {formData.tags.length === 0 && (
                  <p className="form-hint">Vui lòng chọn ít nhất một thẻ.</p>
                )}
              </div>
            </div>

            <div className="form-section">
              <label className="form-label">
                Tệp tài liệu <span className="required-star">*</span>
              </label>
              <div
                className={`dropzone ${
                  formData.documentFile || formData.existingDocumentUrl || isUploading
                    ? "dropzone-disabled"
                    : ""
                }`}
                onClick={
                  formData.documentFile || formData.existingDocumentUrl || isUploading
                    ? undefined
                    : () => fileInputRef.current?.click()
                }
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={(event) => handleFileChange(event, "documentFile")}
                  accept=".pdf,.doc,.docx,.ppt,.pptx"
                  disabled={Boolean(
                    formData.documentFile || formData.existingDocumentUrl || isUploading
                  )}
                />
                <div className="dropzone-icon">
                  <FileUploadIcon />
                </div>
                <p className="dropzone-text">
                  {formData.documentFile || formData.existingDocumentUrl
                    ? "Đã tải lên 1 tệp"
                    : "Kéo thả hoặc nhấp để tải tệp"}
                </p>
                <p className="dropzone-subtext">
                  Hỗ trợ PDF, DOCX, PPTX. Chỉ cho phép 1 tệp.
                </p>
              </div>
            </div>

            {(formData.documentFile || formData.existingDocumentUrl) && (
              <div className="form-section uploaded-file-preview">
                <p className="preview-section-title">Xem trước tệp đã chọn</p>
                <div className="file-preview-card">
                  <div className="file-preview-info">
                    <div className="file-type-icon">
                      <PdfIcon />
                    </div>
                    <div className="file-details">
                      <span className="file-name">
                        {formData.documentFile?.name || formData.existingFileName}
                      </span>
                      <span className="file-meta">{displayedFileSize} MB • Đã sẵn sàng</span>
                    </div>
                  </div>
                  <div className="remove-file" onClick={isUploading ? undefined : () => removeFile("documentFile")}>
                    <TrashIcon />
                  </div>
                </div>
              </div>
            )}

            <div className="form-section">
              <label className="form-label">Ảnh minh họa tài liệu</label>
              <div
                className={`dropzone ${
                  formData.thumbnailFile || formData.existingThumbnailUrl || isUploading
                    ? "dropzone-disabled"
                    : ""
                }`}
                onClick={
                  formData.thumbnailFile || formData.existingThumbnailUrl || isUploading
                    ? undefined
                    : () => imageInputRef.current?.click()
                }
              >
                <input
                  type="file"
                  ref={imageInputRef}
                  style={{ display: "none" }}
                  onChange={(event) => handleFileChange(event, "thumbnailFile")}
                  accept="image/*"
                  disabled={Boolean(
                    formData.thumbnailFile || formData.existingThumbnailUrl || isUploading
                  )}
                />
                <div className="dropzone-icon">
                  <ImageIcon />
                </div>
                <p className="dropzone-text">
                  {formData.thumbnailFile || formData.existingThumbnailUrl
                    ? "Đã tải lên 1 ảnh"
                    : "Tải lên ảnh bìa hoặc kéo thả"}
                </p>
                <p className="dropzone-subtext">Hỗ trợ JPG, PNG. Chỉ cho phép 1 ảnh.</p>
              </div>
            </div>

            {(formData.thumbnailFile || formData.existingThumbnailUrl) && (
              <div className="form-section uploaded-image-preview">
                <p className="preview-section-title">Xem trước ảnh đã chọn</p>
                <div className="image-preview-card">
                  <img
                    src={
                      formData.thumbnailFile
                        ? URL.createObjectURL(formData.thumbnailFile)
                        : formData.existingThumbnailUrl
                    }
                    alt="Ảnh minh họa"
                    className="thumbnail-preview-img"
                  />
                  <div className="image-details">
                    <span className="image-name">
                      {formData.thumbnailFile?.name || "Thumbnail hiện tại"}
                    </span>
                    <span className="image-meta">
                      {formData.thumbnailFile ? toMb(formData.thumbnailFile.size) : "-"} MB
                    </span>
                  </div>
                  <div className="remove-image" onClick={isUploading ? undefined : () => removeFile("thumbnailFile")}>
                    <TrashIcon />
                  </div>
                </div>
              </div>
            )}

            <div className="confirmation-section">
              <div className="checkbox-wrapper">
                <input
                  type="checkbox"
                  id="confirm"
                  name="confirmed"
                  className="checkbox-input"
                  checked={formData.confirmed}
                  onChange={handleInputChange}
                  disabled={isUploading}
                />
                <label htmlFor="confirm" className="checkbox-label">
                  Tôi xác nhận nội dung này hợp lệ, không vi phạm bản quyền và tuân thủ điều khoản cộng đồng của StudyIT.
                </label>
              </div>
            </div>

            <div className="form-section quiz-section">
              <label className="form-label">Bài đánh giá tự động</label>

              {/* ── EDIT MODE: show existing generations ── */}
              {isEditing && !isQuizGenerationsLoading ? (
                <div className="quiz-generations-list" data-block="quiz-existing">
                  {/* Phase 7A.2 — Direction A: clarifying UX boundary. The textarea
                    + per-card "Tạo lại bài đánh giá" buttons below are
                    Auto-Quiz controls. Editing them and pressing the
                    global "Cập nhật tài liệu" DOES create new
                    generations for any dirty FAILED config (Phase 7A.2
                    Direction A). Editing only document metadata and
                    pressing Save does NOT trigger any new generation.
                    The per-card "Tạo lại bài đánh giá" button still
                    works independently for users who prefer not to
                    touch document metadata when retrying. */}
                  {existingQuizGenerations.some(
                    (g) =>
                      String(g?.status || "").toUpperCase() === "FAILED"
                  ) ? (
                    <p
                      className="form-hint quiz-retry-hint"
                      role="note"
                      data-block="quiz-retry-hint"
                    >
                      Bạn có thể bấm <strong>Tạo lại bài đánh giá</strong> trên
                      từng thẻ để thử lại ngay, hoặc chỉnh cấu hình rồi bấm{" "}
                      <em>Cập nhật tài liệu</em> cuối trang để lưu cả thông tin
                      tài liệu lẫn các thay đổi của cấu hình bài đánh giá đã
                      thất bại. Nếu chỉ sửa tiêu đề / mô tả / danh mục mà không
                      đổi cấu hình bài đánh giá, hệ thống sẽ không tạo thêm
                      bài đánh giá mới.
                    </p>
                  ) : null}
                  {quizGenerationsError ? (
                    <p className="form-hint error">{quizGenerationsError}</p>
                  ) : existingQuizGenerations.length === 0 ? (
                    <p className="form-hint">Chưa có bài đánh giá tự động nào cho tài liệu này.</p>
                  ) : (
                    existingQuizGenerations.map((gen) => {
                      const s = (gen.status || "").toUpperCase();
                      const isRetryable = s === "FAILED";
                      const isDeletable = s === "READY";
                      const isRetryLoading = retryingGenerationId === gen.generationId;
                      const isDeleteLoading = deletingGenerationId === gen.generationId;
                      const questionCount = gen.quiz?.totalQuestions ?? gen.requestedQuestionCount ?? 0;
                      const focusTopic = gen.focusTopic || "";
                      const focusDisplay = focusTopic ? focusTopic : "Toàn bộ tài liệu";
                      const focusMismatch = gen.lastError === FAILED_FOCUS_MISMATCH;

                      if (s === "READY") {
                        return (
                          <div key={gen.generationId} className="quiz-generation-card quiz-generation-card--ready" title="Bài đánh giá này đã được tạo. Không thể thay đổi số câu hoặc nội dung trọng tâm. Hãy xóa bài đánh giá và tạo bài mới nếu muốn thay đổi yêu cầu.">
                            <div className="quiz-generation-card-header">
                              <span className="quiz-generation-title">{gen.quiz?.title || "Bài đánh giá"}</span>
                              <span className="quiz-generation-badge quiz-generation-badge--ready">{EDIT_QUIZ_STATUS_LABELS.READY}</span>
                            </div>
                            <div className="quiz-generation-meta">
                              <span>{questionCount} câu hỏi</span>
                              <span>•</span>
                              <span>Trọng tâm: <strong>{focusDisplay}</strong></span>
                            </div>
                            <div className="quiz-generation-actions">
                              {gen.quiz?.quizId && (
                                <button
                                  type="button"
                                  className="quiz-generation-preview-btn"
                                  onClick={() => navigate(`/quiz/${gen.quiz.quizId}/preview?from=edit&documentId=${editDocId}`)}
                                >
                                  Xem trước
                                </button>
                              )}
                              <button
                                type="button"
                                className="quiz-generation-delete-btn"
                                disabled={isDeleteLoading}
                                onClick={() => handleDeleteGeneration(gen.generationId)}
                              >
                                {isDeleteLoading ? "Đang xóa..." : "Xóa"}
                              </button>
                            </div>
                          </div>
                        );
                      }

                      if (s === "FAILED") {
                        const failedCount = getFailedQuestionCount(gen.generationId, gen);
                        const failedEdit = getFailedEdit(gen.generationId);
                        const failedCustomSelected = failedEdit ? failedEdit.customSelected : false;
                        const failedCustomCount = failedEdit ? (failedEdit.customCount || "") : "";
                        const failedFocus = getFailedFocusTopic(gen.generationId, gen);
                        const countChipActive = (val) =>
                          !failedCustomSelected && failedCount === val;
                        const countChipCustomActive = failedCustomSelected;
                        // Phase 7A.4 — chronology-based "superseded"
                        // decision. A FAILED generation is historical
                        // when at least one OTHER generation in the
                        // current list has a strictly later
                        // `requestedAt`, REGARDLESS of that other
                        // generation's status. The previous rule
                        // excluded newer FAILED / CANCELLED rows from
                        // the comparison, which incorrectly kept an
                        // older FAILED card un-marked when the newer
                        // attempt also failed. The rule now matches
                        // the detail-page chronology (list[0] is
                        // always latest; older FAILED = history).
                        //
                        // We still respect the requestedAt parse as a
                        // tiebreaker when both sides have parseable
                        // timestamps, and fall back to a position-only
                        // heuristic when they do not.
                        const genRequestedAt =
                          typeof gen?.requestedAt === "string"
                            ? gen.requestedAt
                            : null;
                        const genRequestedAtMs =
                          genRequestedAt ? Date.parse(genRequestedAt) : NaN;
                        const superseded = existingQuizGenerations.some(
                          (other) => {
                            if (!other || other.generationId === gen.generationId) {
                              return false;
                            }
                            if (Number.isFinite(genRequestedAtMs)) {
                              const otherRequestedAt =
                                typeof other?.requestedAt === "string"
                                  ? other.requestedAt
                                  : null;
                              if (otherRequestedAt) {
                                const otherMs = Date.parse(otherRequestedAt);
                                if (Number.isFinite(otherMs)) {
                                  return otherMs > genRequestedAtMs;
                                }
                              }
                            }
                            // No parseable timestamps on at least one
                            // side: fall back to ordering. The BE
                            // returns requestedAt DESC so any other
                            // row that appears BEFORE this row in the
                            // current list is strictly newer by
                            // construction. We mirror that with a
                            // position check.
                            const otherIdx = existingQuizGenerations.indexOf(other);
                            const selfIdx = existingQuizGenerations.indexOf(gen);
                            return otherIdx >= 0 && selfIdx >= 0 && otherIdx < selfIdx;
                          }
                        );

                        return (
                          <div
                            key={gen.generationId}
                            className={
                              "quiz-generation-card quiz-generation-card--failed"
                              + (superseded ? " quiz-generation-card--superseded" : "")
                            }
                          >
                            <div className="quiz-generation-card-header">
                              <span className="quiz-generation-title">Bài đánh giá</span>
                              <span className="quiz-generation-badge quiz-generation-badge--failed">{EDIT_QUIZ_STATUS_LABELS.FAILED}</span>
                            </div>
                            {superseded ? (
                              <p className="quiz-generation-superseded-note">
                                Đã được thay thế bằng một bài đánh giá mới bên dưới. Bài cũ được giữ lại trong lịch sử.
                              </p>
                            ) : null}
                            <div className="quiz-generation-error-message">
                              {focusMismatch
                                ? "Nội dung trọng tâm không phù hợp hoặc không có đủ thông tin trong tài liệu. Bạn có thể chỉnh sửa yêu cầu và tạo lại."
                                : (gen.lastError || "Không thể tạo bài đánh giá.")}
                            </div>
                            <div className="quiz-generation-meta">
                              <span>Trọng tâm: <strong>{focusDisplay}</strong></span>
                            </div>
                            <div className="quiz-generation-count-row">
                              <span className="quiz-generation-count-label">Số câu hỏi</span>
                              <div className="quiz-count-chips" role="radiogroup">
                                {QUIZ_COUNT_OPTIONS.map((val) => (
                                  <button
                                    key={val}
                                    type="button"
                                    role="radio"
                                    aria-checked={countChipActive(val)}
                                    className={`quiz-count-chip${countChipActive(val) ? " active" : ""}`}
                                    onClick={() => setFailedEdit(gen.generationId, { questionCount: val, customSelected: false })}
                                    disabled={isRetryLoading}
                                  >
                                    {val}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  role="radio"
                                  aria-checked={countChipCustomActive}
                                  className={`quiz-count-chip${countChipCustomActive ? " active" : ""}`}
                                  onClick={() => setFailedEdit(gen.generationId, { customSelected: true })}
                                  disabled={isRetryLoading}
                                >
                                  Tùy chỉnh
                                </button>
                              </div>
                            </div>
                            {failedCustomSelected && (
                              <div className="quiz-count-custom-row">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  className="form-input"
                                  value={failedCustomCount}
                                  onChange={(e) => setFailedEdit(gen.generationId, { customCount: e.target.value })}
                                  placeholder={`Nhập số câu (${QUIZ_CUSTOM_MIN}–${QUIZ_CUSTOM_MAX})`}
                                  maxLength={2}
                                  disabled={isRetryLoading}
                                />
                              </div>
                            )}
                            <div className="quiz-generation-focus-row">
                              <label className="form-label">Nội dung trọng tâm <span className="optional-label">(không bắt buộc)</span></label>
                              <textarea
                                className="form-textarea quiz-config-focus-textarea"
                                value={failedFocus}
                                onChange={(e) => setFailedEdit(gen.generationId, { focusTopic: e.target.value })}
                                placeholder="Ví dụ: Nhà nước pháp quyền, Chương 2, Vai trò của pháp luật..."
                                maxLength={QUIZ_FOCUS_MAX_LENGTH}
                                disabled={isRetryLoading}
                              />
                              <p className="form-hint quiz-config-focus-counter">{failedFocus.length}/{QUIZ_FOCUS_MAX_LENGTH}</p>
                            </div>
                            <div className="quiz-generation-actions">
                              <button
                                type="button"
                                className="quiz-generation-retry-btn"
                                disabled={isRetryLoading}
                                onClick={() => handleRetryGeneration(gen.generationId)}
                              >
                                {isRetryLoading ? "Đang tạo lại..." : "Tạo lại bài đánh giá"}
                              </button>
                            </div>
                          </div>
                        );
                      }

                      if (s === "WAITING_SOURCE" || s === "QUEUED" || s === "PROCESSING") {
                        return (
                          <div key={gen.generationId} className="quiz-generation-card quiz-generation-card--processing">
                            <div className="quiz-generation-card-header">
                              <span className="quiz-generation-title">Bài đánh giá</span>
                              <span className="quiz-generation-badge quiz-generation-badge--processing">
                                <span className="quiz-generation-spinner" />
                                {EDIT_QUIZ_STATUS_LABELS[s]}
                              </span>
                            </div>
                            <div className="quiz-generation-meta">
                              <span>Trọng tâm: <strong>{focusDisplay}</strong></span>
                            </div>
                          </div>
                        );
                      }

                      // CANCELLED and any other status
                      return (
                        <div key={gen.generationId} className="quiz-generation-card quiz-generation-card--cancelled">
                          <div className="quiz-generation-card-header">
                            <span className="quiz-generation-title">Bài đánh giá</span>
                            <span className="quiz-generation-badge quiz-generation-badge--cancelled">{EDIT_QUIZ_STATUS_LABELS.CANCELLED}</span>
                          </div>
                          <div className="quiz-generation-meta">
                            <span>Trọng tâm: <strong>{focusDisplay}</strong></span>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* ── ADD NEW QUIZ DRAFT (edit mode only) ── */}
                  {!showQuizDraft ? (
                    <button
                      type="button"
                      className="quiz-config-add-btn"
                      onClick={() => setShowQuizDraft(true)}
                    >
                      + Thêm bài đánh giá
                    </button>
                  ) : (
                    <div className="quiz-generation-card quiz-generation-card--draft">
                      <div className="quiz-generation-card-header">
                        <span className="quiz-generation-title">Bài đánh giá mới</span>
                      </div>
                      <div className="quiz-generation-count-row">
                        <span className="quiz-generation-count-label">Số câu hỏi</span>
                        <div className="quiz-count-chips" role="radiogroup">
                          {QUIZ_COUNT_OPTIONS.map((val) => (
                            <button
                              key={val}
                              type="button"
                              role="radio"
                              aria-checked={!quizDraftCustomSelected && quizDraftCount === val}
                              className={`quiz-count-chip${(!quizDraftCustomSelected && quizDraftCount === val) ? " active" : ""}`}
                              onClick={() => { setQuizDraftCount(val); setQuizDraftCustomSelected(false); setQuizDraftCustomCount(""); }}
                              disabled={isCreatingDraftQuiz}
                            >
                              {val}
                            </button>
                          ))}
                          <button
                            type="button"
                            role="radio"
                            aria-checked={quizDraftCustomSelected}
                            className={`quiz-count-chip${quizDraftCustomSelected ? " active" : ""}`}
                            onClick={() => setQuizDraftCustomSelected(true)}
                            disabled={isCreatingDraftQuiz}
                          >
                            Tùy chỉnh
                          </button>
                        </div>
                      </div>
                      {quizDraftCustomSelected && (
                        <div className="quiz-count-custom-row">
                          <input
                            type="text"
                            inputMode="numeric"
                            className="form-input"
                            value={quizDraftCustomCount}
                            onChange={(e) => {
                              const raw = e.target.value ?? "";
                              if (!/^\d{0,2}$/.test(raw)) return;
                              setQuizDraftCustomCount(raw);
                            }}
                            placeholder={`Nhập số câu (${QUIZ_CUSTOM_MIN}–${QUIZ_CUSTOM_MAX})`}
                            maxLength={2}
                            disabled={isCreatingDraftQuiz}
                          />
                        </div>
                      )}
                      <div className="quiz-generation-focus-row">
                        <label className="form-label">
                          Nội dung trọng tâm <span className="optional-label">(không bắt buộc)</span>
                        </label>
                        <textarea
                          className="form-textarea quiz-config-focus-textarea"
                          value={quizDraftFocus}
                          onChange={(e) => setQuizDraftFocus(e.target.value)}
                          placeholder="Ví dụ: Nhà nước pháp quyền, Chương 2, Vai trò của pháp luật..."
                          maxLength={QUIZ_FOCUS_MAX_LENGTH}
                          disabled={isCreatingDraftQuiz}
                        />
                        <p className="form-hint quiz-config-focus-counter">{quizDraftFocus.length}/{QUIZ_FOCUS_MAX_LENGTH}</p>
                      </div>
                      <div className="quiz-draft-actions">
                        <button
                          type="button"
                          className="quiz-draft-submit-btn"
                          disabled={!isQuizDraftConfigValid() || isCreatingDraftQuiz}
                          onClick={handleCreateDraftQuiz}
                        >
                          {isCreatingDraftQuiz ? "Đang tạo..." : "Tạo bài đánh giá"}
                        </button>
                        <button
                          type="button"
                          className="quiz-draft-cancel-btn"
                          disabled={isCreatingDraftQuiz}
                          onClick={() => {
                            setShowQuizDraft(false);
                            setQuizDraftCount(10);
                            setQuizDraftCustomSelected(false);
                            setQuizDraftCustomCount("");
                            setQuizDraftFocus("");
                          }}
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : isEditing ? (
                <p className="form-hint">Đang tải bài đánh giá...</p>
              ) : null}

              {/* ── CREATE MODE: checkbox + quiz configs (unchanged) ── */}
              {!isEditing ? (
                <>
                  <div className="checkbox-wrapper quiz-toggle-row">
                    <input
                      type="checkbox"
                      id="generate-quiz"
                      name="generateQuiz"
                      className="checkbox-input"
                      checked={generateQuiz}
                      onChange={handleGenerateQuizChange}
                      disabled={isUploading || !isQuizAutoSupportedForFile}
                    />
                    <label htmlFor="generate-quiz" className="checkbox-label">
                      Tự động tạo bài Quiz từ tài liệu này
                    </label>
                  </div>
                  {showQuizUnsupportedHint ? (
                    <p className="form-hint quiz-unsupported-hint" role="status">
                      {QUIZ_AUTO_UNSUPPORTED_MESSAGE}
                    </p>
                  ) : null}
                  {generateQuiz && isQuizAutoSupportedForFile ? (
                    <p className="form-hint">
                      Hệ thống sẽ sử dụng AI để tạo câu hỏi trắc nghiệm dựa trên nội dung tài liệu.
                    </p>
                  ) : null}

                  {generateQuiz && isQuizAutoSupportedForFile ? (
                    <div className="quiz-config-list">
                      {quizConfigs.map((config, index) => (
                        <div
                          key={config.localId}
                          className="quiz-config-card"
                        >
                          <div className="quiz-config-card-header">
                            <span className="quiz-config-card-title">
                              Bài đánh giá {index + 1}
                            </span>
                            {quizConfigs.length > 1 ? (
                              <button
                                type="button"
                                className="quiz-config-remove-btn"
                                onClick={() =>
                                  setQuizConfigs((prev) =>
                                    prev.filter((c) => c.localId !== config.localId)
                                  )
                                }
                                disabled={isUploading}
                                title="Xóa"
                              >
                                ×
                              </button>
                            ) : null}
                          </div>

                          {/* Question count */}
                          <div className="quiz-config-count-row">
                            <span className="form-label quiz-config-count-label">Số câu hỏi</span>
                            <div className="quiz-count-chips" role="radiogroup" aria-label="Số câu hỏi">
                              {QUIZ_COUNT_OPTIONS.map((val) => {
                                const isSelected =
                                  !config.customSelected && config.questionCount === val;
                                return (
                                  <button
                                    key={val}
                                    type="button"
                                    role="radio"
                                    aria-checked={isSelected}
                                    className={`quiz-count-chip${isSelected ? " active" : ""}`}
                                    onClick={() =>
                                      setQuizConfigs((prev) =>
                                        prev.map((c) =>
                                          c.localId === config.localId
                                            ? { ...c, questionCount: val, customSelected: false, customCount: "" }
                                            : c
                                        )
                                      )
                                    }
                                    disabled={isUploading}
                                  >
                                    {val}
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                role="radio"
                                aria-checked={config.customSelected}
                                className={`quiz-count-chip${config.customSelected ? " active" : ""}`}
                                onClick={() => {
                                  const parsed =
                                    typeof config.customCount === "string" &&
                                    config.customCount.length > 0
                                      ? Number(config.customCount)
                                      : NaN;
                                  setQuizConfigs((prev) =>
                                    prev.map((c) =>
                                      c.localId === config.localId
                                        ? {
                                            ...c,
                                            customSelected: true,
                                            questionCount:
                                              Number.isInteger(parsed) &&
                                              parsed >= QUIZ_CUSTOM_MIN &&
                                              parsed <= QUIZ_CUSTOM_MAX
                                                ? parsed
                                                : c.questionCount,
                                          }
                                        : c
                                    )
                                  );
                                }}
                                disabled={isUploading}
                              >
                                Tùy chỉnh
                              </button>
                            </div>
                          </div>

                          {config.customSelected ? (
                            <div className="quiz-count-custom-row">
                              <input
                                type="text"
                                inputMode="numeric"
                                className="form-input"
                                value={config.customCount}
                                onChange={(e) => {
                                  const raw = e.target.value ?? "";
                                  if (!/^\d{0,2}$/.test(raw)) return;
                                  setQuizConfigs((prev) =>
                                    prev.map((c) =>
                                      c.localId === config.localId
                                        ? { ...c, customCount: raw }
                                        : c
                                    )
                                  );
                                }}
                                placeholder={`Nhập số câu (${QUIZ_CUSTOM_MIN}–${QUIZ_CUSTOM_MAX})`}
                                maxLength={2}
                                disabled={isUploading}
                              />
                            </div>
                          ) : null}

                          {/* Focus topic */}
                          <div className="quiz-config-focus-row">
                            <label
                              className="form-label"
                              htmlFor={`quiz-focus-${config.localId}`}
                            >
                              Nội dung trọng tâm{" "}
                              <span className="optional-label">(không bắt buộc)</span>
                            </label>
                            <textarea
                              id={`quiz-focus-${config.localId}`}
                              className="form-textarea quiz-config-focus-textarea"
                              value={config.focusTopic}
                              onChange={(e) =>
                                setQuizConfigs((prev) =>
                                  prev.map((c) =>
                                    c.localId === config.localId
                                      ? { ...c, focusTopic: e.target.value }
                                      : c
                                  )
                                )
                              }
                              placeholder="Ví dụ: Nhà nước pháp quyền, Chương 2, Vai trò của pháp luật..."
                              maxLength={QUIZ_FOCUS_MAX_LENGTH}
                              disabled={isUploading}
                            />
                            <p className="form-hint">
                              Nếu để trống, hệ thống sẽ tạo câu hỏi dựa trên toàn bộ nội dung tài liệu.
                            </p>
                            <p className="form-hint quiz-config-focus-counter">
                              {config.focusTopic.length}/{QUIZ_FOCUS_MAX_LENGTH}
                            </p>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        className="quiz-config-add-btn"
                        onClick={() =>
                          setQuizConfigs((prev) => [
                            ...prev,
                            createDefaultQuizConfig(),
                          ])
                        }
                        disabled={isUploading}
                      >
                        + Thêm bài đánh giá
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="form-section pricing-section">
              <label className="form-label">Giá trị tài liệu</label>
              <div className="pricing-toggle" role="radiogroup" aria-label="Giá trị tài liệu">
                <button
                  type="button"
                  role="radio"
                  aria-checked={!isPaid}
                  className={`pricing-toggle__btn ${!isPaid ? "active" : ""}`}
                  onClick={() => handlePricingModeChange(false)}
                  disabled={isUploading || pricingLocked}
                >
                  Miễn phí
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isPaid}
                  className={`pricing-toggle__btn ${isPaid ? "active" : ""}`}
                  onClick={() => handlePricingModeChange(true)}
                  disabled={isUploading || pricingLocked}
                >
                  Có phí
                </button>
              </div>

              {isPaid ? (
                <div className="pricing-paid">
                  {pricingLocked ? (
                    <div className="pricing-lock-notice" role="status">
                      <span className="pricing-lock-notice__icon" aria-hidden="true" style={{ display: "inline-flex", alignItems: "center" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </span>
                      <span className="pricing-lock-notice__text">
                        {lockDataMissing
                          ? "Không thể xác định trạng thái khóa giá. Hình thức và giá bán tạm thời bị khóa."
                          : "Tài liệu đã có người mua. Hình thức và giá bán đã được khóa."}
                      </span>
                    </div>
                  ) : null}
                  {isUnchangedLegacyPrice ? (
                    <div className="pricing-legacy-notice" role="status">
                      <span className="pricing-legacy-notice__icon" aria-hidden="true">⚠</span>
                      <span className="pricing-legacy-notice__text">
                        Giá hiện tại được tạo theo mức tối thiểu cũ và thấp hơn mức
                        3.000 VND đang áp dụng.
                      </span>
                    </div>
                  ) : null}

                  <div className="pricing-quick-row">
                    {QUICK_PRICES.map((v) => (
                      <button
                        key={v}
                        type="button"
                        className={`pricing-quick-chip ${numericPrice === v ? "active" : ""}`}
                        onClick={() => applyQuickPrice(v)}
                        disabled={isUploading || pricingLocked}
                      >
                        {formatVnd(v)} ₫
                      </button>
                    ))}
                  </div>

                  <div className="pricing-slider-row">
                    <label className="form-label" htmlFor="price-slider">
                      Thanh chọn nhanh
                    </label>
                    <input
                      id="price-slider"
                      type="range"
                      min={PRICE_SLIDER_MIN}
                      max={PRICE_SLIDER_MAX}
                      step={PRICE_SLIDER_STEP}
                      value={sliderValue}
                      onChange={handleSliderChange}
                      disabled={isUploading || pricingLocked}
                      className="pricing-slider"
                    />
                    <div className="pricing-slider-bounds" aria-hidden="true">
                      <span>{formatVnd(PRICE_SLIDER_MIN)} ₫</span>
                      <span>{formatVnd(PRICE_SLIDER_MAX)} ₫</span>
                    </div>
                  </div>

                  <div className="pricing-input-row">
                    <label className="form-label" htmlFor="price-input">
                      Giá (VND)
                    </label>
                    <input
                      id="price-input"
                      type="text"
                      inputMode="numeric"
                      className="form-input"
                      placeholder={`Tối thiểu ${formatVnd(MIN_PAID_DOCUMENT_PRICE)} ₫`}
                      value={formattedPrice}
                      onChange={handlePriceInputChange}
                      disabled={isUploading || pricingLocked}
                      readOnly={pricingLocked}
                    />
                    {priceError ? (
                      <p className="form-hint error">{priceError}</p>
                    ) : null}
                  </div>

                  <div className="pricing-preview" aria-live="polite">
                    <div className="pricing-preview__row">
                      <span className="pricing-preview__label">Người mua thanh toán:</span>
                      <strong className="pricing-preview__value">
                        {previewPrice > 0 ? `${formatVnd(previewPrice)} ₫` : "—"}
                      </strong>
                    </div>
                    <div className="pricing-preview__row">
                      <span className="pricing-preview__label">Phí nền tảng 10%:</span>
                      <strong className="pricing-preview__value">
                        {previewPrice > 0 ? `${formatVnd(platformFee)} ₫` : "—"}
                      </strong>
                    </div>
                    <div className="pricing-preview__row">
                      <span className="pricing-preview__label">Bạn nhận sau phí:</span>
                      <strong className="pricing-preview__value">
                        {previewPrice > 0 ? `${formatVnd(sellerNet)} ₫` : "—"}
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pricing-free-wrapper">
                  {pricingLocked ? (
                    <div className="pricing-lock-notice" role="status">
                      <span className="pricing-lock-notice__icon" aria-hidden="true" style={{ display: "inline-flex", alignItems: "center" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </span>
                      <span className="pricing-lock-notice__text">
                        {lockDataMissing
                          ? "Không thể xác định trạng thái khóa giá. Hình thức và giá bán tạm thời bị khóa."
                          : "Tài liệu đã có người mua. Hình thức và giá bán đã được khóa."}
                      </span>
                    </div>
                  ) : null}
                  <p className="pricing-free-note">Tài liệu miễn phí cho mọi người dùng.</p>
                </div>
              )}
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className={`upload-document-submit ${
                  !canSubmit || isUploading ? "upload-document-submit--disabled" : ""
                }`}
                disabled={!canSubmit || isUploading}
              >
                <span className="upload-document-submit__label">
                  {getSubmitButtonLabel({
                    isUploading,
                    submissionPhase,
                    isEditing: formData.isEditing,
                  })}
                </span>
              </button>
              <button
                type="button"
                className="cancel-btn"
                onClick={() => navigate(-1)}
                disabled={isUploading}
              >
                Hủy bỏ
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}