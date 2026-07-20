import React, { useEffect } from "react";
import { createPortal } from "react-dom";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  danger = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onCancel?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div className="community-confirm-backdrop" onClick={onCancel}>
      <div
        className="community-confirm-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="community-confirm-title">{title}</h3>
        {message && <p className="community-confirm-message">{message}</p>}
        <div className="community-confirm-actions">
          <button
            type="button"
            className="community-confirm-btn-secondary"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? "community-confirm-btn-danger" : "community-confirm-btn-primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
