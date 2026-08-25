import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTableWrapper from '../../components/admin/AdminTableWrapper';
import AdminPagination from '../../components/admin/AdminPagination';
import {
  getApiErrorMessage,
  getPendingDocuments,
} from '../../api/adminDocumentApi';
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
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [size] = useState(PAGE_SIZE);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-pending-documents', page, size, statusFilter],
    queryFn: () => getPendingDocuments(page, size, statusFilter),
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const filteredItems = useMemo(() => {
    return items.filter((doc) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const author = (doc.authorName?.trim() || doc.author?.fullName || doc.createdByName || '').toLowerCase();
        const category = (doc.categoryName || doc.category || '').toLowerCase();
        const match =
          (doc.title || '').toLowerCase().includes(q) ||
          (doc.fileName || '').toLowerCase().includes(q) ||
          author.includes(q) ||
          category.includes(q) ||
          (doc.fileType || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      if (startDate) {
        const rawDate = doc.uploadDate || doc.createdAt;
        const itemDate = rawDate ? new Date(rawDate) : null;
        if (itemDate && itemDate < new Date(`${startDate}T00:00:00`)) return false;
      }
      if (endDate) {
        const rawDate = doc.uploadDate || doc.createdAt;
        const itemDate = rawDate ? new Date(rawDate) : null;
        if (itemDate && itemDate > new Date(`${endDate}T23:59:59.999`)) return false;
      }
      return true;
    });
  }, [items, search, startDate, endDate]);

  useEffect(() => {
    if (isLoading) return;
    if (total === 0 && page > 0) setPage(0);
  }, [total, page, isLoading]);

  const empty = useMemo(() => !isLoading && filteredItems.length === 0, [isLoading, filteredItems.length]);

  return (
    <main className="admin-main">
      <AdminPageHeader
        title="Quản lý duyệt tài liệu"
        description="Kiểm duyệt và quản lý các tài liệu được người dùng đăng tải lên nền tảng."
        showSearch={true}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tiêu đề, tác giả, danh mục..."
      />

      <div className="admin-toolbar-row">
        <div className="admin-tabs-wrapper">
          {[
            { key: '', label: 'Tất cả' },
            { key: 'PENDING', label: 'Chờ duyệt' },
            { key: 'APPROVED', label: 'Đã duyệt' },
            { key: 'REJECTED', label: 'Đã từ chối' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`admin-tab-btn ${statusFilter === tab.key ? 'active' : ''}`}
              onClick={() => {
                setStatusFilter(tab.key);
                setPage(0);
              }}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="admin-date-filters">
          <div className="admin-date-group">
            <span className="admin-date-label">Từ ngày:</span>
            <input
              type="date"
              className="admin-date-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="admin-date-group">
            <span className="admin-date-label">Đến ngày:</span>
            <input
              type="date"
              className="admin-date-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {(search || startDate || endDate || statusFilter) && (
            <button
              type="button"
              className="admin-reset-btn"
              onClick={() => {
                setSearch('');
                setStartDate('');
                setEndDate('');
                setStatusFilter('');
                setPage(0);
              }}
              title="Xóa bộ lọc"
            >
              Reset bộ lọc
            </button>
          )}
        </div>
      </div>

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
        emptyTitle="Không có tài liệu nào"
        emptyDescription="Không tìm thấy tài liệu phù hợp với bộ lọc hiện tại."
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
            {filteredItems.map((doc) => {
              const thumbSrc = getDocumentThumbnailUrl({
                thumbnailUrl: doc.thumbnailUrl,
              });
              const author =
                doc.authorName?.trim() ||
                doc.author?.fullName ||
                doc.createdByName ||
                '—';
              const category = doc.categoryName || doc.category || '—';
              const s = (doc.status || '').toUpperCase();
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
                    {s === 'APPROVED' ? (
                      <span className="status-badge status-approved">Đã duyệt</span>
                    ) : s === 'REJECTED' ? (
                      <span className="status-badge status-rejected">Đã từ chối</span>
                    ) : (
                      <span className="status-badge status-pending">Chờ duyệt</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="admin-btn-ghost"
                      onClick={() => navigate(`/admin/documents/${doc.id}`)}
                    >
                      Xem chi tiết
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </AdminTableWrapper>
    </main>
  );
}
