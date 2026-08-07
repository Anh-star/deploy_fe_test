import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import JustChatWidget from '../../components/common/JustChatWidget';
import { useAuth } from '../../context/AuthContext';
import '../../styles/admin/adminDashboard.css';
import { getAdminDashboard } from '../../api/adminDashboardApi';
import { getPendingDocuments } from '../../api/adminDocumentApi';
import { getApiErrorMessage } from '../../api/userApi';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

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
 *
 * <p>The dashboard endpoint is gated by {@code ROLE_ADMIN}; users with
 * the {@code ROLE_CONTENT_MODERATOR} authority must NOT call it because
 * the backend would return 403 (Forbidden) and the page would render
 * blank. Instead Content Moderators see a moderation-focused
 * overview built from endpoints they can legitimately access.</p>
 */
function isSystemAdmin(roles) {
  if (!Array.isArray(roles)) return false;
  return roles.includes('ROLE_ADMIN') || roles.includes('ADMIN');
}

/**
 * Render the moderation overview for Content Moderators. We list
 * three shortcuts (pending documents, contributor requests, direct
 * link to the pending list) and never call the System Admin API.
 */
function ModeratorDashboard() {
  const [pendingCount, setPendingCount] = useState(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [countError, setCountError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingCount(true);
    setCountError(null);
    // Use the smallest available page size so we only trip the
    // count endpoint without dragging the whole document list back.
    getPendingDocuments(0, 1)
      .then((data) => {
        if (!cancelled) setPendingCount(data.total ?? 0);
      })
      .catch((err) => {
        if (!cancelled) setCountError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoadingCount(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="admin-main">
      <JustChatWidget />
      <header className="dashboard-header">
        <div className="header-title">
          <h1>Tổng quan kiểm duyệt</h1>
          <p>Chào mừng quay trở lại, kiểm duyệt viên.</p>
        </div>
      </header>

      <section className="stats-grid">
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
          <p className="stats-label">Tài liệu đang chờ duyệt</p>
          <h2 className="stats-value">
            {loadingCount ? 'Đang tải…' : countError ? '—' : formatCount(pendingCount)}
          </h2>
        </div>

        <Link to="/admin/contributor-requests" className="stats-card stats-card--link">
          <div className="stats-card-header">
            <div className="stats-icon icon-indigo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="18" r="3"></circle>
                <circle cx="6" cy="6" r="3"></circle>
                <path d="M13 6h3a2 2 0 0 1 2 2v7"></path>
                <line x1="6" x2="6" y1="9" y2="21"></line>
              </svg>
            </div>
            <span className="stats-trend stats-trend-placeholder" aria-hidden />
          </div>
          <p className="stats-label">Yêu cầu đóng góp</p>
          <h2 className="stats-value">Mở</h2>
        </Link>

        <Link to="/admin/documents/pending" className="stats-card stats-card--link">
          <div className="stats-card-header">
            <div className="stats-icon icon-blue">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
            </div>
            <span className="stats-trend stats-trend-placeholder" aria-hidden />
          </div>
          <p className="stats-label">Đi đến danh sách chờ duyệt</p>
          <h2 className="stats-value">Mở</h2>
        </Link>
      </section>
    </main>
  );
}

const AdminDashboard = () => {
  const { user } = useAuth();
  const roles = Array.isArray(user?.roles) ? user.roles : [];

  // Role-aware dispatch: Content Moderators get their own dashboard
  // so they never trigger the System Admin 403 path.
  if (!isSystemAdmin(roles)) {
    return <ModeratorDashboard />;
  }

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
      <JustChatWidget />
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
};

export default AdminDashboard;