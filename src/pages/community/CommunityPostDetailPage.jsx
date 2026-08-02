import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPostById, hidePost, unhidePost, moderatorDeletePost } from "../../api/communityApi";
import PostCard from "../../components/community/PostCard";
import JustChatWidget from "../../components/common/JustChatWidget";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import ConfirmDialog from "../../components/community/ConfirmDialog";
import "../../styles/community.css";

export default function CommunityPostDetailPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const notification = useNotification();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const isModerator = roles.includes("COMMUNITY_MODERATOR") || roles.includes("ADMIN");

  const fetchPost = async () => {
    if (!postId) return;
    setLoading(true);
    setError("");
    try {
      const data = await getPostById(postId);
      if (data) {
        setPost(data);
      } else {
        setError("Không tìm thấy bài viết.");
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Bài viết không tồn tại hoặc đã bị ẩn.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPost();
  }, [postId]);

  const handlePostDeleted = () => {
    notification.success("Đã xóa bài viết.");
    navigate(-1);
  };

  const handlePostUpdated = (updatedPost) => {
    setPost(updatedPost);
  };

  const handleToggleHide = async () => {
    if (!post) return;
    try {
      if (post.isHidden) {
        await unhidePost(post.id);
        notification.success("Đã hiện lại bài viết.");
      } else {
        await hidePost(post.id);
        notification.success("Đã ẩn bài viết.");
      }
      fetchPost();
    } catch {
      notification.error("Không thể thay đổi trạng thái bài viết.");
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const executeDelete = async () => {
    if (!post) return;
    setShowDeleteConfirm(false);
    try {
      await moderatorDeletePost(post.id);
      notification.success("Đã xóa bài viết.");
      navigate(-1);
    } catch {
      notification.error("Không thể xóa bài viết.");
    }
  };

  const isAuthor = user?.id && post?.authorId === user?.id;

  return (
    <div className="community-page-layout">
      <JustChatWidget />

      <main className="community-main-container" style={{ maxWidth: "800px", margin: "24px auto", padding: "0 16px" }}>
        {/* Navigation Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "10px",
              border: "1px solid #E2E8F0",
              background: "#FFFFFF",
              color: "#475569",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            ← Quay lại
          </button>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#64748B" }}>
            Chi tiết bài viết thảo luận
          </span>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ background: "#FFFFFF", padding: "40px", borderRadius: "16px", textAlign: "center", color: "#64748B" }}>
            ⏳ Đang tải thông tin bài viết...
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div
            style={{
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              borderRadius: "16px",
              padding: "32px",
              textAlign: "center",
              color: "#DC2626",
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔒</div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px" }}>Không thể truy cập bài viết</h3>
            <p style={{ fontSize: "14px", color: "#7F1D1D", margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Post Detail Card */}
        {!loading && !error && post && (
          <>
            {/* Moderator Action Banner */}
            {isModerator && (
              <div
                style={{
                  background: post.isHidden ? "#FEF2F2" : "#EFF6FF",
                  border: `1px solid ${post.isHidden ? "#FECACA" : "#BFDBFE"}`,
                  borderRadius: "14px",
                  padding: "16px 20px",
                  marginBottom: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: post.isHidden ? "#DC2626" : "#1D4ED8", fontSize: "14px" }}>
                    {post.isHidden ? "🔒 Bài viết đang bị ẩn bởi Quản trị viên" : "🛡️ Chế độ Kiểm duyệt bài viết"}
                  </div>
                  <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>
                    Bạn đang xem bài viết này dưới quyền hạn Kiểm duyệt viên cộng đồng.
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={handleToggleHide}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      border: "none",
                      background: post.isHidden ? "#16A34A" : "#F59E0B",
                      color: "#FFFFFF",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {post.isHidden ? "🔓 Hiện bài viết" : "🔒 Ẩn bài viết"}
                  </button>

                  <button
                    type="button"
                    onClick={handleDelete}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      border: "none",
                      background: "#EF4444",
                      color: "#FFFFFF",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    🗑️ Xóa bài
                  </button>
                </div>
              </div>
            )}

            {/* Author Notice Banner when post is hidden */}
            {post.isHidden && !isModerator && isAuthor && (
              <div
                style={{
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: "14px",
                  padding: "14px 18px",
                  marginBottom: "20px",
                  color: "#DC2626",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                🔒 Bài viết này của bạn đã bị Quản trị viên ẩn khỏi Bảng tin chung của cộng đồng.
              </div>
            )}

            {/* Post View */}
            <PostCard
              post={post}
              onPostDeleted={handlePostDeleted}
              onPostUpdated={handlePostUpdated}
              hideOptionsMenu={post.isHidden || post.isReported || (post.reportCount && post.reportCount > 0)}
            />
          </>
        )}
      </main>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Xóa bài viết"
        message="Bạn có chắc chắn muốn xóa bài viết này khỏi cộng đồng không? Hành động này không thể hoàn tác."
        confirmLabel="Xóa bài viết"
        danger
        onConfirm={executeDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
