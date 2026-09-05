import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../styles/admin/adminDashboard.css';
import '../../styles/admin/adminComponents.css';
import '../../styles/admin/contributorRequests.css';
import { getAdminDashboard } from '../../api/adminDashboardApi';
import { getPendingDocuments } from '../../api/adminDocumentApi';
import { getApiErrorMessage } from '../../api/userApi';
import axiosClient from '../../api/axiosClient';
import { documentService } from '../../services/api';
import { formatDate } from '../../utils/dateUtils';
import { ContributorStatusLabel } from '../../constants/contributorStatus';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import CustomChartTooltip from '../../components/admin/CustomChartTooltip';
import ChartDateRangeFilter from '../../components/admin/ChartDateRangeFilter';

const numberFormatter = new Intl.NumberFormat('vi-VN');

const VI_WEEKDAY = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

function formatCount(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '0';
  return numberFormatter.format(Math.round(x));
}

function viWeekdayFromIso(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return '';
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return VI_WEEKDAY[d.getDay()];
}

function formatTableDate(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return '—';
  const p = isoDate.split('-');
  if (p.length !== 3) return isoDate;
  const [y, m, day] = p;
  return `${day}/${m}/${y}`;
}

/**
 * Detect whether the current user can consume the System Admin dashboard.
 */
function isSystemAdmin(roles) {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => {
    const u = String(r).toUpperCase();
    return u === 'ROLE_ADMIN' || u === 'ADMIN';
  });
}

function isUserModerator(roles) {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => {
    const u = String(r).toUpperCase();
    return u === 'ROLE_USER_MODERATOR' || u === 'USER_MODERATOR';
  });
}

function isContentModerator(roles) {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => {
    const u = String(r).toUpperCase();
    return u === 'ROLE_CONTENT_MODERATOR' || u === 'CONTENT_MODERATOR';
  });
}

function getContributorStatusClass(statusKey) {
  const s = String(statusKey || '').toUpperCase();
  switch (s) {
    case 'PENDING':
    case 'NEED_INFO':
      return 'dot-pending';
    case 'APPROVED':
      return 'dot-approved';
    case 'REJECTED':
      return 'dot-rejected';
    default:
      return 'dot-pending';
  }
}

function getContributorStatusTextClass(statusKey) {
  const s = String(statusKey || '').toUpperCase();
  switch (s) {
    case 'PENDING':
    case 'NEED_INFO':
      return 'status-text-pending';
    case 'APPROVED':
      return 'status-text-approved';
    case 'REJECTED':
      return 'status-text-rejected';
    default:
      return 'status-text-pending';
  }
}

function getContributorStatusLabel(statusKey) {
  const s = String(statusKey || '').toUpperCase();
  switch (s) {
    case 'NEED_INFO':
      return 'Chờ bổ sung';
    case 'PENDING':
      return 'Chờ duyệt';
    case 'APPROVED':
      return 'Đã duyệt';
    case 'REJECTED':
      return 'Đã từ chối';
    default:
      return ContributorStatusLabel[s] || s || 'Chưa rõ';
  }
}

/**
 * Dedicated Dashboard View for User Moderator.
 * Focuses purely on Contributor Requests:
 * - Metrics: Pending / Need Info, Approved, Rejected, Total requests
 * - Quick notice banner for pending requests
 * - BarChart showing distribution of contributor request statuses
 */
