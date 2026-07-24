import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { votePost, toggleSavePost, deletePost, updatePost, votePollOption, getPollVoters, addPollOption } from "../../api/communityApi";
import { supabase } from "../../supabaseClient";
import ImageGallery from "./ImageGallery";
import CommentSection from "./CommentSection";
import ConfirmDialog from "./ConfirmDialog";

const COMMUNITY_BUCKET = "documents";
const MAX_IMAGES = 4;

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

export default function PostCard({ post, onPostDeleted, onPostSavedChange }) {
  const { user, isAuthenticated } = useAuth();
  const notification = useNotification();

  // Vote state
  const [userVote, setUserVote] = useState(post.currentUserVote || null); // "UPVOTE" | "DOWNVOTE" | null
  const [upvoteCount, setUpvoteCount] = useState(post.upvoteCount || 0);
  const [downvoteCount, setDownvoteCount] = useState(post.downvoteCount || 0);

  // Saved Post state (DB-backed)
  const [isSaved, setIsSaved] = useState(post.isSaved || false);

  // Poll state
  const [poll, setPoll] = useState(post.poll || null);
  const [showVotersModal, setShowVotersModal] = useState(false);
  const [votersList, setVotersList] = useState([]);
  const [votersOptionText, setVotersOptionText] = useState("");
  const [loadingVoters, setLoadingVoters] = useState(false);
  const [newOptionText, setNewOptionText] = useState("");
  const [addingOption, setAddingOption] = useState(false);

  const [commentCount, setCommentCount] = useState(post.commentCount || 0);
  const [showComments, setShowComments] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Options menu dropdown
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content || "");
  const [editImages, setEditImages] = useState([]);
  const [updating, setUpdating] = useState(false);
  const editFileInputRef = useRef(null);

  const isOwner = user && post.authorId === user.id;

  useEffect(() => {
    setIsSaved(post.isSaved || false);
    setUserVote(post.currentUserVote || null);
    setUpvoteCount(post.upvoteCount || 0);
    setDownvoteCount(post.downvoteCount || 0);
    setPoll(post.poll || null);
  }, [post]);

  useEffect(() => {
    if (!showMenu) return;
    const closeMenu = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, [showMenu]);

  // Handle Reddit Upvote / Downvote
  const handleVote = async (targetVoteType) => {
    if (!isAuthenticated) {
      notification.error("Vui lòng đăng nhập để bình chọn bài viết.");
      return;
    }
    try {
      const updated = await votePost(post.id, targetVoteType);
      setUserVote(updated.currentUserVote);
      setUpvoteCount(updated.upvoteCount || 0);
      setDownvoteCount(updated.downvoteCount || 0);
    } catch {
      notification.error("Không thể thực hiện bình chọn.");
    }
  };

  // Handle Save / Unsave (DB)
  const handleSaveToggle = async () => {
    if (!isAuthenticated) {
      notification.error("Vui lòng đăng nhập để lưu bài viết.");
      return;
    }
    try {
      const res = await toggleSavePost(post.id);
      setIsSaved(res.isSaved);
      notification.success(res.isSaved ? "Đã lưu bài viết." : "Đã bỏ lưu bài viết.");
      if (onPostSavedChange) {
        onPostSavedChange(post.id, res.isSaved);
      }
    } catch {
      notification.error("Không thể thực hiện thao tác lưu bài viết.");
    } finally {
      setShowMenu(false);
    }
  };

  // Handle Poll Option Voting
  const handlePollVote = async (optionId) => {
    if (!isAuthenticated) {
      notification.error("Vui lòng đăng nhập để bình chọn khảo sát.");
      return;
    }
    try {
      const updatedPoll = await votePollOption(poll.id, optionId);
      setPoll(updatedPoll);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Bình chọn thất bại.";
      notification.error(msg);
    }
  };

  const handleViewVoters = async (e, optionId, optionText) => {
    e.stopPropagation();
    setVotersOptionText(optionText);
    setLoadingVoters(true);
    setShowVotersModal(true);
    try {
      const voters = await getPollVoters(optionId);
      setVotersList(voters || []);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Không thể tải danh sách người bình chọn.";
      notification.error(msg);
      setShowVotersModal(false);
    } finally {
      setLoadingVoters(false);
    }
  };

  const handleAddOptionSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      notification.error("Vui lòng đăng nhập để thêm phương án.");
      return;
    }
    const val = newOptionText.trim();
    if (!val) return;

    setAddingOption(true);
    try {
      const updatedPoll = await addPollOption(poll.id, val);
      setPoll(updatedPoll);
      setNewOptionText("");
      notification.success("Đã thêm phương án mới!");
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Thêm phương án thất bại.";
      notification.error(msg);
    } finally {
      setAddingOption(false);
    }
  };

  const handleDelete = () => {
    setShowConfirm(true);
  };

  const executeDelete = async () => {
    setShowConfirm(false);
    setDeleting(true);
    try {
      await deletePost(post.id);
      notification.success("Đã xóa bài viết.");
      if (onPostDeleted) onPostDeleted(post.id);
    } catch {
      notification.error("Không thể xóa bài viết.");
    } finally {
      setDeleting(false);
    }
  };

  const startEditing = () => {
    setEditContent(post.content || "");
    setEditImages(
      (post.imageUrls || []).map((url) => ({
        url,
        isExisting: true,
      }))
    );
    setIsEditing(true);
    setShowMenu(false);
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (editImages.length + files.length > MAX_IMAGES) {
      notification.error(`Tối đa ${MAX_IMAGES} ảnh mỗi bài viết.`);
      return;
    }

    const newImages = files.map((file) => ({
      url: URL.createObjectURL(file),
      isExisting: false,
      file,
    }));
    setEditImages((prev) => [...prev, ...newImages]);
    e.target.value = "";
  };

  const removeEditImage = (idx) => {
    setEditImages((prev) => {
      const updated = [...prev];
      if (!updated[idx].isExisting) {
        URL.revokeObjectURL(updated[idx].url);
      }
      updated.splice(idx, 1);
      return updated;
    });
  };

  const uploadNewImages = async () => {
    const urls = [];
    for (const img of editImages) {
      if (img.isExisting) {
        urls.push(img.url);
      } else {
        const file = img.file;
        const ext = file.name.split(".").pop();
        const fileName = `community/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error } = await supabase.storage
          .from(COMMUNITY_BUCKET)
          .upload(fileName, file, { upsert: false });

        if (error) throw new Error(`Upload failed: ${error.message}`);

        const { data: urlData } = supabase.storage
          .from(COMMUNITY_BUCKET)
          .getPublicUrl(fileName);

        urls.push(urlData.publicUrl);
      }
    }
    return urls;
  };

  const handleUpdate = async () => {
    if (!editContent.trim()) {
      notification.error("Nội dung không được để trống.");
      return;
    }
    setUpdating(true);
    try {
      const uploadedUrls = await uploadNewImages();
      const updated = await updatePost(post.id, {
        content: editContent.trim(),
        imageUrls: uploadedUrls,
      });

      post.content = updated.content;
      post.imageUrls = updated.imageUrls;

      editImages.forEach((img) => {
        if (!img.isExisting) URL.revokeObjectURL(img.url);
      });

      notification.success("Đã cập nhật bài viết.");
      setIsEditing(false);
    } catch (err) {
      notification.error(err.message || "Không thể cập nhật bài viết.");
    } finally {
      setUpdating(false);
    }
  };

  const score = upvoteCount - downvoteCount;
  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(post.authorName || "U")}&background=E2E8F0&color=475569&size=88`;

  return (
    <div className="post-card">
      {/* Header */}
      <div className="post-card-header">
        <img
          className="post-card-avatar"
          src={post.authorAvatar || defaultAvatar}
          alt=""
        />
        <div className="post-card-author">
          <div className="post-card-author-name">{post.authorName || "Người dùng"}</div>
          <div className="post-card-time">
            {timeAgo(post.createdAt)} &bull; 🌐
          </div>
        </div>

        {/* Dropdown Options */}
        <div className="post-card-options-container" ref={menuRef}>
          <button
            className="post-card-options-btn"
            onClick={() => setShowMenu(!showMenu)}
            title="Tùy chọn"
          >
            •••
          </button>
          {showMenu && (
            <div className="post-card-dropdown">
              <button className="post-dropdown-item" onClick={handleSaveToggle}>
                📌 {isSaved ? "Bỏ lưu bài viết" : "Lưu bài viết"}
              </button>
              {isOwner && (
                <>
                  <button className="post-dropdown-item" onClick={startEditing}>
                    ✏️ Chỉnh sửa bài viết
                  </button>
                  <button
                    className="post-dropdown-item danger"
                    onClick={() => {
                      handleDelete();
                      setShowMenu(false);
                    }}
                  >
                    🗑️ Xóa bài viết
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {isEditing ? (
        <div className="post-edit-container">
          <textarea
            className="post-edit-textarea"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
          />
          <div className="post-edit-images-section">
            <div className="create-post-previews" style={{ paddingLeft: 0, margin: "10px 0" }}>
              {editImages.map((img, i) => (
                <div className="create-post-preview-item" key={i}>
                  <img src={img.url} alt={`Edit Preview ${i + 1}`} />
                  <button
                    type="button"
                    className="create-post-preview-remove"
                    onClick={() => removeEditImage(i)}
                    title="Xóa ảnh"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>

            {editImages.length < MAX_IMAGES && (
              <div style={{ marginBottom: "12px" }}>
                <button
                  type="button"
                  className="create-post-image-btn"
                  onClick={() => editFileInputRef.current?.click()}
                  disabled={updating}
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                >
                  🖼️ Thêm ảnh ({editImages.length}/{MAX_IMAGES})
                </button>
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={handleImageSelect}
                />
              </div>
            )}
          </div>

          <div className="post-edit-actions">
            <button
              className="post-edit-btncancel"
              onClick={() => {
                setIsEditing(false);
                setEditContent(post.content);
              }}
              disabled={updating}
            >
              Hủy
            </button>
            <button
              className="post-edit-btnsave"
              onClick={handleUpdate}
              disabled={updating}
            >
              {updating ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </div>
      ) : (
        <div className="post-card-content">{post.content}</div>
      )}

      {/* Attached Images */}
      {!isEditing && <ImageGallery imageUrls={post.imageUrls} />}

      {/* Attached Files (Documents) */}
      {!isEditing && post.fileUrls && post.fileUrls.length > 0 && (
        <div className="post-card-files">
          {post.fileUrls.map((url, i) => {
            const filename = url.split("/").pop().replace(/^\d+_/, "") || `Tài liệu ${i + 1}`;
            return (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="post-file-card">
                <span className="file-card-icon">📄</span>
                <span className="file-card-name">{filename}</span>
                <span className="file-card-download">Tải xuống ⬇️</span>
              </a>
            );
          })}
        </div>
      )}

      {/* Poll Section */}
      {!isEditing && poll && (
        <div className="post-card-poll">
          <div className="poll-header-title">📊 {poll.question}</div>
          
          {poll.hideResultsBeforeVote && !poll.hasCurrentUserVoted && (
            <div className="poll-hidden-notice">
              🔒 Kết quả bị ẩn cho đến khi bạn thực hiện bình chọn
            </div>
          )}

          <div className="poll-options-list">
            {poll.options && poll.options.map((opt) => {
              const showStats = !(poll.hideResultsBeforeVote && !poll.hasCurrentUserVoted);
              const pct = (showStats && poll.totalVotes > 0) ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0;
              const isVoted = opt.isVotedByCurrentUser;
              const canViewVoters = !poll.hideVoters && showStats && opt.voteCount > 0;

              return (
                <div
                  key={opt.id}
                  className={`poll-option-bar-item ${isVoted ? "voted" : ""}`}
                  onClick={() => handlePollVote(opt.id)}
                >
                  <div className="poll-option-fill" style={{ width: `${showStats ? pct : 0}%` }} />
                  <div className="poll-option-label">
                    <span className="poll-option-text">{opt.optionText}</span>
                    <div className="poll-option-right">
                      {showStats ? (
                        <span className="poll-option-stats">
                          {opt.voteCount} vote ({pct}%)
                        </span>
                      ) : (
                        <span className="poll-option-stats hidden-stat">Bình chọn để xem</span>
                      )}
                      {canViewVoters && (
                        <button
                          type="button"
                          className="poll-voters-btn"
                          onClick={(e) => handleViewVoters(e, opt.id, opt.optionText)}
                          title="Xem ai đã bình chọn"
                        >
                          👥
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Option Form */}
          {poll.allowAddOptions && (
            <form className="poll-add-option-form" onSubmit={handleAddOptionSubmit}>
              <input
                type="text"
                className="poll-add-option-input"
                placeholder="+ Thêm phương án khảo sát mới..."
                value={newOptionText}
                onChange={(e) => setNewOptionText(e.target.value)}
              />
              {newOptionText.trim() && (
                <button type="submit" className="poll-add-option-submit" disabled={addingOption}>
                  {addingOption ? "..." : "Thêm"}
                </button>
              )}
            </form>
          )}

          <div className="poll-footer-info">
            {poll.hideResultsBeforeVote && !poll.hasCurrentUserVoted ? (
              <span>Hãy chọn 1 phương án để bình chọn</span>
            ) : (
              <span>Tổng số lượt bình chọn: {poll.totalVotes || 0}</span>
            )}
          </div>
        </div>
      )}

      {/* Actions (Reddit-Style Upvote/Downvote & Comments) */}
      <div className="post-card-actions">
        <div className="reddit-vote-box">
          <button
            className={`vote-btn upvote ${userVote === "UPVOTE" ? "active" : ""}`}
            onClick={() => handleVote("UPVOTE")}
            title="Upvote"
          >
            ▲
          </button>

          <span className={`vote-score ${userVote === "UPVOTE" ? "upvoted" : userVote === "DOWNVOTE" ? "downvoted" : ""}`}>
            {score > 0 ? `+${score}` : score}
          </span>

          <button
            className={`vote-btn downvote ${userVote === "DOWNVOTE" ? "active" : ""}`}
            onClick={() => handleVote("DOWNVOTE")}
            title="Downvote"
          >
            ▼
          </button>
        </div>

        {post.allowComments !== false ? (
          <button
            className="post-action-btn"
            onClick={() => setShowComments(!showComments)}
          >
            💬 {commentCount > 0 ? `${commentCount} ` : ""}Bình luận
          </button>
        ) : (
          <span className="post-comments-disabled" style={{ fontSize: "13px", color: "#94A3B8", display: "flex", alignItems: "center", gap: "4px" }}>
            🚫 Đã tắt bình luận
          </span>
        )}
      </div>

      {/* Comment Section */}
      {showComments && post.allowComments !== false && (
        <CommentSection
          postId={post.id}
          onCommentCountChange={(delta) => setCommentCount((c) => c + delta)}
        />
      )}

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={showConfirm}
        title="Xóa bài viết"
        message="Bạn có chắc chắn muốn xóa bài viết này không? Hành động này không thể hoàn tác."
        confirmLabel="Xóa"
        danger
        onConfirm={executeDelete}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Voters List Modal */}
      {showVotersModal && (
        <div className="voters-modal-overlay" onClick={() => setShowVotersModal(false)}>
          <div className="voters-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="voters-modal-header">
              <span>👥 Người chọn "{votersOptionText}"</span>
              <button className="voters-modal-close" onClick={() => setShowVotersModal(false)}>&times;</button>
            </div>
            <div className="voters-modal-body">
              {loadingVoters ? (
                <div className="voters-loading">Đang tải...</div>
              ) : votersList.length === 0 ? (
                <div className="voters-empty">Chưa có lượt bình chọn nào.</div>
              ) : (
                <div className="voters-list">
                  {votersList.map((voter) => (
                    <div key={voter.userId} className="voter-item">
                      <img
                        src={voter.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${voter.fullName}`}
                        alt={voter.fullName}
                        className="voter-avatar"
                      />
                      <span className="voter-name">{voter.fullName}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
