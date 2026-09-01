import React, { useEffect, useState } from "react";
import { formatDateTime, timeAgo } from "../../utils/dateUtils";
import { HistoryIcon, EditIcon } from "../icons";
import AutoLinkText from "../AutoLinkText";

export default function CommentEditHistoryModal({
  commentId,
  currentComment,
  fetchHistory,
  onClose,
}) {
  const [historyList, setHistoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeImage, setActiveImage] = useState(null);

  useEffect(() => {
    if (!commentId || !fetchHistory) return;
    setLoading(true);
    setError(null);
    fetchHistory(commentId)
      .then((data) => {
        setHistoryList(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Failed to load comment edit history:", err);
        setError("Không thể tải lịch sử chỉnh sửa bình luận.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [commentId, fetchHistory]);

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (activeImage) {
          setActiveImage(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeImage, onClose]);

  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    try {
      const d = new Date(timeStr);
      if (isNaN(d.getTime())) return timeStr;
      return d.toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return timeStr;
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        zIndex: 12000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "580px",
          maxHeight: "85vh",
          background: "#FFFFFF",
          borderRadius: "16px",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            borderBottom: "1px solid #E2E8F0",
            padding: "16px 20px",
            background: "#F8FAFC",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: "700",
                color: "#0F172A",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <HistoryIcon size={18} color="#2563EB" /> Lịch sử chỉnh sửa bình luận
            </h3>
            <p style={{ margin: "3px 0 0", fontSize: "12.5px", color: "#64748B" }}>
              Xem nội dung của bình luận qua các lần chỉnh sửa
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: "20px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#64748B",
              padding: "4px 8px",
              borderRadius: "8px",
            }}
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#64748B", fontSize: "14px" }}>
              Đang tải lịch sử chỉnh sửa...
            </div>
          ) : error ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "#EF4444", fontSize: "14px" }}>
              {error}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Current Version */}
              {currentComment && (
                <div
                  style={{
                    border: "1.5px solid #2563EB",
                    borderRadius: "12px",
                    padding: "14px",
                    background: "#F8FAFC",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#2563EB",
                        backgroundColor: "#EFF6FF",
                        padding: "2px 8px",
                        borderRadius: "6px",
                      }}
                    >
                      Phiên bản hiện tại
                    </span>
                    <span style={{ fontSize: "12px", color: "#64748B" }}>
                      {formatTime(currentComment.updatedAt || currentComment.createdAt)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      color: "#1E293B",
                      lineHeight: "1.5",
                      wordBreak: "break-word",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    <AutoLinkText text={currentComment.body} />
                  </div>
                  {/* Current images */}
                  {Array.isArray(currentComment.imageUrls) && currentComment.imageUrls.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px",
                        marginTop: "10px",
                      }}
                    >
                      {currentComment.imageUrls.map((url, idx) => (
                        <img
                          key={idx}
                          src={url}
                          alt=""
                          onClick={() => setActiveImage(url)}
                          style={{
                            width: "72px",
                            height: "72px",
                            objectFit: "cover",
                            borderRadius: "8px",
                            border: "1px solid #E2E8F0",
                            cursor: "pointer",
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* History list */}
              {historyList.length === 0 ? (
                <div style={{ textAlign: "center", padding: "16px 0", color: "#64748B", fontSize: "13px" }}>
                  Chưa có thông tin phiên bản cũ nào được ghi nhận.
                </div>
              ) : (
                historyList.map((item, index) => (
                  <div
                    key={item.id || index}
                    style={{
                      border: "1px solid #E2E8F0",
                      borderRadius: "12px",
                      padding: "14px",
                      background: "#FFFFFF",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "8px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: "600",
                          color: "#475569",
                          backgroundColor: "#F1F5F9",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <EditIcon size={12} /> Phiên bản trước #{historyList.length - index}
                      </span>
                      <span style={{ fontSize: "12px", color: "#64748B" }}>
                        {formatTime(item.editedAt)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        color: "#334155",
                        lineHeight: "1.5",
                        wordBreak: "break-word",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      <AutoLinkText text={item.previousBody} />
                    </div>
                    {/* Previous images */}
                    {Array.isArray(item.previousImageUrls) && item.previousImageUrls.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "8px",
                          marginTop: "10px",
                        }}
                      >
                        {item.previousImageUrls.map((url, imgIdx) => (
                          <img
                            key={imgIdx}
                            src={url}
                            alt=""
                            onClick={() => setActiveImage(url)}
                            style={{
                              width: "72px",
                              height: "72px",
                              objectFit: "cover",
                              borderRadius: "8px",
                              border: "1px solid #E2E8F0",
                              cursor: "pointer",
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            borderTop: "1px solid #E2E8F0",
            padding: "12px 20px",
            background: "#F8FAFC",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "7px 16px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              background: "#FFFFFF",
              color: "#334155",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Lightbox Preview */}
      {activeImage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            zIndex: 13000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setActiveImage(null)}
        >
          <img
            src={activeImage}
            alt=""
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              objectFit: "contain",
              borderRadius: "8px",
            }}
          />
        </div>
      )}
    </div>
  );
}
