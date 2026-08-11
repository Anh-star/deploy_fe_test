import React, { useMemo } from "react";
import { getDocumentPreviewMode } from "../../utils/documentPreview";
import SecureDocumentPreview from "./SecureDocumentPreview";
import SharedFreeDocumentPdfViewer from "./SharedFreeDocumentPdfViewer";

/**
 * Public-facing preview wrapper.
 *
 * <p>Free and paid documents render through the SAME shared
 * {@code StudyItPdfViewer} shell — dark toolbar, thumbnail
 * sidebar, current-page indicator, zoom in/out, fit width,
 * rotate, download, print — so the UI never diverges by
 * payment status. The component does not duplicate the
 * viewer; it only routes to the right shell:</p>
 *
 * <ul>
 *   <li>Paid documents delegate to {@link SecureDocumentPreview}
 *       which fetches the access-controlled bytes from the
 *       backend and routes them through the shared viewer in
 *       either {@code FULL} (owner / purchaser / staff) or
 *       {@code LIMITED} (unpurchased, with the existing lock
 *       overlay) mode.</li>
 *   <li>Free PDF documents delegate to
 *       {@link SharedFreeDocumentPdfViewer} which fetches the
 *       public PDF bytes directly from the public URL and
 *       routes them through the same shared viewer in
 *       {@code FULL} mode (toolbar + thumbnails + download,
 *       no lock overlay, no purchase CTA, no page limit).</li>
 *   <li>Free non-PDF documents (image / Google Docs viewer)
 *       fall back to the legacy public-URL pipeline that
 *       does not need the viewer chrome.</li>
 * </ul>
 */
export default function DocumentPreview({
  documentId,
  fileUrl,
  fileType,
  fileName,
  isPaid,
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
    />
  );
}

function FreeDocumentPreview({ fileUrl, fileType, fileName, documentId }) {
  const mode = useMemo(
    () => getDocumentPreviewMode(fileType, fileUrl, fileName),
    [fileType, fileUrl, fileName]
  );

  if (!fileUrl) {
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