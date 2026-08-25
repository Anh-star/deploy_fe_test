import JustChatWidget from '../../components/common/JustChatWidget';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMyMenus } from '../../api/menuApi';
import {
  filterAdminSidebarForModerator,
  filterOnlyAdminRoutes,
  getAdminRouteOrder,
  isModeratorRole,
  normalizeMenuTree,
  pruneEmptyMenuGroups,
  resolveAdminVietnameseLabel,
} from './menuTree';
import '../../styles/admin/adminLayout.css';

// ==================== BẢNG DỊCH MENU SANG TIẾNG VIỆT ====================
// Map theo route /admin/... (the verified DB schema on tbl_menus
// does not carry a per-locale label column). The route-based map
// lives next to the helpers in menuTree.js so it can be unit-
// tested; this object is kept as a public re-export for any caller
// that still imports from AdminLayout.
const MENU_TRANSLATIONS = {
  "Dashboard": "Bảng điều khiển",
  "Access Control": "Quản lý Truy cập",
  "Users": "Người dùng",
  "Roles": "Vai trò",
  "Permissions": "Quyền hạn",
  "Categories": "Danh mục",
  "Tags": "Thẻ",
  "Settings": "Cài đặt",
  "Contributor Requests": "Yêu cầu đóng góp",
  "Pending Documents": "Tài liệu đang chờ duyệt",
  "User Reports": "Báo cáo người dùng"
};

// Hàm dịch label
const translateMenuLabel = (label) => {
  if (!label || typeof label !== 'string') return label;
  return MENU_TRANSLATIONS[label] || label;   // Nếu không có trong bảng thì giữ nguyên
};

/** Trả về icon giống với ảnh bạn gửi */
const getMenuIcon = (label) => {
  const props = {
    className: "menu-icon",
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.25",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  };

  switch (label) {
    case "Bảng điều khiển":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-layout-dashboard-icon lucide-layout-dashboard"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
      );

    case "Quản lý Truy cập":
    case "Kiểm soát truy cập":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-cog-icon lucide-user-cog"><path d="M10 15H6a4 4 0 0 0-4 4v2"/><path d="m14.305 16.53.923-.382"/><path d="m15.228 13.852-.923-.383"/><path d="m16.852 12.228-.383-.923"/><path d="m16.852 17.772-.383.924"/><path d="m19.148 12.228.383-.923"/><path d="m19.53 18.696-.382-.924"/><path d="m20.772 13.852.924-.383"/><path d="m20.772 16.148.924.383"/><circle cx="18" cy="15" r="3"/><circle cx="9" cy="7" r="4"/></svg>
      );

    case "Người dùng":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-icon lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      );

    case "Vai trò":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-key-icon lucide-user-key"><path d="M20 11v6"/><path d="M20 13h2"/><path d="M3 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 2.072.578"/><circle cx="10" cy="7" r="4"/><circle cx="20" cy="19" r="2"/></svg>
      );

    case "Quyền hạn":
    case "Quyền":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-metronome-icon lucide-metronome"><path d="M12 11.4V9.1"/><path d="m12 17 6.59-6.59"/><path d="m15.05 5.7-.218-.691a3 3 0 0 0-5.663 0L4.418 19.695A1 1 0 0 0 5.37 21h13.253a1 1 0 0 0 .951-1.31L18.45 16.2"/><circle cx="20" cy="9" r="2"/></svg>
      );

    case "Danh mục":
    case "Quản lý danh mục":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
        </svg>
      );

    case "Thẻ":
    case "Quản lý thẻ":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-tag-icon lucide-tag"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>
      );

    case "Cài đặt":
    case "Cấu hình":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings-icon lucide-settings"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>
      );

    case "Yêu cầu đóng góp":
      return(
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-git-pull-request-icon lucide-git-pull-request"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" x2="6" y1="9" y2="21"/></svg>
      );

    case "Tài liệu đang chờ duyệt":
      return(
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clipboard-clock-icon lucide-clipboard-clock"><path d="M16 14v2.2l1.6 1"/><path d="M16 4h2a2 2 0 0 1 2 2v.832"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h2"/><circle cx="16" cy="16" r="6"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
      );

    case "Báo cáo người dùng":
      return(
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-message-square-warning-icon lucide-message-square-warning"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path d="M12 15h.01"/><path d="M12 7v4"/></svg>
      );

    case "Quản lý cộng đồng":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
      );

    default:
      // No fallback circle / placeholder icon. Items
      // without an icon entry simply render without an
      // icon. The previous default circle was rendering
      // as a white ring around empty menu leaves.
      return null;
  }
};

