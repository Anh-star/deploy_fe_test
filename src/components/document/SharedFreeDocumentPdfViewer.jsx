import { useCallback, useEffect, useMemo, useState } from "react";
import StudyItPdfViewer from "./StudyItPdfViewer";
import { useFreeDocumentPdfBytes } from "../../hooks/useFreeDocumentPdfBytes";

/**
 * Shared free-document PDF preview.
 *
 * <p>Renders the same {@link StudyItPdfViewer} shell as the paid
 * viewer so free and paid documents look identical: dark toolbar,
 * thumbnail sidebar, current-page indicator, zoom in/out, fit
 * width, rotate, download, print. No lock CTA, no purchase overlay,
 * no blur, no page limit.</p>
 *
 * <p>Bytes are fetched from the document preview endpoint
 * ({@code GET /api/documents/{id}/preview}) — the same endpoint
 * used by {@link SecureDocumentPreview}. Free documents resolve
 * through the free access path on the backend and receive FULL PDF
 * bytes for READY artifacts.</p>
 *
 * <p>This component is intentionally minimal: it owns ONLY the
 * bytes-loading hook and the three states (loading / viewer /
 * error). The viewer chrome is fully delegated to
 * {@link StudyItPdfViewer}.</p>
 *
 * @param {object} props
 * @param {string} props.documentId — used to fetch preview bytes and as the viewer's documentId for stable rendering.
 * @param {string} props.fileName — used as download file name.
 * @param {() => void} [props.onDownload] — optional override for the toolbar download button.
 * @param {() => void} [props.onPrint] — optional override for the toolbar print button.
 */
export default function SharedFreeDocumentPdfViewer({
  documentId,
  fileName,
  onDownload,
  onPrint,
}) {
  const { preview, loading } = useFreeDocumentPdfBytes(documentId);
  const [reloadKey, setReloadKey] = useState(0);

  // Reset the viewer's internal state when the documentId changes
  // so a stale PDF never leaks across navigations.
  useEffect(() => {
    setReloadKey((k) => k + 1);
  }, [documentId]);

  const downloadName = typeof fileName === "string" && fileName ? fileName : "document";

  const handleDownload = useCallback(() => {
    if (typeof onDownload === "function") {
      onDownload({ documentId, fileName: downloadName });
    }
  }, [documentId, downloadName, onDownload]);

  const handlePrint = useCallback(() => {
    if (typeof onPrint === "function") {
      onPrint({ documentId, fileName: downloadName });
    }
  }, [documentId, downloadName, onPrint]);

  // Viewer only mounts once a valid FULL PDF buffer is ready.
  const viewerBuffer = useMemo(() => {
    if (!preview) return null;
    if (preview.kind !== "pdf") return null;
    if (preview.mode !== "FULL") return null;
    if (!(preview.pdfBuffer instanceof ArrayBuffer)) return null;
    return preview.pdfBuffer;
  }, [preview]);

  // Pass totalPages from the response so StudyItPdfViewer can
  // initialise page indicators without fetching the whole PDF first.
  const totalPages = preview?.totalPages ?? null;

  if (loading || !preview) {
    return (
      <div
        className="secure-document-preview-loading"
        aria-live="polite"
        data-renderer="LOADING"
      >
        Đang tải bản xem trước…
      </div>
    );
  }

  if (preview.kind === "error") {
    return (
      <div
        className="secure-document-preview-error"
        role="alert"
        data-renderer="ERROR"
      >
        <p>{preview.message || "Không thể tải bản xem trước."}</p>
      </div>
    );
  }

  if (!viewerBuffer) {
    return (
      <div
        className="secure-document-preview-loading"
        aria-live="polite"
        data-renderer="LOADING"
      >
        Đang tải bản xem trước…
      </div>
    );
  }

  return (
    <div
      className="secure-document-preview-inner secure-document-preview-pdf"
      data-mode="FULL"
      data-renderer="PDF"
    >
      <StudyItPdfViewer
        key={reloadKey}
        arrayBuffer={viewerBuffer}
        mode="FULL"
        documentId={documentId}
        fileName={downloadName}
        formattedPrice=""
        isAuthenticated={true}
        onDownload={handleDownload}
        onPrint={handlePrint}
        totalPages={totalPages}
      />
    </div>
  );
}