function UserModeratorDashboardView() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    axiosClient
      .get('/admin/contributor-requests')
      .then((res) => {
        if (cancelled) return;
        const data = Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data)
          ? res.data
          : [];
        setRequests(data);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const { pendingCount, approvedCount, rejectedCount, totalCount } = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const r of requests) {
      const s = String(r.status || '').toUpperCase();
      if (s === 'PENDING' || s === 'NEED_INFO') pending++;
      else if (s === 'APPROVED') approved++;
      else if (s === 'REJECTED') rejected++;
    }
    return {
      pendingCount: pending,
      approvedCount: approved,
      rejectedCount: rejected,
      totalCount: requests.length,
    };
  }, [requests]);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [preset, setPreset] = useState('ALL');

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (!r.createdAt) return true;
      const itemTime = new Date(r.createdAt).getTime();
      if (isNaN(itemTime)) return true;

      if (startDate) {
        const start = new Date(`${startDate}T00:00:00`).getTime();
        if (itemTime < start) return false;
      }
      if (endDate) {
        const end = new Date(`${endDate}T23:59:59`).getTime();
        if (itemTime > end) return false;
      }
      return true;
    });
  }, [requests, startDate, endDate]);

  const statusChartData = useMemo(() => {
    let pending = 0;
    let needInfo = 0;
    let approved = 0;
    let rejected = 0;
    for (const r of filteredRequests) {
      const s = String(r.status || '').toUpperCase();
      if (s === 'PENDING') pending++;
      else if (s === 'NEED_INFO') needInfo++;
      else if (s === 'APPROVED') approved++;
      else if (s === 'REJECTED') rejected++;
    }
    const total = pending + needInfo + approved + rejected;
    const items = [
      { name: 'Chờ duyệt', count: pending, fill: '#F79009' },
      { name: 'Chờ bổ sung', count: needInfo, fill: '#EAAA08' },
      { name: 'Đã phê duyệt', count: approved, fill: '#12B76A' },
      { name: 'Đã từ chối', count: rejected, fill: '#F04438' },
    ];
    return items.map((i) => ({
      ...i,
      percentage: total > 0 ? Math.round((i.count / total) * 100) : 0,
    }));
  }, [filteredRequests]);

  return (
    <>
      {error ? (
        <div className="admin-dashboard-error" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="admin-dashboard-loading">Đang tải dữ liệu kiểm duyệt người dùng…</div>
      ) : null}

      {!loading && !error && (
        <>
          {pendingCount > 0 && (
            <div className="moderator-notice-banner">
              <div className="moderator-notice-left">
                <div className="moderator-notice-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="moderator-notice-text">
                  <strong>Có {formatCount(pendingCount)} yêu cầu trở thành Contributor đang chờ xử lý</strong>
                  <span>Vui lòng kiểm tra hồ sơ năng lực, bằng cấp/chứng chỉ và tiến hành xét duyệt.</span>
                </div>
              </div>
              <Link to="/admin/contributor-requests" className="moderator-notice-btn">
                Xử lý ngay &rarr;
              </Link>
            </div>
          )}

          <section className="stats-grid stats-grid--4">
            <Link to="/admin/contributor-requests" className="stats-card stats-card--link">
              <div className="stats-card-header">
                <div className="stats-icon icon-amber">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <span className="stats-trend stats-trend-placeholder" aria-hidden />
              </div>
              <p className="stats-label">Hồ sơ chờ xử lý</p>
              <h2 className="stats-value">{formatCount(pendingCount)}</h2>
            </Link>

            <Link to="/admin/contributor-requests" className="stats-card stats-card--link">
              <div className="stats-card-header">
                <div className="stats-icon icon-green">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <span className="stats-trend stats-trend-placeholder" aria-hidden />
              </div>
              <p className="stats-label">Hồ sơ đã duyệt</p>
              <h2 className="stats-value">{formatCount(approvedCount)}</h2>
            </Link>

            <Link to="/admin/contributor-requests" className="stats-card stats-card--link">
              <div className="stats-card-header">
                <div className="stats-icon icon-red">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <span className="stats-trend stats-trend-placeholder" aria-hidden />
              </div>
              <p className="stats-label">Hồ sơ đã từ chối</p>
              <h2 className="stats-value">{formatCount(rejectedCount)}</h2>
            </Link>

            <Link to="/admin/contributor-requests" className="stats-card stats-card--link">
              <div className="stats-card-header">
                <div className="stats-icon icon-indigo">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <span className="stats-trend stats-trend-placeholder" aria-hidden />
              </div>
              <p className="stats-label">Tổng số yêu cầu</p>
              <h2 className="stats-value">{formatCount(totalCount)}</h2>
            </Link>
          </section>

          <section className="chart-card">
            <div className="chart-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h3>Thống kê yêu cầu đóng góp</h3>
                <Link to="/admin/contributor-requests" className="btn-view-all">
                  Quản lý hồ sơ &rarr;
                </Link>
              </div>
              <ChartDateRangeFilter
                startDate={startDate}
                endDate={endDate}
                preset={preset}
                onDateChange={(s, e, p) => {
                  setStartDate(s);
                  setEndDate(e);
                  setPreset(p);
                }}
              />
            </div>

            {filteredRequests.length === 0 ? (
              <div className="admin-chart-empty">Chưa có dữ liệu yêu cầu đóng góp trong khoảng thời gian này.</div>
            ) : (
              <div className="admin-recharts-wrap">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={statusChartData}
                    margin={{ top: 16, right: 24, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F2F4F7" vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="#98A2B3"
                      tick={{ fontSize: 13, fill: '#475467' }}
                    />
                    <YAxis
                      stroke="#98A2B3"
                      tick={{ fontSize: 12, fill: '#98A2B3' }}
                      allowDecimals={false}
                      width={36}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(16, 24, 40, 0.04)' }}
                      content={<CustomChartTooltip unit="hồ sơ" />}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={64}>
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

/**
 * Dedicated Dashboard View for Content Moderator.
 * Focuses purely on Content Moderation:
 * - Pending documents count
 * - Reported documents count
 * - Categories & Tags shortcuts
 * - BarChart for content & report moderation distribution
 */
function ContentModeratorDashboardView() {
  const [docCounts, setDocCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [reportCounts, setReportCounts] = useState({ pending: 0, resolved: 0, dismissed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [scopeFilter, setScopeFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [preset, setPreset] = useState('ALL');

  const fetchContentData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pendingDocsRes, approvedDocsRes, rejectedDocsRes, pendingReportsRes, resolvedReportsRes] =
        await Promise.allSettled([
          getPendingDocuments(0, 1, 'PENDING', '', startDate || undefined, endDate || undefined),
          getPendingDocuments(0, 1, 'APPROVED', '', startDate || undefined, endDate || undefined),
          getPendingDocuments(0, 1, 'REJECTED', '', startDate || undefined, endDate || undefined),
          documentService.getReportedDocuments('PENDING', 0, 1, '', startDate || undefined, endDate || undefined),
          documentService.getReportedDocuments('RESOLVED', 0, 1, '', startDate || undefined, endDate || undefined),
        ]);

      setDocCounts({
        pending: pendingDocsRes.status === 'fulfilled' ? (pendingDocsRes.value?.total ?? 0) : 0,
        approved: approvedDocsRes.status === 'fulfilled' ? (approvedDocsRes.value?.total ?? 0) : 0,
        rejected: rejectedDocsRes.status === 'fulfilled' ? (rejectedDocsRes.value?.total ?? 0) : 0,
      });

      setReportCounts({
        pending: pendingReportsRes.status === 'fulfilled' ? (pendingReportsRes.value?.totalElements ?? 0) : 0,
        resolved: resolvedReportsRes.status === 'fulfilled' ? (resolvedReportsRes.value?.totalElements ?? 0) : 0,
      });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchContentData();
  }, [fetchContentData]);

  const contentChartData = useMemo(() => {
    const docItems = [
      { name: 'Tài liệu chờ duyệt', count: docCounts.pending, fill: '#0086C9' },
      { name: 'Tài liệu đã duyệt', count: docCounts.approved, fill: '#12B76A' },
      { name: 'Tài liệu từ chối', count: docCounts.rejected, fill: '#F04438' },
    ];
    const reportItems = [
      { name: 'Báo cáo chờ xử lý', count: reportCounts.pending, fill: '#F79009' },
      { name: 'Báo cáo đã xử lý', count: reportCounts.resolved, fill: '#7F56D9' },
    ];

    let activeItems = [];
    if (scopeFilter === 'DOCS') {
      activeItems = docItems;
    } else if (scopeFilter === 'REPORTS') {
      activeItems = reportItems;
    } else {
      activeItems = [...docItems, ...reportItems];
    }

    const total = activeItems.reduce((acc, cur) => acc + cur.count, 0);
    return activeItems.map((item) => ({
      ...item,
      percentage: total > 0 ? Math.round((item.count / total) * 100) : 0,
    }));
  }, [docCounts, reportCounts, scopeFilter]);

  return (
    <>
      {error ? (
        <div className="admin-dashboard-error" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="admin-dashboard-loading">Đang tải dữ liệu kiểm duyệt nội dung…</div>
      ) : null}

      {!loading && !error && (
        <>
          <section className="stats-grid">
            <Link to="/admin/documents/pending" className="stats-card stats-card--link">
              <div className="stats-card-header">
                <div className="stats-icon icon-sky">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <span className="stats-trend stats-trend-placeholder" aria-hidden />
              </div>
              <p className="stats-label">Tài liệu chờ duyệt</p>
              <h2 className="stats-value">{formatCount(docCounts.pending)}</h2>
            </Link>

            <Link to="/admin/reports" className="stats-card stats-card--link">
              <div className="stats-card-header">
                <div className="stats-icon icon-red">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <span className="stats-trend stats-trend-placeholder" aria-hidden />
              </div>
              <p className="stats-label">Báo cáo vi phạm chờ xử lý</p>
              <h2 className="stats-value">{formatCount(reportCounts.pending)}</h2>
            </Link>

            <Link to="/admin/categories" className="stats-card stats-card--link">
              <div className="stats-card-header">
                <div className="stats-icon icon-purple">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                </div>
                <span className="stats-trend stats-trend-placeholder" aria-hidden />
              </div>
              <p className="stats-label">Danh mục & Thẻ</p>
              <h2 className="stats-value">Quản lý</h2>
            </Link>
          </section>

          <section className="chart-card">
            <div className="chart-header">
              <h3>Thống kê kiểm duyệt nội dung & báo cáo</h3>
              <div className="chart-header-controls">
                <div className="chart-filter-pills">
                  <button
                    type="button"
                    className={`chart-filter-btn ${scopeFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setScopeFilter('ALL')}
                  >
                    Tất cả
                  </button>
                  <button
                    type="button"
                    className={`chart-filter-btn ${scopeFilter === 'DOCS' ? 'active' : ''}`}
                    onClick={() => setScopeFilter('DOCS')}
                  >
                    Tài liệu
                  </button>
                  <button
                    type="button"
                    className={`chart-filter-btn ${scopeFilter === 'REPORTS' ? 'active' : ''}`}
                    onClick={() => setScopeFilter('REPORTS')}
                  >
                    Báo cáo vi phạm
                  </button>
                </div>
                <ChartDateRangeFilter
                  startDate={startDate}
                  endDate={endDate}
                  preset={preset}
                  onDateChange={(s, e, p) => {
                    setStartDate(s);
                    setEndDate(e);
                    setPreset(p);
                  }}
                />
              </div>
            </div>
            <div className="admin-recharts-wrap">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={contentChartData}
                  margin={{ top: 16, right: 24, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F2F4F7" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#98A2B3"
                    tick={{ fontSize: 13, fill: '#475467' }}
                  />
                  <YAxis
                    stroke="#98A2B3"
                    tick={{ fontSize: 12, fill: '#98A2B3' }}
                    allowDecimals={false}
                    width={36}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(16, 24, 40, 0.04)' }}
                    content={<CustomChartTooltip unit="mục" />}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={64}>
                    {contentChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </>
  );
}

/**
 * Dispatcher container for moderators.
 * If user holds both User Moderator & Content Moderator roles,
 * provides tabs to smoothly switch between views.
 */
function ModeratorDashboard({ isUserMod, isContentMod }) {
  const [activeTab, setActiveTab] = useState(isUserMod ? 'user' : 'content');
  const hasBoth = isUserMod && isContentMod;

  const getHeaderTitle = () => {
    if (hasBoth) return 'Tổng quan kiểm duyệt';
    if (isUserMod) return 'Tổng quan kiểm duyệt người dùng';
    return 'Tổng quan kiểm duyệt nội dung';
  };

  const getHeaderSubtitle = () => {
    if (hasBoth) return 'Chào mừng quay trở lại, kiểm duyệt viên hệ thống.';
    if (isUserMod) return 'Chào mừng quay trở lại, kiểm duyệt viên người dùng.';
    return 'Chào mừng quay trở lại, kiểm duyệt viên nội dung.';
  };

  return (
    <main className="admin-main">
      <header className="dashboard-header">
        <div className="header-title">
          <h1>{getHeaderTitle()}</h1>
          <p>{getHeaderSubtitle()}</p>
        </div>
      </header>

      {hasBoth && (
        <div className="admin-tabs-wrapper" style={{ marginBottom: '24px' }}>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'user' ? 'active' : ''}`}
            onClick={() => setActiveTab('user')}
          >
            <span>Kiểm duyệt người dùng</span>
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'content' ? 'active' : ''}`}
            onClick={() => setActiveTab('content')}
          >
            <span>Kiểm duyệt nội dung</span>
          </button>
        </div>
      )}

      {activeTab === 'user' ? (
        <UserModeratorDashboardView />
      ) : (
        <ContentModeratorDashboardView />
      )}
    </main>
  );
}

function SystemAdminDashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAdminDashboard()
      .then((data) => {
        if (!cancelled) setDashboardData(data);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const chartRows = useMemo(() => {
    const raw = dashboardData?.activeUsersByDay;
    if (!Array.isArray(raw)) return [];
    return raw.map((row) => ({
      date: row.date,
      count: Number(row.count) || 0,
    }));
  }, [dashboardData]);

  const latestUsers = useMemo(() => {
    const raw = dashboardData?.latestUsers;
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, 5);
  }, [dashboardData]);

  return (
    <main className="admin-main">
      <header className="dashboard-header">
        <div className="header-title">
          <h1>Tổng quan Dashboard</h1>
          <p>Chào mừng quay trở lại, quản trị viên.</p>
        </div>
      </header>

      {error ? (
        <div className="admin-dashboard-error" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="admin-dashboard-loading">Đang tải…</div>
      ) : null}

      {!loading && !error ? (
        <>
          <section className="stats-grid">
            <div className="stats-card">
              <div className="stats-card-header">
                <div className="stats-icon icon-blue">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <line x1="19" y1="8" x2="19" y2="14"></line>
                    <line x1="22" y1="11" x2="16" y2="11"></line>
                  </svg>
                </div>
                <span className="stats-trend stats-trend-placeholder" aria-hidden />
              </div>
              <p className="stats-label">Tổng người dùng</p>
              <h2 className="stats-value">{formatCount(dashboardData?.totalUsers)}</h2>
            </div>

            <div className="stats-card">
              <div className="stats-card-header">
                <div className="stats-icon icon-indigo">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                </div>
                <span className="stats-trend stats-trend-placeholder" aria-hidden />
              </div>
              <p className="stats-label">Tổng tài liệu</p>
              <h2 className="stats-value">{formatCount(dashboardData?.totalDocuments)}</h2>
            </div>

            <div className="stats-card">
              <div className="stats-card-header">
                <div className="stats-icon icon-sky">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                    <path d="M9 16l2 2 4-4"></path>
                  </svg>
                </div>
                <span className="stats-trend stats-trend-placeholder" aria-hidden />
              </div>
              <p className="stats-label">Yêu cầu chờ duyệt</p>
              <h2 className="stats-value">{formatCount(dashboardData?.pendingRequests)}</h2>
            </div>
          </section>

          <section className="chart-card">
            <div className="chart-header">
              <h3>Hoạt động hệ thống</h3>
            </div>
            {chartRows.length === 0 ? (
              <div className="admin-chart-empty">Chưa có dữ liệu hoạt động theo ngày.</div>
            ) : (
              <div className="admin-recharts-wrap">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={chartRows}
                    margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F2F4F7" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={viWeekdayFromIso}
                      tick={{ fontSize: 12, fill: '#98A2B3' }}
                      stroke="#E4E7F1"
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#98A2B3' }}
                      stroke="#E4E7F1"
                      width={44}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid #E4E7F1',
                        fontSize: 13,
                      }}
                      labelFormatter={(label) =>
                        typeof label === 'string' ? viWeekdayFromIso(label) : label
                      }
                      formatter={(value) => [formatCount(value), 'User hoạt động']}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#007AFF"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#007AFF' }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="table-card">
            <div className="table-header">
              <h3>Người dùng mới tham gia</h3>
              <Link to="/admin/users" className="btn-view-all">Xem tất cả</Link>
            </div>

            <table className="admin-table new-users-table">
              <thead>
                <tr>
                  <th>TÊN NGƯỜI DÙNG</th>
                  <th>NGÀY</th>
                </tr>
              </thead>
              <tbody>
                {latestUsers.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="admin-table-empty-cell">
                      Chưa có người dùng.
                    </td>
                  </tr>
                ) : (
                  latestUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="user-name-cell">{u.name ?? '—'}</td>
                      <td className="date-cell">{formatTableDate(u.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </main>
  );
}

const AdminDashboard = () => {
  const { user } = useAuth();
  const roles = Array.isArray(user?.roles) ? user.roles : [];

  const isSysAdmin = isSystemAdmin(roles);
  const isUserMod = isUserModerator(roles);
  const isContentMod = isContentModerator(roles);

  if (!isSysAdmin) {
    return <ModeratorDashboard isUserMod={isUserMod} isContentMod={isContentMod} />;
  }

  return <SystemAdminDashboard />;
};

export default AdminDashboard;