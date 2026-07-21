import React, { useCallback, useEffect, useState } from "react";
import AdminPagination from "../../components/admin/AdminPagination";
import { EyeIcon } from "../../components/icons";
import {
  listWithdrawals,
  getWithdrawal,
  approveWithdrawal,
  rejectWithdrawal,
  markPaidWithdrawal,
  toErrorMessage,
} from "../../api/paymentModeratorWithdrawalApi";
import { useNotification } from "../../context/NotificationContext";
import "../../styles/admin/contributorRequests.css";
import "../../styles/admin/contributorDetailModal.css";
import "../../styles/paymentModerator/paymentModeratorWithdrawals.css";

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

function formatTimeOnly(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function truncateText(value, max = 12) {
  if (!value || typeof value !== "string") return value || "—";
  if (value.length <= max) return value;
  return value.slice(0, max) + "…";
}

function truncateBankName(value, max = 18) {
  if (!value || typeof value !== "string") return value || "—";
  if (value.length <= max) return value;
  return value.slice(0, max) + "…";
}

function truncateUuid(value, max = 8) {
  if (!value || typeof value !== "string") return null;
  if (value.length <= max) return value;
  return value.slice(0, max) + "…";
}

function getStatusClass(status) {
  switch (status) {
    case "PENDING": return "pmw-status-pill pending";
    case "APPROVED": return "pmw-status-pill approved";
    case "PAID": return "pmw-status-pill paid";
    case "REJECTED": return "pmw-status-pill rejected";
    case "CANCELLED": return "pmw-status-pill cancelled";
    default: return "pmw-status-pill";
  }
}

function StatusPill({ status }) {
  return (
    <span className={getStatusClass(status)}>
      <span className={`pmw-status-dot ${(status || "").toLowerCase()}`}></span>
      {STATUS_LABELS[status] || status || "—"}
    </span>
  );
}

function BankCell({ withdrawal }) {
  const code = withdrawal.bankCode;
  const name = withdrawal.bankName;
  if (code) {
    return (
      <div className="pmw-bank-info" title={name || code}>
        <span className="pmw-bank-code">{code}</span>
        {name && name !== code ? (
          <span className="pmw-bank-name-soft">{truncateBankName(name, 18)}</span>
        ) : null}
      </div>
    );
  }
  return (
    <span title={name || ""}>{truncateBankName(name, 18)}</span>
  );
}

/* ============================================================
   Mini Modals: Approve / Reject / MarkPaid
   ============================================================ */

function ApproveMiniModal({ withdrawal, onConfirm, onCancel, submitting }) {
  const [note, setNote] = useState("");
  return (
    <div className="mini-modal-overlay">
      <div className="mini-modal theme-approve">
        <div className="mini-modal-icon theme-approve-icon">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h3>Xác nhận phê duyệt</h3>
        <p className="mini-modal-amount">{formatVnd(withdrawal.amount)}</p>
        <p className="mini-modal-meta">
          Mã: <strong title={withdrawal.requestCode || ""}>
            {truncateText(withdrawal.requestCode, 14)}
          </strong>
        </p>
        <textarea
          className="reject-textarea"
          placeholder="Ghi chú phê duyệt (không bắt buộc)"
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="modal-footer">
          <button
            type="button"
            className="btn-cancel"
            onClick={onCancel}
            disabled={submitting}
          >
            Hủy
          </button>
          <button
            type="button"
            className="btn-confirm-approve"
            onClick={() => onConfirm(note)}
            disabled={submitting}
          >
            {submitting ? "Đang xử lý..." : "Phê duyệt"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectMiniModal({ withdrawal, onConfirm, onCancel, submitting }) {
  const [note, setNote] = useState("");
  const trimmed = note.trim();
  const invalid = !trimmed;
  return (
    <div className="mini-modal-overlay">
      <div className="mini-modal theme-reject">
        <div className="mini-modal-icon theme-reject-icon">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h3>Từ chối yêu cầu</h3>
        <p className="pmw-reject-warning">
          Tiền đang khóa sẽ được hoàn lại vào số dư khả dụng của Contributor.
        </p>
        <textarea
          className="reject-textarea"
          placeholder="Nhập lý do từ chối"
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="pmw-char-counter">
          {note.length} / 1000
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="btn-cancel"
            onClick={onCancel}
            disabled={submitting}
          >
            Hủy
          </button>
          <button
            type="button"
            className="pmw-btn-reject"
            onClick={() => onConfirm(trimmed)}
            disabled={submitting || invalid}
          >
            {submitting ? "Đang xử lý..." : "Từ chối"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MarkPaidMiniModal({ withdrawal, onConfirm, onCancel, submitting }) {
  const [note, setNote] = useState("");
  const trimmed = note.trim();
  const invalid = !trimmed;
  const fullAccount = withdrawal.bankAccountNumber || "";
  const masked = fullAccount
    ? `****${fullAccount.slice(-4)}`
    : withdrawal.maskedBankAccountNumber || "—";
  return (
    <div className="mini-modal-overlay">
      <div className="mini-modal theme-paid">
        <div className="mini-modal-icon theme-paid-icon">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
        <h3>Xác nhận thanh toán</h3>
        <p className="mini-modal-amount">{formatVnd(withdrawal.amount)}</p>
        <div className="pmw-paid-summary">
          <div className="pmw-paid-row">
            <span>Ngân hàng:</span>
            <strong>
              {withdrawal.bankCode || "—"}
              {withdrawal.bankName ? ` · ${withdrawal.bankName}` : ""}
            </strong>
          </div>
          <div className="pmw-paid-row">
            <span>Số tài khoản:</span>
            <strong>{masked}</strong>
          </div>
          <div className="pmw-paid-row">
            <span>Mã yêu cầu:</span>
            <strong
              className="pmw-paid-full-code"
              title={withdrawal.requestCode || ""}
            >
              {withdrawal.requestCode || "—"}
            </strong>
          </div>
        </div>
        <p className="pmw-warning-text">
          Hành động này xác nhận đã chuyển khoản thực tế và không thể hoàn tác.
        </p>
        <textarea
          className="reject-textarea"
          placeholder="Nhập mã giao dịch, mã chứng từ hoặc ghi chú thanh toán"
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="pmw-char-counter">
          {note.length} / 1000
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="btn-cancel"
            onClick={onCancel}
            disabled={submitting}
          >
            Hủy
          </button>
          <button
            type="button"
            className="pmw-btn-mark-paid"
            onClick={() => onConfirm(trimmed)}
            disabled={submitting || invalid}
          >
            {submitting ? "Đang xử lý..." : "Xác nhận thanh toán"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Audit Timeline
   ============================================================ */

const TIMELINE_STEPS = [
  { key: "created",  label: "Đã tạo",       timeKey: "createdAt",    actorKey: null },
  { key: "approved", label: "Đã duyệt",     timeKey: "approvedAt",   actorKey: "approvedByAdminId" },
  { key: "paid",     label: "Đã thanh toán", timeKey: "paidAt",      actorKey: "paidByAdminId" },
  { key: "rejected", label: "Đã từ chối",   timeKey: "rejectedAt",   actorKey: "rejectedByAdminId" },
];

function AuditTimeline({ withdrawal }) {
  const activeKeys = TIMELINE_STEPS
    .filter((s) => withdrawal[s.timeKey])
    .map((s) => s.key);

  if (activeKeys.length === 0) return null;

  return (
    <div className="pmw-timeline">
      {TIMELINE_STEPS.filter((s) => activeKeys.includes(s.key)).map((step) => {
        const time = withdrawal[step.timeKey];
        const actor = step.actorKey ? withdrawal[step.actorKey] : null;
        const actorDisplay = truncateUuid(actor, 8);
        return (
          <div key={step.key} className={`pmw-timeline-step ${(step.key === "rejected" || step.key === "paid") ? (step.key === "rejected" ? "rejected" : "paid") : (step.key === "approved" ? "approved" : "pending")}`}>
            <div className="pmw-timeline-dot"></div>
            <div className="pmw-timeline-content">
              <div className="pmw-timeline-label">{step.label}</div>
              <div className="pmw-timeline-time">{formatDateTime(time)}</div>
              {actorDisplay ? (
                <div className="pmw-timeline-actor" title={actor || ""}>
                  bởi {actorDisplay}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   Detail Modal
   ============================================================ */

function WithdrawalDetailModal({
  withdrawal,
  onClose,
  onActionSuccess,
  onActionError,
  actionSubmitting,
  onActionStart,
}) {
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [showFullAccount, setShowFullAccount] = useState(false);

  useEffect(() => {
    setShowFullAccount(false);
    setShowApprove(false);
    setShowReject(false);
    setShowMarkPaid(false);
  }, [withdrawal?.id]);

  if (!withdrawal) return null;

  const status = withdrawal.status;
  const isPending = status === "PENDING";
  const isApproved = status === "APPROVED";
  const hasActions = isPending || isApproved;

  const fullAccount = withdrawal.bankAccountNumber || "";
  const displayAccount = showFullAccount
    ? fullAccount
    : fullAccount
    ? `****${fullAccount.slice(-4)}`
    : withdrawal.maskedBankAccountNumber || "—";

  const handleApprove = async (note) => {
    setShowApprove(false);
    try {
      await approveWithdrawal(withdrawal.id, { adminNote: note });
      onActionSuccess("Phê duyệt yêu cầu thành công");
    } catch (e) {
      onActionError(e);
    }
  };

  const handleReject = async (note) => {
    setShowReject(false);
    try {
      await rejectWithdrawal(withdrawal.id, { adminNote: note });
      onActionSuccess("Đã từ chối yêu cầu rút tiền");
    } catch (e) {
      onActionError(e);
    }
  };

  const handleMarkPaid = async (note) => {
    setShowMarkPaid(false);
    try {
      await markPaidWithdrawal(withdrawal.id, { adminNote: note });
      onActionSuccess("Đã xác nhận thanh toán yêu cầu rút tiền");
    } catch (e) {
      onActionError(e);
    }
  };

  const statusKey = (status || "").toLowerCase();

  return (
    <>
      <div
        className="modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="modal-container pmw-detail-modal">
          {/* Header */}
          <div className="modal-header pmw-detail-header">
            <div className="modal-title-group">
              <div className="pmw-detail-header-icon">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <div>
                <h4 className="pmw-detail-caption">CHI TIẾT YÊU CẦU RÚT TIỀN</h4>
                <h2 className="pmw-detail-title">
                  Yêu cầu rút tiền
                </h2>
                <div className="pw-detail-request-meta">
                  <span>
                    Mã yêu cầu:{" "}
                    <strong>{withdrawal.requestCode || "—"}</strong>
                  </span>
                </div>
              </div>
            </div>
            <div className="pmw-detail-header-right">
              <StatusPill status={status} />
              <button
                type="button"
                className="modal-close-btn"
                onClick={onClose}
                aria-label="Đóng"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="modal-body pmw-detail-body">
            {/* Summary card */}
            <div className={`pmw-summary-card-modal status-${statusKey}`}>
              <div className="pmw-summary-icon-wrap">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </div>
              <div className="pmw-summary-content">
                <div className="pmw-summary-amount-modal">
                  {formatVnd(withdrawal.amount)}
                </div>
                <div className="pmw-summary-meta-modal">
                  <span>
                    Mã yêu cầu:{" "}
                    <strong>{withdrawal.requestCode || "—"}</strong>
                  </span>
                  <span>Ngày tạo: {formatDateTime(withdrawal.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Information Grid: Contributor + Bank */}
            <div className="pmw-info-grid-modal">
              {/* Contributor */}
              <section className="pmw-info-card">
                <header className="pmw-info-card-header">
                  <span className="pmw-info-card-icon">
                    <svg
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
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </span>
                  <h4>Contributor</h4>
                </header>
                <div className="pmw-info-card-body">
                  <div className="pmw-info-row">
                    <label>Họ tên</label>
                    <p>{withdrawal.sellerFullName || "—"}</p>
                  </div>
                  <div className="pmw-info-row">
                    <label>Email</label>
                    <p className="pmw-info-mono">{withdrawal.sellerEmail || "—"}</p>
                  </div>
                </div>
              </section>

              {/* Bank */}
              <section className="pmw-info-card">
                <header className="pmw-info-card-header">
                  <span className="pmw-info-card-icon">
                    <svg
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
                      <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4"></path>
                    </svg>
                  </span>
                  <h4>Tài khoản nhận tiền</h4>
                </header>
                <div className="pmw-info-card-body">
                  <div className="pmw-info-row">
                    <label>Ngân hàng</label>
                    <p>
                      {withdrawal.bankName || "—"}
                      {withdrawal.bankCode ? (
                        <span className="pmw-bank-code-inline">
                          {withdrawal.bankCode}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="pmw-info-row">
                    <label>Số tài khoản</label>
                    <p>
                      <span className="pmw-full-account">{displayAccount}</span>
                      {withdrawal.bankAccountNumber ? (
                        <button
                          type="button"
                          className="pmw-reveal-btn"
                          onClick={() => setShowFullAccount((v) => !v)}
                          title={showFullAccount ? "Che số tài khoản" : "Hiện số tài khoản"}
                        >
                          <EyeIcon size={12} />
                          {showFullAccount ? "Che" : "Hiện"}
                        </button>
                      ) : null}
                    </p>
                  </div>
                  <div className="pmw-info-row">
                    <label>Chủ tài khoản</label>
                    <p>{withdrawal.bankAccountHolderName || "—"}</p>
                  </div>
                </div>
              </section>
            </div>

            {/* Notes cards */}
            <div className="pmw-notes-grid">
              <section className="pmw-note-card note-seller">
                <header className="pmw-note-header">
                  <span className="pmw-note-icon">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                  </span>
                  <h4>Ghi chú Contributor</h4>
                </header>
                <p>{withdrawal.sellerNote || "Chưa có ghi chú"}</p>
              </section>

              <section className="pmw-note-card note-admin">
                <header className="pmw-note-header">
                  <span className="pmw-note-icon">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </span>
                  <h4>Ghi chú xử lý</h4>
                </header>
                <p>{withdrawal.adminNote || "Chưa có ghi chú xử lý"}</p>
              </section>
            </div>

            {/* Timeline */}
            <section className="pmw-timeline-section">
              <header className="pmw-timeline-header">
                <span className="pmw-timeline-header-icon">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </span>
                <h4>Lịch sử xử lý</h4>
              </header>
              <AuditTimeline withdrawal={withdrawal} />
            </section>
          </div>

          {/* Footer actions */}
          <div className="pmw-detail-footer">
            <button type="button" className="pmw-btn-cancel" onClick={onClose}>
              Đóng
            </button>
            <div className="pmw-detail-footer-right">
              {hasActions && (
                <button
                  type="button"
                  className="pmw-btn-reject"
                  onClick={() => setShowReject(true)}
                >
                  Từ chối
                </button>
              )}
              {hasActions && isPending && (
                <button
                  type="button"
                  className="pmw-btn-approve"
                  onClick={() => setShowApprove(true)}
                >
                  Phê duyệt
                </button>
              )}
              {hasActions && isApproved && (
                <button
                  type="button"
                  className="pmw-btn-mark-paid"
                  onClick={() => setShowMarkPaid(true)}
                >
                  Xác nhận thanh toán
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Nested mini-modals */}
      {showApprove && (
        <ApproveMiniModal
          withdrawal={withdrawal}
          onConfirm={(note) => {
            if (onActionStart) onActionStart("approve");
            handleApprove(note);
          }}
          onCancel={() => setShowApprove(false)}
          submitting={actionSubmitting === "approve"}
        />
      )}
      {showReject && (
        <RejectMiniModal
          withdrawal={withdrawal}
          onConfirm={(note) => {
            if (onActionStart) onActionStart("reject");
            handleReject(note);
          }}
          onCancel={() => setShowReject(false)}
          submitting={actionSubmitting === "reject"}
        />
      )}
      {showMarkPaid && (
        <MarkPaidMiniModal
          withdrawal={withdrawal}
          onConfirm={(note) => {
            if (onActionStart) onActionStart("mark-paid");
            handleMarkPaid(note);
          }}
          onCancel={() => setShowMarkPaid(false)}
          submitting={actionSubmitting === "mark-paid"}
        />
      )}
    </>
  );
}

/* ============================================================
   Main Page
   ============================================================ */

export default function PaymentModeratorWithdrawalPage() {
  const notification = useNotification();

  // List state
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);

  // Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Detail state
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Action state
  const [actionSubmitting, setActionSubmitting] = useState(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 450);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch list
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listWithdrawals({
        page,
        size,
        status: statusFilter || undefined,
        search: debouncedSearch,
      });
      setWithdrawals(data.content || []);
      setTotalElements(data.totalElements || 0);
    } catch (e) {
      setWithdrawals([]);
      notification.error(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [page, size, statusFilter, debouncedSearch, notification]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleStatusChange = (e) => {
    setStatusFilter(e.target.value);
    setPage(0);
  };

  const handleSizeChange = (newSize) => {
    setSize(newSize);
    setPage(0);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handleOpenDetail = async (item) => {
    setDetailLoading(true);
    setSelectedWithdrawal(null);
    try {
      const detail = await getWithdrawal(item.id);
      setSelectedWithdrawal(detail);
    } catch (e) {
      if (e?.response?.status === 404) {
        notification.error("Không tìm thấy yêu cầu rút tiền");
        fetchList();
      } else {
        notification.error(toErrorMessage(e));
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const handleActionStart = (type) => {
    setActionSubmitting(type);
  };

  const handleActionSuccess = async (message) => {
    setActionSubmitting(null);
    notification.success(message);
    if (selectedWithdrawal) {
      try {
        const detail = await getWithdrawal(selectedWithdrawal.id);
        setSelectedWithdrawal(detail);
      } catch (e) {
        if (e?.response?.status === 404) {
          setSelectedWithdrawal(null);
        }
      }
    }
    await fetchList();
  };

  const handleActionError = async (e) => {
    setActionSubmitting(null);
    if (e?.response?.status === 409) {
      notification.error("Yêu cầu đã được xử lý bởi người khác");
      if (selectedWithdrawal) {
        try {
          const detail = await getWithdrawal(selectedWithdrawal.id);
          setSelectedWithdrawal(detail);
        } catch (refreshErr) {
          if (refreshErr?.response?.status === 404) {
            setSelectedWithdrawal(null);
          }
        }
      }
      await fetchList();
    } else {
      notification.error(toErrorMessage(e));
    }
  };

  const activeFilters = statusFilter || debouncedSearch;

  const handleClearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("");
    setPage(0);
  };

  return (
    <div className="pm-dashboard">
      <header className="pm-dashboard-header">
        <div className="pm-dashboard-header-title">
          <h1>Yêu cầu rút tiền</h1>
          <p>Quản lý và xử lý yêu cầu rút tiền của Contributor</p>
        </div>
        <div className="pm-dashboard-header-actions">
          <button
            type="button"
            className="pm-btn-secondary"
            onClick={fetchList}
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

      {/* Toolbar */}
      <div className="pmw-toolbar">
        <div className="pmw-search">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#98A2B3"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Tìm theo mã yêu cầu, email hoặc tên Contributor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={statusFilter} onChange={handleStatusChange}>
          <option value="">Tất cả</option>
          <option value="PENDING">Chờ duyệt</option>
          <option value="APPROVED">Đã duyệt</option>
          <option value="PAID">Đã thanh toán</option>
          <option value="REJECTED">Đã từ chối</option>
          <option value="CANCELLED">Đã hủy</option>
        </select>
        {activeFilters ? (
          <button
            type="button"
            className="pmw-clear-filters-btn"
            onClick={handleClearFilters}
          >
            ✕ Xóa bộ lọc
          </button>
        ) : null}
      </div>

      {/* Table */}
      <div className="table-card pmw-table-card">
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center" }}>
            <div className="spinner"></div>
            <p style={{ marginTop: 10, color: "#64748b" }}>Đang tải danh sách...</p>
          </div>
        ) : (
          <>
            <table className="contributor-table pmw-table">
              <thead>
                <tr>
                  <th>Mã yêu cầu</th>
                  <th>Contributor</th>
                  <th>Số tiền</th>
                  <th>Ngân hàng</th>
                  <th>Số tài khoản</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.length === 0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}
                    >
                      {activeFilters
                        ? "Không tìm thấy yêu cầu phù hợp."
                        : "Chưa có yêu cầu rút tiền nào."}
                    </td>
                  </tr>
                ) : (
                  withdrawals.map((w) => (
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
                        <BankCell withdrawal={w} />
                      </td>
                      <td>
                        <span className="pmw-masked-account">
                          {w.maskedBankAccountNumber || "—"}
                        </span>
                      </td>
                      <td>
                        <StatusPill status={w.status} />
                      </td>
                      <td className="pmw-created-at-column">
                        <div className="pmw-date-cell">
                          <span className="pmw-date-time">{formatTimeOnly(w.createdAt)}</span>
                          <span className="pmw-date-date">{formatDateOnly(w.createdAt)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="pmw-action-cell">
                          <button
                            type="button"
                            className="pmw-detail-btn"
                            onClick={() => handleOpenDetail(w)}
                            disabled={detailLoading}
                          >
                            Chi tiết
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {totalElements > 0 ? (
              <AdminPagination
                page={page}
                size={size}
                total={totalElements}
                onPageChange={handlePageChange}
                onSizeChange={handleSizeChange}
              />
            ) : null}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selectedWithdrawal ? (
        <WithdrawalDetailModal
          withdrawal={selectedWithdrawal}
          onClose={() => setSelectedWithdrawal(null)}
          onActionSuccess={handleActionSuccess}
          onActionError={handleActionError}
          actionSubmitting={actionSubmitting}
          onActionStart={handleActionStart}
        />
      ) : null}
    </div>
  );
}