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

const WITHDRAWAL_HUB_ROUTE = "/contributor/withdrawals";
const WITHDRAWAL_HUB_NAME = "Trung tâm rút tiền";
const WITHDRAWAL_HUB_GROUP = "Quản lý";

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
  const dynamicHasWithdrawalHub = dynamicRoutes.has(
    normalizeRoute(WITHDRAWAL_HUB_ROUTE)
  );

  const showWithdrawalHubFallback = isContributor && !dynamicHasWithdrawalHub;

  const validGroups = menus
    .filter((group) => group.children && group.children.some((child) => child.route))
    .map((group) => {
      if (
        !showWithdrawalHubFallback ||
        String(group?.name || "").trim() !== WITHDRAWAL_HUB_GROUP
      ) {
        return { group, fallbackChild: null };
      }
      return {
        group,
        fallbackChild: {
          id: "__local_withdrawal_hub__",
          name: WITHDRAWAL_HUB_NAME,
          route: WITHDRAWAL_HUB_ROUTE,
          __local: true,
        },
      };
    });

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
        validGroups.map(({ group, fallbackChild }) => (
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
            {fallbackChild ? (
              <Link
                to={fallbackChild.route}
                className="popup-item"
                key={fallbackChild.id}
                onClick={onClose}
              >
                <WithdrawalHubIcon size={18} />
                <span>{fallbackChild.name}</span>
              </Link>
            ) : null}
          </div>
        ))}

      {showWithdrawalHubFallback && validGroups.length === 0 && (
        <div className="popup-section">
          <div className="popup-header">{WITHDRAWAL_HUB_GROUP}</div>
          <Link
            to={WITHDRAWAL_HUB_ROUTE}
            className="popup-item"
            key="__local_withdrawal_hub_only__"
            onClick={onClose}
          >
            <WithdrawalHubIcon size={18} />
            <span>{WITHDRAWAL_HUB_NAME}</span>
          </Link>
        </div>
      )}

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
