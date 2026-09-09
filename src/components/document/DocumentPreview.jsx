import React, { useMemo } from "react";
import { getDocumentPreviewMode } from "../../utils/documentPreview";
import SecureDocumentPreview from "./SecureDocumentPreview";
import SharedFreeDocumentPdfViewer from "./SharedFreeDocumentPdfViewer";

export default function DocumentPreview({
  documentId,
  fileUrl,
  fileType,
  fileName,
  isPaid,
  hasAccess,
  renderBuyCta,
}) {
  const isPaidDoc = isPaid === true;

  if (isPaidDoc) {
    return (
      <SecureDocumentPreview
        documentId={documentId}
        fileType={fileType}
        fileName={fileName}
        isPaid
        renderBuyCta={renderBuyCta}
      />
    );
  }

  return (
    <FreeDocumentPreview
      fileUrl={fileUrl}
      fileType={fileType}
      fileName={fileName}
      documentId={documentId}
      isPaid={isPaid}
      hasAccess={hasAccess}
    />
  );
}

function FreeDocumentPreview({ fileUrl, fileType, fileName, documentId, isPaid, hasAccess }) {
  const mode = useMemo(
    () => getDocumentPreviewMode(fileType, fileUrl, fileName),
    [fileType, fileUrl, fileName]
  );

  if (!fileUrl) {
    if (isPaid && !hasAccess) {
      return (
        <div className="document-preview-message paid-preview-notice" style={{ padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔒</div>
          <h4 style={{ margin: "0 0 8px 0", color: "#1e293b", fontSize: "16px", fontWeight: "600" }}>Tài liệu có phí</h4>
          <p style={{ margin: 0, color: "#64748b", fontSize: "14px", lineHeight: "1.5" }}>
            Vui lòng mua tài liệu này để xem trước và tải về toàn bộ nội dung.
          </p>
        </div>
      );
    }
    return (
      <div className="document-preview-message">
        Không có file để xem trước
      </div>
    );
  }

  // PDF → shared StudyItPdfViewer shell (toolbar + thumbnails).
  if (mode === "pdf") {
    return (
      <SharedFreeDocumentPdfViewer
        documentId={documentId}
        fileUrl={fileUrl}
        fileName={fileName}
      />
    );
  }

  // Image preview.
  if (mode === "image") {
    return (
      <div className="document-preview-inner">
        <img
          src={fileUrl}
          alt="Xem trước tài liệu"
          style={{ maxWidth: "100%", borderRadius: 8, display: "block" }}
        />
      </div>
    );
  }

  // Google Docs viewer fallback for DOC/PPT.
  if (mode === "gview") {
    return (
      <div className="document-preview-inner">
        <iframe
          title="Document preview"
          className="document-preview-iframe"
          src={`https://docs.google.com/gview?url=${encodeURIComponent(
            fileUrl
          )}&embedded=true`}
        />
      </div>
    );
  }

  // Fallback: định dạng không hỗ trợ xem trước trực tiếp.
  return (
    <div className="document-preview-message">
      <p>Không hỗ trợ xem trước định dạng này trong trình duyệt.</p>
      <a
        href={fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "#007bff", fontWeight: 600 }}
      >
        Mở file trong tab mới
      </a>
    </div>
  );
}