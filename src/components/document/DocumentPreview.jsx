import React, { useEffect, useMemo, useState } from "react";
import { getDocumentPreviewMode } from "../../utils/documentPreview";

export default function DocumentPreview({ fileUrl, fileType, fileName }) {
  const [isLoading, setIsLoading] = useState(true);

  const mode = useMemo(
    () => getDocumentPreviewMode(fileType, fileUrl, fileName),
    [fileType, fileUrl, fileName]
  );

  const previewSrc = useMemo(() => {
    if (!fileUrl) return "";
    if (mode === "pdf") return fileUrl;
    if (mode === "gview")
      return `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`;
    return "";
  }, [mode, fileUrl]);

  useEffect(() => {
    if (previewSrc) {
      setIsLoading(true);
    }
  }, [previewSrc]);

  if (!fileUrl) {
    return (
      <div className="document-preview-message">
        Không có file để xem trước
      </div>
    );
  }

  // Xem trước ảnh
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

  // Xem trước PDF hoặc Google Docs Viewer (gview)
  if (previewSrc) {
    return (
      <div className="document-preview-inner">
        {isLoading ? (
          <div className="document-preview-loading" aria-live="polite">
            Đang tải xem trước...
          </div>
        ) : null}
        <iframe
          title="Document preview"
          className="document-preview-iframe"
          src={previewSrc}
          onLoad={() => setIsLoading(false)}
        />
      </div>
    );
  }

  // Fallback: định dạng không hỗ trợ xem trước trực tiếp
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
