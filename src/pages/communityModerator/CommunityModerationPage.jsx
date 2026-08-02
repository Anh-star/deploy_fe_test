import React, { useEffect, useState } from "react";
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
import ConfirmDialog from "../../components/community/ConfirmDialog";
import "../../styles/communityModerationPage.css";

const REASON_LABELS = {
  SPAM: "Spam / Quảng cáo rác",
  INAPPROPRIATE: "Nội dung không phù hợp",
  HARASSMENT: "Quấy rối / Xúc phạm",
  COPYRIGHT: "Vi phạm bản quyền",
  OTHER: "Lý do khác",
};

export default function CommunityModerationPage() {
  const navigate = useNavigate();
  const notification = useNotification();
  const [activeTab, setActiveTab] = useState("PENDING"); // PENDING | RESOLVED | DISMISSED
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [postToDelete, setPostToDelete] = useState(null);

  const fetchReports = async (tabStatus = activeTab, pageNum = 0) => {
    setLoading(true);
    try {
      const data = await getReportedPosts(tabStatus, pageNum, 10);
      if (data) {
        setReports((data.content || []).filter(Boolean));
        setTotalPages(data.totalPages || 0);
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

  const handleResolve = async (reportId) => {
    try {
      await resolveReport(reportId);
      notification.success("Đã đánh dấu báo cáo là đã xử lý.");
      fetchReports(activeTab, page);
    } catch {
      notification.error("Không thể cập nhật báo cáo.");
    }
  };

  const handleDismiss = async (reportId) => {
    try {
      await dismissReport(reportId);
      notification.success("Đã bỏ qua báo cáo.");
      fetchReports(activeTab, page);
    } catch {
      notification.error("Không thể cập nhật báo cáo.");
    }
  };

  const handleHidePost = async (postId) => {
    try {
      await hidePost(postId);
      notification.success("Đã ẩn bài viết khỏi bảng tin cộng đồng.");
      setReports((prev) =>
        prev.map((r) => (r.postId === postId ? { ...r, isPostHidden: true } : r))
      );
      fetchReports(activeTab, page);
    } catch {
      notification.error("Không thể ẩn bài viết.");
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

  const handleDeletePost = (postId) => {
    setPostToDelete(postId);
  };

  const executeDeletePost = async () => {
    if (!postToDelete) return;
    const postId = postToDelete;
    setPostToDelete(null);
    try {
      await moderatorDeletePost(postId);
      notification.success("Đã xóa bài viết khỏi cộng đồng.");
      setReports((prev) => prev.filter((r) => r.postId !== postId));
      fetchReports(activeTab, page);
    } catch {
      notification.error("Không thể xóa bài viết.");
    }
  };

  return (
    <div className="cmp-container">
      {/* Metric Cards */}
      <div className="cmp-stats-grid">
        <div className="cmp-stat-card">
          <div className="cmp-stat-icon pending">🚩</div>
          <div className="cmp-stat-info">
            <h3>{reports.length}</h3>
            <p>Báo cáo bài viết</p>
          </div>
        </div>

        <div className="cmp-stat-card">
          <div className="cmp-stat-icon hidden">🔒</div>
          <div className="cmp-stat-info">
            <h3>{reports.filter(r => r.isPostHidden).length}</h3>
            <p>Bài viết đang bị ẩn</p>
          </div>
        </div>

        <div className="cmp-stat-card">
          <div className="cmp-stat-icon resolved">🛡️</div>
          <div className="cmp-stat-info">
            <h3>{activeTab === "RESOLVED" ? reports.length : "Xử lý đàng hoàng"}</h3>
            <p>Trạng thái danh sách</p>
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
            {activeTab === tab.key && reports.length > 0 && (
              <span className="cmp-tab-badge">{reports.length}</span>
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
        ) : reports.length === 0 ? (
          <div className="cmp-state-box">
            <div className="cmp-state-icon">✅</div>
            <div>Không có báo cáo nào ở trạng thái này.</div>
          </div>
        ) : (
          <table className="cmp-table">
            <thead>
              <tr>
                <th>Bài viết bị báo cáo</th>
                <th>Tác giả</th>
                <th>Người báo cáo</th>
                <th>Lý do & Chi tiết</th>
                <th>Số lượt báo cáo</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((item) => (
                <tr key={item.id}>
                  {/* Bài viết */}
                  <td className="cmp-post-cell">
                    <div
                      className="cmp-post-title"
                      style={{ cursor: "pointer", color: "#4F46E5" }}
                      onClick={() => navigate(`/community/posts/${item.postId}`)}
                      title="Bấm để xem duy nhất bài viết này"
                    >
                      {item.postTitle || "Bài viết thảo luận"}
                    </div>
                    <div className="cmp-post-snippet">
                      {item.postContent?.replace(/<[^>]+>/g, "")}
                    </div>
                  </td>

                  {/* Tác giả */}
                  <td>
                    <div className="cmp-user-pill">
                      <div className="cmp-avatar-small">
                        {(item.postAuthorName || "A").charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600, color: "#1E293B" }}>
                        {item.postAuthorName || "Tác giả"}
                      </span>
                    </div>
                  </td>

                  {/* Người báo cáo */}
                  <td>
                    <div className="cmp-user-pill">
                      <div className="cmp-avatar-small" style={{ background: "#F1F5F9", color: "#64748B" }}>
                        {(item.reporterName || "R").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "#1E293B", fontSize: "13px" }}>
                          {item.reporterName || "Người báo cáo"}
                        </div>
                        <div style={{ fontSize: "11px", color: "#94A3B8" }}>
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString("vi-VN") : ""}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Lý do */}
                  <td>
                    <span className={`cmp-reason-tag ${item.reasonCode || "OTHER"}`}>
                      {REASON_LABELS[item.reasonCode] || item.reasonCode}
                    </span>
                    {item.detail && (
                      <div style={{ fontSize: "12px", color: "#475569", fontStyle: "italic", marginTop: "4px" }}>
                        "{item.detail}"
                      </div>
                    )}
                  </td>

                  {/* Số lượt báo cáo */}
                  <td>
                    <span className="cmp-count-badge">
                      🔥 {item.reportCount || 1}
                    </span>
                  </td>

                  {/* Trạng thái Bài */}
                  <td>
                    {item.isPostHidden ? (
                      <span className="cmp-status-badge hidden">
                        🔒 Đã ẩn
                      </span>
                    ) : (
                      <span className="cmp-status-badge visible">
                        🌐 Hiển thị
                      </span>
                    )}
                  </td>

                  {/* Action buttons */}
                  <td>
                    <div className="cmp-actions">
                      <button
                        type="button"
                        className="cmp-btn cmp-btn-dismiss"
                        onClick={() => navigate(`/community/posts/${item.postId}`)}
                        title="Xem duy nhất bài viết này"
                      >
                        👁️ Xem bài
                      </button>

                      {item.isPostHidden ? (
                        <button
                          type="button"
                          className="cmp-btn cmp-btn-unhide"
                          onClick={() => handleUnhidePost(item.postId)}
                        >
                          🔓 Hiện bài
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="cmp-btn cmp-btn-hide"
                          onClick={() => handleHidePost(item.postId)}
                        >
                          🔒 Ẩn bài
                        </button>
                      )}

                      <button
                        type="button"
                        className="cmp-btn cmp-btn-delete"
                        onClick={() => handleDeletePost(item.postId)}
                      >
                        🗑️ Xóa
                      </button>

                      {activeTab === "PENDING" && (
                        <>
                          <button
                            type="button"
                            className="cmp-btn cmp-btn-resolve"
                            onClick={() => handleResolve(item.id)}
                          >
                            ✅ Duyệt
                          </button>

                          <button
                            type="button"
                            className="cmp-btn cmp-btn-dismiss"
                            onClick={() => handleDismiss(item.id)}
                          >
                            ❌ Bỏ qua
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={postToDelete !== null}
        title="Xóa bài viết vĩnh viễn"
        message="Bạn có chắc chắn muốn xóa bài viết này vĩnh viễn khỏi cộng đồng? Hành động này không thể hoàn tác."
        confirmLabel="Xóa vĩnh viễn"
        danger
        onConfirm={executeDeletePost}
        onCancel={() => setPostToDelete(null)}
      />
    </div>
  );
}
