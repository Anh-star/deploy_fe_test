import React from "react";
import { NavLink, useNavigate, Outlet } from "react-router-dom";
import JustChatWidget from "../../components/common/JustChatWidget";
import {
  ShieldIcon,
  UserCircleIcon,
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

  const userName = user?.fullName || "Kiểm duyệt viên";
  const userRole = "Kiểm duyệt cộng đồng";

  return (
    <div className="cm-layout">
      <JustChatWidget />

      {/* Sidebar */}
      <aside className="cm-sidebar">
        <div className="cm-sidebar-logo">
          <img
            src="/Logo_Icon.png"
            alt="StudyIT Logo"
            className="cm-sidebar-logo-img"
          />
          <div className="cm-logo-text">
            <h2>QUẢN TRỊ CỘNG ĐỒNG</h2>
            <p>Kiểm duyệt cộng đồng</p>
          </div>
        </div>

        <nav className="cm-sidebar-menu">
          {MENU_ITEMS.map((item) => {
            const Icon = item.Icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `cm-menu-item${isActive ? " active" : ""}`
                }
                end={false}
              >
                <Icon size={20} className="cm-menu-icon" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="cm-sidebar-footer">
          <div className="cm-user-profile">
            <div className="cm-user-avatar">
              <UserCircleIcon size={22} />
            </div>
            <div className="cm-user-info">
              <span className="cm-user-name">{userName}</span>
              <span className="cm-user-role">{userRole}</span>
            </div>
            <button
              type="button"
              className="cm-logout-button"
              onClick={handleLogout}
              title="Đăng xuất"
              aria-label="Đăng xuất"
            >
              <LogoutIcon size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="cm-content-wrapper">
        <header className="cm-top-nav" />
        <main className="cm-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
