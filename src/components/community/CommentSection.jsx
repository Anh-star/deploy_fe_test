import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  addComment,
  getComments,
  getReplies,
  deleteComment,
  voteComment,
  editComment,
  getCommentEditHistory,
} from "../../api/communityApi";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { useSSE } from "../../hooks/useSSE";
import { timeAgo } from "../../utils/dateUtils";
import { UpvoteIcon, DownvoteIcon, ImageIcon } from "../icons";
import ConfirmDialog from "./ConfirmDialog";
import AutoLinkText from "../AutoLinkText";
import { CommentSkeleton } from "./CommunitySkeletons";
import CommentEditHistoryModal from "../common/CommentEditHistoryModal";
import { uploadDocumentToSupabase, DEFAULT_DOCUMENT_BUCKET } from "../../utils/uploadDocumentSupabase";

const MAX_COMMENT_IMAGES = 4;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

function ProfileLink({ authorId, children, style }) {
  return (
    <Link to={authorId ? `/profile/${authorId}` : "#"} style={{ textDecoration: "none", color: "inherit", ...style }}>
      {children}
    </Link>
  );
}

const dedupeComments = (list) => {
  const seen = new Set();
  return (list || []).filter((item) => {
    if (!item || !item.id) return false;
    const idStr = String(item.id).toLowerCase().trim();
    if (seen.has(idStr)) return false;
    seen.add(idStr);
    return true;
  });
};

function CommentImagesDisplay({ imageUrls, onImageClick }) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "6px",
        marginTop: "8px",
      }}
    >
      {imageUrls.map((url, idx) => (
        <img
          key={idx}
          src={url}
          alt=""
          onClick={() => onImageClick?.(url)}
          style={{
            width: imageUrls.length === 1 ? "180px" : "90px",
            height: imageUrls.length === 1 ? "180px" : "90px",
            maxHeight: "220px",
            objectFit: "cover",
            borderRadius: "8px",
            border: "1px solid #E2E8F0",
            cursor: "pointer",
            transition: "transform 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        />
      ))}
    </div>
  );
}

