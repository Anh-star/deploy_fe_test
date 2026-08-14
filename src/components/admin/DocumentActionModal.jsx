import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function DocumentActionModal({
  open,
  loading = false,
  title,
  description,
  placeholder,
  confirmLabel = 'Xác nhận',
  danger = false,
  required = false,
  onConfirm,
  onCancel,
}) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (open) setText('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const submit = () => {
    const trimmed = text.trim();
    if (required && !trimmed) return;
    onConfirm?.(trimmed);
  };

  return createPortal(
    <div className="admin-confirm-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="admin-confirm-dialog"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440 }}
      >
        <h3>{title}</h3>
        {description ? <p style={{ color: '#667085', fontSize: 14, marginTop: 8 }}>{description}</p> : null}
        <textarea
          className="form-textarea"
          style={{ width: '100%', minHeight: 90, marginTop: 12, boxSizing: 'border-box' }}
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={loading}
        />
        <div className="admin-confirm-dialog__actions" style={{ marginTop: 16 }}>
          <button type="button" className="admin-btn-secondary" onClick={onCancel} disabled={loading}>
            Hủy
          </button>
          <button
            type="button"
            className={danger ? 'admin-btn-danger' : 'admin-btn-primary'}
            onClick={submit}
            disabled={loading || (required && !text.trim())}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
