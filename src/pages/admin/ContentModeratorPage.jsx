import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTableWrapper from '../../components/admin/AdminTableWrapper';
import AdminPagination from '../../components/admin/AdminPagination';
import DocumentActionModal from '../../components/admin/DocumentActionModal';
import {
  getApiErrorMessage,
  getPendingDocuments,
  patchDocumentStatus,
} from '../../api/adminDocumentApi';
import { useNotification } from '../../context/NotificationContext';
import { getDocumentThumbnailUrl, onDocumentThumbnailError } from '../../utils/documentThumbnail';
import '../../styles/admin/adminDashboard.css';
import '../../styles/admin/adminComponents.css';

const PAGE_SIZE = 10;

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

export default function ContentModeratorPage() {
  const navigate = useNavigate();
  const notification = useNotification();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [size] = useState(PAGE_SIZE);

  const [approveTarget, setApproveTarget] = useState(null);
  const [approveLoading, setApproveLoading] = useState(false);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectLoading, setRejectLoading] = useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-pending-documents', page, size],
    queryFn: () => getPendingDocuments(page, size),
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  useEffect(() => {
    if (isLoading || isFetching) return;
    if (total === 0 && page > 0) setPage(0);
  }, [total, page, isLoading, isFetching]);

  const empty = useMemo(() => !isLoading && items.length === 0, [isLoading, items.length]);

  const invalidateList = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-pending-documents'] });
  }, [queryClient]);

  const handleApproveClick = (doc) => {
    setApproveTarget(doc);
  };

  const confirmApprove = async (note) => {
    if (!approveTarget?.id) return;
    try {
      setApproveLoading(true);
      await patchDocumentStatus(approveTarget.id, {
        status: 'APPROVED',
        adminNote: note ? note.trim() : undefined,
      });
      notification.success('Đã phê duyệt tài liệu.');
      setApproveTarget(null);
      await invalidateList();
    } catch (e) {
      notification.error(getApiErrorMessage(e));
    } finally {
      setApproveLoading(false);
    }
  };

  const openReject = (doc) => {
    setRejectTarget(doc);
    setRejectOpen(true);
  };

  const confirmReject = async (reason) => {
    if (!rejectTarget?.id) return;
    try {
      setRejectLoading(true);
      await patchDocumentStatus(rejectTarget.id, {
        status: 'REJECTED',
        rejectReason: reason,
      });
      notification.success('Đã từ chối tài liệu.');
      setRejectOpen(false);
      setRejectTarget(null);
      await invalidateList();
    } catch (e) {
      notification.error(getApiErrorMessage(e));
    } finally {
      setRejectLoading(false);
    }
  };

  return (
    <main className="admin-main">
      <AdminPageHeader
        title="Tài liệu chờ duyệt"
        description="Danh sách tài liệu trạng thái PENDING — kiểm duyệt trước khi công khai."
        showSearch={false}
      />

      {isError ? (
        <div className="admin-table-card" style={{ padding: 24 }}>
          <p style={{ color: '#b42318', margin: 0 }}>{getApiErrorMessage(error)}</p>
          <button type="button" className="admin-btn-secondary" style={{ marginTop: 12 }} onClick={() => refetch()}>
            Thử lại
          </button>
        </div>
      ) : null}

      <AdminTableWrapper
        loading={isLoading && !data}
        empty={empty && !isError}
        emptyTitle="Không có tài liệu chờ duyệt"
        emptyDescription="Khi người dùng đăng tải tài liệu mới, bản ghi PENDING sẽ xuất hiện tại đây."
        footer={
          <AdminPagination
            page={page}
            size={size}
            total={total}
            onPageChange={setPage}
            onSizeChange={() => {}}
            sizeOptions={[PAGE_SIZE]}
          />
        }
      >
        <table className="admin-table">
            <thead>
              <tr>
                <th>ẢNH</th>
                <th>TÀI LIỆU</th>
                <th>TÁC GIẢ</th>
                <th>DANH MỤC</th>
                <th>NGÀY GỬI</th>
                <th>LOẠI FILE</th>
                <th>TRẠNG THÁI</th>
                <th>HÀNH ĐỘNG</th>
              </tr>
            </thead>
            <tbody>
              {items.map((doc) => {
                const thumbSrc = getDocumentThumbnailUrl({
                  thumbnailUrl: doc.thumbnailUrl,
                });
                const author =
                  doc.authorName?.trim() ||
                  doc.author?.fullName ||
                  doc.createdByName ||
                  '—';
                const category = doc.categoryName || doc.category || '—';
                return (
                  <tr key={doc.id}>
                    <td style={{ width: 72 }}>
                      <img
                        src={thumbSrc}
                        alt=""
                        onError={onDocumentThumbnailError}
                        style={{
                          width: 56,
                          height: 56,
                          objectFit: 'cover',
                          borderRadius: 8,
                          background: '#f2f4f7',
                        }}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{doc.title || '—'}</div>
                      {doc.fileName ? (
                        <small style={{ color: '#667085' }}>{doc.fileName}</small>
                      ) : null}
                    </td>
                    <td>{author}</td>
                    <td>{category}</td>
                    <td>{formatDateTime(doc.uploadDate)}</td>
                    <td>{doc.fileType || '—'}</td>
                    <td>
                      <span className="status-badge status-pending">PENDING</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <button
                          type="button"
                          className="admin-btn-ghost"
                          onClick={() => navigate(`/admin/documents/${doc.id}`)}
                        >
                          Xem chi tiết
                        </button>
                        <button
                          type="button"
                          className="admin-btn-primary"
                          style={{ fontSize: 12, padding: '6px 10px' }}
                          disabled={isFetching}
                          onClick={() => handleApproveClick(doc)}
                        >
                          Duyệt
                        </button>
                        <button
                          type="button"
                          className="admin-btn-danger"
                          style={{ fontSize: 12, padding: '6px 10px' }}
                          disabled={isFetching}
                          onClick={() => openReject(doc)}
                        >
                          Từ chối
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
      </AdminTableWrapper>

      <DocumentActionModal
        open={Boolean(approveTarget)}
        loading={approveLoading}
        title="Phê duyệt tài liệu"
        description={
          approveTarget
            ? `Xác nhận phê duyệt tài liệu "${approveTarget.title}"?`
            : ''
        }
        placeholder="Ghi chú thêm cho tác giả (tùy chọn)…"
        confirmLabel="Phê duyệt"
        onCancel={() => !approveLoading && setApproveTarget(null)}
        onConfirm={confirmApprove}
      />

      <DocumentActionModal
        open={rejectOpen}
        loading={rejectLoading}
        title="Từ chối tài liệu"
        description="Vui lòng nhập lý do từ chối (bắt buộc)."
        placeholder="Nhập lý do..."
        confirmLabel="Xác nhận từ chối"
        danger
        required
        onCancel={() => !rejectLoading && setRejectOpen(false)}
        onConfirm={confirmReject}
      />
    </main>
  );
}
