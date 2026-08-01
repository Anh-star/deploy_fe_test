import React, { useState } from "react";
import { reportPost } from "../../api/communityApi";
import { useNotification } from "../../context/NotificationContext";

const REASON_OPTIONS = [
  { code: "SPAM", label: "Spam / Quảng cáo rác" },
  { code: "INAPPROPRIATE", label: "Nội dung không phù hợp / Độc hại" },
  { code: "HARASSMENT", label: "Quấy rối / Xúc phạm người khác" },
  { code: "COPYRIGHT", label: "Vi phạm bản quyền" },
  { code: "OTHER", label: "Lý do khác" },
];

export default function ReportPostModal({ postId, onClose }) {
  const notification = useNotification();
  const [reasonCode, setReasonCode] = useState("SPAM");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reasonCode) {
      notification.error("Vui lòng chọn lý do báo cáo.");
      return;
    }

    setSubmitting(true);
    try {
      await reportPost(postId, { reasonCode, detail: detail.trim() });
      notification.success("Đã gửi báo cáo bài viết thành công. Ban quản trị sẽ sớm xem xét!");
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || "Không thể gửi báo cáo bài viết.";
      notification.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "#FFFFFF",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
            🚩 Báo cáo bài viết
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "none",
              fontSize: "20px",
              color: "#94A3B8",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#334155", marginBottom: "10px" }}>
              Chọn lý do báo cáo bài viết này:
            </label>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {REASON_OPTIONS.map((opt) => (
                <label
                  key={opt.code}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: reasonCode === opt.code ? "2px solid #6366F1" : "1px solid #E2E8F0",
                    background: reasonCode === opt.code ? "#F5F3FF" : "#FFFFFF",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <input
                    type="radio"
                    name="reasonCode"
                    value={opt.code}
                    checked={reasonCode === opt.code}
                    onChange={(e) => setReasonCode(e.target.value)}
                    style={{ accentColor: "#6366F1" }}
                  />
                  <span style={{ fontSize: "14px", color: "#1E293B", fontWeight: reasonCode === opt.code ? 600 : 400 }}>
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#475569", marginBottom: "6px" }}>
              Chi tiết thêm (Tùy chọn):
            </label>
            <textarea
              rows={3}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Mô tả cụ thể hơn lý do bài viết này vi phạm..."
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #CBD5E1",
                outline: "none",
                fontSize: "14px",
                boxSizing: "border-box",
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: "10px",
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#475569",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "8px 20px",
                borderRadius: "10px",
                border: "none",
                background: "#EF4444",
                color: "#FFFFFF",
                fontSize: "14px",
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Đang gửi..." : "Gửi báo cáo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