function ImagePickerRow({ images, onRemove, onAdd, disabled, max = MAX_COMMENT_IMAGES }) {
  const fileInputRef = useRef(null);

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    onAdd(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginTop: "6px" }}>
      {images.map((item, idx) => {
        const previewUrl = typeof item === "string" ? item : URL.createObjectURL(item);
        return (
          <div
            key={idx}
            style={{
              position: "relative",
              width: "56px",
              height: "56px",
              borderRadius: "6px",
              overflow: "hidden",
              border: "1px solid #CBD5E1",
            }}
          >
            <img src={previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <button
              type="button"
              onClick={() => onRemove(idx)}
              disabled={disabled}
              style={{
                position: "absolute",
                top: "2px",
                right: "2px",
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                background: "rgba(0, 0, 0, 0.65)",
                color: "#FFF",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: "11px",
                lineHeight: 1,
                padding: 0,
              }}
            >
              &times;
            </button>
          </div>
        );
      })}

      {images.length < max && (
        <>
          <button
            type="button"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            title="Đính kèm ảnh (tối đa 4 ảnh, tối đa 5MB/ảnh)"
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "6px",
              border: "1px dashed #94A3B8",
              background: "#F8FAFC",
              color: "#64748B",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: "10px",
              gap: "2px",
            }}
          >
            <ImageIcon size={16} color="#64748B" />
            <span>Thêm</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            style={{ display: "none" }}
            onChange={handleFiles}
          />
        </>
      )}
    </div>
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
  onOpenHistory,
  onOpenImageLightbox,
}) {
  const { user, isAuthenticated } = useAuth();
  const notification = useNotification();
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyImages, setReplyImages] = useState([]);
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

  // Edit root comment state
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState("");
  const [editExistingImages, setEditExistingImages] = useState([]);
  const [editNewImages, setEditNewImages] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // Edit reply state
  const [editingReplyId, setEditingReplyId] = useState(null);
  const [editReplyBody, setEditReplyBody] = useState("");
  const [editReplyExistingImages, setEditReplyExistingImages] = useState([]);
  const [editReplyNewImages, setEditReplyNewImages] = useState([]);
  const [savingReplyEdit, setSavingReplyEdit] = useState(false);

  const replyFileInputRef = useRef(null);

  const isAuthor = user && (String(comment.authorId) === String(user.id) || (comment.authorName && comment.authorName === user.fullName));

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
          setReplies((prev) => dedupeComments([...prev, newC]));
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

  const handleAddReplyImages = (files) => {
    const valid = [];
    for (const f of files) {
      if (!f.type.startsWith("image/")) {
        notification.warning(`Tệp "${f.name}" không phải là định dạng hình ảnh hợp lệ.`);
        continue;
      }
      if (f.size > MAX_IMAGE_SIZE_BYTES) {
        notification.warning(`Ảnh "${f.name}" vượt quá giới hạn 5MB.`);
        continue;
      }
      valid.push(f);
    }
    const combined = [...replyImages, ...valid];
    if (combined.length > MAX_COMMENT_IMAGES) {
      notification.warning(`Chỉ được đính kèm tối đa ${MAX_COMMENT_IMAGES} ảnh.`);
      setReplyImages(combined.slice(0, MAX_COMMENT_IMAGES));
    } else {
      setReplyImages(combined);
    }
  };

  const handleReply = async () => {
    if ((!replyText.trim() && replyImages.length === 0) || sending) return;
    setSending(true);
    try {
      // Upload images if any
      const uploadedUrls = [];
      for (const imgFile of replyImages) {
        const res = await uploadDocumentToSupabase(imgFile, "community/comments", DEFAULT_DOCUMENT_BUCKET);
        if (res?.url) uploadedUrls.push(res.url);
      }

      const newReply = await addComment(postId, {
        body: replyText.trim(),
        parentCommentId: comment.id,
        imageUrls: uploadedUrls,
      });
      setReplies((prev) => dedupeComments([...prev, newReply]));
      setRepliesLoaded(true);
      setReplyText("");
      setReplyImages([]);
      setShowReplyInput(false);
      if (onCommentAdded) onCommentAdded(newReply?.postCommentCount, typeof newReply?.postCommentCount === "number");
    } catch (err) {
      notification.error(err?.message || "Không thể gửi phản hồi.");
    } finally {
      setSending(false);
    }
  };

  // Edit root comment handlers
  const handleStartEdit = () => {
    setIsEditing(true);
    setEditBody(comment.body || "");
    setEditExistingImages(Array.isArray(comment.imageUrls) ? [...comment.imageUrls] : []);
    setEditNewImages([]);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditBody("");
    setEditExistingImages([]);
    setEditNewImages([]);
    setSavingEdit(false);
  };

  const handleAddNewEditImages = (files) => {
    const valid = [];
    for (const f of files) {
      if (!f.type.startsWith("image/")) {
        notification.warning(`Tệp "${f.name}" không phải là ảnh.`);
        continue;
      }
      if (f.size > MAX_IMAGE_SIZE_BYTES) {
        notification.warning(`Ảnh "${f.name}" vượt quá giới hạn 5MB.`);
        continue;
      }
      valid.push(f);
    }
    const currentTotal = editExistingImages.length + editNewImages.length;
    const available = MAX_COMMENT_IMAGES - currentTotal;
    if (available <= 0) {
      notification.warning(`Chỉ được đính kèm tối đa ${MAX_COMMENT_IMAGES} ảnh.`);
      return;
    }
    setEditNewImages((prev) => [...prev, ...valid.slice(0, available)]);
  };

  const handleSaveEdit = async () => {
    if (!editBody.trim() && editExistingImages.length === 0 && editNewImages.length === 0) {
      notification.warning("Nội dung bình luận không được để trống.");
      return;
    }
    setSavingEdit(true);
    try {
      // Upload newly added images
      const uploadedUrls = [];
      for (const imgFile of editNewImages) {
        const res = await uploadDocumentToSupabase(imgFile, "community/comments", DEFAULT_DOCUMENT_BUCKET);
        if (res?.url) uploadedUrls.push(res.url);
      }

      const finalUrls = [...editExistingImages, ...uploadedUrls];
      const updated = await editComment(comment.id, editBody.trim(), finalUrls);

      comment.body = updated.body;
      comment.isEdited = true;
      comment.updatedAt = updated.updatedAt;
      comment.imageUrls = updated.imageUrls;

      setIsEditing(false);
      notification.success("Đã cập nhật bình luận.");
    } catch (err) {
      notification.error(err?.response?.data?.message || err?.message || "Không thể cập nhật bình luận.");
    } finally {
      setSavingEdit(false);
    }
  };

  // Edit reply handlers
  const handleStartEditReply = (r) => {
    setEditingReplyId(r.id);
    setEditReplyBody(r.body || "");
    setEditReplyExistingImages(Array.isArray(r.imageUrls) ? [...r.imageUrls] : []);
    setEditReplyNewImages([]);
  };

  const handleCancelEditReply = () => {
    setEditingReplyId(null);
    setEditReplyBody("");
    setEditReplyExistingImages([]);
    setEditReplyNewImages([]);
    setSavingReplyEdit(false);
  };

  const handleAddNewEditReplyImages = (files) => {
    const valid = [];
    for (const f of files) {
      if (!f.type.startsWith("image/")) {
        notification.warning(`Tệp "${f.name}" không phải là ảnh.`);
        continue;
      }
      if (f.size > MAX_IMAGE_SIZE_BYTES) {
        notification.warning(`Ảnh "${f.name}" vượt quá giới hạn 5MB.`);
        continue;
      }
      valid.push(f);
    }
    const currentTotal = editReplyExistingImages.length + editReplyNewImages.length;
    const available = MAX_COMMENT_IMAGES - currentTotal;
    if (available <= 0) {
      notification.warning(`Chỉ được đính kèm tối đa ${MAX_COMMENT_IMAGES} ảnh.`);
      return;
    }
    setEditReplyNewImages((prev) => [...prev, ...valid.slice(0, available)]);
  };

  const handleSaveEditReply = async (replyId) => {
    if (!editReplyBody.trim() && editReplyExistingImages.length === 0 && editReplyNewImages.length === 0) {
      notification.warning("Nội dung phản hồi không được để trống.");
      return;
    }
    setSavingReplyEdit(true);
    try {
      const uploadedUrls = [];
      for (const imgFile of editReplyNewImages) {
        const res = await uploadDocumentToSupabase(imgFile, "community/comments", DEFAULT_DOCUMENT_BUCKET);
        if (res?.url) uploadedUrls.push(res.url);
      }

      const finalUrls = [...editReplyExistingImages, ...uploadedUrls];
      const updated = await editComment(replyId, editReplyBody.trim(), finalUrls);

      setReplies((prev) =>
        prev.map((r) =>
          r.id === replyId
            ? {
                ...r,
                body: updated.body,
                isEdited: true,
                updatedAt: updated.updatedAt,
                imageUrls: updated.imageUrls,
              }
            : r
        )
      );

      setEditingReplyId(null);
      notification.success("Đã cập nhật phản hồi.");
    } catch (err) {
      notification.error(err?.response?.data?.message || err?.message || "Không thể cập nhật phản hồi.");
    } finally {
      setSavingReplyEdit(false);
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

            {isEditing ? (
              <div style={{ marginTop: "6px" }}>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    padding: "8px",
                    fontSize: "13.5px",
                    fontFamily: "inherit",
                  }}
                />
                <ImagePickerRow
                  images={[...editExistingImages, ...editNewImages]}
                  disabled={savingEdit}
                  onAdd={handleAddNewEditImages}
                  onRemove={(idx) => {
                    if (idx < editExistingImages.length) {
                      setEditExistingImages((prev) => prev.filter((_, i) => i !== idx));
                    } else {
                      const newIdx = idx - editExistingImages.length;
                      setEditNewImages((prev) => prev.filter((_, i) => i !== newIdx));
                    }
                  }}
                />
                <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                  <button
                    type="button"
                    disabled={savingEdit}
                    onClick={handleSaveEdit}
                    style={{
                      padding: "5px 12px",
                      borderRadius: "6px",
                      backgroundColor: "#2563EB",
                      color: "#FFF",
                      border: "none",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    {savingEdit ? "Đang lưu..." : "Lưu"}
                  </button>
                  <button
                    type="button"
                    disabled={savingEdit}
                    onClick={handleCancelEdit}
                    style={{
                      padding: "5px 12px",
                      borderRadius: "6px",
                      backgroundColor: "#F1F5F9",
                      color: "#475569",
                      border: "1px solid #CBD5E1",
                      fontSize: "12px",
                      fontWeight: "500",
                      cursor: "pointer",
                    }}
                  >
                    Hủy
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="comment-bubble-text">
                  <AutoLinkText text={comment.body} />
                </div>
                <CommentImagesDisplay
                  imageUrls={comment.imageUrls}
                  onImageClick={onOpenImageLightbox}
                />
              </>
            )}
          </div>
          <div className="comment-meta">
            <span>{timeAgo(comment.createdAt)}</span>
            {comment.isEdited && (
              <button
                type="button"
                onClick={() => onOpenHistory?.(comment)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "#64748B",
                  fontSize: "12px",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
                title="Nhấp để xem lịch sử chỉnh sửa"
              >
                (Đã chỉnh sửa)
              </button>
            )}
            {isAuthenticated && !isEditing && (
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
                  cursor: "pointer",
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
                  cursor: "pointer",
                }}
              >
                <DownvoteIcon size={14} color={userVote === "DOWNVOTE" ? "#DC2626" : "#64748B"} filled={userVote === "DOWNVOTE"} />
                <span>{downvoteCount > 0 ? downvoteCount : ""}</span>
              </button>
            </span>
            {isAuthor && !isEditing && (
              <>
                <button onClick={handleStartEdit} style={{ color: "#2563EB" }}>
                  Sửa
                </button>
                <button onClick={handleDeleteComment} style={{ color: "#EF4444" }}>
                  Xóa
                </button>
              </>
            )}
            {comment.replyCount > 0 && !repliesLoaded && (
              <button onClick={handleLoadReplies} disabled={loadingReplies}>
                {loadingReplies ? "Đang tải..." : `Xem ${comment.replyCount} phản hồi`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {loadingReplies && <div style={{ paddingLeft: 44 }}><CommentSkeleton count={1} /></div>}
      {repliesLoaded &&
        replies.map((r) => {
          const replyUserVote = r.userVote || (r.isLiked ? "UPVOTE" : null);
          const replyUpvotes = r.upvoteCount ?? (r.likeCount ?? 0);
          const replyDownvotes = r.downvoteCount ?? 0;
          const isReplyAuthor = user && (String(r.authorId) === String(user.id) || (r.authorName && r.authorName === user.fullName));
          const isReplyEditing = editingReplyId === r.id;

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

                  {isReplyEditing ? (
                    <div style={{ marginTop: "6px" }}>
                      <textarea
                        value={editReplyBody}
                        onChange={(e) => setEditReplyBody(e.target.value)}
                        rows={2}
                        style={{
                          width: "100%",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          padding: "8px",
                          fontSize: "13px",
                          fontFamily: "inherit",
                        }}
                      />
                      <ImagePickerRow
                        images={[...editReplyExistingImages, ...editReplyNewImages]}
                        disabled={savingReplyEdit}
                        onAdd={handleAddNewEditReplyImages}
                        onRemove={(idx) => {
                          if (idx < editReplyExistingImages.length) {
                            setEditReplyExistingImages((prev) => prev.filter((_, i) => i !== idx));
                          } else {
                            const newIdx = idx - editReplyExistingImages.length;
                            setEditReplyNewImages((prev) => prev.filter((_, i) => i !== newIdx));
                          }
                        }}
                      />
                      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                        <button
                          type="button"
                          disabled={savingReplyEdit}
                          onClick={() => handleSaveEditReply(r.id)}
                          style={{
                            padding: "4px 10px",
                            borderRadius: "6px",
                            backgroundColor: "#2563EB",
                            color: "#FFF",
                            border: "none",
                            fontSize: "11.5px",
                            fontWeight: "600",
                            cursor: "pointer",
                          }}
                        >
                          {savingReplyEdit ? "Đang lưu..." : "Lưu"}
                        </button>
                        <button
                          type="button"
                          disabled={savingReplyEdit}
                          onClick={handleCancelEditReply}
                          style={{
                            padding: "4px 10px",
                            borderRadius: "6px",
                            backgroundColor: "#F1F5F9",
                            color: "#475569",
                            border: "1px solid #CBD5E1",
                            fontSize: "11.5px",
                            fontWeight: "500",
                            cursor: "pointer",
                          }}
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="comment-bubble-text">
                        <AutoLinkText text={r.body} />
                      </div>
                      <CommentImagesDisplay
                        imageUrls={r.imageUrls}
                        onImageClick={onOpenImageLightbox}
                      />
                    </>
                  )}
                </div>
                <div className="comment-meta">
                  <span>{timeAgo(r.createdAt)}</span>
                  {r.isEdited && (
                    <button
                      type="button"
                      onClick={() => onOpenHistory?.(r)}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        color: "#64748B",
                        fontSize: "12px",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                      title="Nhấp để xem lịch sử chỉnh sửa"
                    >
                      (Đã chỉnh sửa)
                    </button>
                  )}
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
                        cursor: "pointer",
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
                        cursor: "pointer",
                      }}
                    >
                      <DownvoteIcon size={14} color={replyUserVote === "DOWNVOTE" ? "#DC2626" : "#64748B"} filled={replyUserVote === "DOWNVOTE"} />
                      <span>{replyDownvotes > 0 ? replyDownvotes : ""}</span>
                    </button>
                  </span>
                  {isReplyAuthor && !isReplyEditing && (
                    <>
                      <button onClick={() => handleStartEditReply(r)} style={{ color: "#2563EB" }}>
                        Sửa
                      </button>
                      <button onClick={() => handleDeleteReply(r.id)} style={{ color: "#EF4444" }}>
                        Xóa
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

      {/* Reply input */}
      {showReplyInput && (
        <div className="comment-input-row comment-reply-input-row" style={{ marginLeft: 44, marginTop: 8, flexDirection: "column" }}>
          <div style={{ display: "flex", width: "100%", alignItems: "center", gap: "8px" }}>
            <img
              className="comment-input-avatar"
              src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || "U")}&background=E2E8F0&color=475569&size=64`}
              alt=""
            />
            <div className="comment-input-wrapper" style={{ flex: 1 }}>
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
                type="button"
                className="comment-image-btn"
                onClick={() => replyFileInputRef.current?.click()}
                title="Thêm ảnh (tối đa 4 ảnh, tối đa 5MB/ảnh)"
                style={{
                  background: "none",
                  border: "none",
                  padding: "6px",
                  cursor: "pointer",
                  color: "#64748B",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <ImageIcon size={18} color="#64748B" />
              </button>
              <input
                ref={replyFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  handleAddReplyImages(Array.from(e.target.files || []));
                  if (replyFileInputRef.current) replyFileInputRef.current.value = "";
                }}
              />
              <button
                className="comment-send-btn"
                onClick={handleReply}
                disabled={(!replyText.trim() && replyImages.length === 0) || sending}
                title="Gửi"
              >
                ➤
              </button>
            </div>
          </div>

          {/* Reply Attached images preview */}
          {replyImages.length > 0 && (
            <div style={{ marginLeft: "48px", width: "100%" }}>
              <ImagePickerRow
                images={replyImages}
                disabled={sending}
                onAdd={handleAddReplyImages}
                onRemove={(idx) => setReplyImages((prev) => prev.filter((_, i) => i !== idx))}
              />
            </div>
          )}
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
  const [newCommentImages, setNewCommentImages] = useState([]);
  const [sending, setSending] = useState(false);
  const [highlightedId, setHighlightedId] = useState(null);
  const [historyModalComment, setHistoryModalComment] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  const commentSentinelRef = useRef(null);
  const rootFileInputRef = useRef(null);

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
          setComments((prev) => dedupeComments([newC, ...prev]));
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

  const handleAddNewCommentImages = (files) => {
    const valid = [];
    for (const f of files) {
      if (!f.type.startsWith("image/")) {
        notification.warning(`Tệp "${f.name}" không phải là định dạng hình ảnh hợp lệ.`);
        continue;
      }
      if (f.size > MAX_IMAGE_SIZE_BYTES) {
        notification.warning(`Ảnh "${f.name}" vượt quá giới hạn 5MB.`);
        continue;
      }
      valid.push(f);
    }
    const combined = [...newCommentImages, ...valid];
    if (combined.length > MAX_COMMENT_IMAGES) {
      notification.warning(`Chỉ được đính kèm tối đa ${MAX_COMMENT_IMAGES} ảnh.`);
      setNewCommentImages(combined.slice(0, MAX_COMMENT_IMAGES));
    } else {
      setNewCommentImages(combined);
    }
  };

  const handleSendComment = async () => {
    if ((!newComment.trim() && newCommentImages.length === 0) || sending) return;
    setSending(true);
    try {
      // Upload attached images to Supabase
      const uploadedUrls = [];
      for (const imgFile of newCommentImages) {
        const res = await uploadDocumentToSupabase(imgFile, "community/comments", DEFAULT_DOCUMENT_BUCKET);
        if (res?.url) uploadedUrls.push(res.url);
      }

      const created = await addComment(postId, {
        body: newComment.trim(),
        imageUrls: uploadedUrls,
      });
      setComments((prev) => dedupeComments([created, ...prev]));
      setNewComment("");
      setNewCommentImages([]);
      if (onCommentCountChange && typeof created?.postCommentCount === "number") {
        onCommentCountChange(created.postCommentCount, true);
      }
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
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "#F8FAFC",
            borderRadius: "8px",
            border: "1px dashed #CBD5E1",
            textAlign: "center",
            color: "#64748B",
            fontSize: "13px",
            margin: "8px 0",
          }}
        >
          🔒 Tác giả đã tắt tính năng bình luận cho bài viết này.
        </div>
      ) : (
        isAuthenticated && (
          <div className="comment-input-row" style={{ flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", width: "100%", alignItems: "center", gap: "8px" }}>
              <img className="comment-input-avatar" src={user?.avatar || defaultAvatar} alt="" />
              <div className="comment-input-wrapper" style={{ flex: 1 }}>
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
                  type="button"
                  className="comment-image-btn"
                  onClick={() => rootFileInputRef.current?.click()}
                  title="Thêm ảnh (tối đa 4 ảnh, tối đa 5MB/ảnh)"
                  style={{
                    background: "none",
                    border: "none",
                    padding: "6px",
                    cursor: "pointer",
                    color: "#64748B",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <ImageIcon size={18} color="#64748B" />
                </button>
                <input
                  ref={rootFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    handleAddNewCommentImages(Array.from(e.target.files || []));
                    if (rootFileInputRef.current) rootFileInputRef.current.value = "";
                  }}
                />
                <button
                  className="comment-send-btn"
                  onClick={handleSendComment}
                  disabled={(!newComment.trim() && newCommentImages.length === 0) || sending}
                  title="Gửi"
                >
                  ➤
                </button>
              </div>
            </div>

            {/* Attached images preview */}
            {newCommentImages.length > 0 && (
              <div style={{ marginLeft: "48px" }}>
                <ImagePickerRow
                  images={newCommentImages}
                  disabled={sending}
                  onAdd={handleAddNewCommentImages}
                  onRemove={(idx) => setNewCommentImages((prev) => prev.filter((_, i) => i !== idx))}
                />
              </div>
            )}
          </div>
        )
      )}

      {/* Initial loading skeleton */}
      {loading && !loaded && <CommentSkeleton count={3} />}

      {/* Comments list */}
      {comments.map((c) => (
        <CommentItem
          key={c.id}
          comment={c}
          postId={postId}
          targetCommentId={targetCommentId}
          highlightedId={highlightedId}
          setHighlightedId={setHighlightedId}
          onOpenHistory={(target) => setHistoryModalComment(target)}
          onOpenImageLightbox={(url) => setLightboxImage(url)}
          onCommentAdded={(count, isExact) => onCommentCountChange && onCommentCountChange(count, isExact)}
          onCommentDeleted={(deletedId, countRemoved = 1) => {
            setComments((prev) => prev.filter((item) => item.id !== deletedId));
            if (onCommentCountChange) onCommentCountChange(-countRemoved, false);
          }}
        />
      ))}

      {/* Loading skeleton for subsequent pages */}
      {loading && loaded && <CommentSkeleton count={2} />}

      {/* Manual load more button (only before the first click) */}
      {hasMore && loaded && !autoLoadMore && comments.length > 0 && !loading && (
        <button className="comment-load-more" onClick={handleFirstLoadMore}>
          Xem thêm bình luận
        </button>
      )}

      {/* Invisible sentinel element to trigger auto scroll after 1st click */}
      {hasMore && autoLoadMore && <div ref={commentSentinelRef} style={{ height: 1 }} />}

      {/* Comment Edit History Modal */}
      {historyModalComment && (
        <CommentEditHistoryModal
          commentId={historyModalComment.id}
          currentComment={historyModalComment}
          fetchHistory={(cid) => getCommentEditHistory(cid)}
          onClose={() => setHistoryModalComment(null)}
        />
      )}

      {/* Lightbox for comment images */}
      {lightboxImage && (
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
          onClick={() => setLightboxImage(null)}
        >
          <img
            src={lightboxImage}
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
