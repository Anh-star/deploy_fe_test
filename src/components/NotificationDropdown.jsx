import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { getNotifications, markAsRead, markAllAsRead } from "../api/notificationApi";
import { useSSE } from "../hooks/useSSE";
import { formatDateTime, timeAgo } from "../utils/dateUtils";


const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const AlertCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

function formatRelativeTime(dateString) {
  return timeAgo(dateString);
}


export default function NotificationDropdown({ onClose, onNotificationRead }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Real-time SSE listener: prepend new notification, update aggregated, or remove on cancel
  useSSE({
    notification: (newNotif) => {
      if (newNotif && newNotif.id) {
        if (newNotif.action === "DELETE") {
          setNotifications((prev) => prev.filter((n) => String(n.id) !== String(newNotif.id)));
        } else {
          setNotifications((prev) => [newNotif, ...prev.filter((n) => String(n.id) !== String(newNotif.id))]);
        }
      }
    },
    "notification-removed": (data) => {
      if (data && data.id) {
        setNotifications((prev) => prev.filter((n) => String(n.id) !== String(data.id)));
      }
    },
  });

  // Detail Pop Up Modal state for reason/note notifications
  const [detailModal, setDetailModal] = useState({
    open: false,
    notification: null,
  });

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

  // Helper to parse message, reason & contact string robustly
  const parseMessageAndReason = (rawMessage = "") => {
    if (!rawMessage) return { mainMsg: "", reasonText: "", contactText: "", isNote: false };
    
    let contactText = "";
    let workStr = rawMessage;

    const contactRegex = /\.?\s*(Vui lòng liên hệ[^\n]*|\(Vui lòng liên hệ[^\n]*\)|Nếu có thắc mắc[^\n]*)/i;
    const contactMatch = workStr.match(contactRegex);
    if (contactMatch) {
      contactText = contactMatch[1].replace(/^[.\s()]+|[.\s()]+$/g, "").trim();
      workStr = workStr.replace(contactRegex, "").trim();
    }

    const match = workStr.match(/(?:(ghi chú|ghi chu|note)|lý do|ly do|lý do vi phạm|reason)\s*[:：]\s*(.*)/i);
    if (match && match[2]?.trim()) {
      return {
        mainMsg: workStr.substring(0, match.index).replace(/[.\s]+$/, "").trim(),
        reasonText: match[2].replace(/[.\s]+$/, "").trim(),
        contactText,
        isNote: Boolean(match[1]),
      };
    }

    return {
      mainMsg: workStr.replace(/[.\s]+$/, "").trim(),
      reasonText: "",
      contactText,
      isNote: false,
    };
  };

  const navigateByItem = (item) => {
    setDetailModal({ open: false, notification: null });
    onClose();
    if (
      item.referenceType === "DOCUMENT" ||
      item.type === "DOCUMENT_COMMENTED" ||
      item.type === "DOCUMENT_APPROVED" ||
      item.type === "DOCUMENT_REJECTED"
    ) {
      if (item.type === "DOCUMENT_REJECTED") {
        navigate(item.referenceId ? `/documents/submitted/${item.referenceId}` : `/manage-documents`);
      } else {
        navigate(item.referenceId ? `/documents/${item.referenceId}` : `/documents`);
      }
    } else if (
      item.referenceType === "COMMUNITY_POST" ||
      item.type === "POST_REPORTED" ||
      item.type === "POST_COMMENTED" ||
      item.type === "COMMENT_REPLIED" ||
      item.type === "COMMENT_LIKED" ||
      item.type === "POST_UPVOTED"
    ) {
      if (item.referenceId) {
        if (item.referenceId.includes("?")) {
          const [pid, query] = item.referenceId.split("?");
          navigate(`/community?postId=${pid}&${query}`);
        } else {
          navigate(`/community?postId=${item.referenceId}`);
        }
      } else {
        navigate(`/community`);
      }
    } else if (item.referenceType === "CONTRIBUTOR_REQUEST") {
      navigate(`/contributor-status`);
    } else if (item.referenceType === "WITHDRAWAL") {
      navigate(`/contributor/withdrawals`);
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

    // Show reason/note pop-up modal for rejection, moderation, and approval with note
    const parsed = parseMessageAndReason(item.message);
    const shouldShowModal =
      item.type === "POST_HIDDEN" ||
      item.type === "POST_DELETED" ||
      item.type === "REPORT_DISMISSED" ||
      item.type === "DOCUMENT_REJECTED" ||
      item.type === "WITHDRAWAL_REJECTED" ||
      (parsed.reasonText && (item.type === "DOCUMENT_APPROVED" || item.type === "WITHDRAWAL_APPROVED"));

    if (shouldShowModal) {
      setDetailModal({
        open: true,
        notification: item,
      });
      return;
    }

    navigateByItem(item);
  };

  return (
    <>
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
            notifications.map((item) => {
              const { mainMsg, reasonText, isNote } = parseMessageAndReason(item.message);
              return (
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
                      {mainMsg || item.message}
                    </div>

                    {/* Note / Reason inline badge */}
                    {reasonText ? (
                      <div
                        style={{
                          marginTop: "6px",
                          padding: "4px 8px",
                          background: isNote ? "#F0FDF4" : "#FEF2F2",
                          border: `1px solid ${isNote ? "#BBF7D0" : "#FECACA"}`,
                          borderRadius: "6px",
                          fontSize: "12px",
                          color: isNote ? "#166534" : "#991B1B",
                          lineHeight: "1.3",
                          wordBreak: "break-word",
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{isNote ? "📝 Ghi chú: " : "📌 Lý do: "}</span>
                        {reasonText}
                      </div>
                    ) : null}

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
              );
            })
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

      {/* Reason / Note Notification Pop Up Modal mounted directly onto document.body via Portal */}
      {detailModal.open &&
        detailModal.notification &&
        createPortal(
          <div
            className="notification-detail-portal-modal"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(15, 23, 42, 0.65)",
              backdropFilter: "blur(4px)",
              zIndex: 999999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "480px",
                background: "#FFFFFF",
                borderRadius: "18px",
                padding: "24px",
                boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2), 0 8px 10px -6px rgba(0,0,0,0.1)",
                userSelect: "text",
                WebkitUserSelect: "text",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                  {detailModal.notification.type === "POST_HIDDEN" ? (
                    <>
                      <LockIcon /> Thông báo Bài viết bị ẩn
                    </>
                  ) : detailModal.notification.type === "POST_DELETED" ? (
                    <>
                      <TrashIcon /> Thông báo Bài viết đã bị xóa
                    </>
                  ) : detailModal.notification.type === "REPORT_DISMISSED" ? (
                    <>
                      <ShieldIcon /> Phản hồi Báo cáo bài viết
                    </>
                  ) : detailModal.notification.type === "DOCUMENT_APPROVED" ? (
                    <>
                      <CheckCircleIcon /> Thông báo Tài liệu được duyệt
                    </>
                  ) : detailModal.notification.type === "DOCUMENT_REJECTED" ? (
                    <>
                      <AlertCircleIcon /> Thông báo Từ chối tài liệu
                    </>
                  ) : detailModal.notification.type === "WITHDRAWAL_APPROVED" ? (
                    <>
                      <CheckCircleIcon /> Thông báo Yêu cầu rút tiền
                    </>
                  ) : detailModal.notification.type === "WITHDRAWAL_REJECTED" ? (
                    <>
                      <AlertCircleIcon /> Thông báo Từ chối rút tiền
                    </>
                  ) : (
                    <>
                      <ShieldIcon /> Chi tiết thông báo
                    </>
                  )}
                </h3>
                <button
                  type="button"
                  onClick={() => setDetailModal({ open: false, notification: null })}
                  style={{ border: "none", background: "none", fontSize: "20px", color: "#94A3B8", cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>

              {/* Modal Content Box */}
              {(() => {
                const { mainMsg, reasonText, contactText, isNote } = parseMessageAndReason(detailModal.notification.message);
                const isDismissed = detailModal.notification.type === "REPORT_DISMISSED" || detailModal.notification.type === "DOCUMENT_APPROVED" || detailModal.notification.type === "WITHDRAWAL_APPROVED";
                const isPostHidden = detailModal.notification.type === "POST_HIDDEN";

                return (
                  <div
                    style={{
                      background: isDismissed ? "#F8FAFC" : "#FEF2F2",
                      border: `1px solid ${isDismissed ? "#E2E8F0" : "#FECACA"}`,
                      borderRadius: "12px",
                      padding: "16px",
                      marginBottom: "20px",
                    }}
                  >
                    {/* Main Notice */}
                    <p style={{ fontSize: "14px", color: "#1E293B", margin: 0, lineHeight: "1.5", fontWeight: 600 }}>
                      {mainMsg}
                    </p>

                    {/* Reason / Note Highlight Box */}
                    {reasonText ? (
                      <div
                        style={{
                          marginTop: "12px",
                          padding: "12px",
                          background: "#FFFFFF",
                          border: `1px solid ${isNote ? "#BBF7D0" : isDismissed ? "#CBD5E1" : "#FCA5A5"}`,
                          borderRadius: "8px",
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: "13px", color: isNote ? "#166534" : isDismissed ? "#334155" : "#991B1B", marginBottom: "4px" }}>
                          {isNote ? "📝 Ghi chú từ ban quản trị:" : "📌 Lý do xử lý:"}
                        </div>
                        <div style={{ fontSize: "14px", color: "#1E293B", lineHeight: "1.4", userSelect: "text", WebkitUserSelect: "text" }}>
                          {reasonText}
                        </div>
                      </div>
                    ) : null}

                    {/* Contact & Appeals Box */}
                    {(contactText || isPostHidden) && (
                      <div
                        style={{
                          marginTop: "12px",
                          padding: "12px",
                          background: "#EFF6FF",
                          border: "1px solid #BFDBFE",
                          borderRadius: "8px",
                          fontSize: "13px",
                          color: "#1E40AF",
                          lineHeight: "1.4",
                        }}
                      >
                        ✉️ <strong>Thắc mắc &amp; Khiếu nại:</strong>{" "}
                        {contactText ? contactText : "Vui lòng liên hệ tới email của Admin nếu bạn có thắc mắc hoặc khiếu nại."}
                      </div>
                    )}

                    {/* Timestamp */}
                    <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "12px" }}>
                      Thời gian: {formatDateTime(detailModal.notification.createdAt)}
                    </div>

                  </div>
                );
              })()}

              {/* Modal Footer */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setDetailModal({ open: false, notification: null });
                  }}
                  style={{
                    padding: "9px 20px",
                    borderRadius: "10px",
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    color: "#475569",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Đóng
                </button>

                {/* Direct Action Button if referenceId exists */}
                {detailModal.notification.referenceType === "DOCUMENT" || detailModal.notification.referenceType === "WITHDRAWAL" ? (
                  <button
                    type="button"
                    onClick={() => navigateByItem(detailModal.notification)}
                    style={{
                      padding: "9px 20px",
                      borderRadius: "10px",
                      border: "none",
                      background: "#2563EB",
                      color: "#FFFFFF",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {detailModal.notification.referenceType === "DOCUMENT"
                      ? (detailModal.notification.type === "DOCUMENT_REJECTED" ? "Xem chi tiết tài liệu" : "Xem tài liệu")
                      : "Xem lịch sử rút tiền"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

