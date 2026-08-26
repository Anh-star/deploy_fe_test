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
import { useAuth } from '../../context/AuthContext';
import { getDocumentThumbnailUrl, onDocumentThumbnailError } from '../../utils/documentThumbnail';
import '../../styles/admin/adminDashboard.css';
import '../../styles/admin/adminComponents.css';
import { parseApiDate } from '../../utils/dateUtils';

const PAGE_SIZE = 10;

function formatDateTime(value) {
  if (value == null) return '—';
  try {
    const d = parseApiDate(value);
    if (!d || Number.isNaN(d.getTime())) return '—';
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

  const pendingCount = items.filter(
    (d) => String(d.status || '').toUpperCase() === 'PENDING'
  ).length;
  const approvedCount = items.filter(
    (d) => String(d.status || '').toUpperCase() === 'APPROVED'
  ).length;
  const rejectedCount = items.filter(
    (d) => String(d.status || '').toUpperCase() === 'REJECTED'
  ).length;

  const { user } = useAuth();
  const isAdmin = useMemo(() => {
    const roles = user?.roles || [];
    return roles.map((r) => String(r).toUpperCase()).includes('ADMIN');
  }, [user?.roles]);

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

      {/* Metric Cards - Only visible for ADMIN role */}
      {isAdmin && (
        <section className="cmp-stats-grid">
          <div className="cmp-stat-card">
            <div className="cmp-stat-icon blue">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div className="cmp-stat-info">
              <h3>{isLoading ? '—' : total}</h3>
              <p>Tổng số tài liệu</p>
            </div>
          </div>

          <div className="cmp-stat-card">
            <div className="cmp-stat-icon pending">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="cmp-stat-info">
              <h3>{isLoading ? '—' : pendingCount}</h3>
              <p>Tài liệu chờ duyệt</p>
            </div>
          </div>

          <div className="cmp-stat-card">
            <div className="cmp-stat-icon resolved">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div className="cmp-stat-info">
              <h3>{isLoading ? '—' : approvedCount}</h3>
              <p>Đã phê duyệt</p>
            </div>
          </div>

          <div className="cmp-stat-card">
            <div className="cmp-stat-icon rejected">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div className="cmp-stat-info">
              <h3>{isLoading ? '—' : rejectedCount}</h3>
              <p>Đã từ chối</p>
            </div>
          </div>
        </section>
      )}

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
