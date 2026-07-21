import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listWithdrawals, toErrorMessage } from "../../api/paymentModeratorWithdrawalApi";
import { useNotification } from "../../context/NotificationContext";
import "../../styles/paymentModerator/paymentModeratorWithdrawals.css";
import "../../styles/paymentModerator/paymentModeratorDashboard.css";

/* ============================================================
   Helpers
   ============================================================ */

const STATUS_LABELS = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  PAID: "Đã thanh toán",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã hủy",
};

function formatVnd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateText(value, max = 12) {
  if (!value || typeof value !== "string") return value || "—";
  if (value.length <= max) return value;
  return value.slice(0, max) + "…";
}

function StatusPill({ status }) {
  const key = (status || "").toLowerCase();
  return (
    <span className={`pmw-status-pill ${key}`}>
      <span className={`pmw-status-dot ${key}`}></span>
      {STATUS_LABELS[status] || status || "—"}
    </span>
  );
}

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
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [all, pending, approved, paid, rejected] = await Promise.all([
        listWithdrawals({ page: 0, size: 5 }),
        listWithdrawals({ page: 0, size: 1, status: "PENDING" }),
        listWithdrawals({ page: 0, size: 1, status: "APPROVED" }),
        listWithdrawals({ page: 0, size: 1, status: "PAID" }),
        listWithdrawals({ page: 0, size: 1, status: "REJECTED" }),
      ]);

      setCounts({
        ALL: all?.totalElements || 0,
        PENDING: pending?.totalElements || 0,
        APPROVED: approved?.totalElements || 0,
        PAID: paid?.totalElements || 0,
        REJECTED: rejected?.totalElements || 0,
      });

      setRecent(Array.isArray(all?.content) ? all.content : []);
    } catch (e) {
      const msg = toErrorMessage(e);
      setError(msg);
      notification.error(msg);
      setCounts({ ALL: 0, PENDING: 0, APPROVED: 0, PAID: 0, REJECTED: 0 });
      setRecent([]);
    } finally {
      setLoading(false);
    }
  }, [notification]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <div className="pm-dashboard">
      <header className="pm-dashboard-header">
        <div className="pm-dashboard-header-title">
          <h1>Bảng điều khiển thanh toán</h1>
          <p>Theo dõi và quản lý các yêu cầu rút tiền của Contributor</p>
        </div>
        <div className="pm-dashboard-header-actions">
          <button
            type="button"
            className="pm-btn-secondary"
            onClick={fetchAll}
            disabled={loading}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Làm mới
          </button>
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

      {/* Recent Withdrawals */}
      <section className="pm-recent-card">
        <div className="pm-recent-header">
          <h3>Yêu cầu rút tiền gần đây</h3>
          <Link to="/payment-moderator/withdrawals" className="pm-btn-view-all">
            Xem tất cả yêu cầu →
          </Link>
        </div>

        {loading ? (
          <div className="pm-recent-loading">
            <div className="spinner"></div>
            <p>Đang tải...</p>
          </div>
        ) : recent.length === 0 ? (
          <div className="pm-recent-empty">
            <p>Chưa có yêu cầu rút tiền nào.</p>
          </div>
        ) : (
          <table className="pmw-table pm-recent-table">
            <thead>
              <tr>
                <th>Mã yêu cầu</th>
                <th>Contributor</th>
                <th>Số tiền</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((w) => (
                <tr key={w.id}>
                  <td>
                    <span
                      className="pmw-request-code"
                      title={w.requestCode || ""}
                    >
                      {truncateText(w.requestCode, 12)}
                    </span>
                  </td>
                  <td>
                    <div className="pmw-contributor">
                      <span
                        className="pmw-contributor-name"
                        title={w.sellerFullName || ""}
                      >
                        {w.sellerFullName || "—"}
                      </span>
                      <span
                        className="pmw-contributor-email"
                        title={w.sellerEmail || ""}
                      >
                        {w.sellerEmail || "—"}
                      </span>
                    </div>
                  </td>
                  <td className="pmw-amount">{formatVnd(w.amount)}</td>
                  <td>
                    <StatusPill status={w.status} />
                  </td>
                  <td>{formatDateTime(w.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default PaymentModeratorDashboardPage;