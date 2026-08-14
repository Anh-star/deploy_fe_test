import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminConfirmDialog from '../../components/admin/AdminConfirmDialog';
import {
  getAdminDocumentDetail,
  getApiErrorMessage,
  patchDocumentStatus,
} from '../../api/adminDocumentApi';
import { useNotification } from '../../context/NotificationContext';
import { getDocumentThumbnailUrl, onDocumentThumbnailError } from '../../utils/documentThumbnail';
import SecureDocumentPreview from '../../components/document/SecureDocumentPreview';
import { useDocumentPreviewStatus } from '../../hooks/useDocumentPreviewStatus';
import DocumentPreviewStatusIndicator, {
  computeApprovalStatus,
} from '../../components/admin/DocumentPreviewStatusIndicator';
import '../../styles/admin/adminDashboard.css';
import '../../styles/admin/adminComponents.css';

function formatDateTime(value) {
  if (value == null) return '—';
  try {
    let d;
    if (Array.isArray(value)) {
      const [y, mo, day, h = 0, mi = 0, s = 0] = value;
      d = new Date(y, mo - 1, day, h, mi, s);
    } else {
      d = new Date(value);
    }
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function statusBadgeClass(status) {
  const s = (status || '').toUpperCase();
  if (s === 'APPROVED') return 'status-approved';
  if (s === 'REJECTED') return 'status-rejected';
  return 'status-pending';
}

function statusLabel(status) {
  const s = (status || '').toUpperCase();
  if (s === 'APPROVED') return 'Đã duyệt';
  if (s === 'REJECTED') return 'Đã từ chối';
  if (s === 'PENDING') return 'Chờ duyệt';
  return status || '—';
}

export default function AdminDocumentDetailPage() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const notification = useNotification();
  const queryClient = useQueryClient();

  const [approveOpen, setApproveOpen] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);

  const {
    data: detail,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-document-detail', documentId],
    queryFn: () => getAdminDocumentDetail(documentId),
    enabled: Boolean(documentId),
  });

  // Preview status polling — active only while the document is PENDING.
  const isPending = (detail?.status || '').toUpperCase() === 'PENDING';
  const { status: previewStatus, loading: previewLoading, httpError: previewHttpError, refresh: refreshPreview } =
    useDocumentPreviewStatus(isPending ? documentId : null);

  // Derive whether the moderator can approve.
  // The decision is driven entirely by the backend; the UI guard is
  // supplementary to the backend's own authorization.
  const approvalStatus = useMemo(
    () => computeApprovalStatus(previewStatus),
    [previewStatus]
  );

  // For Office documents: disable approve while PENDING / PROCESSING / RETRY / DEAD.
  // For non-Office documents: no restriction from preview status.
  const isApproveDisabled = useMemo(() => {
    if (!isPending) return true; // Only PENDING documents can be approved.
    return approvalStatus === 'CANNOT_APPROVE';
  }, [isPending, approvalStatus]);

  // Reason shown near the disabled approve button.
  const approveDisabledReason = useMemo(() => {
    if (!isPending) return null;
    if (!previewStatus) return null;
    if (!previewStatus.officeDocument) return null; // No restriction for non-Office.

    switch (previewStatus.fullStatus) {
      case 'PENDING':
        return 'Bản xem trước đang được tạo — vui lòng đợi';
      case 'PROCESSING':
        return 'Hệ thống đang chuyển đổi DOC/DOCX sang PDF';
      case 'RETRY':
        return 'Hệ thống đang thử xử lý lại — vui lòng đợi';
      case 'DEAD':
        return 'Không thể tạo bản xem trước — không thể phê duyệt';
      case 'READY':
        return null; // Enabled — no reason needed.
      default:
        return 'Chưa xác định được trạng thái bản xem trước';
    }
  }, [isPending, previewStatus]);

  const invalidateAll = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-document-detail', documentId] });
    await queryClient.invalidateQueries({ queryKey: ['admin-pending-documents'] });
  }, [queryClient, documentId]);

  const confirmApprove = async (note) => {
    if (!documentId) return;
    try {
      setApproveLoading(true);
      await patchDocumentStatus(documentId, {
        status: 'APPROVED',
        adminNote: note ? note.trim() : undefined,
      });
      notification.success('Đã phê duyệt tài liệu.');
      setApproveOpen(false);
      await invalidateAll();
      navigate('/admin/documents/pending');
    } catch (e) {
      notification.error(getApiErrorMessage(e));
    } finally {
      setApproveLoading(false);
    }
  };

  const confirmReject = async (reason) => {
    if (!documentId) return;
    try {
      setRejectLoading(true);
      await patchDocumentStatus(documentId, { status: 'REJECTED', rejectReason: reason });
      notification.success('Đã từ chối tài liệu.');
      setRejectOpen(false);
      await invalidateAll();
      navigate('/admin/documents/pending');
    } catch (e) {
      notification.error(getApiErrorMessage(e));
    } finally {
      setRejectLoading(false);
    }
  };

  const thumbSrc = useMemo(
    () => getDocumentThumbnailUrl({ thumbnailUrl: detail?.thumbnailUrl }),
    [detail?.thumbnailUrl]
  );

  return (
    <main className="admin-main">
      <AdminPageHeader
        title={detail?.title || 'Chi tiết tài liệu'}
        description={documentId ? `ID: ${documentId}` : '—'}
        showSearch={false}
        actions={
          <Link to="/admin/documents/pending" className="admin-btn-secondary" style={{ textDecoration: 'none' }}>
            ← Danh sách chờ duyệt
          </Link>
        }
      />

      {isLoading ? (
        <div className="admin-table-card" style={{ padding: 24 }}>
          <p style={{ margin: 0, color: '#667085' }}>Đang tải…</p>
        </div>
      ) : null}

      {isError ? (
        <div className="admin-table-card" style={{ padding: 24 }}>
          <p style={{ color: '#b42318', margin: 0 }}>{getApiErrorMessage(error)}</p>
          <button type="button" className="admin-btn-secondary" style={{ marginTop: 12 }} onClick={() => refetch()}>
            Thử lại
          </button>
        </div>
      ) : null}

      {!isLoading && !isError && detail ? (
        <>
          <div
            className="admin-doc-detail-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 340px)',
              gap: 24,
              alignItems: 'start',
            }}
          >
            <div className="admin-table-card" style={{ padding: 20, minHeight: 200 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Xem trước</h3>
              <SecureDocumentPreview
                documentId={documentId}
                fileType={detail?.fileType}
                fileName={detail?.fileName || detail?.title}
                isPaid={detail?.isPaid === true}
                status={detail?.status}
              />
            </div>

            <aside className="admin-table-card" style={{ padding: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <img
                  src={thumbSrc}
                  alt=""
                  onError={onDocumentThumbnailError}
                  style={{
                    width: '100%',
                    maxHeight: 160,
                    objectFit: 'cover',
                    borderRadius: 8,
                    background: '#f2f4f7',
                  }}
                />
              </div>
              <h2 style={{ margin: '0 0 12px', fontSize: 18, lineHeight: 1.3 }}>{detail.title}</h2>
              <p style={{ margin: '0 0 12px', color: '#667085', fontSize: 14, whiteSpace: 'pre-wrap' }}>
                {detail.description?.trim() ? detail.description : '—'}
              </p>
              <dl style={{ margin: 0, fontSize: 14 }}>
                <div style={{ marginBottom: 10 }}>
                  <dt style={{ color: '#667085', marginBottom: 4 }}>Tác giả</dt>
                  <dd style={{ margin: 0 }}>{detail.authorName?.trim() || '—'}</dd>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <dt style={{ color: '#667085', marginBottom: 4 }}>Danh mục</dt>
                  <dd style={{ margin: 0 }}>{detail.categoryName?.trim() || '—'}</dd>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <dt style={{ color: '#667085', marginBottom: 4 }}>Trạng thái</dt>
                  <dd style={{ margin: 0 }}>
                    <span className={`status-badge ${statusBadgeClass(detail.status)}`}>
                      {statusLabel(detail.status)}
                    </span>
                  </dd>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <dt style={{ color: '#667085', marginBottom: 4 }}>Loại file</dt>
                  <dd style={{ margin: 0 }}>{detail.fileType || '—'}</dd>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <dt style={{ color: '#667085', marginBottom: 4 }}>Ngày gửi</dt>
                  <dd style={{ margin: 0 }}>{formatDateTime(detail.createdAt)}</dd>
                </div>
                {detail.rejectReason?.trim() ? (
                  <div style={{ marginBottom: 10 }}>
                    <dt style={{ color: '#667085', marginBottom: 4 }}>Lý do từ chối</dt>
                    <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{detail.rejectReason}</dd>
                  </div>
                ) : null}
                {detail.storagePath && !/^https?:\/\//i.test(detail.storagePath) ? (
                  <div style={{ marginBottom: 0 }}>
                    <dt style={{ color: '#667085', marginBottom: 4 }}>Storage path</dt>
                    <dd style={{ margin: 0, wordBreak: 'break-all', fontSize: 12 }}>{detail.storagePath}</dd>
                  </div>
                ) : null}
              </dl>
            </aside>
          </div>

          {isPending ? (
            <div
              className="admin-table-card"
              style={{
                marginTop: 24,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <span style={{ fontWeight: 600 }}>Thao tác duyệt</span>

              {/* Preview status indicator — only shown for PENDING documents */}
              <DocumentPreviewStatusIndicator
                status={previewStatus}
                loading={previewLoading}
                httpError={previewHttpError}
                onRefresh={refreshPreview}
              />

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                <button
                  type="button"
                  className="admin-btn-primary"
                  disabled={isApproveDisabled}
                  title={approveDisabledReason ?? undefined}
                  onClick={() => setApproveOpen(true)}
                >
                  Phê duyệt
                </button>
                <button
                  type="button"
                  className="admin-btn-danger"
                  onClick={() => setRejectOpen(true)}
                >
                  Từ chối
                </button>
                {isApproveDisabled && approveDisabledReason ? (
                  <span
                    style={{
                      fontSize: 12,
                      color: '#92400e',
                      background: '#fef3c7',
                      padding: '4px 8px',
                      borderRadius: 4,
                    }}
                  >
                    {approveDisabledReason}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <ApproveDocumentModal
        open={approveOpen}
        loading={approveLoading}
        docTitle={detail?.title || ''}
        onCancel={() => !approveLoading && setApproveOpen(false)}
        onConfirm={confirmApprove}
      />

      <RejectReasonModal
        open={rejectOpen}
        loading={rejectLoading}
        onCancel={() => !rejectLoading && setRejectOpen(false)}
        onConfirm={confirmReject}
      />

      <style>{`
        @media (max-width: 960px) {
          .admin-doc-detail-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}

function ApproveDocumentModal({ open, loading, docTitle, onConfirm, onCancel }) {
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) setNote('');
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
    onConfirm?.(note.trim());
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
        <h3>Phê duyệt tài liệu</h3>
        <p style={{ color: '#667085', fontSize: 14, marginTop: 8 }}>
          Xác nhận phê duyệt tài liệu &quot;{docTitle}&quot;?
        </p>
        <textarea
          className="form-textarea"
          style={{ width: '100%', minHeight: 80, marginTop: 12, boxSizing: 'border-box' }}
          placeholder="Ghi chú thêm cho tác giả (tùy chọn)…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={loading}
        />
        <div className="admin-confirm-dialog__actions" style={{ marginTop: 16 }}>
          <button type="button" className="admin-btn-secondary" onClick={onCancel} disabled={loading}>
            Hủy
          </button>
          <button
            type="button"
            className="admin-btn-primary"
            onClick={submit}
            disabled={loading}
          >
            Phê duyệt
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Re-export so RejectReasonModal still works after the file rewrite.
function RejectReasonModal({ open, loading, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
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
    const t = reason.trim();
    if (!t) return;
    onConfirm?.(t);
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
        <h3>Từ chối tài liệu</h3>
        <p style={{ color: '#667085', fontSize: 14, marginTop: 8 }}>
          Nhập lý do từ chối (bắt buộc).
        </p>
        <textarea
          className="form-textarea"
          style={{ width: '100%', minHeight: 100, marginTop: 12, boxSizing: 'border-box' }}
          placeholder="Lý do…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={loading}
        />
        <div className="admin-confirm-dialog__actions" style={{ marginTop: 16 }}>
          <button type="button" className="admin-btn-secondary" onClick={onCancel} disabled={loading}>
            Hủy
          </button>
          <button
            type="button"
            className="admin-btn-danger"
            onClick={submit}
            disabled={loading || !reason.trim()}
          >
            Xác nhận từ chối
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
