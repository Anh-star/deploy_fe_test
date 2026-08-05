import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTableWrapper from '../../components/admin/AdminTableWrapper';
import AdminPagination from '../../components/admin/AdminPagination';
import { documentService } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { EyeIcon } from '../../components/icons';
import '../../styles/admin/adminDashboard.css';
import '../../styles/admin/adminComponents.css';
import '../../styles/admin/contentModerator.css';

const REASON_LABELS = {
  COPYRIGHT: 'Vi phạm bản quyền',
  WRONG_CONTENT: 'Nội dung sai lệch / Chất lượng kém',
  INAPPROPRIATE: 'Nội dung không phù hợp / Độc hại',
  SPAM: 'Spam / Quảng cáo rác',
  OTHER: 'Khác',
};

const REPORT_STATUS_UI = {
  PENDING:   { label: 'Chờ xử lý',    className: 'status-badge--pending' },
  RESOLVED:  { label: 'Đã xử lý',     className: 'status-badge--resolved' },
  DISMISSED: { label: 'Đã bỏ qua',    className: 'status-badge--dismissed' },
};

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
  const notification = useNotification();
  const [activeTab, setActiveTab] = useState('PENDING'); // PENDING | RESOLVED | DISMISSED | ''
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [search, setSearch] = useState('');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = activeTab || undefined;
      const data = await documentService.getReportedDocuments(statusParam, page, size);
      if (data) {
        setReports(data.content || []);
        setTotalElements(data.totalElements || 0);
      }
    } catch (err) {
      notification.error(err?.response?.data?.message || 'Không thể tải danh sách báo cáo tài liệu.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, size, notification]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleResolve = async (reportId) => {
    try {
      await documentService.resolveDocumentReport(reportId);
      notification.success('Đã đánh dấu báo cáo là Đã xử lý.');
      fetchReports();
    } catch (err) {
      notification.error(err?.response?.data?.message || 'Không thể xử lý báo cáo.');
    }
  };

  const handleDismiss = async (reportId) => {
    try {
      await documentService.dismissDocumentReport(reportId);
      notification.success('Đã bỏ qua báo cáo.');
      fetchReports();
    } catch (err) {
      notification.error(err?.response?.data?.message || 'Không thể bỏ qua báo cáo.');
    }
  };

  const filteredReports = reports.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const reasonLabel = (REASON_LABELS[r.reasonCode] || r.reasonCode || '').toLowerCase();
    return (
      (r.documentTitle || '').toLowerCase().includes(q) ||
      (r.reporterName || '').toLowerCase().includes(q) ||
      (r.detail || '').toLowerCase().includes(q) ||
      reasonLabel.includes(q)
    );
  });

  return (
    <main className="admin-main">
      <AdminPageHeader
        title="Quản lý Báo cáo Tài liệu"
        description="Danh sách báo cáo vi phạm nội dung, bản quyền, hoặc spam liên quan đến tài liệu trên hệ thống."
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tên tài liệu, người báo cáo, lý do..."
      />

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        {[
          { key: 'PENDING', label: 'Chờ xử lý' },
          { key: 'RESOLVED', label: 'Đã xử lý' },
          { key: 'DISMISSED', label: 'Đã bỏ qua' },
          { key: '', label: 'Tất cả' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setActiveTab(tab.key);
              setPage(0);
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: activeTab === tab.key ? '2px solid #6366F1' : '1px solid #CBD5E1',
              background: activeTab === tab.key ? '#EEF2FF' : '#FFFFFF',
              color: activeTab === tab.key ? '#4F46E5' : '#475569',
              fontWeight: activeTab === tab.key ? 700 : 500,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <AdminTableWrapper
        empty={!loading && filteredReports.length === 0}
        emptyTitle="Chưa có báo cáo"
        emptyDescription="Không có báo cáo tài liệu nào phù hợp với bộ lọc hiện tại."
        footer={
          <AdminPagination
            page={page}
            size={size}
            total={totalElements}
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
              <th>Ngày gửi</th>
              <th style={{ minWidth: 160 }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#64748B' }}>
                  Đang tải danh sách báo cáo...
                </td>
              </tr>
            ) : (
              filteredReports.map((row) => {
                const currentStatus = row.status || 'PENDING';
                const st = REPORT_STATUS_UI[currentStatus] ?? {
                  label: currentStatus,
                  className: 'status-badge--pending',
                };
                const reasonLabel = REASON_LABELS[row.reasonCode] || row.reasonCode || '—';

                return (
                  <tr key={row.id}>
                    <td>
                      <div className="file-info" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <DocumentIcon size={18} color="#64748B" style={{ flexShrink: 0 }} />
                        <div style={{ fontWeight: 600, color: '#0F172A' }}>{row.documentTitle || 'Tài liệu không tên'}</div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#334155' }}>{row.reporterName || 'N/A'}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#DC2626' }}>{reasonLabel}</div>
                      <small style={{ color: '#64748B', fontFamily: 'monospace' }}>{row.reasonCode}</small>
                    </td>
                    <td>
                      <span title={row.detail || ''}>{truncate(row.detail, 60)}</span>
                    </td>
                    <td>
                      <span className={`status-badge ${st.className}`}>{st.label}</span>
                    </td>
                    <td>{formatDateTime(row.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {row.documentId && (
                          <Link
                            to={`/documents/${row.documentId}`}
                            className="admin-btn-ghost"
                            style={{ textDecoration: 'none', padding: '4px 8px', fontSize: '13px' }}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <EyeIcon size={14} style={{ marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }} /> Xem
                          </Link>
                        )}

                        {currentStatus === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleResolve(row.id)}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                border: 'none',
                                background: '#10B981',
                                color: '#FFFFFF',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Xử lý
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDismiss(row.id)}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                background: '#F8FAFC',
                                color: '#64748B',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Bỏ qua
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </AdminTableWrapper>
    </main>
  );
}
