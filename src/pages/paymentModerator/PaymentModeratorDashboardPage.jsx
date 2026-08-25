import React, { useCallback, useEffect, useState } from "react";
import { listWithdrawals, toErrorMessage } from "../../api/paymentModeratorWithdrawalApi";
import { useNotification } from "../../context/NotificationContext";
import "../../styles/paymentModerator/paymentModeratorDashboard.css";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [all, pending, approved, paid, rejected] = await Promise.all([
        listWithdrawals({ page: 0, size: 1 }),
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
    } catch (e) {
      const msg = toErrorMessage(e);
      setError(msg);
      notification.error(msg);
      setCounts({ ALL: 0, PENDING: 0, APPROVED: 0, PAID: 0, REJECTED: 0 });
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
    </div>
  );
};

export default PaymentModeratorDashboardPage;