import React from "react";
import { Link, NavLink, useNavigate, Outlet } from "react-router-dom";
import JustChatWidget from "../../components/common/JustChatWidget";
import {
  LayoutIcon,
  DownloadIcon,
  UserCircleIcon,
  LogoutIcon,
} from "../../components/icons";
import { useAuth } from "../../context/AuthContext";
import "../../styles/paymentModerator/paymentModeratorLayout.css";

const MENU_ITEMS = [
  {
    label: "Bảng điều khiển",
    path: "/payment-moderator/dashboard",
    Icon: LayoutIcon,
  },
  {
    label: "Yêu cầu rút tiền",
    path: "/payment-moderator/withdrawals",
    Icon: DownloadIcon,
  },
];

const PaymentModeratorLayout = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const userName = user?.fullName || "Quản trị viên";
  const userRole = "Quản trị viên thanh toán";

  return (
    <div className="pm-layout">
      <JustChatWidget />

      <aside className="pm-sidebar">
        <div className="pm-sidebar-logo">
          <img
            src="/Logo_Icon.png"
            alt="StudyIT Logo"
            className="pm-sidebar-logo-img"
          />
          <div className="pm-logo-text">
            <h2>QUẢN TRỊ THANH TOÁN</h2>
            <p>Trang thanh toán</p>
          </div>
        </div>

        <nav className="pm-sidebar-menu">
          {MENU_ITEMS.map((item) => {
            const Icon = item.Icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `pm-menu-item${isActive ? " active" : ""}`
                }
                end={false}
              >
                <Icon size={20} className="pm-menu-icon" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="pm-sidebar-footer">
          <div className="pm-user-profile">
            <div className="pm-user-avatar">
              <UserCircleIcon size={22} />
            </div>
            <div className="pm-user-info">
              <span className="pm-user-name">{userName}</span>
              <span className="pm-user-role">{userRole}</span>
            </div>
            <button
              type="button"
              className="pm-logout-button"
              onClick={handleLogout}
              title="Đăng xuất"
              aria-label="Đăng xuất"
            >
              <LogoutIcon size={18} />
            </button>
          </div>
        </div>
      </aside>

      <div className="pm-content-wrapper">
        <header className="pm-top-nav" />
        <main className="pm-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default PaymentModeratorLayout;