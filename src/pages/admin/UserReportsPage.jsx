import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTableWrapper from '../../components/admin/AdminTableWrapper';
import AdminPagination from '../../components/admin/AdminPagination';
import '../../styles/admin/adminDashboard.css';
import '../../styles/admin/adminComponents.css';
import '../../styles/admin/contentModerator.css';

/** Mã lý do — khớp hướng entity `reason_code` phía backend */
const REASON_LABELS = {
  COPYRIGHT: 'Vi phạm bản quyền',
  INAPPROPRIATE: 'Nội dung không phù hợp',
  MISLEADING: 'Thông tin sai lệch / gây hiểu nhầm',
  SPAM: 'Spam / quảng cáo',
  OTHER: 'Khác',
};

const REPORT_STATUS_UI = {
  PENDING:   { label: 'Chờ xử lý',    className: 'status-badge--pending' },
  REVIEWING: { label: 'Đang xem xét', className: 'status-badge--reviewing' },
  RESOLVED:  { label: 'Đã xử lý',     className: 'status-badge--resolved' },
  DISMISSED: { label: 'Đã bỏ qua',    className: 'status-badge--dismissed' },
};

/** Mock — thay bằng API danh sách báo cáo khi backend sẵn sàng */
const MOCK_USER_REPORTS = [
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    documentId: '11111111-2222-3333-4444-555555555501',
    documentTitle: 'Giáo trình CSDL nâng cao.pdf',
    reporter: { name: 'Nguyễn Văn An', email: 'an.nguyen@email.com' },
    reasonCode: 'COPYRIGHT',
    detail: 'Tài liệu copy nguyên tác từ NXB X không ghi nguồn.',
    status: 'PENDING',
    createdAt: '2026-04-08T14:22:00',
  },
  {
    id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    documentId: '11111111-2222-3333-4444-555555555502',
    documentTitle: 'Slide ôn thi mạng máy tính.pptx',
    reporter: { name: 'Trần Thị Bình', email: 'binh.tran@example.vn' },
    reasonCode: 'INAPPROPRIATE',
    detail: 'Có hình ảnh nhạy cảm ở slide 12–15.',
    status: 'REVIEWING',
    createdAt: '2026-04-07T09:10:00',
  },
  {
    id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    documentId: '11111111-2222-3333-4444-555555555503',
    documentTitle: 'Đề cương Java cơ bản.docx',
    reporter: { name: 'Lê Hoàng Nam', email: 'namlh@gmail.com' },
    reasonCode: 'MISLEADING',
    detail: 'Mô tả là đề cương chính thức nhưng không phải của khoa.',
    status: 'RESOLVED',
    createdAt: '2026-04-05T16:45:00',
  },
  {
    id: 'd4e5f6a7-b8c9-0123-def0-234567890123',
    documentId: '11111111-2222-3333-4444-555555555504',
    documentTitle: 'Khóa học lập trình web miễn phí.pdf',
    reporter: { name: 'Phạm Quỳnh', email: 'quynh.pham@study.vn' },
    reasonCode: 'SPAM',
    detail: 'Toàn link ra trang bán khóa học ngoài nền tảng.',
    status: 'PENDING',
    createdAt: '2026-04-04T11:00:00',
  },
  {
    id: 'e5f6a7b8-c9d0-1234-ef01-345678901234',
    documentId: '11111111-2222-3333-4444-555555555505',
    documentTitle: 'Bài tập nhóm OOP.zip',
    reporter: { name: 'Hoàng Minh Tuấn', email: 'tuan.hm@uni.edu' },
    reasonCode: 'OTHER',
    detail: 'File zip không mở được trên nhiều máy, nghi ngờ chứa mã độc.',
    status: 'DISMISSED',
    createdAt: '2026-04-02T08:30:00',
  },
  {
    id: 'f6a7b8c9-d0e1-2345-f012-456789012345',
    documentId: '11111111-2222-3333-4444-555555555501',
    documentTitle: 'Giáo trình CSDL nâng cao.pdf',
    reporter: { name: 'Đỗ Thu Hà', email: 'ha.do@email.com' },
    reasonCode: 'COPYRIGHT',
    detail: 'Trùng với tài liệu đã báo cáo trước đó.',
    status: 'PENDING',
    createdAt: '2026-04-01T19:20:00',
  },
];

