import React, { useEffect, useState } from "react";
import { getPostEditHistory } from "../../api/communityApi";
import { formatDateTime } from "../../utils/dateUtils";
import { HistoryIcon, EditIcon, StarIcon } from "../icons";
import "../../styles/community.css";

export default function PostEditHistoryModal({ postId, currentPost, onClose }) {
  const [historyList, setHistoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!postId) return;
    setLoading(true);
    setError(null);
    getPostEditHistory(postId)
      .then((data) => {
        setHistoryList(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Failed to load post edit history:", err);
        setError("Không thể tải lịch sử chỉnh sửa bài viết.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [postId]);

  return (
    <div
      className="cmp-modal-overlay"
      style={{ zIndex: 12000 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cmp-modal-box" style={{ maxWidth: "680px", width: "95%", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        {/* Modal Header */}
        <div className="cmp-modal-header" style={{ borderBottom: "1px solid var(--border-color, #E5E7EB)", padding: "16px 20px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "var(--text-color, #111827)", display: "flex", alignItems: "center", gap: "8px" }}>
              <HistoryIcon size={18} color="#4F46E5" /> Lịch sử chỉnh sửa bài viết
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6B7280" }}>
              Xem nội dung bài viết trước và sau các lần chỉnh sửa
            </p>
          </div>
          <button
            type="button"
            className="cmp-close-btn"
            onClick={onClose}
            style={{ fontSize: "20px", background: "none", border: "none", cursor: "pointer", color: "#6B7280" }}
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#6B7280" }}>
              <div className="cmp-spinner" style={{ margin: "0 auto 12px" }}></div>
              <p>Đang tải lịch sử chỉnh sửa...</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "#EF4444" }}>
              <p>{error}</p>
            </div>
          ) : historyList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#6B7280" }}>
              <p>Bài viết này chưa có bản lưu lịch sử chỉnh sửa nào trước đó.</p>
            </div>
          ) : (
            <div className="post-history-timeline" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Current Version */}
              {currentPost && (
                <div
                  style={{
                    border: "1px solid #3B82F6",
                    borderRadius: "8px",
                    padding: "14px 16px",
                    background: "rgba(59, 130, 246, 0.04)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontWeight: "600", color: "#2563EB", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <StarIcon size={14} color="#2563EB" /> Phiên bản hiện tại (Mới nhất)
                    </span>
                    <span style={{ fontSize: "12px", color: "#6B7280" }}>
                      {currentPost.updatedAt ? formatDateTime(currentPost.updatedAt) : "Hiện tại"}
                    </span>
                  </div>
                  {currentPost.title && (
                    <h4 style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "600", color: "#1F2937" }}>
                      {currentPost.title}
                    </h4>
                  )}
                  <div
                    style={{
                      fontSize: "14px",
                      lineHeight: "1.6",
                      color: "#374151",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {currentPost.content}
                  </div>
                </div>
              )}

              {/* Historical Versions */}
              <div style={{ fontSize: "13px", fontWeight: "600", color: "#4B5563", marginTop: "8px" }}>
                Các phiên bản trước đó ({historyList.length} lần sửa):
              </div>

              {historyList.map((item, idx) => (
                <div
                  key={item.id || idx}
                  style={{
                    border: "1px solid var(--border-color, #E5E7EB)",
                    borderRadius: "8px",
                    padding: "14px 16px",
                    background: "var(--card-bg, #FFFFFF)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          background: "#F3F4F6",
                          color: "#4B5563",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: "600",
                        }}
                      >
                        Bản #{historyList.length - idx}
                      </span>
                      <span style={{ fontSize: "13px", color: "#374151", fontWeight: "500" }}>
                        {item.editorName || "Tác giả"}
                      </span>
                    </div>
                    <span style={{ fontSize: "12px", color: "#6B7280" }}>
                      {item.editedAt ? new Date(item.editedAt).toLocaleString("vi-VN") : ""}
                    </span>
                  </div>
                  {item.title && (
                    <h4 style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: "600", color: "#1F2937" }}>
                      {item.title}
                    </h4>
                  )}
                  <div
                    style={{
                      fontSize: "13px",
                      lineHeight: "1.6",
                      color: "#4B5563",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      background: "#F9FAFB",
                      padding: "10px 12px",
                      borderRadius: "6px",
                    }}
                  >
                    {item.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ borderTop: "1px solid var(--border-color, #E5E7EB)", padding: "12px 20px", display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="cmp-btn cmp-btn-cancel"
            onClick={onClose}
            style={{ padding: "8px 18px" }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
