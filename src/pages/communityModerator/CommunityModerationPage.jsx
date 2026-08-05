import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  getReportedPosts,
  resolveReport,
  dismissReport,
  hidePost,
  unhidePost,
  moderatorDeletePost,
} from "../../api/communityApi";
import { useNotification } from "../../context/NotificationContext";
import "../../styles/communityModerationPage.css";

const REASON_LABELS = {
  SPAM: "Spam / Quảng cáo rác",
  INAPPROPRIATE: "Nội dung không phù hợp",
  HARASSMENT: "Quấy rối / Xúc phạm",
  COPYRIGHT: "Vi phạm bản quyền",
  OTHER: "Lý do khác",
};

// Modern SVG Icons
const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const UnlockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
);

const DismissIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const FlagIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const LockCircleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

const FlameIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2c0 4-4 6-4 10 0 3.3 2.7 6 6 6s6-2.7 6-6c0-3.5-3-5.5-3-8 0 0-2 2-2 4 0-1.7-1-4-3-6z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

function ModerationReasonModal({ open, title, prompt, confirmLabel, isDanger, onConfirm, onCancel }) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(reason.trim());
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
      onClick={onCancel}
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
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            style={{ border: "none", background: "none", fontSize: "20px", color: "#94A3B8", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <p style={{ fontSize: "14px", color: "#475569", marginTop: 0, marginBottom: "12px", lineHeight: "1.4" }}>
            {prompt}
          </p>
          <textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Nhập lý do chi tiết..."
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid #CBD5E1",
              outline: "none",
              fontSize: "14px",
              boxSizing: "border-box",
              resize: "vertical",
              marginBottom: "20px",
            }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              type="button"
              onClick={onCancel}
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
              style={{
                padding: "8px 20px",
                borderRadius: "10px",
                border: "none",
                background: isDanger ? "#EF4444" : "#4F46E5",
                color: "#FFFFFF",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {confirmLabel || "Xác nhận"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CommunityModerationPage() {
  const navigate = useNavigate();
  const notification = useNotification();
  const [activeTab, setActiveTab] = useState("PENDING"); // PENDING | RESOLVED | DISMISSED
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [expandedPosts, setExpandedPosts] = useState({});

  // Reason Dialog Modal state
  const [reasonModal, setReasonModal] = useState({
    open: false,
    actionType: null, // "HIDE" | "DELETE" | "DISMISS_GROUP"
    targetId: null,
    title: "",
    prompt: "",
    confirmLabel: "",
    isDanger: false,
  });

  const fetchReports = async (tabStatus = activeTab, pageNum = 0) => {
    setLoading(true);
    try {
      const data = await getReportedPosts(tabStatus, pageNum, 10);
      if (data) {
        setReports((data.content || []).filter(Boolean));
      }
    } catch (err) {
      notification.error("Không thể tải danh sách báo cáo bài viết.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports(activeTab, 0);
  }, [activeTab]);

  // Group raw report items by Post ID
  const groupedPosts = useMemo(() => {
    const map = new Map();
    reports.forEach((item) => {
      const key = item.postId || item.id;
      if (!map.has(key)) {
        map.set(key, {
          postId: item.postId,
          postTitle: item.postTitle,
          postContent: item.postContent,
          postAuthorName: item.postAuthorName,
          isPostHidden: Boolean(item.isPostHidden),
          reportsList: [item],
        });
      } else {
        const existing = map.get(key);
        existing.reportsList.push(item);
        if (item.isPostHidden) existing.isPostHidden = true;
      }
    });
    return Array.from(map.values());
  }, [reports]);

  const toggleExpand = (postId) => {
    setExpandedPosts((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  // Open Reason Box Modal for Hide, Delete, or Dismiss Group
  const promptHidePost = (postId) => {
    setReasonModal({
      open: true,
      actionType: "HIDE",
      targetId: postId,
      title: "Ẩn bài viết khỏi cộng đồng",
      prompt: "Vui lòng nhập lý do ẩn bài viết (thông báo lý do này sẽ được gửi tới người đăng bài):",
      confirmLabel: "Xác nhận Ẩn bài",
      isDanger: false,
    });
  };

  const promptDeletePost = (postId) => {
    setReasonModal({
      open: true,
      actionType: "DELETE",
      targetId: postId,
      title: "Xóa vĩnh viễn bài viết",
      prompt: "Vui lòng nhập lý do xóa bài viết (thông báo lý do này sẽ được gửi tới người đăng bài):",
      confirmLabel: "Xóa vĩnh viễn",
      isDanger: true,
    });
  };

  const promptDismissReportGroup = (group) => {
    const reportIds = group.reportsList.map((r) => r.id).filter(Boolean);
    setReasonModal({
      open: true,
      actionType: "DISMISS_GROUP",
      targetId: reportIds,
      title: "Từ chối / Bỏ qua báo cáo",
      prompt: "Vui lòng nhập lý do bỏ qua báo cáo (thông báo lý do này sẽ được gửi tới người gửi tố cáo):",
      confirmLabel: "Xác nhận Bỏ qua",
      isDanger: false,
    });
  };

  const handleConfirmReason = async (reason) => {
    const { actionType, targetId } = reasonModal;
    setReasonModal((prev) => ({ ...prev, open: false }));

    try {
      if (actionType === "HIDE") {
        await hidePost(targetId, reason);
        notification.success("Đã ẩn bài viết và gửi lý do cho tác giả.");
        setReports((prev) =>
          prev.map((r) => (r.postId === targetId ? { ...r, isPostHidden: true } : r))
        );
      } else if (actionType === "DELETE") {
        await moderatorDeletePost(targetId, reason);
        notification.success("Đã xóa bài viết và gửi lý do cho tác giả.");
        setReports((prev) => prev.filter((r) => r.postId !== targetId));
      } else if (actionType === "DISMISS_GROUP") {
        const ids = Array.isArray(targetId) ? targetId : [targetId];
        await Promise.all(ids.map((id) => dismissReport(id, reason)));
        notification.success("Đã bỏ qua báo cáo và gửi lý do cho người tố cáo.");
      }
      fetchReports(activeTab, page);
    } catch (err) {
      notification.error(err?.response?.data?.message || "Thao tác thất bại.");
    }
  };

  const handleUnhidePost = async (postId) => {
    try {
      await unhidePost(postId);
      notification.success("Đã hiện lại bài viết.");
      setReports((prev) =>
        prev.map((r) => (r.postId === postId ? { ...r, isPostHidden: false } : r))
      );
      fetchReports(activeTab, page);
    } catch {
      notification.error("Không thể hiện bài viết.");
    }
  };

  const hiddenPostsCount = useMemo(() => {
    const uniqueHidden = new Set(
      reports.filter((r) => r.isPostHidden).map((r) => r.postId)
    );
    return uniqueHidden.size;
  }, [reports]);

  return (
    <div className="cmp-container">
      {/* Metric Cards */}
      <div className="cmp-stats-grid">
        <div className="cmp-stat-card">
          <div className="cmp-stat-icon pending">
            <FlagIcon />
          </div>
          <div className="cmp-stat-info">
            <h3>{groupedPosts.length}</h3>
            <p>Bài viết bị báo cáo</p>
          </div>
        </div>

        <div className="cmp-stat-card">
          <div className="cmp-stat-icon hidden">
            <LockCircleIcon />
          </div>
          <div className="cmp-stat-info">
            <h3>{hiddenPostsCount}</h3>
            <p>Bài viết đang bị ẩn</p>
          </div>
        </div>

        <div className="cmp-stat-card">
          <div className="cmp-stat-icon resolved">
            <ShieldIcon />
          </div>
          <div className="cmp-stat-info">
            <h3>{reports.length}</h3>
            <p>Tổng số lượt báo cáo</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="cmp-tabs-wrapper">
        {[
          { key: "PENDING", label: "Chờ xử lý" },
          { key: "RESOLVED", label: "Đã xử lý" },
          { key: "DISMISSED", label: "Đã bỏ qua" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`cmp-tab-btn ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => {
              setActiveTab(tab.key);
              setPage(0);
            }}
          >
            <span>{tab.label}</span>
            {activeTab === tab.key && groupedPosts.length > 0 && (
              <span className="cmp-tab-badge">{groupedPosts.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Reports Table Card */}
      <div className="cmp-table-card">
        {loading ? (
          <div className="cmp-state-box">
            <div className="cmp-state-icon">⏳</div>
            <div>Đang tải danh sách báo cáo...</div>
          </div>
        ) : groupedPosts.length === 0 ? (
          <div className="cmp-state-box">
            <div className="cmp-state-icon"><CheckCircleIcon /></div>
            <div>Không có báo cáo nào ở trạng thái này.</div>
          </div>
        ) : (
          <table className="cmp-table">
            <thead>
              <tr>
                <th>Bài viết</th>
                <th>Tác giả</th>
                <th>Lý do</th>
                <th style={{ whiteSpace: "nowrap" }}>Số lượt báo cáo</th>
                <th style={{ whiteSpace: "nowrap" }}>Trạng thái</th>
                <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {groupedPosts.map((group) => {
                const isExpanded = Boolean(expandedPosts[group.postId]);
                const uniqueReasons = Array.from(
                  new Set(group.reportsList.map((r) => r.reasonCode).filter(Boolean))
                );

                return (
                  <React.Fragment key={group.postId}>
                    <tr
                      style={{ cursor: "pointer", transition: "background 0.15s ease" }}
                      onClick={() => toggleExpand(group.postId)}
                    >
                      {/* Bài viết */}
                      <td className="cmp-post-cell">
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            style={{
                              fontSize: "12px",
                              color: "#6366F1",
                              display: "inline-block",
                              transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                              transition: "transform 0.2s ease",
                            }}
                          >
                            ▶
                          </span>
                          <div
                            className="cmp-post-title"
                            style={{ fontWeight: 700, color: "#1E293B" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/community/posts/${group.postId}?fromTab=${activeTab}`);
                            }}
                            title="Xem chi tiết bài viết này"
                          >
                            {group.postTitle || "Bài viết thảo luận"}
                          </div>
                        </div>
                        <div className="cmp-post-snippet" style={{ marginLeft: "20px" }}>
                          {group.postContent?.replace(/<[^>]+>/g, "")}
                        </div>
                      </td>

                      {/* Tác giả */}
                      <td>
                        <div className="cmp-user-pill">
                          <div className="cmp-avatar-small">
                            {(group.postAuthorName || "A").charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, color: "#1E293B" }}>
                            {group.postAuthorName || "Tác giả"}
                          </span>
                        </div>
                      </td>

                      {/* Lý do (Gộp các lý do của bài viết) */}
                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          {uniqueReasons.map((code) => (
                            <span key={code} className={`cmp-reason-tag ${code}`}>
                              {REASON_LABELS[code] || code}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Số lượt báo cáo */}
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span className="cmp-count-badge">
                          <FlameIcon /> {group.reportsList.length} báo cáo
                        </span>
                      </td>

                      {/* Trạng thái Bài */}
                      <td style={{ whiteSpace: "nowrap" }}>
                        {group.isPostHidden ? (
                          <span className="cmp-status-badge hidden" style={{ whiteSpace: "nowrap" }}>
                            <LockIcon /> Đã ẩn
                          </span>
                        ) : (
                          <span className="cmp-status-badge visible" style={{ whiteSpace: "nowrap" }}>
                            <EyeIcon /> Hiển thị
                          </span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td style={{ whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                        <div className="cmp-actions">
                          <button
                            type="button"
                            className="cmp-btn cmp-btn-view"
                            onClick={() => navigate(`/community/posts/${group.postId}?fromTab=${activeTab}`)}
                            title="Xem chi tiết và kiểm duyệt bài viết này"
                          >
                            <EyeIcon />
                            <span>Xem bài</span>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable sub-list of individual reports (List only) */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} style={{ background: "#F8FAFC", padding: "12px 16px" }}>
                          <div style={{ fontWeight: 700, fontSize: "13px", color: "#334155", marginBottom: "8px" }}>
                            📋 Danh sách chi tiết các báo cáo ({group.reportsList.length}):
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {group.reportsList.map((item, idx) => (
                              <div
                                key={item.id || idx}
                                style={{
                                  background: "#FFFFFF",
                                  border: "1px solid #E2E8F0",
                                  borderRadius: "8px",
                                  padding: "10px 14px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: "12px",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%" }}>
                                  <div className="cmp-user-pill">
                                    <div className="cmp-avatar-small" style={{ background: "#EEF2FF", color: "#4F46E5" }}>
                                      {(item.reporterName || "R").charAt(0).toUpperCase()}
                                    </div>
                                    <span style={{ fontWeight: 600, fontSize: "13px", color: "#1E293B" }}>
                                      {item.reporterName || "Người báo cáo"}
                                    </span>
                                  </div>

                                  <span className={`cmp-reason-tag ${item.reasonCode || "OTHER"}`}>
                                    {REASON_LABELS[item.reasonCode] || item.reasonCode}
                                  </span>

                                  {item.detail && (
                                    <span style={{ fontSize: "13px", color: "#475569", fontStyle: "italic" }}>
                                      "{item.detail}"
                                    </span>
                                  )}

                                  <span style={{ fontSize: "12px", color: "#94A3B8", marginLeft: "auto", whiteSpace: "nowrap" }}>
                                    {item.createdAt ? new Date(item.createdAt).toLocaleString("vi-VN") : ""}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Moderation Reason Modal */}
      <ModerationReasonModal
        open={reasonModal.open}
        title={reasonModal.title}
        prompt={reasonModal.prompt}
        confirmLabel={reasonModal.confirmLabel}
        isDanger={reasonModal.isDanger}
        onConfirm={handleConfirmReason}
        onCancel={() => setReasonModal((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
