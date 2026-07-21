import { useState, useEffect } from "react";
import { addComment, getComments, getReplies, deleteComment, toggleLikeComment } from "../../api/communityApi";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import ConfirmDialog from "./ConfirmDialog";

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "Vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} ngày trước`;
  return d.toLocaleDateString("vi-VN");
}

function CommentItem({ comment, postId, onCommentAdded, onCommentDeleted }) {
  const { user, isAuthenticated } = useAuth();
  const notification = useNotification();
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [replies, setReplies] = useState([]);
  const [repliesLoaded, setRepliesLoaded] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [liked, setLiked] = useState(comment.isLiked || false);
  const [likeCount, setLikeCount] = useState(comment.likeCount || 0);
  const [showConfirmComment, setShowConfirmComment] = useState(false);
  const [replyToDelete, setReplyToDelete] = useState(null);

  const handleLikeComment = async () => {
    if (!isAuthenticated) {
      notification.error("Vui lòng đăng nhập để thích bình luận.");
      return;
    }
    try {
      const data = await toggleLikeComment(comment.id);
      setLiked(data.isLiked);
      setLikeCount(data.likeCount);
    } catch {
      notification.error("Không thể thích bình luận.");
    }
  };

  const handleLikeReply = async (replyId) => {
    if (!isAuthenticated) {
      notification.error("Vui lòng đăng nhập để thích phản hồi.");
      return;
    }
    try {
      const data = await toggleLikeComment(replyId);
      setReplies((prev) =>
        prev.map((r) =>
          r.id === replyId ? { ...r, isLiked: data.isLiked, likeCount: data.likeCount } : r
        )
      );
    } catch {
      notification.error("Không thể thích phản hồi.");
    }
  };

  const handleLoadReplies = async () => {
    setLoadingReplies(true);
    try {
      const data = await getReplies(comment.id);
      setReplies(data || []);
      setRepliesLoaded(true);
    } catch {
      notification.error("Không thể tải phản hồi.");
    } finally {
      setLoadingReplies(false);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || sending) return;
    setSending(true);
    try {
      const newReply = await addComment(postId, {
        body: replyText.trim(),
        parentCommentId: comment.id,
      });
      setReplies((prev) => [...prev, newReply]);
      setRepliesLoaded(true);
      setReplyText("");
      setShowReplyInput(false);
      if (onCommentAdded) onCommentAdded();
    } catch {
      notification.error("Không thể gửi phản hồi.");
    } finally {
      setSending(false);
    }
  };

  const handleDeleteComment = () => {
    setShowConfirmComment(true);
  };

  const executeDeleteComment = async () => {
    setShowConfirmComment(false);
    try {
      await deleteComment(comment.id);
      notification.success("Đã xóa bình luận.");
      if (onCommentDeleted) onCommentDeleted(comment.id, 1 + (comment.replyCount || 0));
    } catch {
      notification.error("Không thể xóa bình luận.");
    }
  };

  const handleDeleteReply = (replyId) => {
    setReplyToDelete(replyId);
  };

  const executeDeleteReply = async () => {
    const id = replyToDelete;
    setReplyToDelete(null);
    try {
      await deleteComment(id);
      notification.success("Đã xóa phản hồi.");
      setReplies((prev) => prev.filter((r) => r.id !== id));
      if (onCommentDeleted) onCommentDeleted(id, 1);
    } catch {
      notification.error("Không thể xóa phản hồi.");
    }
  };

  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.authorName || "U")}&background=E2E8F0&color=475569&size=64`;

  return (
    <div>
      <div className="comment-item">
        <img
          className="comment-item-avatar"
          src={comment.authorAvatar || defaultAvatar}
          alt=""
        />
        <div className="comment-item-body">
          <div className="comment-bubble">
            <div className="comment-bubble-author">{comment.authorName || "Người dùng"}</div>
            {comment.replyToUserName && (
              <span className="comment-bubble-reply-to">@{comment.replyToUserName} </span>
            )}
            <div className="comment-bubble-text">{comment.body}</div>
          </div>
          <div className="comment-meta">
            <span>{timeAgo(comment.createdAt)}</span>
            {isAuthenticated && (
              <button onClick={() => setShowReplyInput(!showReplyInput)}>
                Phản hồi
              </button>
            )}
            <button onClick={handleLikeComment} style={{ color: liked ? "#007BFF" : "#64748B", fontWeight: liked ? "600" : "400" }}>
              👍 Thích {likeCount > 0 ? `(${likeCount})` : ""}
            </button>
            {user && comment.authorId === user.id && (
              <button onClick={handleDeleteComment} style={{ color: "#EF4444" }}>
                Xóa
              </button>
            )}
            {(comment.replyCount > 0 && !repliesLoaded) && (
              <button onClick={handleLoadReplies} disabled={loadingReplies}>
                {loadingReplies ? "Đang tải..." : `Xem ${comment.replyCount} phản hồi`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {repliesLoaded && replies.map((r) => (
        <div className="comment-item reply" key={r.id}>
          <img
            className="comment-item-avatar"
            src={r.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.authorName || "U")}&background=E2E8F0&color=475569&size=64`}
            alt=""
          />
          <div className="comment-item-body">
            <div className="comment-bubble">
              <div className="comment-bubble-author">{r.authorName || "Người dùng"}</div>
              {r.replyToUserName && (
                <span className="comment-bubble-reply-to">@{r.replyToUserName} </span>
              )}
              <div className="comment-bubble-text">{r.body}</div>
            </div>
            <div className="comment-meta">
              <span>{timeAgo(r.createdAt)}</span>
              <button onClick={() => handleLikeReply(r.id)} style={{ color: r.isLiked ? "#007BFF" : "#64748B", fontWeight: r.isLiked ? "600" : "400" }}>
                👍 Thích {r.likeCount > 0 ? `(${r.likeCount})` : ""}
              </button>
              {user && r.authorId === user.id && (
                <button onClick={() => handleDeleteReply(r.id)} style={{ color: "#EF4444" }}>
                  Xóa
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Reply input */}
      {showReplyInput && (
        <div className="comment-input-row" style={{ marginLeft: 44, marginTop: 4 }}>
          <img
            className="comment-input-avatar"
            src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || "U")}&background=E2E8F0&color=475569&size=64`}
            alt=""
          />
          <div className="comment-input-wrapper">
            <input
              className="comment-input"
              placeholder="Viết phản hồi..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleReply()}
            />
            <button
              className="comment-send-btn"
              onClick={handleReply}
              disabled={!replyText.trim() || sending}
              title="Gửi"
            >
              ➤
            </button>
          </div>
        </div>
      )}

      {/* Confirm delete dialogs */}
      <ConfirmDialog
        open={showConfirmComment}
        title="Xóa bình luận"
        message="Bạn có chắc chắn muốn xóa bình luận này không? Hành động này không thể hoàn tác."
        confirmLabel="Xóa"
        danger
        onConfirm={executeDeleteComment}
        onCancel={() => setShowConfirmComment(false)}
      />
      <ConfirmDialog
        open={replyToDelete !== null}
        title="Xóa phản hồi"
        message="Bạn có chắc chắn muốn xóa phản hồi này không? Hành động này không thể hoàn tác."
        confirmLabel="Xóa"
        danger
        onConfirm={executeDeleteReply}
        onCancel={() => setReplyToDelete(null)}
      />
    </div>
  );
}

export default function CommentSection({ postId, onCommentCountChange }) {
  const { user, isAuthenticated } = useAuth();
  const notification = useNotification();
  const [comments, setComments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);

  const loadComments = async (p = 0) => {
    setLoading(true);
    try {
      const data = await getComments(postId, p, 5);
      if (p === 0) {
        setComments(data || []);
      } else {
        setComments((prev) => [...prev, ...(data || [])]);
      }
      setHasMore((data || []).length >= 5);
      setPage(p);
      setLoaded(true);
    } catch {
      notification.error("Không thể tải bình luận.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments(0);
  }, [postId]);

  const handleSendComment = async () => {
    if (!newComment.trim() || sending) return;
    setSending(true);
    try {
      const created = await addComment(postId, { body: newComment.trim() });
      setComments((prev) => [created, ...prev]);
      setNewComment("");
      if (onCommentCountChange) onCommentCountChange(1);
    } catch {
      notification.error("Không thể gửi bình luận.");
    } finally {
      setSending(false);
    }
  };

  const defaultAvatar = user
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || "U")}&background=E2E8F0&color=475569&size=64`
    : "";

  return (
    <div className="comment-section">
      {isAuthenticated && (
        <div className="comment-input-row">
          <img
            className="comment-input-avatar"
            src={user?.avatar || defaultAvatar}
            alt=""
          />
          <div className="comment-input-wrapper">
            <input
              className="comment-input"
              placeholder="Viết bình luận..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendComment()}
            />
            <button
              className="comment-send-btn"
              onClick={handleSendComment}
              disabled={!newComment.trim() || sending}
              title="Gửi"
            >
              ➤
            </button>
          </div>
        </div>
      )}

      {comments.map((c) => (
        <CommentItem
          key={c.id}
          comment={c}
          postId={postId}
          onCommentAdded={() => onCommentCountChange && onCommentCountChange(1)}
          onCommentDeleted={(deletedId, countRemoved = 1) => {
            setComments((prev) => prev.filter((item) => item.id !== deletedId));
            if (onCommentCountChange) onCommentCountChange(-countRemoved);
          }}
        />
      ))}

      {hasMore && loaded && comments.length > 0 && (
        <button
          className="comment-load-more"
          onClick={() => loadComments(page + 1)}
          disabled={loading}
        >
          {loading ? "Đang tải..." : "Xem thêm bình luận"}
        </button>
      )}
    </div>
  );
}
