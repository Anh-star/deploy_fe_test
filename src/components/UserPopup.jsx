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

export default function UserPopup({
  onClose,
  onLogout,
  menus = [],
  menuLoading = false,
  menuError = false,
}) {
  const validGroups = menus.filter(
    (group) => group.children && group.children.some((child) => child.route)
  );

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
        validGroups.map((group) => (
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
          </div>
        ))}

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
