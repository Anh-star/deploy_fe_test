import { SearchIcon, UploadIcon } from "./icons";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { useRef, useState, useEffect, useCallback } from "react";
import UserPopup from "./UserPopup";
import UserAvatarDisplay from "./UserAvatarDisplay";
import ContributorUploadGateModal from "./common/ContributorUploadGateModal";
import {
  checkContributorAccess,
  ContributorUploadGateVariant,
  getContributorUploadGateModalCopy,
} from "../utils/checkContributorUploadAccess";
import NotificationBell from "./NotificationBell";
import { getMyMenus } from "../api/menuApi";
import "../styles/header.css";

const navLinkBaseStyle = {
  textAlign: "center",
  fontSize: "14px",
  lineHeight: "20px",
  textDecoration: "none",
};
export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout, initializing, loading, refreshUserProfile } = useAuth();
  const notification = useNotification();
  const [keyword, setKeyword] = useState("");
  const [uploadGateOpen, setUploadGateOpen] = useState(false);
  const [uploadGateConfig, setUploadGateConfig] = useState(() =>
    getContributorUploadGateModalCopy(ContributorUploadGateVariant.PENDING)
  );
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [menus, setMenus] = useState([]);
  const [menusLoading, setMenusLoading] = useState(false);
  const [menusError, setMenusError] = useState(false);
  const [avatarOpening, setAvatarOpening] = useState(false);
  const inputRef = useRef(null);
  const avatarMenuRef = useRef(null);

  const fetchMenus = useCallback(async ({ silent = false } = {}) => {
    if (!isAuthenticated) return;

    if (!silent) setMenusLoading(true);
    setMenusError(false);
    try {
      const data = await getMyMenus();
      setMenus(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load menus:", err);
      if (!silent) {
        setMenusError(true);
        setMenus([]);
      }
      // Silent failure: keep existing menus — no destructive state update
    } finally {
      if (!silent) setMenusLoading(false);
    }
  }, [isAuthenticated]);

  // Stable stringsignature used so the menu-refetch effect only fires when
  // the user's role set actually changes (USER → CONTRIBUTOR, etc.). Arrays
  // CANNOT be used as a dependency directly — they would be a new reference
  // on every render and force an infinite refetch loop.
  const userRoleSignature = Array.isArray(user?.roles)
    ? [...user.roles].map((r) => String(r)).sort().join("|")
    : "";

  useEffect(() => {
    if (isAuthenticated) {
      fetchMenus();
    } else {
      setMenus([]);
      setMenusError(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userRoleSignature, fetchMenus]);

  useEffect(() => {
    if (!avatarMenuOpen) return;
    const handleClickOutside = (e) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target)) {
        setAvatarMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [avatarMenuOpen]);

  const handleAvatarToggle = async () => {
    // Closing the popup is a pure UI concern — no network activity needed.
    if (avatarMenuOpen) {
      setAvatarMenuOpen(false);
      return;
    }

    // Opening: try to refresh authoritative profile + menu BEFORE opening.
    // Wrapped in try/finally so a transient network failure still opens the
    // popup with the last-known data instead of leaving the user with a
    // dead button.
    setAvatarOpening(true);
    // Open optimistically so the UI does not feel sluggish; replace with
    // refreshed data once the requests complete.
    setAvatarMenuOpen(true);
    try {
      if (typeof refreshUserProfile === "function") {
        await refreshUserProfile();
      }
      // Refresh menus silently — keep existing menu visible while updating
      await fetchMenus({ silent: true });
    } catch (err) {
      console.error("Avatar open refresh failed:", err);
    } finally {
      setAvatarOpening(false);
    }
  };

  const handleLogout = async () => {
    setAvatarMenuOpen(false);
    try {
      await logout();
      notification.success("Đăng xuất thành công.");
      navigate("/login", { replace: true });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Logout failed. Please try again.";
      notification.error(msg);
    }
  };

  const handleUploadClick = async () => {
    if (!isAuthenticated) {
      notification.info("Vui lòng đăng nhập để tải tài liệu.");
      navigate("/login");
      return;
    }

    if (initializing || loading || !user) {
      return;
    }

    const access = await checkContributorAccess(user);
    if (access.kind === "ALLOW_UPLOAD") {
      navigate("/upload-document");
      return;
    }
    if (access.kind === "NAVIGATE_CONTRIBUTOR_REGISTRATION") {
      navigate("/contributor-request");
      return;
    }
    setUploadGateConfig(getContributorUploadGateModalCopy(access.variant));
    setUploadGateOpen(true);
  };

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    const k = keyword.trim();
    if (k.length > 50) {
      notification.error("Từ khóa tìm kiếm tối đa 50 ký tự.");
      return;
    }
    setMobileMenuOpen(false);
    navigate(k ? `/documents?keyword=${encodeURIComponent(k)}` : "/documents");
  };

  return (
    <header className="main-header">
      <div className="header-inner">
        {/* Brand Logo */}
        <NavLink to="/" aria-label="Go to home" className="header-logo-link">
          <img
            className="header-logo-img"
            src="/imgs/logo.png"
            alt="StudyIT Logo"
          />
        </NavLink>

        {/* Desktop Navigation */}
        <nav className="header-desktop-nav">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `header-nav-link ${isActive ? "active" : ""}`
            }
          >
            Trang chủ
          </NavLink>
          <NavLink
            to="/documents"
            className={({ isActive }) =>
              `header-nav-link ${isActive ? "active" : ""}`
            }
          >
            Tài liệu
          </NavLink>
          <NavLink
            to="/community"
            className={({ isActive }) =>
              `header-nav-link ${isActive ? "active" : ""}`
            }
          >
            Cộng đồng
          </NavLink>
          <NavLink
            to="/about-us"
            className={({ isActive }) =>
              `header-nav-link ${isActive ? "active" : ""}`
            }
          >
            Về chúng tôi
          </NavLink>
          <NavLink
            to="/leaderboard"
            className={({ isActive }) =>
              `header-nav-link ${isActive ? "active" : ""}`
            }
          >
            Bảng xếp hạng
          </NavLink>
        </nav>

        {/* Desktop Search Bar */}
        <div className="header-search-container">
          <div className="header-search-box">
            <form onSubmit={handleSearchSubmit}>
              <input
                ref={inputRef}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && keyword) {
                    e.preventDefault();
                    setKeyword("");
                  }
                }}
                placeholder="Tìm kiếm tài liệu..."
                aria-label="Search documents"
                className="header-search-input"
              />
            </form>
            <div className="header-search-icon">
              <SearchIcon size={15} />
            </div>
            {!!keyword && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setKeyword("");
                  inputRef.current?.focus();
                }}
                className="header-search-clear"
                title="Clear"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Desktop & Mobile Actions */}
        <div className="header-actions">
          <button
            type="button"
            onClick={handleUploadClick}
            className="header-upload-btn"
          >
            <UploadIcon size={14} />
            <span>Tải lên</span>
          </button>

          {isAuthenticated && <NotificationBell />}

          {isAuthenticated ? (
            <div ref={avatarMenuRef} style={{ position: "relative" }}>
              <button
                type="button"
                title="Profile menu"
                aria-label="Profile menu"
                aria-expanded={avatarMenuOpen}
                aria-haspopup="true"
                onClick={handleAvatarToggle}
                style={{
                  width: "40px",
                  height: "40px",
                  padding: 0,
                  margin: 0,
                  border: "none",
                  borderRadius: "9999px",
                  overflow: "hidden",
                  outline: "2px solid #E2E8F0",
                  outlineOffset: "-2px",
                  background: "transparent",
                  cursor: "pointer",
                  display: "block",
                }}
              >
                <UserAvatarDisplay user={user} size="header" />
              </button>
              {avatarMenuOpen && (
                <UserPopup
                  onClose={() => setAvatarMenuOpen(false)}
                  onLogout={handleLogout}
                  menus={menus}
                  menuLoading={menusLoading}
                  menuError={menusError}
                />
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="header-login-btn">
                Đăng nhập
              </Link>
              <Link to="/sign-up" className="header-signup-btn">
                Đăng ký
              </Link>
            </>
          )}

          {/* Hamburger Menu Toggle Button for Mobile */}
          <button
            type="button"
            className="header-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
            title="Menu"
          >
            {mobileMenuOpen ? (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            ) : (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      <div
        className={`mobile-drawer-overlay ${mobileMenuOpen ? "open" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Mobile Navigation Drawer */}
      <div className={`mobile-nav-drawer ${mobileMenuOpen ? "open" : ""}`}>
        {/* Mobile Search */}
        <div className="mobile-drawer-search">
          <div className="header-search-box">
            <form onSubmit={handleSearchSubmit}>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tìm kiếm tài liệu..."
                className="header-search-input"
              />
            </form>
            <div className="header-search-icon">
              <SearchIcon size={15} />
            </div>
          </div>
        </div>

        {/* Mobile Nav Links */}
        <nav className="mobile-drawer-links">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `mobile-nav-item ${isActive ? "active" : ""}`
            }
          >
            <span>Trang chủ</span>
          </NavLink>
          <NavLink
            to="/documents"
            className={({ isActive }) =>
              `mobile-nav-item ${isActive ? "active" : ""}`
            }
          >
            <span>Tài liệu</span>
          </NavLink>
          <NavLink
            to="/community"
            className={({ isActive }) =>
              `mobile-nav-item ${isActive ? "active" : ""}`
            }
          >
            <span>Cộng đồng</span>
          </NavLink>
          <NavLink
            to="/about-us"
            className={({ isActive }) =>
              `mobile-nav-item ${isActive ? "active" : ""}`
            }
          >
            <span>Về chúng tôi</span>
          </NavLink>
          <NavLink
            to="/leaderboard"
            className={({ isActive }) =>
              `mobile-nav-item ${isActive ? "active" : ""}`
            }
          >
            <span>Bảng xếp hạng</span>
          </NavLink>
        </nav>

        {/* Mobile Drawer Actions */}
        <div className="mobile-drawer-actions">
          <button
            type="button"
            className="mobile-drawer-upload-btn"
            onClick={() => {
              setMobileMenuOpen(false);
              handleUploadClick();
            }}
          >
            <UploadIcon size={16} />
            <span>Tải lên tài liệu</span>
          </button>

          {isAuthenticated ? (
            <>
              <Link
                to="/profile"
                className="mobile-drawer-user-info"
                onClick={() => setMobileMenuOpen(false)}
              >
                <UserAvatarDisplay user={user} size="sidebar" />
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#0F172A",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {user?.fullName || "Người dùng"}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748B" }}>
                    Xem trang cá nhân
                  </div>
                </div>
              </Link>
              <button
                type="button"
                className="mobile-drawer-logout-btn"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <div className="mobile-drawer-auth-row">
              <Link to="/login" className="mobile-drawer-auth-btn login">
                Đăng nhập
              </Link>
              <Link to="/sign-up" className="mobile-drawer-auth-btn signup">
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>

      <ContributorUploadGateModal
        isOpen={uploadGateOpen}
        onClose={() => setUploadGateOpen(false)}
        title={uploadGateConfig.title}
        message={uploadGateConfig.message}
        primary={uploadGateConfig.primary}
        closeOnly={uploadGateConfig.closeOnly}
      />
    </header>
  );
}
