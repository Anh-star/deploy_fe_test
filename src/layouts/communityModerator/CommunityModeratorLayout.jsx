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
  {
    label: "Xem trang Cộng đồng",
    path: "/community",
    Icon: LayoutIcon,
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
            <h2>QUẢN TRỊ CỘNG ĐỒNG</h2>
            <p>Community Moderator</p>
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
          <div className="cm-topbar-title">
            <h1>CỔNG QUẢN TRỊ NỘI DUNG CỘNG ĐỒNG</h1>
            <p>Hệ thống giám sát và xử lý báo cáo bài viết vi phạm</p>
          </div>
          <div className="cm-topbar-badge">
            <ShieldIcon size={16} />
            <span>Chế độ Kiểm duyệt</span>
          </div>
        </header>

        <div className="cm-content-body">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
