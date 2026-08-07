import React from "react";
import { Link } from "react-router-dom";
import {
  UserCircleIcon,
  ShieldIcon,
  DocumentIcon,
  QuizIcon,
  BookmarkIcon,
  HistoryIcon,
  EyeIcon,
  LogoutIcon,
} from "./icons";
import { useAuth } from "../context/AuthContext";
import "../styles/userPopup.css";

const ICON_MAP = {
  "/profile": UserCircleIcon,
  "/contributor-profile": ShieldIcon,
  "/manage-documents": DocumentIcon,
  "/manage-quizzes": QuizIcon,
  "/favorite-documents": BookmarkIcon,
  "/quiz-history": HistoryIcon,
  "/view-history": EyeIcon,
  "/purchase-history": HistoryIcon,
};

function getItemIcon(route) {
  return ICON_MAP[route] || null;
}

function normalizeRoute(route) {
  if (!route) return "";
  return String(route).trim().replace(/\/+$/, "");
}

// Case-insensitive group name comparison. Backend menu group names may
// come back in any case (e.g. "QUẢN LÝ", "Quản lý", "quản lý") and we
// must treat them as the same group when deciding whether to merge
// contributor fallbacks into an existing group.
function normalizeGroupName(name) {
  return String(name || "").trim().toLocaleLowerCase("vi-VN");
}

function WithdrawalHubIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg
      style={{ display: "block" }}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M16 15h2" />
      <path d="M7 6V4h10v2" />
    </svg>
  );
}

function ManageDocumentsIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg
      style={{ display: "block" }}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  );
}

const WITHDRAWAL_HUB_ROUTE = "/contributor/withdrawals";
const WITHDRAWAL_HUB_NAME = "Trung tâm rút tiền";
const WITHDRAWAL_HUB_GROUP = "Quản lý";

const MANAGE_DOCUMENTS_ROUTE = "/manage-documents";
const MANAGE_DOCUMENTS_NAME = "Quản lý tài liệu";
const MANAGE_DOCUMENTS_GROUP = "Quản lý";

// Local fallback items that surface for a CONTRIBUTOR when the backend
// dynamic menu omits them. They are appended to the matching group so the
// user sees the same UX shape whether the backend authorises them via
// permissions or via this fallback.
const CONTRIBUTOR_FALLBACKS = [
  {
    id: "__local_manage_documents__",
    name: MANAGE_DOCUMENTS_NAME,
    route: MANAGE_DOCUMENTS_ROUTE,
    group: MANAGE_DOCUMENTS_GROUP,
    Icon: ManageDocumentsIcon,
  },
  {
    id: "__local_withdrawal_hub__",
    name: WITHDRAWAL_HUB_NAME,
    route: WITHDRAWAL_HUB_ROUTE,
    group: WITHDRAWAL_HUB_GROUP,
    Icon: WithdrawalHubIcon,
  },
];

export default function UserPopup({
  onClose,
  onLogout,
  menus = [],
  menuLoading = false,
  menuError = false,
}) {
  const { user } = useAuth();

  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const isContributor = roles.some(
    (role) => String(role).toUpperCase() === "CONTRIBUTOR"
  );

  const dynamicRoutes = new Set(
    menus.flatMap((group) =>
      Array.isArray(group?.children)
        ? group.children.map((child) => normalizeRoute(child?.route))
        : []
    )
  );

  // Only consider a fallback for routes that the backend has not already
  // given us. USER never sees them; CONTRIBUTOR sees the missing ones.
  const activeFallbacks = isContributor
    ? CONTRIBUTOR_FALLBACKS.filter(
        (f) => !dynamicRoutes.has(normalizeRoute(f.route))
      )
    : [];

  const validGroups = menus
    .filter((group) => group.children && group.children.some((child) => child.route))
    .map((group) => {
      const groupName = String(group?.name || "").trim();
      const fallbackChildren = activeFallbacks.filter(
        (f) => normalizeGroupName(f.group) === normalizeGroupName(groupName)
      );
      return { group, fallbackChildren };
    });

  // True when the backend already exposes a visible "Quản lý" group on
  // screen (i.e. one with at least one navigable child). Determined from
  // `validGroups` so empty / no-route groups do not count as a "Quản lý"
  // surface for the user. Comparison is case-insensitive so backend
  // variations like "QUẢN LÝ" / "Quản lý" / "quản lý" all collapse to
  // the same management group.
  const managementGroupExists = validGroups.some(
    ({ group }) =>
      normalizeGroupName(group?.name) === normalizeGroupName(WITHDRAWAL_HUB_GROUP)
  );

  // Synthetic local "Quản lý" group — only created when the backend has
  // NOT surfaced a visible "Quản lý" group of its own. Tied to
  // `managementGroupExists` (not `validGroups.length === 0`) so the popup
  // still renders the contributor capabilities even when the backend
  // exposes other unrelated groups (e.g. "TÀI KHOẢN", "LỊCH SỬ") but
  // happens to omit the management group.
  const syntheticManagementGroup =
    isContributor && activeFallbacks.length > 0 && !managementGroupExists
      ? activeFallbacks
      : null;

  return (
    <div className="user-popup-container" onClick={(e) => e.stopPropagation()}>
      {menuLoading && (
        <div className="popup-section">
          <div
            className="popup-item"
            style={{ color: "#94a3b8", cursor: "default" }}
          >
            <span>Đang tải...</span>
          </div>
        </div>
      )}

      {menuError && !menuLoading && (
        <div className="popup-section">
          <div
            className="popup-item"
            style={{ color: "#94a3b8", cursor: "default" }}
          >
            <span>Không tải được menu</span>
          </div>
        </div>
      )}

      {!menuLoading &&
        !menuError &&
        validGroups.map(({ group, fallbackChildren }) => (
          <div className="popup-section" key={group.id}>
            <div className="popup-header">{group.name}</div>
            {group.children
              .filter((child) => child.route)
              .map((child) => {
                const IconComp = getItemIcon(child.route);
                return (
                  <Link
                    to={child.route}
                    className="popup-item"
                    key={child.id}
                    onClick={onClose}
                  >
                    {IconComp && <IconComp size={18} />}
                    <span>{child.name}</span>
                  </Link>
                );
              })}
            {fallbackChildren.map((fallback) => {
              const FallbackIcon = fallback.Icon;
              return (
                <Link
                  to={fallback.route}
                  className="popup-item"
                  key={fallback.id}
                  onClick={onClose}
                >
                  <FallbackIcon size={18} />
                  <span>{fallback.name}</span>
                </Link>
              );
            })}
          </div>
        ))}

      {syntheticManagementGroup ? (
        <div className="popup-section">
          <div className="popup-header">{WITHDRAWAL_HUB_GROUP}</div>
          {syntheticManagementGroup.map((fallback) => {
            const FallbackIcon = fallback.Icon;
            return (
              <Link
                to={fallback.route}
                className="popup-item"
                key={fallback.id}
                onClick={onClose}
              >
                <FallbackIcon size={18} />
                <span>{fallback.name}</span>
              </Link>
            );
          })}
        </div>
      ) : null}

      <div className="popup-section">
        <div
          className="popup-item logout"
          onClick={() => {
            onLogout?.();
            onClose();
          }}
        >
          <LogoutIcon size={18} />
          <span>Đăng xuất</span>
        </div>
      </div>
    </div>
  );
}
