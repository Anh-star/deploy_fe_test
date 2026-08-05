import React, { useState, useEffect, useRef, useCallback } from "react";
import { BellIcon } from "./icons";
import { getUnreadCount } from "../api/notificationApi";
import { useSSE } from "../hooks/useSSE";
import NotificationDropdown from "./NotificationDropdown";

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await getUnreadCount();
      if (res && typeof res.unreadCount === "number") {
        setUnreadCount(res.unreadCount);
      }
    } catch (err) {
      console.error("Lỗi khi lấy số thông báo chưa đọc:", err);
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Real-time SSE listener: fetch accurate unread count for current user
  useSSE({
    notification: () => {
      fetchUnreadCount();
    },
  });

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      // Do not close if clicking inside portal modal or its backdrop
      if (event.target.closest && event.target.closest('.notification-detail-portal-modal')) {
        return;
      }
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        title="Thông báo"
        aria-label="Thông báo"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "12px",
          border: "none",
          background: isOpen ? "#F1F5F9" : "transparent",
          color: isOpen ? "#007BFF" : "#64748B",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          position: "relative",
          transition: "all 0.15s ease",
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.background = "#F1F5F9";
            e.currentTarget.style.color = "#0F172A";
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#64748B";
          }
        }}
      >
        <BellIcon size={20} strokeWidth={2} />

        {/* Badge counter */}
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "4px",
              right: "4px",
              background: "#EF4444",
              color: "#FFFFFF",
              fontSize: "11px",
              fontWeight: 700,
              borderRadius: "9999px",
              minWidth: "18px",
              height: "18px",
              padding: "0 4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              boxShadow: "0 0 0 2px #FFFFFF",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <NotificationDropdown
          onClose={() => setIsOpen(false)}
          onNotificationRead={fetchUnreadCount}
        />
      )}
    </div>
  );
}
