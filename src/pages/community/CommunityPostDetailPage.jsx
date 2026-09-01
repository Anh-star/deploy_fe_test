import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  getPostById,
  hidePost,
  unhidePost,
  dismissPostReports,
  moderatorDeletePost,
} from "../../api/communityApi";
import PostCard from "../../components/community/PostCard";
import JustChatWidget from "../../components/common/JustChatWidget";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { PostCardSkeleton, CommentSkeleton } from "../../components/community/CommunitySkeletons";
import "../../styles/community.css";

// SVG Icons
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

const ShieldIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
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

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 99999,
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
    </div>,
    document.body
  );
}

export default function CommunityPostDetailPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const fromTab = searchParams.get("fromTab");
  const { user } = useAuth();
  const notification = useNotification();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isDismissed, setIsDismissed] = useState(false);

  // Reason Modal State
  const [reasonModal, setReasonModal] = useState({
    open: false,
    actionType: null, // "HIDE" | "DELETE" | "DISMISS"
    title: "",
    prompt: "",
    confirmLabel: "",
    isDanger: false,
  });

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
    if (!isModerator && postId) {
      const commentParam = searchParams.get("commentId");
      navigate(`/community?postId=${postId}${commentParam ? `&commentId=${commentParam}` : ""}`, { replace: true });
      return;
    }
    fetchPost();
  }, [postId, isModerator]);

  const handlePostDeleted = () => {
    notification.success("Đã xóa bài viết.");
    navigate(-1);
  };

  const handlePostUpdated = (updatedPost) => {
    setPost(updatedPost);
  };

  const promptHidePost = () => {
    setReasonModal({
      open: true,
      actionType: "HIDE",
      title: "Ẩn bài viết khỏi cộng đồng",
      prompt: "Vui lòng nhập lý do ẩn bài viết (thông báo lý do này sẽ được gửi tới người đăng bài):",
      confirmLabel: "Xác nhận Ẩn bài",
      isDanger: false,
    });
  };

  const promptDeletePost = () => {
    setReasonModal({
      open: true,
      actionType: "DELETE",
      title: "Xóa vĩnh viễn bài viết",
      prompt: "Vui lòng nhập lý do xóa bài viết (thông báo lý do này sẽ được gửi tới người đăng bài):",
      confirmLabel: "Xóa vĩnh viễn",
      isDanger: true,
    });
  };

  const promptDismissReport = () => {
    setReasonModal({
      open: true,
      actionType: "DISMISS",
      title: "Bỏ qua các báo cáo",
      prompt: "Vui lòng nhập lý do bỏ qua báo cáo (thông báo lý do này sẽ được gửi tới những người gửi tố cáo):",
      confirmLabel: "Xác nhận Bỏ qua",
      isDanger: false,
    });
  };

  const handleUnhidePost = async () => {
    if (!post) return;
    try {
      await unhidePost(post.id);
      notification.success("Đã hiện lại bài viết.");
      fetchPost();
    } catch {
      notification.error("Không thể hiện bài viết.");
    }
  };

  const handleConfirmReason = async (reason) => {
    const { actionType } = reasonModal;
    setReasonModal((prev) => ({ ...prev, open: false }));

    try {
      if (actionType === "HIDE") {
        await hidePost(post.id, reason);
        notification.success("Đã ẩn bài viết và gửi lý do cho tác giả.");
        fetchPost();
      } else if (actionType === "DELETE") {
        await moderatorDeletePost(post.id, reason);
        notification.success("Đã xóa bài viết và gửi lý do cho tác giả.");
        navigate(-1);
      } else if (actionType === "DISMISS") {
        await dismissPostReports(post.id, reason);
        notification.success("Đã bỏ qua các báo cáo và gửi lý do cho người tố cáo.");
        setIsDismissed(true);
        fetchPost();
      }
    } catch (err) {
      notification.error(err?.response?.data?.message || "Thao tác thất bại.");
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
          <div>
            <PostCardSkeleton count={1} />
            <div style={{ background: "#FFFFFF", borderRadius: "16px", padding: "20px", marginTop: "16px", border: "1px solid #E2E8F0" }}>
              <CommentSkeleton count={3} />
            </div>
          </div>
        )}

        {/* Error / Deleted State */}
        {!loading && (error || !post || post?.isDeleted) && (
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #F1F5F9",
              borderRadius: "20px",
              padding: "48px 32px",
              textAlign: "center",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)",
            }}
          >
            <div
              style={{
                width: "72px",
                height: "72px",
                background: "#FEE2E2",
                color: "#EF4444",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            </div>
            <h3 style={{ fontSize: "20px", fontWeight: 700, color: "#0F172A", margin: "0 0 10px" }}>
              Bài viết không tồn tại hoặc đã bị xóa
            </h3>
            <p style={{ fontSize: "14px", color: "#64748B", margin: "0 0 24px", lineHeight: "1.6" }}>
              {error || "Bài viết bạn đang tìm kiếm hiện không khả dụng, đã bị tác giả hoặc ban quản trị xóa khỏi cộng đồng."}
            </p>
            <button
              type="button"
              onClick={() => navigate("/community")}
              style={{
                padding: "10px 24px",
                background: "#007BFF",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "10px",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Quay lại Bảng tin cộng đồng
            </button>
          </div>
        )}

        {/* Post Detail Card */}
        {!loading && !error && post && (
          <>
            {/* Moderator Action Control Bar */}
            {isModerator && (
              <div
                style={{
                  background: post.isHidden ? "#FEF2F2" : "#F8FAFC",
                  border: `1px solid ${post.isHidden ? "#FCA5A5" : "#E2E8F0"}`,
                  borderRadius: "16px",
                  padding: "16px 20px",
                  marginBottom: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: post.isHidden ? "#DC2626" : "#1E293B", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                    {post.isHidden ? (
                      <>
                        <LockIcon /> Bài viết đang bị ẩn bởi Quản trị viên
                      </>
                    ) : (
                      <>
                        <ShieldIcon /> Thanh công cụ Kiểm duyệt viên
                      </>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
                    Thực hiện kiểm duyệt, ẩn/hiện, bỏ qua báo cáo hoặc xóa bài viết này.
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  {(post.isReportDismissed || isDismissed || fromTab === "DISMISSED") ? (
                    <div style={{ padding: "8px 14px", borderRadius: "8px", background: "#F1F5F9", border: "1px solid #CBD5E1", color: "#475569", fontSize: "13px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <ShieldIcon /> Đã bỏ qua báo cáo bài viết (Không thể Ẩn/Xóa)
                    </div>
                  ) : (
                    <>
                      {post.isHidden ? (
                        <button
                          type="button"
                          onClick={handleUnhidePost}
                          style={{
                            padding: "7px 14px",
                            borderRadius: "8px",
                            border: "1px solid #BBF7D0",
                            background: "#F0FDF4",
                            color: "#166534",
                            fontSize: "13px",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <UnlockIcon /> Hiện bài
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={promptHidePost}
                          style={{
                            padding: "7px 14px",
                            borderRadius: "8px",
                            border: "1px solid #FDE68A",
                            background: "#FFFBEB",
                            color: "#B45309",
                            fontSize: "13px",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <LockIcon /> Ẩn bài
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={promptDismissReport}
                        style={{
                          padding: "7px 14px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          background: "#FFFFFF",
                          color: "#475569",
                          fontSize: "13px",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <DismissIcon /> Bỏ qua
                      </button>

                      <button
                        type="button"
                        onClick={promptDeletePost}
                        style={{
                          padding: "7px 14px",
                          borderRadius: "8px",
                          border: "1px solid #FCA5A5",
                          background: "#FEF2F2",
                          color: "#991B1B",
                          fontSize: "13px",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <TrashIcon /> Xóa
                      </button>
                    </>
                  )}
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
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <LockIcon /> Bài viết này của bạn đã bị Quản trị viên ẩn khỏi Bảng tin chung của cộng đồng.
              </div>
            )}

            {/* Post View */}
            <PostCard
              post={post}
              onPostDeleted={handlePostDeleted}
              onPostUpdated={handlePostUpdated}
              hideOptionsMenu={post.isHidden || post.isReported || (post.reportCount && post.reportCount > 0)}
              defaultShowComments={true}
              targetCommentId={searchParams.get("commentId") || (location.hash ? location.hash.replace("#comment-", "") : null)}
            />
          </>
        )}
      </main>

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
