import { SearchIcon, UploadIcon } from "./icons";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { useRef, useState, useEffect } from "react";
import UserPopup from "./UserPopup";
import UserAvatarDisplay from "./UserAvatarDisplay";
import ContributorUploadGateModal from "./common/ContributorUploadGateModal";
import {
  checkContributorAccess,
  ContributorUploadGateVariant,
  getContributorUploadGateModalCopy,
} from "../utils/checkContributorUploadAccess";

const navLinkBaseStyle = {
  textAlign: "center",
  fontSize: "14px",
  lineHeight: "20px",
  textDecoration: "none",
};
export default function Header() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout, initializing, loading } = useAuth();
  const notification = useNotification();
  const [keyword, setKeyword] = useState("");
  const [uploadGateOpen, setUploadGateOpen] = useState(false);
  const [uploadGateConfig, setUploadGateConfig] = useState(() =>
    getContributorUploadGateModalCopy(ContributorUploadGateVariant.PENDING)
  );
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const inputRef = useRef(null);
  const avatarMenuRef = useRef(null);

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

  return (
    <div
      style={{
        width: "100%",
        padding: "0 32px",
        position: "sticky",
        top: 0,
        background: "rgba(255, 255, 255, 0.80)",
        borderBottom: "1px solid #E2E8F0",
        backdropFilter: "blur(6px)",
        flexDirection: "column",
        justifyContent: "flex-start",
        alignItems: "flex-start",
        display: "flex",
        zIndex: 10,
      }}
    >
      <div
        style={{
          width: "100%",
          
          height: "64px",
          paddingRight: "0.02px",
          justifyContent: "space-between",
          alignItems: "center",
          display: "inline-flex",
          position: "relative"
        }}
      >
        <NavLink
          to="/"
          aria-label="Go to home"
          style={{ display: "inline-flex", alignItems: "center", width: "302.42px", height: "64px", position: "relative" }}
        >
          <img
            style={{ 
              width: "302.42px", 
              height: "112px", 
              objectFit: "contain", 
              position: "absolute", 
              top: "50%", 
              transform: "translateY(-50%)",
              zIndex: 11
            }}
            src="/imgs/logo.png"
            alt="StudyIT Logo"
          />
        </NavLink>
<nav
          style={{
            paddingLeft: "32px",
            width: "390px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <NavLink
            to="/"
            style={({ isActive }) => ({
              ...navLinkBaseStyle,
              color: isActive ? "#007BFF" : "#475569",
              fontWeight: isActive ? 600 : 500,
            })}
          >
            Trang chủ
          </NavLink>
          <NavLink
            to="/documents"
            style={({ isActive }) => ({
              ...navLinkBaseStyle,
              color: isActive ? "#007BFF" : "#475569",
              fontWeight: isActive ? 600 : 500,
            })}
          >
            Tài liệu
          </NavLink>
          <NavLink
            to="/about-us"
            style={({ isActive }) => ({
              ...navLinkBaseStyle,
              color: isActive ? "#007BFF" : "#475569",
              fontWeight: isActive ? 600 : 500,
            })}
          >
            Về chúng tôi
          </NavLink>
          <NavLink
            to="/leaderboard"
            style={({ isActive }) => ({
              ...navLinkBaseStyle,
              color: isActive ? "#007BFF" : "#475569",
              fontWeight: isActive ? 600 : 500,
            })}
          >
            Bảng xếp hạng
          </NavLink>
        </nav>

        <div style={{ flex: "1 1 0", maxWidth: "512px", paddingLeft: "32px", paddingRight: "32px" }}>
          <div style={{ width: "100%", maxWidth: "448px", position: "relative" }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const k = keyword.trim();
                if (k.length > 50) {
                  notification.error("Từ khóa tìm kiếm tối đa 50 ký tự.");
                  return;
                }
                navigate(k ? `/documents?keyword=${encodeURIComponent(k)}` : "/documents");
              }}
            >
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
                style={{
                  width: "100%",
                  padding: keyword ? "9px 40px 10px 40px" : "9px 16px 10px 40px",
                  background: "#F1F5F9",
                  borderRadius: "12px",
                  border: "none",
                  outline: "none",
                  color: "#0F172A",
                  fontSize: "14px",
                  fontWeight: 400,
                  boxSizing: "border-box",
                }}
              />
            </form>
            <div style={{ position: "absolute", left: "12.4px", top: "12px", color: "#94A3B8", pointerEvents: "none" }}>
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
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "8px",
                  width: "28px",
                  height: "28px",
                  border: "none",
                  borderRadius: "9999px",
                  background: "transparent",
                  color: "#94A3B8",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Clear"
              >
                <span style={{ fontSize: "16px", lineHeight: 1, fontWeight: 700 }}>×</span>
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            role="button"
            tabIndex={0}
            onClick={handleUploadClick}
            onKeyDown={(e) => e.key === "Enter" && handleUploadClick()}
            style={{
              padding: "8px 16px",
              background: "#007BFF",
              borderRadius: "12px",
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
            }}
          >
            <div style={{ color: "white" }}>
              <UploadIcon size={12} />
            </div>
            <div
              style={{
                color: "white",
                fontSize: "14px",
                fontWeight: 600,
                lineHeight: "20px",
              }}
            >
              Tải lên
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                boxShadow:
                  "0px 4px 6px -4px rgba(0,123,255,0.25), 0px 10px 15px -3px rgba(0,123,255,0.25)",
                borderRadius: "12px",
              }}
            />
          </div>

          {isAuthenticated ? (
              <div ref={avatarMenuRef} style={{ position: "relative" }}>
                <button
                  type="button"
                  title="Profile menu"
                  aria-label="Profile menu"
                  aria-expanded={avatarMenuOpen}
                  aria-haspopup="true"
                  onClick={() => setAvatarMenuOpen((open) => !open)}
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
                  />
                )}
              </div>
          ) : (
            <>
              <Link
                to="/login"
                style={{
                  padding: "8px 12px",
                  borderRadius: "12px",
                  border: "1px solid #CBD5E1",
                  background: "white",
                  color: "#0F172A",
                  fontSize: "14px",
                  fontWeight: 600,
                  lineHeight: "20px",
                  textDecoration: "none",
                }}
              >
                Đăng nhập
              </Link>
              <Link
                to="/sign-up"
                style={{
                  padding: "8px 12px",
                  borderRadius: "12px",
                  background: "#007BFF",
                  color: "white",
                  fontSize: "14px",
                  fontWeight: 600,
                  lineHeight: "20px",
                  textDecoration: "none",
                  boxShadow:
                    "0px 4px 6px -4px rgba(0,123,255,0.25), 0px 10px 15px -3px rgba(0,123,255,0.25)",
                }}
              >
                Đăng ký
              </Link>
            </>
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
    </div>
  );
}