/**
 * Sidebar helpers live in {@link ./menuTree}. The fixture-based
 * regression tests in {@code __tests__/sidebarRuntimeRender.test.mjs}
 * rely on the same source-of-truth helpers, so any change to the
 * pruning rules MUST be applied in both files.
 */

function subtreeContainsPath(item, pathname) {
  if (!item) return false;
  if (item.path && pathname === item.path) return true;
  return Array.isArray(item.children) && item.children.some((c) => subtreeContainsPath(c, pathname));
}

/** Các key nhóm cần mở để hiển thị route đang active (theo index path). */
function collectOpenKeysForPath(items, pathname, prefix = '') {
  const keys = [];
  if (!Array.isArray(items)) return keys;
  items.forEach((item, index) => {
    const key = `${prefix}${index}`;
    if (item.children?.length > 0 && subtreeContainsPath(item, pathname)) {
      keys.push(key);
      keys.push(...collectOpenKeysForPath(item.children, pathname, `${key}-`));
    }
  });
  return keys;
}

function Chevron({ open }) {
  return (
    <svg
      className={`menu-chevron ${open ? 'menu-chevron--open' : ''}`}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/**
 * Render menu nested: có children → nhóm expand/collapse; không → Link (hoặc span nếu thiếu path).
 *
 * <p>Each item may carry an optional {@code displayLabel} — the
 * already-resolved Vietnamese copy. When present, it is rendered
 * instead of the raw {@code item.label} so the moderator sidebar
 * can map {@code /admin/...} routes to Vietnamese labels without
 * touching the database.</p>
 */
function renderMenu(items, ctx) {
  const { location, openKeys, toggleKey, depth, keyPrefix } = ctx;
  if (!Array.isArray(items) || items.length === 0) return null;

  return items.map((item, index) => {
    const key = `${keyPrefix}${index}`;
    const hasChildren = Array.isArray(item.children) && item.children.length > 0;
    const indentPx = 16 + depth * 14;
    const displayLabel =
      typeof item.displayLabel === "string" && item.displayLabel.length > 0
        ? item.displayLabel
        : translateMenuLabel(item.label);

    if (hasChildren) {
      const open = openKeys.has(key);
      const parentActive = subtreeContainsPath(item, location.pathname);

      return (
        <div className="menu-group" key={key}>
          <div
            className={`menu-group-header ${parentActive ? 'menu-group-header--active-branch' : ''}`}
            style={{ paddingLeft: indentPx }}
          >
            {getMenuIcon(displayLabel)}
            {item.path ? (
              <Link
                to={item.path}
                className={`menu-item menu-item--in-group ${location.pathname === item.path ? 'active' : ''}`}
              >
                {displayLabel}
              </Link>
            ) : (
              <span className="menu-item-label">{displayLabel}</span>
            )}
            <button
              type="button"
              className="menu-group-toggle"
              aria-expanded={open}
              aria-label={open ? 'Thu gọn menu' : 'Mở rộng menu'}
              onClick={() => toggleKey(key)}
            >
              <Chevron open={open} />
            </button>
          </div>
          {open && (
            <div className="menu-group-children">
              {renderMenu(item.children, {
                ...ctx,
                depth: depth + 1,
                keyPrefix: `${key}-`,
              })}
            </div>
          )}
        </div>
      );
    }

    if (item.path) {
      return (
        <Link
          key={key}
          to={item.path}
          className={`menu-item ${location.pathname === item.path ? 'active' : ''}`}
          style={{ paddingLeft: indentPx }}
        >
          {getMenuIcon(displayLabel)}
          {displayLabel}
        </Link>
      );
    }

    return (
      <div key={key} className="menu-item menu-item--disabled" style={{ paddingLeft: indentPx }}>
        {getMenuIcon(displayLabel)}
        <span className="menu-item-label">{displayLabel}</span>
      </div>
    );
  });
}

function pickDisplayRole(roles) {
  if (!roles?.length) return 'Kiểm duyệt viên';
  if (roles.includes('ADMIN')) return 'Quản trị viên';
  if (roles.includes('USER_MODERATOR')) return 'Kiểm duyệt người dùng';
  if (roles.includes('CONTENT_MODERATOR')) return 'Kiểm duyệt nội dung';
  return roles[0];
}

const AdminLayout = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menus, setMenus] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getMyMenus();
        if (!cancelled) setMenus(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('getMyMenus failed:', e);
        if (!cancelled) setMenus([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const menuTree = useMemo(() => {
    // ADMIN (System Administrator) keeps the full menu tree —
    // Access Control, every parent group, every child, every
    // permission. The moderator filter MUST NOT run for them.
    if (isModeratorRole(user?.roles)) {
      const normalised = normalizeMenuTree(menus);
      const flat = filterAdminSidebarForModerator(normalised, user?.roles);
      return flat.map((leaf) => ({
        ...leaf,
        displayLabel: resolveAdminVietnameseLabel(leaf),
      }));
    }
    const normalised = normalizeMenuTree(menus);
    const adminOnly = filterOnlyAdminRoutes(normalised);
    const pruned = pruneEmptyMenuGroups(adminOnly);
    return [...pruned].sort((a, b) => {
      const oa = getAdminRouteOrder(a);
      const ob = getAdminRouteOrder(b);
      return oa - ob;
    });
  }, [menus, user?.roles]);

  const [openKeys, setOpenKeys] = useState(() => new Set());

  useEffect(() => {
    const required = collectOpenKeysForPath(menuTree, location.pathname);
    setOpenKeys((prev) => {
      const next = new Set(prev);
      required.forEach((k) => next.add(k));
      return next;
    });
  }, [location.pathname, menuTree]);

  const toggleKey = useCallback((key) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const menuContent = useMemo(
    () =>
      renderMenu(menuTree, {
        location,
        openKeys,
        toggleKey,
        depth: 0,
        keyPrefix: '',
      }),
    [menuTree, location, openKeys, toggleKey]
  );

  return (
    <div className="admin-layout">
      <JustChatWidget />
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="sidebar-logo">
          <img 
            src="/Logo_Icon.png" 
            alt="StudyIT Logo" 
            className="sidebar-logo-img"
          />
          <div className="logo-text">
            <h2>TRANG QUẢN TRỊ</h2>
            <p>Hệ thống quản trị</p>
          </div>
        </div>

        <nav className="sidebar-menu">{menuContent}</nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-user-icon lucide-circle-user"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/></svg>
            </div>
            <div className="user-info">
              <span className="user-name">{user?.fullName || 'Quản trị viên'}</span>
              <span className="user-role">{pickDisplayRole(user?.roles)}</span>
            </div>
            <button className="logout-button" onClick={handleLogout} title="Đăng xuất">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-log-out-icon lucide-log-out"><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></svg>
            </button>
          </div>
        </div>
      </aside>

      <div className="admin-content-wrapper">
        <header className="admin-top-nav" />
        <Outlet />
      </div>
    </div>
  );
};

export default AdminLayout;
