import React, { useCallback, useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { getModerationStats } from "../../api/communityApi";
import { useNotification } from "../../context/NotificationContext";
import CustomChartTooltip from "../../components/admin/CustomChartTooltip";
import "../../styles/admin/adminDashboard.css";
import "../../styles/communityModerationPage.css";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const numberFormatter = new Intl.NumberFormat("vi-VN");

function formatCount(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  return numberFormatter.format(Math.round(x));
}

const CommunityModeratorDashboardPage = () => {
  const notification = useNotification();
  const [stats, setStats] = useState({
    pendingPostsCount: 0,
    pendingReportsCount: 0,
    escalatedPostsCount: 0,
    escalatedReportsCount: 0,
    resolvedPostsCount: 0,
    resolvedReportsCount: 0,
    dismissedPostsCount: 0,
    dismissedReportsCount: 0,
    hiddenPostsCount: 0,
  });
  const [filterMode, setFilterMode] = useState("POSTS");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getModerationStats();
      if (data) {
        setStats({
          pendingPostsCount: data.pendingPostsCount ?? 0,
          pendingReportsCount: data.pendingReportsCount ?? 0,
          escalatedPostsCount: data.escalatedPostsCount ?? 0,
          escalatedReportsCount: data.escalatedReportsCount ?? 0,
          resolvedPostsCount: data.resolvedPostsCount ?? 0,
          resolvedReportsCount: data.resolvedReportsCount ?? 0,
          dismissedPostsCount: data.dismissedPostsCount ?? 0,
          dismissedReportsCount: data.dismissedReportsCount ?? 0,
          hiddenPostsCount: data.hiddenPostsCount ?? 0,
        });
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Không thể tải số liệu thống kê kiểm duyệt.";
      setError(msg);
      notification.error(msg);
    } finally {
      setLoading(false);
    }
  }, [notification]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const chartData = useMemo(() => {
    let items = [];
    if (filterMode === "POSTS") {
      items = [
        { name: "Chờ xử lý", count: stats.pendingPostsCount, fill: "#F79009" },
        { name: "Chuyển Admin", count: stats.escalatedPostsCount, fill: "#7F56D9" },
        { name: "Đã giải quyết", count: stats.resolvedPostsCount, fill: "#12B76A" },
        { name: "Bị ẩn vi phạm", count: stats.hiddenPostsCount, fill: "#F04438" },
        { name: "Bỏ qua / Hợp lệ", count: stats.dismissedPostsCount, fill: "#667085" },
      ];
    } else {
      items = [
        { name: "Chờ xử lý", count: stats.pendingReportsCount, fill: "#F79009" },
        { name: "Chuyển Admin", count: stats.escalatedReportsCount, fill: "#7F56D9" },
        { name: "Đã giải quyết", count: stats.resolvedReportsCount, fill: "#12B76A" },
        { name: "Bỏ qua / Hợp lệ", count: stats.dismissedReportsCount, fill: "#667085" },
      ];
    }

    const total = items.reduce((sum, i) => sum + i.count, 0);
    return items.map((i) => ({
      ...i,
      percentage: total > 0 ? Math.round((i.count / total) * 100) : 0,
    }));
  }, [stats, filterMode]);

  return (
    <div className="cmp-container" style={{ paddingBottom: "40px" }}>
      {/* Header */}
      <header className="dashboard-header" style={{ marginBottom: "24px" }}>
        <div>
          <h1>Bảng điều khiển kiểm duyệt cộng đồng</h1>
          <p>Theo dõi tổng quan vi phạm, trạng thái xử lý bài viết và báo cáo từ người dùng</p>
        </div>
      </header>

      {error ? (
        <div className="admin-dashboard-error" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="admin-dashboard-loading">Đang tải dữ liệu kiểm duyệt cộng đồng…</div>
      ) : null}

      {!loading && !error && (
        <>
          {/* Notice Banner */}
          {stats.pendingPostsCount > 0 && (
            <div className="moderator-notice-banner">
              <div className="moderator-notice-left">
                <div className="moderator-notice-icon">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div className="moderator-notice-text">
                  <strong>
                    Có {formatCount(stats.pendingPostsCount)} bài viết bị báo cáo đang chờ xử lý
                  </strong>
                  <span>
                    Tổng cộng {formatCount(stats.pendingReportsCount)} lượt báo cáo vi phạm cần kiểm tra và giải quyết kịp thời.
                  </span>
                </div>
              </div>
              <Link to="/community-moderator/reports" className="moderator-notice-btn">
                Xử lý báo cáo ngay &rarr;
              </Link>
            </div>
          )}

          {/* Metric Summary Cards */}
          <section className="stats-grid stats-grid--4">
            <Link to="/community-moderator/reports" className="stats-card stats-card--link">
              <div className="stats-card-header">
                <div className="stats-icon icon-amber">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <span className="stats-trend stats-trend-placeholder" aria-hidden />
              </div>
              <p className="stats-label">Bài viết chờ xử lý</p>
              <h2 className="stats-value">{formatCount(stats.pendingPostsCount)}</h2>
            </Link>

            <Link to="/community-moderator/reports" className="stats-card stats-card--link">
              <div className="stats-card-header">
                <div className="stats-icon icon-red">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                </div>
                <span className="stats-trend stats-trend-placeholder" aria-hidden />
              </div>
              <p className="stats-label">Lượt báo cáo vi phạm</p>
              <h2 className="stats-value">{formatCount(stats.pendingReportsCount)}</h2>
            </Link>

            <Link to="/community-moderator/reports" className="stats-card stats-card--link">
              <div className="stats-card-header">
                <div className="stats-icon icon-purple">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 19V5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                </div>
                <span className="stats-trend stats-trend-placeholder" aria-hidden />
              </div>
              <p className="stats-label">Đã chuyển Admin</p>
              <h2 className="stats-value">{formatCount(stats.escalatedPostsCount)}</h2>
            </Link>

            <Link to="/community-moderator/reports" className="stats-card stats-card--link">
              <div className="stats-card-header">
                <div className="stats-icon icon-green">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <span className="stats-trend stats-trend-placeholder" aria-hidden />
              </div>
              <p className="stats-label">Bài viết đã giải quyết</p>
              <h2 className="stats-value">{formatCount(stats.resolvedPostsCount)}</h2>
            </Link>
          </section>

          {/* Biểu đồ cột phân bố vi phạm & kiểm duyệt */}
          <section className="chart-card">
            <div className="chart-header">
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <h3>Phân bố vi phạm & kiểm duyệt cộng đồng</h3>
                <Link to="/community-moderator/reports" className="btn-view-all">
                  Quản lý báo cáo &rarr;
                </Link>
              </div>
              <div className="chart-filter-pills">
                <button
                  type="button"
                  className={`chart-filter-btn ${filterMode === "POSTS" ? "active" : ""}`}
                  onClick={() => setFilterMode("POSTS")}
                >
                  Theo bài viết
                </button>
                <button
                  type="button"
                  className={`chart-filter-btn ${filterMode === "REPORTS" ? "active" : ""}`}
                  onClick={() => setFilterMode("REPORTS")}
                >
                  Theo lượt báo cáo
                </button>
              </div>
            </div>

            <div className="admin-recharts-wrap">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={chartData}
                  margin={{ top: 16, right: 24, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F2F4F7" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#98A2B3"
                    tick={{ fontSize: 13, fill: "#475467" }}
                  />
                  <YAxis
                    stroke="#98A2B3"
                    tick={{ fontSize: 12, fill: "#98A2B3" }}
                    allowDecimals={false}
                    width={36}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(16, 24, 40, 0.04)" }}
                    content={
                      <CustomChartTooltip
                        unit={filterMode === "POSTS" ? "bài viết" : "lượt báo cáo"}
                      />
                    }
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={64}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Quick Actions Section */}
          <section className="moderator-actions-section">
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#101828", marginBottom: "16px" }}>
              Khu vực thao tác nhanh
            </h3>
            <div className="moderator-actions-grid">
              <Link to="/community-moderator/reports" className="moderator-action-card">
                <div className="moderator-action-left">
                  <div className="stats-icon icon-amber">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <div className="moderator-action-info">
                    <h4>Quản lý báo cáo bài viết</h4>
                    <p>Xem danh sách, kiểm tra chi tiết nội dung và xử lý báo cáo vi phạm</p>
                  </div>
                </div>
                <span className="moderator-action-arrow">&rarr;</span>
              </Link>

              <Link to="/community" className="moderator-action-card">
                <div className="moderator-action-left">
                  <div className="stats-icon icon-sky">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <div className="moderator-action-info">
                    <h4>Bảng tin cộng đồng</h4>
                    <p>Khám phá không gian thảo luận thực tế của người dùng trên hệ thống</p>
                  </div>
                </div>
                <span className="moderator-action-arrow">&rarr;</span>
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default CommunityModeratorDashboardPage;
