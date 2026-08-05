import React from "react";
import { NavLink, useNavigate, Outlet } from "react-router-dom";
import JustChatWidget from "../../components/common/JustChatWidget";
import {
  LayoutIcon,
  ShieldIcon,
  LogoutIcon,
} from "../../components/icons";
import { useAuth } from "../../context/AuthContext";
import "../../styles/communityModeratorLayout.css";

const MENU_ITEMS = [
  {
    label: "Quản lý báo cáo bài viết",
    path: "/community-moderator/dashboard",
    Icon: ShieldIcon,
  },
];

export default function CommunityModeratorLayout() {
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

  const userName = user?.fullName || "Quản lý cộng đồng";

  return (
    <div className="cm-layout">
      <JustChatWidget />

      {/* Sidebar */}
      <aside className="cm-sidebar">
        <div className="cm-sidebar-header">
          <img
            src="/Logo_Icon.png"
            alt="StudyIT Logo"
            className="cm-sidebar-logo-img"
          />
          <div className="cm-logo-text">
            <h2>TRANG QUẢN TRỊ</h2>
            <p>Hệ thống quản trị</p>
          </div>
        </div>

        <nav className="cm-sidebar-menu">
          {MENU_ITEMS.map((item) => {
            const IconComponent = item.Icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `cm-menu-item ${isActive ? "active" : ""}`
                }
              >
                <span className="cm-menu-icon">
                  <IconComponent size={20} />
                </span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="cm-sidebar-footer">
          <div className="cm-user-profile">
            <div className="cm-user-avatar">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="cm-user-info">
              <span className="cm-user-name">{userName}</span>
              <span className="cm-user-role">Quản lý cộng đồng</span>
            </div>
          </div>
          <button
            type="button"
            className="cm-logout-button"
            onClick={handleLogout}
            title="Đăng xuất"
          >
            <LogoutIcon size={18} />
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <main className="cm-content-wrapper">
        <header className="cm-topbar">
          <div className="cm-search-box">
            <svg
              className="cm-search-icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input type="text" placeholder="Tìm kiếm..." aria-label="Tìm kiếm" />
          </div>
        </header>

        <div className="cm-content-body">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
