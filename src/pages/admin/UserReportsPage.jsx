import React, { useEffect, useState, useCallback, useMemo } from 'react';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTableWrapper from '../../components/admin/AdminTableWrapper';
import AdminPagination from '../../components/admin/AdminPagination';
import { documentService } from '../../services/api';
import { getAdminDocumentDetail } from '../../api/adminDocumentApi';
import SecureDocumentPreview from '../../components/document/SecureDocumentPreview';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { EyeIcon, DocumentIcon } from '../../components/icons';
import '../../styles/admin/adminDashboard.css';
import '../../styles/admin/adminComponents.css';
import '../../styles/admin/contentModerator.css';
import { parseApiDate } from '../../utils/dateUtils';

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

const HideIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const TrashIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    const d = parseApiDate(iso);
    if (!d || Number.isNaN(d.getTime())) return '—';
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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [stats, setStats] = useState({ pendingCount: 0, resolvedCount: 0, dismissedCount: 0 });
  const [selectedReport, setSelectedReport] = useState(null);
  const [previewDocDetail, setPreviewDocDetail] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [reasonModal, setReasonModal] = useState({
    open: false,
    actionType: '', // 'HIDE' | 'DELETE'
    reportId: null,
    documentTitle: '',
    reason: '',
    loading: false,
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [activeTab, debouncedSearch, startDate, endDate]);

  const handleOpenPreview = async (report) => {
    if (!report?.documentId) return;
    setSelectedReport(report);
    setPreviewDocDetail(null);
    setPreviewLoading(true);
    try {
      const detail = await getAdminDocumentDetail(report.documentId);
      setPreviewDocDetail(detail);
    } catch {
      notification.error('Không thể tải thông tin chi tiết tài liệu.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClosePreview = () => {
    setSelectedReport(null);
    setPreviewDocDetail(null);
    setPreviewLoading(false);
  };

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = activeTab || undefined;
      const data = await documentService.getReportedDocuments(
        statusParam,
        page,
        size,
        debouncedSearch,
        startDate,
        endDate
      );
      if (data) {
        setReports(data.content || []);
        setTotalElements(data.totalElements || 0);
        setStats({
          pendingCount: data.pendingCount || 0,
          resolvedCount: data.resolvedCount || 0,
          dismissedCount: data.dismissedCount || 0,
        });
      }
    } catch (err) {
      notification.error(err?.response?.data?.message || 'Không thể tải danh sách báo cáo tài liệu.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, size, debouncedSearch, startDate, endDate, notification]);

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

  const handlePromptHide = (report) => {
    setReasonModal({
      open: true,
      actionType: 'HIDE',
      reportId: report.id,
      documentTitle: report.documentTitle || previewDocDetail?.title || 'Tài liệu',
      reason: '',
      loading: false,
    });
  };

  const handlePromptDelete = (report) => {
    setReasonModal({
      open: true,
      actionType: 'DELETE',
      reportId: report.id,
      documentTitle: report.documentTitle || previewDocDetail?.title || 'Tài liệu',
      reason: '',
      loading: false,
    });
  };

  const handleConfirmAction = async () => {
    const { actionType, reportId, reason } = reasonModal;
    if (!reason || !reason.trim()) {
      notification.error('Vui lòng nhập lý do vi phạm để thông báo tới người đăng.');
      return;
    }

    setReasonModal((prev) => ({ ...prev, loading: true }));
    try {
      if (actionType === 'HIDE') {
        await documentService.hideDocumentReport(reportId, reason.trim());
        notification.success('Đã ẩn tài liệu và gửi thông báo vi phạm đến tác giả.');
      } else if (actionType === 'DELETE') {
        await documentService.deleteDocumentReport(reportId, reason.trim());
        notification.success('Đã xóa tài liệu và xử lý báo cáo thành công.');
      }
      setReasonModal({ open: false, actionType: '', reportId: null, documentTitle: '', reason: '', loading: false });
      handleClosePreview();
      fetchReports();
    } catch (err) {
      notification.error(err?.response?.data?.message || 'Có lỗi xảy ra khi thực hiện xử lý.');
      setReasonModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const pendingCount = stats.pendingCount;
  const resolvedCount = stats.resolvedCount;
  const dismissedCount = stats.dismissedCount;

  const { user } = useAuth();
  const isAdmin = useMemo(() => {
    const roles = user?.roles || [];
    return roles.map((r) => String(r).toUpperCase()).includes('ADMIN');
  }, [user?.roles]);

  return (
    <main className="admin-main">
      <AdminPageHeader
        title="Quản lý Báo cáo Tài liệu"
        description="Danh sách báo cáo vi phạm nội dung, bản quyền, hoặc spam liên quan đến tài liệu trên hệ thống."
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tên tài liệu, người báo cáo, lý do..."
      />

      {/* Metric Cards - Only visible for ADMIN role */}
      {isAdmin && (
        <section className="cmp-stats-grid">
          <div className="cmp-stat-card">
            <div className="cmp-stat-icon blue">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
            </div>
            <div className="cmp-stat-info">
              <h3>{loading ? '—' : totalElements}</h3>
              <p>Tổng số báo cáo</p>
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
              <h3>{loading ? '—' : pendingCount}</h3>
              <p>Báo cáo chờ xử lý</p>
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
              <h3>{loading ? '—' : resolvedCount}</h3>
              <p>Đã xử lý vi phạm</p>
            </div>
          </div>

          <div className="cmp-stat-card">
            <div className="cmp-stat-icon gray">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
            </div>
            <div className="cmp-stat-info">
              <h3>{loading ? '—' : dismissedCount}</h3>
              <p>Đã bỏ qua</p>
            </div>
          </div>
        </section>
      )}

      <div className="admin-toolbar-row">
        <div className="admin-tabs-wrapper">
          {[
            { key: 'PENDING', label: 'Chờ xử lý' },
            { key: 'RESOLVED', label: 'Đã xử lý' },
            { key: 'DISMISSED', label: 'Đã bỏ qua' },
            { key: '', label: 'Tất cả' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`admin-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.key);
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
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(0);
              }}
            />
          </div>

          <div className="admin-date-group">
            <span className="admin-date-label">Đến ngày:</span>
            <input
              type="date"
              className="admin-date-input"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(0);
              }}
            />
          </div>

          {(search || startDate || endDate) && (
            <button
              type="button"
              className="admin-reset-btn"
              onClick={() => {
                setSearch('');
                setStartDate('');
                setEndDate('');
                setPage(0);
              }}
              title="Xóa bộ lọc"
            >
              Reset bộ lọc
            </button>
          )}
        </div>
      </div>

      <AdminTableWrapper
        empty={!loading && reports.length === 0}
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
              reports.map((row) => {
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
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {row.documentId && (
                          <button
                            type="button"
                            className="admin-btn-ghost"
                            style={{ padding: '5px 10px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 600 }}
                            onClick={() => handleOpenPreview(row)}
                          >
                            <EyeIcon size={14} /> Chi tiết
                          </button>
                        )}
                        {currentStatus === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              title="Ẩn tài liệu vi phạm"
                              style={{
                                padding: '5px 9px',
                                fontSize: '12px',
                                background: '#FEF3C7',
                                color: '#B45309',
                                border: '1px solid #FDE68A',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                              onClick={() => handlePromptHide(row)}
                            >
                              <HideIcon size={13} /> Ẩn
                            </button>
                            <button
                              type="button"
                              title="Xóa tài liệu vi phạm"
                              style={{
                                padding: '5px 9px',
                                fontSize: '12px',
                                background: '#FEE2E2',
                                color: '#DC2626',
                                border: '1px solid #FECDD3',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                              onClick={() => handlePromptDelete(row)}
                            >
                              <TrashIcon size={13} /> Xóa
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

      {/* Document Detail & Preview Modal Popup */}
      {selectedReport && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9990,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={handleClosePreview}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '900px',
              maxHeight: '92vh',
              background: '#FFFFFF',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#F8FAFC',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <DocumentIcon size={20} color="#4F46E5" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                  {previewDocDetail?.title || selectedReport?.documentTitle || 'Xem chi tiết báo cáo tài liệu'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleClosePreview}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '20px',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '6px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {/* Report Info Alert Box */}
              <div
                style={{
                  background: '#FFF1F2',
                  border: '1px solid #FECDD3',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  marginBottom: '16px',
                  fontSize: '13px',
                }}
              >
                <div style={{ fontWeight: 700, color: '#9F1239', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>🚩 Thông tin báo cáo vi phạm</span>
                  <span className={`status-badge ${REPORT_STATUS_UI[selectedReport?.status || 'PENDING']?.className}`}>
                    {REPORT_STATUS_UI[selectedReport?.status || 'PENDING']?.label}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                  <div>
                    <span style={{ color: '#64748B' }}>Người báo cáo: </span>
                    <strong style={{ color: '#0F172A' }}>{selectedReport?.reporterName || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Lý do báo cáo: </span>
                    <strong style={{ color: '#DC2626' }}>{REASON_LABELS[selectedReport?.reasonCode] || selectedReport?.reasonCode || '—'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Ngày gửi báo cáo: </span>
                    <strong style={{ color: '#0F172A' }}>{formatDateTime(selectedReport?.createdAt)}</strong>
                  </div>
                </div>
                {selectedReport?.detail && (
                  <div style={{ marginTop: '8px', color: '#334155', borderTop: '1px dashed #FECDD3', paddingTop: '8px' }}>
                    <span style={{ color: '#64748B' }}>Nội dung phản ánh chi tiết: </span>
                    <strong>{selectedReport.detail}</strong>
                  </div>
                )}
              </div>

              {previewLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                  Đang tải thông tin tài liệu...
                </div>
              ) : previewDocDetail ? (
                <div>
                  {/* Meta info box */}
                  <div
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      marginBottom: '16px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '10px',
                      fontSize: '13px',
                    }}
                  >
                    <div>
                      <span style={{ color: '#64748B' }}>Tác giả: </span>
                      <strong style={{ color: '#0F172A' }}>{previewDocDetail.authorName || previewDocDetail.author?.fullName || previewDocDetail.createdByName || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748B' }}>Danh mục: </span>
                      <strong style={{ color: '#0F172A' }}>{previewDocDetail.categoryName || previewDocDetail.category?.name || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748B' }}>Định dạng: </span>
                      <strong style={{ color: '#0F172A' }}>{previewDocDetail.fileType || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748B' }}>Giá bán: </span>
                      <strong style={{ color: '#0F172A' }}>{previewDocDetail.isPaid ? `${(previewDocDetail.price || 0).toLocaleString('vi-VN')} đ` : 'Miễn phí'}</strong>
                    </div>
                    {(previewDocDetail.isHidden || selectedReport?.isDocumentHidden) && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: '#FEF3C7',
                          color: '#B45309',
                          fontWeight: 600,
                          fontSize: '12px',
                        }}>
                          ⚠️ Tài liệu này hiện đang ở trạng thái BỊ ẨN
                        </span>
                      </div>
                    )}
                    {(previewDocDetail.isDeleted || selectedReport?.isDocumentDeleted) && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: '#FEE2E2',
                          color: '#B91C1C',
                          fontWeight: 600,
                          fontSize: '12px',
                        }}>
                          🗑️ Tài liệu này ĐÃ BỊ XÓA khỏi hệ thống
                        </span>
                      </div>
                    )}
                    {previewDocDetail.description && (
                      <div style={{ gridColumn: '1 / -1', marginTop: '4px', color: '#475569' }}>
                        <span style={{ color: '#64748B' }}>Mô tả tài liệu: </span>
                        {previewDocDetail.description}
                      </div>
                    )}
                  </div>

                  {/* Document Preview Component */}
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', minHeight: '400px' }}>
                    <SecureDocumentPreview
                      documentId={selectedReport?.documentId}
                      fileType={previewDocDetail.fileType}
                      fileName={previewDocDetail.fileName}
                      isPaid={previewDocDetail.isPaid}
                      status={previewDocDetail.status}
                      publicFileUrl={previewDocDetail.fileUrl}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ padding: '30px', textAlign: 'center', color: '#DC2626' }}>
                  Không thể tải nội dung tài liệu.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#F8FAFC',
              }}
            >
              <button
                type="button"
                onClick={handleClosePreview}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>

              {selectedReport?.status === 'PENDING' && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleDismiss(selectedReport.id);
                      handleClosePreview();
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      color: '#64748B',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Bỏ qua báo cáo
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePromptHide(selectedReport)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#D97706',
                      color: '#FFFFFF',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <HideIcon size={15} />
                    <span>Ẩn tài liệu</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePromptDelete(selectedReport)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#DC2626',
                      color: '#FFFFFF',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <TrashIcon size={15} />
                    <span>Xóa tài liệu</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Confirmation & Reason Modal */}
      {reasonModal.open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => !reasonModal.loading && setReasonModal((prev) => ({ ...prev, open: false }))}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              background: '#FFFFFF',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: reasonModal.actionType === 'DELETE' ? '#FEF2F2' : '#FFFBEB',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {reasonModal.actionType === 'DELETE' ? (
                  <TrashIcon size={18} />
                ) : (
                  <HideIcon size={18} />
                )}
                <h3
                  style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: 700,
                    color: reasonModal.actionType === 'DELETE' ? '#B91C1C' : '#B45309',
                  }}
                >
                  {reasonModal.actionType === 'DELETE'
                    ? 'Xác nhận xóa tài liệu vi phạm'
                    : 'Xác nhận ẩn tài liệu vi phạm'}
                </h3>
              </div>
              <button
                type="button"
                disabled={reasonModal.loading}
                onClick={() => setReasonModal((prev) => ({ ...prev, open: false }))}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '18px',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '13px', color: '#475569', lineHeight: '20px' }}>
                {reasonModal.actionType === 'DELETE' ? (
                  <span>
                    Hành động này sẽ <strong>xóa tài liệu</strong> khỏi hệ thống và đánh dấu báo cáo là <strong>Đã xử lý</strong>.
                  </span>
                ) : (
                  <span>
                    Hành động này sẽ <strong>ẩn tài liệu</strong> khỏi danh sách công khai và đánh dấu báo cáo là <strong>Đã xử lý</strong>.
                  </span>
                )}
                <div style={{ marginTop: '6px', color: '#0F172A', fontWeight: 600 }}>
                  Tài liệu: "{reasonModal.documentTitle}"
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1E293B',
                    marginBottom: '6px',
                  }}
                >
                  Lý do vi phạm <span style={{ color: '#DC2626' }}>*</span> (sẽ gửi thông báo đến tác giả):
                </label>
                <textarea
                  rows={4}
                  value={reasonModal.reason}
                  onChange={(e) => setReasonModal((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder={
                    reasonModal.actionType === 'DELETE'
                      ? 'Nhập lý do xóa tài liệu (VD: Tài liệu chứa nội dung độc hại / vi phạm bản quyền nghiêm trọng)...'
                      : 'Nhập lý do ẩn tài liệu (VD: Tài liệu đang bị khiếu nại bản quyền / sai lệch thông tin)...'
                  }
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    fontSize: '13px',
                    fontFamily: 'Inter, sans-serif',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    outline: 'none',
                    resize: 'vertical',
                    lineHeight: '1.4',
                  }}
                  disabled={reasonModal.loading}
                  autoFocus
                />
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
                background: '#F8FAFC',
              }}
            >
              <button
                type="button"
                disabled={reasonModal.loading}
                onClick={() => setReasonModal((prev) => ({ ...prev, open: false }))}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#64748B',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={reasonModal.loading}
                onClick={handleConfirmAction}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: reasonModal.actionType === 'DELETE' ? '#DC2626' : '#D97706',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: reasonModal.loading ? 'not-allowed' : 'pointer',
                  opacity: reasonModal.loading ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {reasonModal.loading ? (
                  <span>Đang xử lý...</span>
                ) : reasonModal.actionType === 'DELETE' ? (
                  <>
                    <TrashIcon size={14} />
                    <span>Xác nhận Xóa tài liệu</span>
                  </>
                ) : (
                  <>
                    <HideIcon size={14} />
                    <span>Xác nhận Ẩn tài liệu</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
