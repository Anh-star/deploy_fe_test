import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getNotifications, markAsRead, markAllAsRead } from "../api/notificationApi";

function formatRelativeTime(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return "Vừa xong";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} ngày trước`;
  return date.toLocaleDateString("vi-VN");
}

export default function NotificationDropdown({ onClose, onNotificationRead }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const fetchNotifications = async (pageNum = 0) => {
    setLoading(true);
    try {
      const res = await getNotifications(pageNum, 15);
      if (res && res.content) {
        if (pageNum === 0) {
          setNotifications(res.content);
        } else {
          setNotifications((prev) => [...prev, ...res.content]);
        }
        setHasMore(!res.last);
      }
    } catch (err) {
      console.error("Lỗi khi tải thông báo:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(0);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      if (onNotificationRead) onNotificationRead();
    } catch (err) {
      console.error("Lỗi khi đánh dấu tất cả đã đọc:", err);
    }
  };

  const handleItemClick = async (item) => {
    if (!item.isRead) {
      try {
        await markAsRead(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
        );
        if (onNotificationRead) onNotificationRead();
      } catch (err) {
        console.error("Lỗi khi đánh dấu đã đọc:", err);
      }
    }

    onClose();

    // Navigate based on referenceType
    if (item.referenceType === "COMMUNITY_POST" || item.type === "POST_REPORTED" || item.type === "POST_HIDDEN") {
      if (item.referenceId) {
        navigate(`/community/posts/${item.referenceId}`);
      } else {
        navigate(`/community`);
      }
    } else if (item.referenceType === "DOCUMENT") {
      if (item.referenceId) {
        navigate(`/documents/${item.referenceId}`);
      } else {
        navigate(`/documents`);
      }
    } else if (item.referenceType === "CONTRIBUTOR_REQUEST") {
      navigate(`/contributor-status`);
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        top: "48px",
        right: "0",
        width: "360px",
        maxHeight: "480px",
        background: "#FFFFFF",
        borderRadius: "16px",
        boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
        border: "1px solid #E2E8F0",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid #F1F5F9",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#FAFAFA",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: "15px", color: "#0F172A" }}>Thông báo</span>
        <button
          type="button"
          onClick={handleMarkAllRead}
          style={{
            border: "none",
            background: "none",
            color: "#6366F1",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Đánh dấu tất cả đã đọc
        </button>
      </div>

      {/* Body List */}
      <div style={{ flex: 1, overflowY: "auto", maxHeight: "380px" }}>
        {loading && notifications.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>
            Đang tải thông báo...
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: "32px 16px", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>
            Bạn chưa có thông báo nào
          </div>
        ) : (
          notifications.map((item) => (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              style={{
                padding: "12px 16px",
                display: "flex",
                gap: "12px",
                alignItems: "flex-start",
                background: item.isRead ? "#FFFFFF" : "#F0F7FF",
                borderBottom: "1px solid #F1F5F9",
                cursor: "pointer",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = item.isRead ? "#F8FAFC" : "#E2F0FE")}
              onMouseLeave={(e) => (e.currentTarget.style.background = item.isRead ? "#FFFFFF" : "#F0F7FF")}
            >
              {/* Avatar */}
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "#E2E8F0",
                  overflow: "hidden",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  fontSize: "14px",
                  color: "#475569",
                }}
              >
                {item.actorAvatar ? (
                  <img src={item.actorAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  (item.actorName || "S").charAt(0).toUpperCase()
                )}
              </div>

              {/* Message Content */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "13px", color: "#1E293B", lineHeight: "1.4", wordBreak: "break-word" }}>
                  {item.message}
                </div>
                <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                  {formatRelativeTime(item.createdAt)}
                </div>
              </div>

              {/* Unread Dot */}
              {!item.isRead && (
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#007BFF",
                    flexShrink: 0,
                    marginTop: "6px",
                  }}
                />
              )}
            </div>
          ))
        )}

        {hasMore && (
          <button
            type="button"
            onClick={() => {
              const nextPage = page + 1;
              setPage(nextPage);
              fetchNotifications(nextPage);
            }}
            style={{
              width: "100%",
              padding: "10px",
              border: "none",
              background: "#F8FAFC",
              color: "#007BFF",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tải thêm thông báo
          </button>
        )}
      </div>
    </div>
  );
}
