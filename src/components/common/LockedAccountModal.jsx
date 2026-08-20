import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
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

/**
 * Modal hiển thị thông báo tài khoản bị khóa trên màn hình chính với hiệu ứng mờ nền.
 */
export default function LockedAccountModal() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (location.state?.accountLocked) {
      setIsOpen(true);
      if (location.state?.lockedReason) {
        setReason(location.state.lockedReason);
      }
      // Xóa state để khi F5 / refresh trang không bị hiện lại popup
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname + window.location.search
      );
    }
  }, [location.state]);

  if (!isOpen) return null;

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <div
      className="locked-account-modal-overlay"
      role="presentation"
      onClick={handleClose}
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
            : "Tài khoản của bạn đã bị tạm khóa do vi phạm Tiêu chuẩn cộng đồng hoặc bị quản trị viên đình chỉ hoạt động."}
        </p>

        <div className="locked-account-modal__support-box">
          Để khiếu nại hoặc yêu cầu xem xét mở khóa tài khoản, vui lòng liên hệ Ban Quản Trị qua email:
          <div className="locked-account-modal__support-email">
            <a href="mailto:support@itstudy.edu.vn">support@itstudy.edu.vn</a>
          </div>
        </div>

        <button
          type="button"
          className="locked-account-modal__btn"
          onClick={handleClose}
        >
          Đã hiểu
        </button>
      </div>
    </div>
  );
}
