import React, { useEffect, useState, useCallback, useMemo } from 'react';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTableWrapper from '../../components/admin/AdminTableWrapper';
import AdminPagination from '../../components/admin/AdminPagination';
import { documentService } from '../../services/api';
import { getAdminDocumentDetail } from '../../api/adminDocumentApi';
import SecureDocumentPreview from '../../components/document/SecureDocumentPreview';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  EyeIcon,
  DocumentIcon,
  LockIcon,
  UnlockIcon,
  TrashIcon,
  DismissIcon,
  FlameIcon,
  FlagIcon,
  ClipboardListIcon,
} from '../../components/icons';
import '../../styles/admin/adminDashboard.css';
import '../../styles/admin/adminComponents.css';
import '../../styles/admin/contentModerator.css';
import '../../styles/communityModerationPage.css';
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
  const [stats, setStats] = useState({ pendingCount: 0, resolvedCount: 0, dismissedCount: 0, allCount: 0 });

  // Group expansion state for accordion
  const [expandedDocs, setExpandedDocs] = useState({});

  // Selected document group for detail modal
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [previewDocDetail, setPreviewDocDetail] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Reason Modal State
  const [reasonModal, setReasonModal] = useState({
    open: false,
    actionType: '', // 'HIDE' | 'UNHIDE' | 'DELETE' | 'DISMISS_GROUP'
    targetGroup: null,
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

  const toggleExpand = (docId) => {
    setExpandedDocs((prev) => ({
      ...prev,
      [docId]: !prev[docId],
    }));
  };

  const handleOpenPreview = async (group) => {
    if (!group?.documentId) return;
    setSelectedGroup(group);
    setPreviewDocDetail(null);
    setPreviewLoading(true);
    try {
      const detail = await getAdminDocumentDetail(group.documentId);
      setPreviewDocDetail(detail);
    } catch {
      notification.error('Không thể tải thông tin chi tiết tài liệu.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClosePreview = () => {
    setSelectedGroup(null);
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
          allCount: data.allCount != null ? data.allCount : (data.totalElements || 0),
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

  // Group reports by documentId
  const groupedDocuments = useMemo(() => {
    const map = {};
    reports.forEach((report) => {
      const docId = report.documentId || report.id;
      if (!map[docId]) {
        map[docId] = {
          documentId: docId,
          documentTitle: report.documentTitle || 'Tài liệu không tên',
          documentAuthorName: report.documentAuthorName || 'Tác giả',
          documentAuthorAvatar: report.documentAuthorAvatar || null,
          isDocumentHidden: Boolean(report.isDocumentHidden),
          isDocumentDeleted: Boolean(report.isDocumentDeleted),
          documentStatus: report.documentStatus,
          reportsList: [],
        };
      }
      map[docId].reportsList.push(report);
      if (report.isDocumentHidden) map[docId].isDocumentHidden = true;
      if (report.isDocumentDeleted) map[docId].isDocumentDeleted = true;
    });
    return Object.values(map);
  }, [reports]);

  const handlePromptHide = (group) => {
    const reportId = group?.reportsList?.[0]?.id;
    setReasonModal({
      open: true,
      actionType: 'HIDE',
      targetGroup: group,
      reportId,
      documentTitle: group?.documentTitle || previewDocDetail?.title || 'Tài liệu',
      reason: '',
      loading: false,
    });
  };

  const handlePromptUnhide = (group) => {
    const reportId = group?.reportsList?.[0]?.id;
    setReasonModal({
      open: true,
      actionType: 'UNHIDE',
      targetGroup: group,
      reportId,
      documentTitle: group?.documentTitle || previewDocDetail?.title || 'Tài liệu',
      reason: '',
      loading: false,
    });
  };

  const handlePromptDelete = (group) => {
    const reportId = group?.reportsList?.[0]?.id;
    setReasonModal({
      open: true,
      actionType: 'DELETE',
      targetGroup: group,
      reportId,
      documentTitle: group?.documentTitle || previewDocDetail?.title || 'Tài liệu',
      reason: '',
      loading: false,
    });
  };

  const handlePromptDismissGroup = (group) => {
    const reportId = group?.reportsList?.[0]?.id;
    setReasonModal({
      open: true,
      actionType: 'DISMISS_GROUP',
      targetGroup: group,
      reportId,
      documentTitle: group?.documentTitle || previewDocDetail?.title || 'Tài liệu',
      reason: '',
      loading: false,
    });
  };

  const handleConfirmAction = async () => {
    const { actionType, reportId, targetGroup, reason } = reasonModal;
    if (actionType !== 'DISMISS_GROUP' && (!reason || !reason.trim())) {
      notification.error('Vui lòng nhập lý do để gửi thông báo đến tác giả.');
      return;
    }

    setReasonModal((prev) => ({ ...prev, loading: true }));
    try {
      if (actionType === 'HIDE') {
        await documentService.hideDocumentReport(reportId, reason.trim());
        notification.success('Đã ẩn tài liệu và gửi thông báo vi phạm đến tác giả.');
        setReports((prev) =>
          prev.map((r) =>
            r.documentId === targetGroup?.documentId ? { ...r, isDocumentHidden: true } : r
          )
        );
        setSelectedGroup((prev) =>
          prev?.documentId === targetGroup?.documentId ? { ...prev, isDocumentHidden: true } : prev
        );
        setPreviewDocDetail((prev) => (prev ? { ...prev, isHidden: true } : null));
      } else if (actionType === 'UNHIDE') {
        await documentService.unhideDocumentReport(reportId, reason.trim());
        notification.success('Đã mở ẩn tài liệu và gửi thông báo đến tác giả.');
        setReports((prev) =>
          prev.map((r) =>
            r.documentId === targetGroup?.documentId ? { ...r, isDocumentHidden: false } : r
          )
        );
        setSelectedGroup((prev) =>
          prev?.documentId === targetGroup?.documentId ? { ...prev, isDocumentHidden: false } : prev
        );
        setPreviewDocDetail((prev) => (prev ? { ...prev, isHidden: false } : null));
      } else if (actionType === 'DELETE') {
        await documentService.deleteDocumentReport(reportId, reason.trim());
        notification.success('Đã xóa tài liệu và xử lý báo cáo thành công.');
        setReports((prev) =>
          prev.map((r) =>
            r.documentId === targetGroup?.documentId ? { ...r, isDocumentDeleted: true } : r
          )
        );
        setSelectedGroup((prev) =>
          prev?.documentId === targetGroup?.documentId ? { ...prev, isDocumentDeleted: true } : prev
        );
        setPreviewDocDetail((prev) => (prev ? { ...prev, isDeleted: true } : null));
        handleClosePreview();
      } else if (actionType === 'DISMISS_GROUP') {
        const pendingReports = targetGroup?.reportsList?.filter((r) => r.status === 'PENDING') || [];
        await Promise.all(pendingReports.map((r) => documentService.dismissDocumentReport(r.id)));
        notification.success('Đã bỏ qua các báo cáo của tài liệu này.');
        handleClosePreview();
      }

      setReasonModal({ open: false, actionType: '', targetGroup: null, reportId: null, documentTitle: '', reason: '', loading: false });
      fetchReports();
    } catch (err) {
      notification.error(err?.response?.data?.message || 'Có lỗi xảy ra khi thực hiện xử lý.');
      setReasonModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const pendingCount = stats.pendingCount;
  const resolvedCount = stats.resolvedCount;
  const dismissedCount = stats.dismissedCount;
  const allCount = stats.allCount;

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
              <h3>{loading ? '—' : (allCount || totalElements)}</h3>
              <p>Tổng tài liệu bị báo cáo</p>
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
              <p>Tài liệu chờ xử lý</p>
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
              <p>Tài liệu đã xử lý vi phạm</p>
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
              <p>Tài liệu đã bỏ qua</p>
            </div>
          </div>
        </section>
      )}

      {/* Status Filter Tabs & Date Filters */}
      <div className="cmp-toolbar-row">
        <div className="cmp-tabs-wrapper">
          {[
            { key: 'PENDING', label: 'Chờ xử lý', count: pendingCount },
            { key: 'RESOLVED', label: 'Đã xử lý', count: resolvedCount },
            { key: 'DISMISSED', label: 'Đã bỏ qua', count: dismissedCount },
            { key: '', label: 'Tất cả', count: allCount },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`cmp-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.key);
                setPage(0);
              }}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && <span className="cmp-tab-badge">{tab.count}</span>}
            </button>
          ))}
        </div>

        <div className="cmp-date-filters">
          <div className="cmp-date-group">
            <span className="cmp-date-label">Từ ngày:</span>
            <input
              type="date"
              className="cmp-date-input"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(0);
              }}
            />
          </div>

          <div className="cmp-date-group">
            <span className="cmp-date-label">Đến ngày:</span>
            <input
              type="date"
              className="cmp-date-input"
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
              className="cmp-reset-btn"
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

      {/* Reports Table: Grouped by Document */}
      <AdminTableWrapper
        empty={!loading && groupedDocuments.length === 0}
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
        <table className="cmp-table">
          <thead>
            <tr>
              <th>Tài liệu</th>
              <th>Tác giả</th>
              <th>Lý do</th>
              <th style={{ whiteSpace: 'nowrap' }}>Số lượt báo cáo</th>
              <th style={{ whiteSpace: 'nowrap' }}>Trạng thái</th>
              <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#64748B' }}>
                  Đang tải danh sách báo cáo tài liệu...
                </td>
              </tr>
            ) : (
              groupedDocuments.map((group) => {
                const isExpanded = expandedDocs[group.documentId];
                const uniqueReasons = Array.from(new Set(group.reportsList.map((r) => r.reasonCode).filter(Boolean)));
                const isDocHidden = group.isDocumentHidden;
                const isDocDeleted = group.isDocumentDeleted;

                return (
                  <React.Fragment key={group.documentId}>
                    <tr
                      style={{ cursor: 'pointer', transition: 'background 0.15s ease' }}
                      onClick={() => toggleExpand(group.documentId)}
                    >
                      {/* Cột Tài liệu */}
                      <td className="cmp-post-cell">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '12px',
                              color: '#6366F1',
                              display: 'inline-block',
                              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s ease',
                              cursor: 'pointer',
                              padding: '2px',
                            }}
                          >
                            ▶
                          </span>
                          <div
                            className="cmp-post-title"
                            style={{ fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPreview(group);
                            }}
                            title="Xem chi tiết tài liệu trong modal"
                          >
                            <DocumentIcon size={16} color="#4F46E5" />
                            <span>{group.documentTitle || 'Tài liệu không tên'}</span>
                            {isDocDeleted && (
                              <span style={{ fontSize: '11px', background: '#FEE2E2', color: '#DC2626', padding: '1px 6px', borderRadius: '4px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <TrashIcon size={10} color="#DC2626" /> Đã xóa vi phạm
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Cột Tác giả */}
                      <td>
                        <div className="cmp-user-pill">
                          <div className="cmp-avatar-small">
                            {(group.documentAuthorName || 'A').charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, color: '#1E293B' }}>
                            {group.documentAuthorName || 'Tác giả'}
                          </span>
                        </div>
                      </td>

                      {/* Cột Lý do */}
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {uniqueReasons.map((code) => (
                            <span key={code} className={`cmp-reason-tag ${code}`}>
                              {REASON_LABELS[code] || code}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Cột Số lượt báo cáo */}
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span className="cmp-count-badge">
                          <FlameIcon /> {group.reportsList.length} báo cáo
                        </span>
                      </td>

                      {/* Cột Trạng thái tài liệu */}
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {isDocDeleted ? (
                          <span className="cmp-status-badge hidden" style={{ background: '#FEE2E2', color: '#DC2626', borderColor: '#FCA5A5', whiteSpace: 'nowrap' }}>
                            <TrashIcon size={12} color="#DC2626" /> Đã xóa vi phạm
                          </span>
                        ) : isDocHidden ? (
                          <span className="cmp-status-badge hidden" style={{ background: '#FEF3C7', color: '#B45309', borderColor: '#FDE68A', whiteSpace: 'nowrap' }}>
                            <LockIcon size={12} color="#B45309" /> Bị ẩn
                          </span>
                        ) : (
                          <span className="cmp-status-badge visible" style={{ whiteSpace: 'nowrap' }}>
                            <EyeIcon size={12} color="currentColor" /> Hiển thị
                          </span>
                        )}
                      </td>

                      {/* Cột Thao tác: CHỈ CÓ NÚT CHI TIẾT */}
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                        <div className="cmp-actions" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="cmp-btn cmp-btn-view"
                            onClick={() => handleOpenPreview(group)}
                            title="Xem chi tiết tài liệu và các báo cáo"
                          >
                            <EyeIcon />
                            <span>Chi tiết</span>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Accordion sub-row: Danh sách chi tiết các báo cáo con */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} style={{ background: '#F8FAFC', padding: '14px 20px', borderBottom: '1px solid #E2E8F0' }}>
                          <div style={{ fontWeight: 700, fontSize: '13px', color: '#334155', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <ClipboardListIcon size={16} color="#4F46E5" />
                            <span>Danh sách chi tiết các lượt báo cáo ({group.reportsList.length}):</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '135px', overflowY: 'auto', paddingRight: '6px' }}>
                            {group.reportsList.map((item, idx) => (
                              <div
                                key={item.id || idx}
                                style={{
                                  background: '#FFFFFF',
                                  border: '1px solid #E2E8F0',
                                  borderRadius: '8px',
                                  padding: '10px 14px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '12px',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                  <div className="cmp-user-pill">
                                    <div className="cmp-avatar-small" style={{ background: '#EEF2FF', color: '#4F46E5' }}>
                                      {(item.reporterName || 'R').charAt(0).toUpperCase()}
                                    </div>
                                    <span style={{ fontWeight: 600, color: '#1E293B' }}>
                                      {item.reporterName || 'Người dùng'}
                                    </span>
                                  </div>
                                  <span className={`cmp-reason-tag ${item.reasonCode}`}>
                                    {REASON_LABELS[item.reasonCode] || item.reasonCode}
                                  </span>
                                  {item.detail && (
                                    <span style={{ color: '#475569', fontSize: '13px' }}>
                                      • Chi tiết: <em>"{item.detail}"</em>
                                    </span>
                                  )}
                                </div>
                                <span style={{ color: '#94A3B8', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                  {formatDateTime(item.createdAt)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </AdminTableWrapper>

      {/* Document Detail & Moderation Modal Popup */}
      {selectedGroup && (
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <DocumentIcon size={20} color="#4F46E5" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                  {previewDocDetail?.title || selectedGroup?.documentTitle || 'Chi tiết báo cáo tài liệu'}
                </h3>
                {selectedGroup.isDocumentDeleted ? (
                  <span className="cmp-status-badge hidden" style={{ background: '#FEE2E2', color: '#DC2626', borderColor: '#FCA5A5', whiteSpace: 'nowrap' }}>
                    <TrashIcon size={12} color="#DC2626" /> Đã xóa vi phạm
                  </span>
                ) : (selectedGroup.isDocumentHidden || previewDocDetail?.isHidden) ? (
                  <span className="cmp-status-badge hidden" style={{ background: '#FEF3C7', color: '#B45309', borderColor: '#FDE68A', whiteSpace: 'nowrap' }}>
                    <LockIcon size={12} color="#B45309" /> Bị ẩn
                  </span>
                ) : (
                  <span className="cmp-status-badge visible" style={{ whiteSpace: 'nowrap' }}>
                    <EyeIcon size={12} color="currentColor" /> Hiển thị
                  </span>
                )}
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
              {/* Reports Box */}
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
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FlagIcon size={16} color="#E11D48" />
                    <span>Danh sách các lượt báo cáo vi phạm ({selectedGroup?.reportsList?.length || 0})</span>
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '135px', overflowY: 'auto', paddingRight: '6px' }}>
                  {selectedGroup?.reportsList?.map((r, idx) => (
                    <div
                      key={r.id || idx}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #FECDD3',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#64748B' }}>Người báo cáo:</span>
                          <strong style={{ color: '#0F172A' }}>{r.reporterName || 'N/A'}</strong>
                          <span className={`cmp-reason-tag ${r.reasonCode}`}>
                            {REASON_LABELS[r.reasonCode] || r.reasonCode || '—'}
                          </span>
                        </div>
                        <span style={{ color: '#94A3B8', fontSize: '12px' }}>{formatDateTime(r.createdAt)}</span>
                      </div>
                      {r.detail && (
                        <div style={{ color: '#334155', fontSize: '13px', marginTop: '2px' }}>
                          <span style={{ color: '#64748B' }}>Phản ánh: </span>
                          <strong>{r.detail}</strong>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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
                    {(previewDocDetail.isHidden || selectedGroup?.isDocumentHidden) && (
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
                    {(previewDocDetail.isDeleted || selectedGroup?.isDocumentDeleted) && (
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
                      documentId={selectedGroup?.documentId}
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

            {/* Modal Footer: Action buttons in detail modal */}
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
                className="cmp-btn cmp-btn-dismiss"
                onClick={handleClosePreview}
              >
                Đóng
              </button>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                {selectedGroup.isDocumentDeleted ? (
                  <span className="cmp-status-badge hidden" style={{ background: '#FEE2E2', color: '#DC2626', borderColor: '#FCA5A5' }}>
                    <TrashIcon size={12} color="#DC2626" /> Tài liệu đã bị xóa khỏi hệ thống
                  </span>
                ) : (
                  <>
                    {(selectedGroup.isDocumentHidden || previewDocDetail?.isHidden) ? (
                      <button
                        type="button"
                        className="cmp-btn cmp-btn-unhide"
                        onClick={() => handlePromptUnhide(selectedGroup)}
                      >
                        <UnlockIcon /> Mở ẩn tài liệu
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="cmp-btn cmp-btn-hide"
                        onClick={() => handlePromptHide(selectedGroup)}
                      >
                        <LockIcon /> Ẩn tài liệu
                      </button>
                    )}

                    {selectedGroup.reportsList?.some((r) => r.status === 'PENDING') && (
                      <button
                        type="button"
                        className="cmp-btn cmp-btn-dismiss"
                        onClick={() => handlePromptDismissGroup(selectedGroup)}
                      >
                        <DismissIcon /> Bỏ qua báo cáo
                      </button>
                    )}

                    <button
                      type="button"
                      className="cmp-btn cmp-btn-delete"
                      onClick={() => handlePromptDelete(selectedGroup)}
                    >
                      <TrashIcon /> Xóa tài liệu
                    </button>
                  </>
                )}
              </div>
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
                background:
                  reasonModal.actionType === 'DELETE'
                    ? '#FEF2F2'
                    : reasonModal.actionType === 'UNHIDE'
                    ? '#F0FDF4'
                    : reasonModal.actionType === 'DISMISS_GROUP'
                    ? '#F8FAFC'
                    : '#FFFBEB',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {reasonModal.actionType === 'DELETE' ? (
                  <TrashIcon size={18} />
                ) : reasonModal.actionType === 'UNHIDE' ? (
                  <UnlockIcon size={18} color="#16A34A" />
                ) : reasonModal.actionType === 'DISMISS_GROUP' ? (
                  <DismissIcon size={18} color="#64748B" />
                ) : (
                  <LockIcon size={18} color="#D97706" />
                )}
                <h3
                  style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: 700,
                    color:
                      reasonModal.actionType === 'DELETE'
                        ? '#B91C1C'
                        : reasonModal.actionType === 'UNHIDE'
                        ? '#16A34A'
                        : reasonModal.actionType === 'DISMISS_GROUP'
                        ? '#334155'
                        : '#B45309',
                  }}
                >
                  {reasonModal.actionType === 'DELETE'
                    ? 'Xác nhận xóa tài liệu vi phạm'
                    : reasonModal.actionType === 'UNHIDE'
                    ? 'Xác nhận mở ẩn tài liệu'
                    : reasonModal.actionType === 'DISMISS_GROUP'
                    ? 'Bỏ qua các báo cáo tài liệu'
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
                    Hành động này sẽ <strong>xóa vĩnh viễn tài liệu</strong> khỏi hệ thống và đánh dấu báo cáo là <strong>Đã xử lý</strong>.
                  </span>
                ) : reasonModal.actionType === 'UNHIDE' ? (
                  <span>
                    Hành động này sẽ <strong>mở ẩn tài liệu</strong>, cho phép hiển thị công khai trở lại và gửi thông báo tới tác giả.
                  </span>
                ) : reasonModal.actionType === 'DISMISS_GROUP' ? (
                  <span>
                    Hành động này sẽ <strong>bỏ qua các báo cáo</strong> đối với tài liệu này mà không thay đổi trạng thái hiển thị của tài liệu.
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

              {reasonModal.actionType !== 'DISMISS_GROUP' && (
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
                    Lý do xử lý <span style={{ color: '#DC2626' }}>*</span> (sẽ gửi thông báo đến tác giả):
                  </label>
                  <textarea
                    rows={4}
                    value={reasonModal.reason}
                    onChange={(e) => setReasonModal((prev) => ({ ...prev, reason: e.target.value }))}
                    placeholder={
                      reasonModal.actionType === 'DELETE'
                        ? 'Nhập lý do xóa tài liệu (VD: Tài liệu chứa nội dung độc hại / vi phạm bản quyền nghiêm trọng)...'
                        : reasonModal.actionType === 'UNHIDE'
                        ? 'Nhập lý do mở ẩn (VD: Tài liệu đã được tác giả chỉnh sửa khắc phục / sau khi kiểm duyệt lại thấy phù hợp)...'
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
              )}
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
                  background:
                    reasonModal.actionType === 'DELETE'
                      ? '#DC2626'
                      : reasonModal.actionType === 'UNHIDE'
                      ? '#16A34A'
                      : reasonModal.actionType === 'DISMISS_GROUP'
                      ? '#64748B'
                      : '#D97706',
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
                    <span>Xác nhận Xóa</span>
                  </>
                ) : reasonModal.actionType === 'UNHIDE' ? (
                  <>
                    <UnlockIcon size={14} />
                    <span>Xác nhận Mở ẩn</span>
                  </>
                ) : reasonModal.actionType === 'DISMISS_GROUP' ? (
                  <>
                    <DismissIcon size={14} />
                    <span>Xác nhận Bỏ qua</span>
                  </>
                ) : (
                  <>
                    <LockIcon size={14} />
                    <span>Xác nhận Ẩn</span>
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
