import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { parseApiDate } from "../../utils/dateUtils";
import "../../styles/lockedAccountModal.css";

function LockIcon() {
  return (
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
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function formatLockDateTime(value) {
  if (!value) return null;
  try {
    const d = parseApiDate(value);
    if (!d || Number.isNaN(d.getTime())) return null;
    return d.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return null;
  }
}


/**
 * Modal hiển thị thông báo tài khoản bị khóa với hiệu ứng mờ nền toàn trang.
 * Tự động khóa toàn bộ thao tác và đăng xuất tài khoản khi bấm nút.
 */
export default function LockedAccountModal() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [reason, setReason] = useState("");
  const [lockedAt, setLockedAt] = useState(() => location.state?.lockedAt || null);
  const [loggingOut, setLoggingOut] = useState(false);

  const isUserLocked = Boolean(
    user?.status && user.status.toUpperCase() !== "ACTIVE"
  );
  const isStateLocked = Boolean(location.state?.accountLocked);
  const isOpen = isUserLocked || isStateLocked;

  useEffect(() => {
    if (location.state?.lockedReason) {
      setReason(location.state.lockedReason);
    }
    if (location.state?.lockedAt) {
      setLockedAt(location.state.lockedAt);
    } else if (!lockedAt) {
      setLockedAt(user?.updatedAt || new Date().toISOString());
    }
  }, [location.state, user?.updatedAt, lockedAt]);

  const formattedTime = useMemo(() => {
    return formatLockDateTime(lockedAt) || formatLockDateTime(new Date().toISOString());
  }, [lockedAt]);

  if (!isOpen) return null;

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setLoggingOut(false);
      navigate("/login", { replace: true });
    }
  };

  return (
    <div
      className="locked-account-modal-overlay"
      role="presentation"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="locked-account-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="locked-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="locked-account-modal__icon-wrap">
          <LockIcon />
        </div>

        <h3 id="locked-modal-title" className="locked-account-modal__title">
          Tài khoản của bạn đã bị khóa
        </h3>

        <p className="locked-account-modal__desc">
          {reason &&
          !reason.toLowerCase().includes("thất bại") &&
          !reason.toLowerCase().includes("vui lòng thử lại")
            ? reason
            : "Tài khoản của bạn hiện đang bị tạm khóa hoặc ngừng hoạt động do vi phạm Tiêu chuẩn cộng đồng hoặc theo quyết định của Quản trị viên."}
        </p>

        {formattedTime && (
          <div className="locked-account-modal__time-box">
            <ClockIcon />
            <span>Thời điểm ghi nhận: <strong>{formattedTime}</strong></span>
          </div>
        )}

        <div className="locked-account-modal__support-box">
          Để khiếu nại hoặc yêu cầu xem xét mở khóa tài khoản, vui lòng liên hệ Ban Quản Trị qua email:
          <div className="locked-account-modal__support-email">
            <a href="mailto:studyit.support@gmail.com">studyit.support@gmail.com</a>
          </div>
        </div>

        <button
          type="button"
          className="locked-account-modal__btn"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? "Đang đăng xuất..." : "Đăng xuất tài khoản"}
        </button>
      </div>
    </div>
  );
}

