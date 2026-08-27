import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { addComment, getComments, getReplies, deleteComment, voteComment } from "../../api/communityApi";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { useSSE } from "../../hooks/useSSE";
import { timeAgo } from "../../utils/dateUtils";
import { UpvoteIcon, DownvoteIcon } from "../icons";
import ConfirmDialog from "./ConfirmDialog";
import AutoLinkText from "../AutoLinkText";
import { CommentSkeleton } from "./CommunitySkeletons";

function ProfileLink({ authorId, children, style }) {
  return (
    <Link to={authorId ? `/profile/${authorId}` : "#"} style={{ textDecoration: "none", color: "inherit", ...style }}>
      {children}
    </Link>
  );
}

function CommentItem({
  comment,
  postId,
  onCommentAdded,
  onCommentDeleted,
  targetCommentId,
  highlightedId,
  setHighlightedId,
}) {
  const { user, isAuthenticated } = useAuth();
  const notification = useNotification();
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [replies, setReplies] = useState([]);
  const [repliesLoaded, setRepliesLoaded] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [userVote, setUserVote] = useState(comment.userVote || (comment.isLiked ? "UPVOTE" : null));
  const [upvoteCount, setUpvoteCount] = useState(comment.upvoteCount ?? comment.likeCount ?? 0);
  const [downvoteCount, setDownvoteCount] = useState(comment.downvoteCount ?? 0);
  const [isVoting, setIsVoting] = useState(false);
  const [showConfirmComment, setShowConfirmComment] = useState(false);
  const [replyToDelete, setReplyToDelete] = useState(null);

  // Auto-expand replies if target comment might be inside this thread
  useEffect(() => {
    if (targetCommentId && String(comment.id) !== String(targetCommentId) && comment.replyCount > 0 && !repliesLoaded && !loadingReplies) {
      handleLoadReplies();
    }
  }, [targetCommentId, comment.id, comment.replyCount, repliesLoaded, loadingReplies]);

  // Scroll and highlight target root comment
  useEffect(() => {
    if (targetCommentId && String(comment.id) === String(targetCommentId)) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`comment-${comment.id}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          if (setHighlightedId) {
            setHighlightedId(String(comment.id));
            setTimeout(() => setHighlightedId(null), 1200);
          }
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [targetCommentId, comment.id, setHighlightedId]);

  // Scroll and highlight target reply
  useEffect(() => {
    if (targetCommentId && repliesLoaded && replies.some((r) => String(r.id) === String(targetCommentId))) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`comment-${targetCommentId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          if (setHighlightedId) {
            setHighlightedId(String(targetCommentId));
            setTimeout(() => setHighlightedId(null), 1200);
          }
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [targetCommentId, repliesLoaded, replies, setHighlightedId]);

  useSSE({
    "comment-voted": (data) => {
      if (data && data.commentId) {
        if (String(data.commentId) === String(comment.id)) {
          if (typeof data.upvoteCount === "number") setUpvoteCount(data.upvoteCount);
          if (typeof data.downvoteCount === "number") setDownvoteCount(data.downvoteCount);
        } else {
          setReplies((prev) =>
            prev.map((r) =>
              String(r.id) === String(data.commentId)
                ? {
                    ...r,
                    upvoteCount: data.upvoteCount,
                    downvoteCount: data.downvoteCount,
                    likeCount: data.likeCount,
                  }
                : r
            )
          );
        }
      }
    },
    "comment-liked": (data) => {
      if (data && data.commentId) {
        if (String(data.commentId) === String(comment.id)) {
          if (typeof data.upvoteCount === "number") setUpvoteCount(data.upvoteCount);
          if (typeof data.downvoteCount === "number") setDownvoteCount(data.downvoteCount);
        } else {
          setReplies((prev) =>
            prev.map((r) =>
              String(r.id) === String(data.commentId)
                ? {
                    ...r,
                    upvoteCount: data.upvoteCount ?? r.upvoteCount,
                    downvoteCount: data.downvoteCount ?? r.downvoteCount,
                    likeCount: data.likeCount ?? r.likeCount,
                  }
                : r
            )
          );
        }
      }
    },
    "new-comment": (data) => {
      if (data && data.comment) {
        const newC = data.comment;
        if (newC.parentCommentId && String(newC.parentCommentId) === String(comment.id)) {
          setReplies((prev) => {
            if (prev.some((r) => String(r.id) === String(newC.id))) return prev;
            return [...prev, newC];
          });
          setRepliesLoaded(true);
        }
      }
    },
  });

  const handleVoteComment = async (voteType) => {
    if (!isAuthenticated) {
      notification.warning("Vui lòng đăng nhập để đánh giá bình luận.");
      return;
    }
    if (isVoting) return;
    setIsVoting(true);
    try {
      const data = await voteComment(comment.id, voteType);
      setUserVote(data.userVote);
      if (typeof data.upvoteCount === "number") setUpvoteCount(data.upvoteCount);
      if (typeof data.downvoteCount === "number") setDownvoteCount(data.downvoteCount);
    } catch {
      notification.error("Không thể bình chọn bình luận.");
    } finally {
      setIsVoting(false);
    }
  };

  const handleVoteReply = async (replyId, voteType) => {
    if (!isAuthenticated) {
      notification.warning("Vui lòng đăng nhập để đánh giá phản hồi.");
      return;
    }
    if (isVoting) return;
    setIsVoting(true);
    try {
      const data = await voteComment(replyId, voteType);
      setReplies((prev) =>
        prev.map((r) =>
          r.id === replyId
            ? {
                ...r,
                userVote: data.userVote,
                isLiked: data.userVote === "UPVOTE",
                upvoteCount: data.upvoteCount,
                downvoteCount: data.downvoteCount,
                likeCount: data.likeCount,
              }
            : r
        )
      );
    } catch {
      notification.error("Không thể bình chọn phản hồi.");
    } finally {
      setIsVoting(false);
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
      <div
        id={`comment-${comment.id}`}
        className={`comment-item ${String(highlightedId) === String(comment.id) ? "comment-highlight" : ""}`}
      >
        <ProfileLink authorId={comment.authorId}>
          <img
            className="comment-item-avatar"
            src={comment.authorAvatar || defaultAvatar}
            alt=""
          />
        </ProfileLink>
        <div className="comment-item-body">
          <div className="comment-bubble">
            <ProfileLink authorId={comment.authorId}>
              <div className="comment-bubble-author">{comment.authorName || "Người dùng"}</div>
            </ProfileLink>
            <div className="comment-bubble-text"><AutoLinkText text={comment.body} /></div>
          </div>
          <div className="comment-meta">
            <span>{timeAgo(comment.createdAt)}</span>
            {isAuthenticated && (
              <button onClick={() => setShowReplyInput(!showReplyInput)}>
                Phản hồi
              </button>
            )}
            <span className="comment-vote-group" style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
              <button
                onClick={() => handleVoteComment("UPVOTE")}
                title="Upvote"
                style={{
                  color: userVote === "UPVOTE" ? "#2563EB" : "#64748B",
                  fontWeight: userVote === "UPVOTE" ? "600" : "400",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "2px",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  background: userVote === "UPVOTE" ? "#EFF6FF" : "transparent",
                  border: "none",
                  cursor: "pointer"
                }}
              >
                <UpvoteIcon size={14} color={userVote === "UPVOTE" ? "#2563EB" : "#64748B"} filled={userVote === "UPVOTE"} />
                <span>{upvoteCount > 0 ? upvoteCount : ""}</span>
              </button>
              <button
                onClick={() => handleVoteComment("DOWNVOTE")}
                title="Downvote"
                style={{
                  color: userVote === "DOWNVOTE" ? "#DC2626" : "#64748B",
                  fontWeight: userVote === "DOWNVOTE" ? "600" : "400",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "2px",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  background: userVote === "DOWNVOTE" ? "#FEF2F2" : "transparent",
                  border: "none",
                  cursor: "pointer"
                }}
              >
                <DownvoteIcon size={14} color={userVote === "DOWNVOTE" ? "#DC2626" : "#64748B"} filled={userVote === "DOWNVOTE"} />
                <span>{downvoteCount > 0 ? downvoteCount : ""}</span>
              </button>
            </span>
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
      {loadingReplies && <div style={{ paddingLeft: 44 }}><CommentSkeleton count={1} /></div>}
      {repliesLoaded && replies.map((r) => {
        const replyUserVote = r.userVote || (r.isLiked ? "UPVOTE" : null);
        const replyUpvotes = r.upvoteCount ?? (r.likeCount ?? 0);
        const replyDownvotes = r.downvoteCount ?? 0;
        return (
          <div
            id={`comment-${r.id}`}
            className={`comment-item reply ${String(highlightedId) === String(r.id) ? "comment-highlight" : ""}`}
            key={r.id}
          >
            <ProfileLink authorId={r.authorId}>
              <img
                className="comment-item-avatar"
                src={r.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.authorName || "U")}&background=E2E8F0&color=475569&size=64`}
                alt=""
              />
            </ProfileLink>
            <div className="comment-item-body">
              <div className="comment-bubble">
                <ProfileLink authorId={r.authorId}>
                  <div className="comment-bubble-author">{r.authorName || "Người dùng"}</div>
                </ProfileLink>
                <div className="comment-bubble-text"><AutoLinkText text={r.body} /></div>
              </div>
              <div className="comment-meta">
                <span>{timeAgo(r.createdAt)}</span>
                <span className="comment-vote-group" style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
                  <button
                    onClick={() => handleVoteReply(r.id, "UPVOTE")}
                    title="Upvote"
                    style={{
                      color: replyUserVote === "UPVOTE" ? "#2563EB" : "#64748B",
                      fontWeight: replyUserVote === "UPVOTE" ? "600" : "400",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "2px",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: replyUserVote === "UPVOTE" ? "#EFF6FF" : "transparent",
                      border: "none",
                      cursor: "pointer"
                    }}
                  >
                    <UpvoteIcon size={14} color={replyUserVote === "UPVOTE" ? "#2563EB" : "#64748B"} filled={replyUserVote === "UPVOTE"} />
                    <span>{replyUpvotes > 0 ? replyUpvotes : ""}</span>
                  </button>
                  <button
                    onClick={() => handleVoteReply(r.id, "DOWNVOTE")}
                    title="Downvote"
                    style={{
                      color: replyUserVote === "DOWNVOTE" ? "#DC2626" : "#64748B",
                      fontWeight: replyUserVote === "DOWNVOTE" ? "600" : "400",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "2px",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: replyUserVote === "DOWNVOTE" ? "#FEF2F2" : "transparent",
                      border: "none",
                      cursor: "pointer"
                    }}
                  >
                    <DownvoteIcon size={14} color={replyUserVote === "DOWNVOTE" ? "#DC2626" : "#64748B"} filled={replyUserVote === "DOWNVOTE"} />
                    <span>{replyDownvotes > 0 ? replyDownvotes : ""}</span>
                  </button>
                </span>
                {user && r.authorId === user.id && (
                  <button onClick={() => handleDeleteReply(r.id)} style={{ color: "#EF4444" }}>
                    Xóa
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Reply input */}
      {showReplyInput && (
        <div className="comment-reply-input-row" style={{ marginLeft: 44 }}>
          <img
            className="comment-input-avatar"
            src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || "U")}&background=E2E8F0&color=475569&size=64`}
            alt=""
          />
          <div className="comment-input-wrapper">
            <input
              className="comment-input"
              placeholder={`Trả lời ${comment.authorName || "người dùng"}...`}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent?.isComposing) {
                  e.preventDefault();
                  handleReply();
                }
              }}
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

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={showConfirmComment}
        title="Xóa bình luận"
        message="Bạn có chắc chắn muốn xóa bình luận này cùng tất cả phản hồi liên quan không? Hành động này không thể hoàn tác."
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

export default function CommentSection({ postId, onCommentCountChange, targetCommentId, allowComments = true }) {
  const { user, isAuthenticated } = useAuth();
  const notification = useNotification();
  const [comments, setComments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [autoLoadMore, setAutoLoadMore] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [highlightedId, setHighlightedId] = useState(null);
  const commentSentinelRef = useRef(null);

  const loadComments = useCallback(async (p = 0) => {
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
  }, [postId, notification]);

  useEffect(() => {
    setPage(0);
    setHasMore(true);
    setAutoLoadMore(false);
    loadComments(0);
  }, [postId, loadComments]);

  // Infinite scroll after user clicks "Xem thêm bình luận" once
  useEffect(() => {
    if (!autoLoadMore || !hasMore || loading) return;
    const el = commentSentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading) {
          loadComments(page + 1);
        }
      },
      { rootMargin: "150px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [autoLoadMore, hasMore, loading, page, loadComments]);

  // Real-time SSE listener for instant new comments without page refresh
  useSSE({
    "new-comment": (data) => {
      if (data && String(data.postId) === String(postId) && data.comment) {
        const newC = data.comment;
        if (newC.parentCommentId) {
          setComments((prev) =>
            prev.map((c) =>
              String(c.id) === String(newC.parentCommentId)
                ? { ...c, replyCount: (c.replyCount || 0) + 1 }
                : c
            )
          );
        } else {
          setComments((prev) => {
            if (prev.some((c) => String(c.id) === String(newC.id))) {
              return prev;
            }
            return [newC, ...prev];
          });
        }
      }
    },
    "comment-liked": (data) => {
      if (data && data.commentId) {
        setComments((prev) =>
          prev.map((c) =>
            String(c.id) === String(data.commentId)
              ? { ...c, likeCount: data.likeCount }
              : c
          )
        );
      }
    },
  });

  const handleSendComment = async () => {
    if (!newComment.trim() || sending) return;
    setSending(true);
    try {
      const created = await addComment(postId, { body: newComment.trim() });
      setComments((prev) => {
        if (prev.some((c) => String(c.id) === String(created.id))) return prev;
        return [created, ...prev];
      });
      setNewComment("");
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || "Không thể gửi bình luận.";
      notification.error(errorMsg);
    } finally {
      setSending(false);
    }
  };

  const handleFirstLoadMore = () => {
    setAutoLoadMore(true);
    loadComments(page + 1);
  };

  const defaultAvatar = user
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || "U")}&background=E2E8F0&color=475569&size=64`
    : "";

  return (
    <div className="comment-section">
      {allowComments === false ? (
        <div style={{
          padding: "12px 16px",
          backgroundColor: "#F8FAFC",
          borderRadius: "8px",
          border: "1px dashed #CBD5E1",
          textAlign: "center",
          color: "#64748B",
          fontSize: "13px",
          margin: "8px 0"
        }}>
          🔒 Tác giả đã tắt tính năng bình luận cho bài viết này.
        </div>
      ) : (
        isAuthenticated && (
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
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent?.isComposing) {
                    e.preventDefault();
                    handleSendComment();
                  }
                }}
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
        )
      )}

      {/* Initial loading skeleton */}
      {loading && !loaded && (
        <CommentSkeleton count={3} />
      )}

      {/* Comments list */}
      {comments.map((c) => (
        <CommentItem
          key={c.id}
          comment={c}
          postId={postId}
          targetCommentId={targetCommentId}
          highlightedId={highlightedId}
          setHighlightedId={setHighlightedId}
          onCommentAdded={() => onCommentCountChange && onCommentCountChange(1)}
          onCommentDeleted={(deletedId, countRemoved = 1) => {
            setComments((prev) => prev.filter((item) => item.id !== deletedId));
            if (onCommentCountChange) onCommentCountChange(-countRemoved);
          }}
        />
      ))}

      {/* Loading skeleton for subsequent pages */}
      {loading && loaded && (
        <CommentSkeleton count={2} />
      )}

      {/* Manual load more button (only before the first click) */}
      {hasMore && loaded && !autoLoadMore && comments.length > 0 && !loading && (
        <button
          className="comment-load-more"
          onClick={handleFirstLoadMore}
        >
          Xem thêm bình luận
        </button>
      )}

      {/* Invisible sentinel element to trigger auto scroll after 1st click */}
      {hasMore && autoLoadMore && (
        <div ref={commentSentinelRef} style={{ height: 1 }} />
      )}
    </div>
  );
}
