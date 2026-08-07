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

function toCreatePayload(
  formData,
  documentUrl,
  thumbnailUrl,
  fileName,
  fileSizeBytes,
  storagePath,
  isPaid,
  price
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
  normalizedPrice
) {
  return toCreatePayload(
    formData,
    documentUrl,
    thumbnailUrl,
    fileName,
    fileSizeBytes,
    storagePath,
    isPaid,
    normalizedPrice
  );
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
 * </ol>
 */
async function submitFreeDocument({ formData, notification, navigate }) {
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

  const payload = toFreeCreatePayload(
    formData,
    docUrl,
    thumbUrl,
    docFileName,
    docFileSizeBytes || 0,
    docStoragePath,
    false,
    0
  );

  const savedDocument = await documentService.createMyDocument(payload);

  notification.success("Đăng tải tài liệu thành công!");
  const sid = savedDocument?.id;
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
  documentServiceApi,
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
      deps: {
        createPaidUploadTarget: documentServiceApi.createPaidUploadTarget,
        uploadPaidFileViaSignedUrl,
        createMyDocument: documentServiceApi.createMyDocument,
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

  notification.success("Đăng tải tài liệu thành công!");
  const sid = savedDocument?.id;
  if (sid) {
    navigate(`/documents/submitted/${sid}`);
  } else {
    navigate("/submitted-document-details", { state: { document: savedDocument } });
  }
}

/**
 * Edit-mode submit — Phase S1-C2 keeps the legacy metadata-only round-trip
 * flow intact. Paid edit replacement is NOT in this milestone.
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
  navigate,
}) {
  notification.success("Đang cập nhật tài liệu...");

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

  notification.success("Cập nhật tài liệu thành công!");
  const sid = savedDocument?.id;
  if (sid) {
    navigate(`/documents/submitted/${sid}`);
  } else {
    navigate("/submitted-document-details", { state: { document: savedDocument } });
  }
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
  const [tagInput, setTagInput] = useState("");
  const [categories, setCategories] = useState([]);
  const [isPaid, setIsPaid] = useState(false);
  const [priceDigits, setPriceDigits] = useState("");
  const [editGuardError, setEditGuardError] = useState("");

  useEffect(() => {
    if (!documentToEdit) {
      setFormData(EMPTY_FORM);
      setIsPaid(false);
      setPriceDigits("");
      setEditGuardError("");
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

  useEffect(() => {
    let isMounted = true;

    const fetchCategories = async () => {
      try {
        const data = await sidebarService.getCategories();
        if (!isMounted) return;
        setCategories(Array.isArray(data) ? data : []);
      } catch (error) {
        if (!isMounted) return;
        setCategories([]);
        notification.error(
          error?.response?.data?.message || "Không thể tải danh mục tài liệu."
        );
      }
    };

    fetchCategories();
    return () => {
      isMounted = false;
    };
  }, [notification]);

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
    !editGuardError;

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

  const handleTagInputKeyDown = (event) => {
    if ((event.key === "Enter" || event.key === ";") && tagInput.trim()) {
      event.preventDefault();
      const newTag = tagInput.trim().replace(/;$/, "");
      if (newTag && !formData.tags.includes(newTag)) {
        setFormData((prev) => ({
          ...prev,
          tags: [...prev.tags, newTag],
        }));
      }
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

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
          documentServiceApi: documentService,
        });
      } else if (formData.isEditing) {
        await submitUpdateDocument({
          formData,
          documentToEdit,
          isPaid,
          normalizedPrice,
          initialIsPaid,
          initialPrice,
          documentService,
          notification,
          navigate,
        });
      } else {
        await submitFreeDocument({ formData, notification, navigate });
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
                <label className="form-label">Danh mục</label>
                <select
                  name="category"
                  className="form-select"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                  disabled={isUploading}
                >
                  <option value="" disabled>
                    Chọn danh mục phù hợp
                  </option>
                  {categories.map((category) => (
                    <option
                      key={category.id || category.name}
                      value={category.name || ""}
                    >
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Thẻ (Tags)</label>
                <div className="tags-input-container">
                  {formData.tags.map((tag) => (
                    <span key={tag} className="tag-item">
                      {tag}
                      <span
                        className="tag-remove"
                        onClick={isUploading ? undefined : () => removeTag(tag)}
                      >
                        ×
                      </span>
                    </span>
                  ))}
                  <input
                    type="text"
                    className="tags-input"
                    placeholder="Thêm thẻ..."
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    disabled={isUploading}
                    title="Nhập thẻ và nhấn Enter hoặc dấu ; để thêm"
                  />
                </div>
                {formData.tags.length === 0 && tagInput.trim() === "" && (
                  <p className="form-hint">Vui lòng thêm ít nhất một thẻ.</p>
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
                      <span className="pricing-lock-notice__icon" aria-hidden="true">🔒</span>
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
                      <span className="pricing-lock-notice__icon" aria-hidden="true">🔒</span>
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