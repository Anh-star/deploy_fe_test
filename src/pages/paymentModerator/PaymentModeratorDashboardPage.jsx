import React, { useCallback, useEffect, useState, useMemo } from "react";
import { listWithdrawals, toErrorMessage } from "../../api/paymentModeratorWithdrawalApi";
import { useNotification } from "../../context/NotificationContext";
import CustomChartTooltip from "../../components/admin/CustomChartTooltip";
import ChartDateRangeFilter from "../../components/admin/ChartDateRangeFilter";
import "../../styles/paymentModerator/paymentModeratorDashboard.css";
import "../../styles/admin/adminDashboard.css";
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

/* ============================================================
   Summary Cards Config
   ============================================================ */

const SUMMARY_CONFIG = [
  { key: "ALL", label: "Tổng yêu cầu", color: "blue" },
  { key: "PENDING", label: "Chờ duyệt", color: "amber" },
  { key: "APPROVED", label: "Đã duyệt", color: "sky" },
  { key: "PAID", label: "Đã thanh toán", color: "green" },
  { key: "REJECTED", label: "Đã từ chối", color: "red" },
];

/* ============================================================
   Page
   ============================================================ */

const PaymentModeratorDashboardPage = () => {
  const notification = useNotification();
  const [counts, setCounts] = useState({
    ALL: 0,
    PENDING: 0,
    APPROVED: 0,
    PAID: 0,
    REJECTED: 0,
  });
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [preset, setPreset] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dateParams = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };
      const [all, pending, approved, paid, rejected] = await Promise.all([
        listWithdrawals({ page: 0, size: 1, ...dateParams }),
        listWithdrawals({ page: 0, size: 1, status: "PENDING", ...dateParams }),
        listWithdrawals({ page: 0, size: 1, status: "APPROVED", ...dateParams }),
        listWithdrawals({ page: 0, size: 1, status: "PAID", ...dateParams }),
        listWithdrawals({ page: 0, size: 1, status: "REJECTED", ...dateParams }),
      ]);

      setCounts({
        ALL: all?.totalElements || 0,
        PENDING: pending?.totalElements || 0,
        APPROVED: approved?.totalElements || 0,
        PAID: paid?.totalElements || 0,
        REJECTED: rejected?.totalElements || 0,
      });
    } catch (e) {
      const msg = toErrorMessage(e);
      setError(msg);
      notification.error(msg);
      setCounts({ ALL: 0, PENDING: 0, APPROVED: 0, PAID: 0, REJECTED: 0 });
    } finally {
      setLoading(false);
    }
  }, [notification, startDate, endDate]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const chartData = useMemo(() => {
    const allItems = [
      { name: "Chờ duyệt", count: counts.PENDING ?? 0, fill: "#F79009", group: "PENDING_GROUP" },
      { name: "Đã duyệt", count: counts.APPROVED ?? 0, fill: "#0086C9", group: "PENDING_GROUP" },
      { name: "Đã thanh toán", count: counts.PAID ?? 0, fill: "#12B76A", group: "DONE_GROUP" },
      { name: "Đã từ chối", count: counts.REJECTED ?? 0, fill: "#F04438", group: "DONE_GROUP" },
    ];

    let items = allItems;
    if (scopeFilter === "PENDING_GROUP") {
      items = allItems.filter((i) => i.group === "PENDING_GROUP");
    } else if (scopeFilter === "DONE_GROUP") {
      items = allItems.filter((i) => i.group === "DONE_GROUP");
    }

    const total = items.reduce((acc, cur) => acc + cur.count, 0);
    return items.map((i) => ({
      ...i,
      percentage: total > 0 ? Math.round((i.count / total) * 100) : 0,
    }));
  }, [counts, scopeFilter]);

  return (
    <div className="pm-dashboard">
      <header className="pm-dashboard-header">
        <div className="pm-dashboard-header-title">
          <h1>Bảng điều khiển thanh toán</h1>
          <p>Theo dõi và quản lý các yêu cầu rút tiền của Contributor</p>
        </div>
      </header>

      {error ? (
        <div className="pm-dashboard-error" role="alert">
          {error}
        </div>
      ) : null}

      {/* Summary Cards */}
      <section className="pm-summary-grid">
        {SUMMARY_CONFIG.map((cfg) => (
          <article key={cfg.key} className={`pm-summary-card color-${cfg.color}`}>
            <div className={`pm-summary-icon icon-${cfg.color}`}>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="10" x2="21" y2="10"></line>
                <path d="M9 16l2 2 4-4"></path>
              </svg>
            </div>
            <p className="pm-summary-label">{cfg.label}</p>
            <h2 className="pm-summary-value">
              {loading ? "—" : (counts[cfg.key] ?? 0).toLocaleString("vi-VN")}
            </h2>
          </article>
        ))}
      </section>

      {/* Biểu đồ cột phân bố yêu cầu rút tiền */}
      <section className="chart-card" style={{ marginTop: "8px" }}>
        <div className="chart-header">
          <h3>Phân bố trạng thái yêu cầu rút tiền</h3>
          <div className="chart-header-controls">
            <div className="chart-filter-pills">
              <button
                type="button"
                className={`chart-filter-btn ${scopeFilter === "ALL" ? "active" : ""}`}
                onClick={() => setScopeFilter("ALL")}
              >
                Tất cả
              </button>
              <button
                type="button"
                className={`chart-filter-btn ${scopeFilter === "PENDING_GROUP" ? "active" : ""}`}
                onClick={() => setScopeFilter("PENDING_GROUP")}
              >
                Cần xử lý
              </button>
              <button
                type="button"
                className={`chart-filter-btn ${scopeFilter === "DONE_GROUP" ? "active" : ""}`}
                onClick={() => setScopeFilter("DONE_GROUP")}
              >
                Đã kết thúc
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
                content={<CustomChartTooltip unit="yêu cầu" />}
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
    </div>
  );
};

export default PaymentModeratorDashboardPage;