function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function truncate(str, max = 72) {
  if (!str) return '—';
  const t = str.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export default function UserReportsPage() {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // Theo dõi trạng thái local (key = report.id)
  const [statusMap, setStatusMap] = useState(() =>
    Object.fromEntries(MOCK_USER_REPORTS.map((r) => [r.id, r.status]))
  );

  const handleSetStatus = (id, newStatus) => {
    setStatusMap((prev) => ({ ...prev, [id]: newStatus }));
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return MOCK_USER_REPORTS;
    return MOCK_USER_REPORTS.filter((r) => {
      const reasonLabel = (REASON_LABELS[r.reasonCode] || r.reasonCode || '').toLowerCase();
      return (
        (r.documentTitle || '').toLowerCase().includes(q) ||
        (r.reporter?.name || '').toLowerCase().includes(q) ||
        (r.reporter?.email || '').toLowerCase().includes(q) ||
        (r.detail || '').toLowerCase().includes(q) ||
        reasonLabel.includes(q) ||
        (r.reasonCode || '').toLowerCase().includes(q)
      );
    });
  }, [debouncedSearch]);

  const total = filtered.length;
  const items = useMemo(() => {
    const start = page * size;
    return filtered.slice(start, start + size);
  }, [filtered, page, size]);

  const empty = items.length === 0;

  return (
    <main className="admin-main">
      <AdminPageHeader
        title="Báo cáo người dùng"
        description="Danh sách báo cáo vi phạm hoặc nội dung không phù hợp liên quan đến tài liệu trên nền tảng."
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tài liệu, người báo cáo, lý do, chi tiết…"
        actions={
          <button type="button" className="admin-btn-secondary">
            Lọc trạng thái
          </button>
        }
      />

      <AdminTableWrapper
        empty={empty}
        emptyTitle="Chưa có báo cáo"
        emptyDescription={
          debouncedSearch
            ? 'Không có báo cáo khớp từ khóa — thử tìm kiếm khác.'
            : 'Khi người dùng báo cáo tài liệu, thông tin sẽ hiển thị tại đây.'
        }
        footer={
          <AdminPagination
            page={page}
            size={size}
            total={total}
            onPageChange={setPage}
            onSizeChange={(next) => {
              setSize(next);
              setPage(0);
            }}
          />
        }
      >
        <table className="admin-table">
          <thead>
            <tr>
              <th>Tài liệu</th>
              <th>Người báo cáo</th>
              <th>Lý do</th>
              <th>Chi tiết</th>
              <th>Trạng thái</th>
              <th>Gửi lúc</th>
              <th style={{ minWidth: 140 }}>Thao tác</th>
              <th style={{ minWidth: 200 }}>Xử lý</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const currentStatus = statusMap[row.id] || row.status;
              const st = REPORT_STATUS_UI[currentStatus] ?? {
                label: currentStatus,
                className: 'status-badge--pending',
              };
              const reasonLabel = REASON_LABELS[row.reasonCode] || row.reasonCode || '—';
              return (
                <tr key={row.id}>
                  <td>
                    <div className="file-info">
                      <span className="file-icon" aria-hidden>
                        📄
                      </span>
                      <span>{row.documentTitle || '—'}</span>
                    </div>
                  </td>
                  <td>
                    <div>
                      <div style={{ fontWeight: 600 }}>{row.reporter?.name || '—'}</div>
                      <small style={{ color: '#667085' }}>{row.reporter?.email || ''}</small>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{reasonLabel}</div>
                    <small style={{ color: '#667085', fontFamily: 'monospace' }}>
                      {row.reasonCode}
                    </small>
                  </td>
                  <td>
                    <span title={row.detail || ''}>{truncate(row.detail)}</span>
                  </td>
                  <td>
                    <span className={`status-badge ${st.className}`}>{st.label}</span>
                  </td>
                  <td>{formatDateTime(row.createdAt)}</td>
                  <td>
                    <div className="admin-table-actions">
                      <Link
                        to={`/document/${row.documentId}`}
                        className="admin-btn-ghost"
                        style={{ textDecoration: 'none', display: 'inline-block' }}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Xem tài liệu
                      </Link>
                    </div>
                  </td>
                  <td>
                    <div className="admin-table-actions report-action-btns">
                      <button
                        type="button"
                        className={`report-action-btn report-action-btn--resolve${
                          currentStatus === 'RESOLVED' ? ' report-action-btn--active' : ''
                        }`}
                        title="Đánh dấu đã xử lý"
                        onClick={() => handleSetStatus(row.id, 'RESOLVED')}
                        disabled={currentStatus === 'RESOLVED'}
                      >
                        ✅ Xử lý
                      </button>
                      <button
                        type="button"
                        className={`report-action-btn report-action-btn--review${
                          currentStatus === 'REVIEWING' ? ' report-action-btn--active' : ''
                        }`}
                        title="Chuyển sang đang xem xét"
                        onClick={() => handleSetStatus(row.id, 'REVIEWING')}
                        disabled={currentStatus === 'REVIEWING'}
                      >
                        🔍 Đang xem xét
                      </button>
                    </div>
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
