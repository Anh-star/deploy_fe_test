import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { votePost, toggleSavePost, deletePost, updatePost, votePollOption, getPollVoters, addPollOption, togglePostNotifications, togglePinPost } from "../../api/communityApi";
import { supabase } from "../../supabaseClient";
import { userHasAvatar } from "../../utils/avatarDisplay";
import { timeAgo } from "../../utils/dateUtils";
import { UpvoteIcon, DownvoteIcon, CommentBubbleIcon, BookmarkRibbonIcon, LockIcon, UsersIcon, DownloadIcon, ChartIcon, DocumentIcon, BellIcon, BellOffIcon, PinIcon, PencilIcon, TrashIcon, FlagIcon, MoreHorizontalIcon } from "../icons";
import ImageGallery from "./ImageGallery";
import CommentSection from "./CommentSection";
import ConfirmDialog from "./ConfirmDialog";
import ReportPostModal from "./ReportPostModal";
import AutoLinkText from "../AutoLinkText";
import { useSSE } from "../../hooks/useSSE";

const COMMUNITY_BUCKET = "documents";
const MAX_IMAGES = 4;

export default function PostCard({ post, onPostDeleted, onPostSavedChange, onPostUpdated, hideOptionsMenu = false, defaultShowComments = false, showPinnedBadge = false }) {
  const { user, isAuthenticated } = useAuth();
  const notification = useNotification();

  // Vote state
  const [userVote, setUserVote] = useState(post.currentUserVote || null);
  const [upvoteCount, setUpvoteCount] = useState(post.upvoteCount || 0);
  const [downvoteCount, setDownvoteCount] = useState(post.downvoteCount || 0);

  // Saved & Notification Mute state (DB-backed)
  const [isSaved, setIsSaved] = useState(post.isSaved || false);
  const [isMuted, setIsMuted] = useState(post.isMuted || false);
  const [isPinned, setIsPinned] = useState(post.isPinned || false);

  const handleTogglePin = async () => {
    try {
      const updated = await togglePinPost(post.id);
      setIsPinned(Boolean(updated?.isPinned));
      setShowMenu(false);
      if (updated?.isPinned) {
        notification.success("Đã ghim bài viết lên trang cá nhân!");
      } else {
        notification.info("Đã bỏ ghim bài viết.");
      }
      if (onPostUpdated && updated) {
        onPostUpdated(updated);
      }
    } catch (err) {
      notification.error(err.response?.data?.message || err.message || "Không thể ghim bài viết.");
    }
  };

  // Poll state
  const [poll, setPoll] = useState(post.poll || null);
  const [showVotersModal, setShowVotersModal] = useState(false);
  const [votersList, setVotersList] = useState([]);
  const [votersOptionText, setVotersOptionText] = useState("");
  const [loadingVoters, setLoadingVoters] = useState(false);
  const [newOptionText, setNewOptionText] = useState("");
  const [addingOption, setAddingOption] = useState(false);

  const [commentCount, setCommentCount] = useState(post.commentCount || 0);
  const [showCommentsModal, setShowCommentsModal] = useState(defaultShowComments);

  // Prevent body scroll when comment popup modal is open
  useEffect(() => {
    if (showCommentsModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showCommentsModal]);

  // Real-time SSE updates for post votes and comment count
  useSSE({
    "post-voted": (data) => {
      if (data && String(data.postId) === String(post.id)) {
        if (typeof data.upvoteCount === "number") setUpvoteCount(data.upvoteCount);
        if (typeof data.downvoteCount === "number") setDownvoteCount(data.downvoteCount);
      }
    },
    "new-comment": (data) => {
      if (data && String(data.postId) === String(post.id)) {
        setCommentCount((prev) => prev + 1);
      }
    },
  });
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Options menu dropdown
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  // Edit post state
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content || "");
  const [editImages, setEditImages] = useState([]);
  const [updating, setUpdating] = useState(false);
  const editFileInputRef = useRef(null);

  const userRoles = Array.isArray(user?.roles) ? user.roles : [];
  const isModerator = userRoles.includes("COMMUNITY_MODERATOR") || userRoles.includes("ADMIN") || userRoles.includes("ROLE_COMMUNITY_MODERATOR") || userRoles.includes("ROLE_ADMIN");
  const isOwner = user?.id && post.authorId && user.id === post.authorId;
  const isPostDisabled = isModerator || post.isHidden || post.isReported || (post.reportCount && post.reportCount > 0);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleVote = async (targetVote) => {
    if (!isAuthenticated) {
      notification.info("Vui lòng đăng nhập để tương tác bài viết.");
      return;
    }

    const prevVote = userVote;
    const prevUp = upvoteCount;
    const prevDown = downvoteCount;

    // Optimistic UI Update
    if (prevVote === targetVote) {
      setUserVote(null);
      if (targetVote === "UPVOTE") setUpvoteCount(c => Math.max(0, c - 1));
      else setDownvoteCount(c => Math.max(0, c - 1));
    } else if (prevVote === null) {
      setUserVote(targetVote);
      if (targetVote === "UPVOTE") setUpvoteCount(c => c + 1);
      else setDownvoteCount(c => c + 1);
    } else {
      setUserVote(targetVote);
      if (targetVote === "UPVOTE") {
        setUpvoteCount(c => c + 1);
        setDownvoteCount(c => Math.max(0, c - 1));
      } else {
        setDownvoteCount(c => c + 1);
        setUpvoteCount(c => Math.max(0, c - 1));
      }
    }

    try {
      const res = await votePost(post.id, targetVote);
      if (res) {
        setUserVote(res.currentUserVote);
        setUpvoteCount(res.upvoteCount);
        setDownvoteCount(res.downvoteCount);
      }
    } catch (err) {
      setUserVote(prevVote);
      setUpvoteCount(prevUp);
      setDownvoteCount(prevDown);
      notification.error("Thao tác bình chọn thất bại.");
    }
  };

  const handleSaveToggle = async () => {
    if (!isAuthenticated) {
      notification.info("Vui lòng đăng nhập để lưu bài viết.");
      return;
    }

    const nextSavedState = !isSaved;
    setIsSaved(nextSavedState);

    try {
      const res = await toggleSavePost(post.id);
      setIsSaved(res.isSaved);
      if (onPostSavedChange) {
        onPostSavedChange(post.id, res.isSaved);
      }
      if (res.isSaved) {
        notification.success("Đã lưu bài viết vào danh sách của bạn!");
      } else {
        notification.info("Đã bỏ lưu bài viết.");
      }
    } catch (err) {
      setIsSaved(!nextSavedState);
      notification.error("Không thể thay đổi trạng thái lưu bài viết.");
    }
  };

  // Keep isMuted in sync with post prop
  useEffect(() => {
    if (post.isMuted !== undefined) {
      setIsMuted(post.isMuted);
    }
  }, [post.isMuted]);

  const handleCommentCountChange = useCallback((delta) => {
    queueMicrotask(() => {
      setCommentCount((c) => Math.max(0, c + delta));
    });
  }, []);

  const handleToggleNotifications = async () => {
    if (!isAuthenticated) {
      notification.info("Vui lòng đăng nhập để bật/tắt thông báo.");
      return;
    }
    const prevMuted = isMuted;
    const nextMuted = !prevMuted;
    setIsMuted(nextMuted);
    setShowMenu(false);
    try {
      const res = await togglePostNotifications(post.id);
      const newMutedState = typeof res?.isMuted === "boolean" ? res.isMuted : nextMuted;
      setIsMuted(newMutedState);
      if (newMutedState) {
        notification.info("Đã tắt thông báo cho bài viết này.");
      } else {
        notification.success("Đã bật thông báo cho bài viết này.");
      }
    } catch (err) {
      setIsMuted(prevMuted);
      const errMsg = err?.response?.data?.message || err?.message || "Không thể thay đổi cài đặt thông báo.";
      notification.error(errMsg);
    }
  };

  const handleDelete = () => {
    setShowConfirm(true);
  };

  const executeDelete = async () => {
    setDeleting(true);
    setShowConfirm(false);
    try {
      await deletePost(post.id);
      notification.success("Đã xóa bài viết.");
      if (onPostDeleted) onPostDeleted(post.id);
    } catch (err) {
      notification.error(err.message || "Không thể xóa bài viết.");
    } finally {
      setDeleting(false);
    }
  };

  const handlePollVote = async (optionId) => {
    if (!isAuthenticated) {
      notification.info("Vui lòng đăng nhập để bình chọn.");
      return;
    }
    try {
      const updatedPoll = await votePollOption(poll.id, optionId);
      setPoll(updatedPoll);
      notification.success("Đã bình chọn thành công!");
    } catch (err) {
      notification.error(err.response?.data?.message || err.message || "Không thể thực hiện bình chọn.");
    }
  };

  const handleViewVoters = async (e, optionId, optionText) => {
    e.stopPropagation();
    setVotersOptionText(optionText);
    setShowVotersModal(true);
    setLoadingVoters(true);
    try {
      const list = await getPollVoters(optionId);
      setVotersList(list || []);
    } catch (err) {
      notification.error("Không thể lấy danh sách người bình chọn.");
    } finally {
      setLoadingVoters(false);
    }
  };

  const handleAddOptionSubmit = async (e) => {
    e.preventDefault();
    if (!newOptionText.trim()) return;
    setAddingOption(true);
    try {
      const updatedPoll = await addPollOption(poll.id, newOptionText.trim());
      setPoll(updatedPoll);
      setNewOptionText("");
      notification.success("Đã thêm phương án khảo sát mới!");
    } catch (err) {
      notification.error(err.response?.data?.message || err.message || "Không thể thêm phương án.");
    } finally {
      setAddingOption(false);
    }
  };

  const startEditing = () => {
    const existing = (post.imageUrls || []).map((url) => ({
      url,
      isExisting: true,
    }));
    setEditImages(existing);
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

  const renderAvatar = () => {
    if (userHasAvatar({ avatar: post.authorAvatar })) {
      return (
        <img
          className="post-card-avatar"
          src={post.authorAvatar}
          alt={post.authorName || "User"}
        />
      );
    }
    const nameStr = post.authorName || "U";
    const initials = nameStr.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "U";
    return (
      <span className="post-card-avatar avatar-dark-circle">
        {initials}
      </span>
    );
  };

  // Extract display title & content
  let displayTitle = post.title || "";
  let displayContent = post.content || "";

  if (!displayTitle && displayContent) {
    const h2Match = displayContent.match(/^<h2>(.*?)<\/h2>\n?([\s\S]*)$/i);
    if (h2Match) {
      displayTitle = h2Match[1];
      displayContent = h2Match[2];
    }
  }

  const isHtml = /<[a-z][\s\S]*>/i.test(displayContent);

  if (post.isHidden && !isModerator) {
    return null;
  }

  return (
    <div className="post-card">

      {isPinned && showPinnedBadge && (
        <div className="pinned-post-badge">
          <PinIcon size={14} color="#D97706" /> Bài viết đã ghim
        </div>
      )}

      {/* Header */}
      <div className="post-card-header">
        <Link to={post.authorId ? `/profile/${post.authorId}` : "#"} className="post-card-author-link" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", color: "inherit" }}>
          {renderAvatar()}
          <div className="post-card-header-meta">
            <span className="post-author-name">{post.authorName || "Người dùng"}</span>
            <span className="post-meta-dot">·</span>
            <span className="post-time">{timeAgo(post.createdAt)}</span>
          </div>
        </Link>

        {/* Dropdown Options */}
        {isAuthenticated && !hideOptionsMenu && !post.isHidden && (
          <div className="post-card-options-container" ref={menuRef}>
            <button
              className="post-card-options-btn"
              onClick={() => setShowMenu(!showMenu)}
              title="Tùy chọn"
              style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <MoreHorizontalIcon size={18} color="#64748B" />
            </button>
            {showMenu && (
              <div className="post-card-dropdown">
                <button className="post-dropdown-item" onClick={handleToggleNotifications} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {isMuted ? <BellIcon size={16} color="#3B82F6" /> : <BellOffIcon size={16} color="#64748B" />}
                  <span>{isMuted ? "Bật thông báo bài viết" : "Tắt thông báo bài viết"}</span>
                </button>
                {isOwner ? (
                  <>
                    <button className="post-dropdown-item" onClick={handleTogglePin} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <PinIcon size={16} color={isPinned ? "#D97706" : "#64748B"} />
                      <span>{isPinned ? "Bỏ ghim bài viết" : "Ghim lên trang cá nhân"}</span>
                    </button>
                    <button className="post-dropdown-item" onClick={startEditing} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <PencilIcon size={16} color="#2563EB" />
                      <span>Chỉnh sửa bài viết</span>
                    </button>
                    <button
                      className="post-dropdown-item danger"
                      onClick={() => {
                        handleDelete();
                        setShowMenu(false);
                      }}
                      style={{ display: "flex", alignItems: "center", gap: "8px" }}
                    >
                      <TrashIcon size={16} color="#DC2626" />
                      <span>Xóa bài viết</span>
                    </button>
                  </>
                ) : (
                  <button
                    className="post-dropdown-item danger"
                    onClick={() => {
                      setShowReportModal(true);
                      setShowMenu(false);
                    }}
                    style={{ display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    <FlagIcon size={16} color="#DC2626" />
                    <span>Báo cáo bài viết</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
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
        <div className="post-card-body">
          {displayTitle && <h2 className="post-card-title">{displayTitle}</h2>}
          {displayContent && (
            isHtml ? (
              <div className="post-card-text" dangerouslySetInnerHTML={{ __html: displayContent }} />
            ) : (
              <div className="post-card-text"><AutoLinkText text={displayContent} /></div>
            )
          )}
          {post.tags && post.tags.length > 0 && (
            <div className="post-card-tags-row" style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {post.tags.map((tag, idx) => (
                <span key={idx} className="tag-chip-item" style={{ cursor: "default" }}>
                  {tag.startsWith("#") ? tag : `#${tag}`}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Attached Images */}
      {!isEditing && <ImageGallery imageUrls={post.imageUrls} />}

      {/* Attached Files (Documents) */}
      {!isEditing && post.fileUrls && post.fileUrls.length > 0 && (
        <div className="post-card-files">
          {post.fileUrls.map((url, i) => {
            const filename = url.split("/").pop().replace(/^\d+_/, "") || `Tải liệu ${i + 1}`;
            return (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="post-file-card">
                <span className="file-card-icon"><DocumentIcon size={18} color="#2563EB" /></span>
                <span className="file-card-name">{filename}</span>
                <span className="file-card-download" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  Tải xuống <DownloadIcon size={14} color="currentColor" />
                </span>
              </a>
            );
          })}
        </div>
      )}

      {/* Poll Section */}
      {!isEditing && poll && (
        <div className="post-card-poll">
          <div className="poll-header-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ChartIcon size={18} color="#2563EB" />
            <span>{poll.question}</span>
          </div>
          
          {poll.hideResultsBeforeVote && !poll.hasCurrentUserVoted && (
            <div className="poll-hidden-notice" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <LockIcon size={14} color="#64748B" />
              <span>Kết quả bị ẩn cho đến khi bạn thực hiện bình chọn</span>
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
                          <UsersIcon size={14} color="#475569" />
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

      {/* Stats Row & Action Bar (Hidden when post is hidden or reported) */}
      {!isPostDisabled ? (
        <>
          <div className="post-card-stats-row">
            <div className="post-stats-left" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="post-stats-item">
                <span className="post-stats-icon">
                  <UpvoteIcon size={15} color="#2563EB" />
                </span>
                <span>{upvoteCount} lượt upvote</span>
              </span>
              <span className="post-stats-item">
                <span className="post-stats-icon">
                  <DownvoteIcon size={15} color="#DC2626" />
                </span>
                <span>{downvoteCount} lượt downvote</span>
              </span>
            </div>
            <div className="post-stats-right">
              <span className="post-stats-item">
                <span className="post-stats-icon">
                  <CommentBubbleIcon size={15} color="#64748B" />
                </span>
                <span>{commentCount} bình luận</span>
              </span>
              <span className="post-stats-item">
                <span className="post-stats-icon">
                  <BookmarkRibbonIcon size={15} color="#64748B" />
                </span>
                <span>{post.savedCount || (isSaved ? 1 : 0)} lượt lưu</span>
              </span>
            </div>
          </div>

          <div className="post-card-actions-bar">
            <button
              type="button"
              className={`action-segment-btn ${userVote === "UPVOTE" ? "active-upvote" : ""}`}
              onClick={() => handleVote("UPVOTE")}
            >
              <span className="segment-icon">
                <UpvoteIcon size={16} color={userVote === "UPVOTE" ? "#2563EB" : "#475569"} filled={userVote === "UPVOTE"} />
              </span>
              <span>Upvote {upvoteCount > 0 ? `(${upvoteCount})` : ""}</span>
            </button>

            <button
              type="button"
              className={`action-segment-btn ${userVote === "DOWNVOTE" ? "active-downvote" : ""}`}
              onClick={() => handleVote("DOWNVOTE")}
            >
              <span className="segment-icon">
                <DownvoteIcon size={16} color={userVote === "DOWNVOTE" ? "#DC2626" : "#475569"} filled={userVote === "DOWNVOTE"} />
              </span>
              <span>Downvote {downvoteCount > 0 ? `(${downvoteCount})` : ""}</span>
            </button>

            <button
              type="button"
              className={`action-segment-btn ${showCommentsModal ? "active-comments" : ""}`}
              onClick={() => {
                if (post.allowComments === false) {
                  notification.info("Bài viết này đã bị tắt bình luận.");
                } else {
                  setShowCommentsModal(true);
                }
              }}
            >
              <span className="segment-icon">
                <CommentBubbleIcon size={16} color={showCommentsModal ? "#2563EB" : "#475569"} />
              </span>
              <span>Bình luận</span>
            </button>

            <button
              type="button"
              className={`action-segment-btn ${isSaved ? "active-saved" : ""}`}
              onClick={handleSaveToggle}
            >
              <span className="segment-icon">
                <BookmarkRibbonIcon size={16} color={isSaved ? "#6366F1" : "#475569"} filled={isSaved} />
              </span>
              <span>{isSaved ? "Đã lưu" : "Lưu"}</span>
            </button>
          </div>
        </>
      ) : null}

      {/* Post Popup Detail & Comment Modal (Facebook Style) */}
      {showCommentsModal && (
        <div
          className="post-modal-overlay"
          onClick={() => setShowCommentsModal(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            className="post-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "680px",
              maxHeight: "90vh",
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderBottom: "1px solid #E2E8F0",
                backgroundColor: "#ffffff",
                position: "sticky",
                top: 0,
                zIndex: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {renderAvatar()}
                <div>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#0F172A" }}>
                    {post.authorName || "Người dùng"}
                  </h4>
                  <span style={{ fontSize: "12px", color: "#64748B" }}>
                    {timeAgo(post.createdAt)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCommentsModal(false)}
                style={{
                  background: "#F1F5F9",
                  border: "none",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: "16px",
                  color: "#475569",
                  transition: "all 0.2s ease",
                }}
              >
                ✕
              </button>
            </div>

            {/* Scrollable Container (Post Details + Comments) */}
            <div
              style={{
                padding: "20px",
                overflowY: "auto",
                flex: 1,
              }}
            >
              {/* Post Content */}
              <div className="post-card-body" style={{ padding: 0, marginBottom: "16px" }}>
                {displayTitle && <h2 className="post-card-title">{displayTitle}</h2>}
                {displayContent && (
                  isHtml ? (
                    <div className="post-card-text" dangerouslySetInnerHTML={{ __html: displayContent }} />
                  ) : (
                    <div className="post-card-text">{displayContent}</div>
                  )
                )}
                {post.tags && post.tags.length > 0 && (
                  <div className="post-card-tags-row" style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {post.tags.map((tag, idx) => (
                      <span key={idx} className="tag-chip-item" style={{ cursor: "default" }}>
                        {tag.startsWith("#") ? tag : `#${tag}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Attached Images */}
              <ImageGallery imageUrls={post.imageUrls} />

              {/* Attached Files */}
              {post.fileUrls && post.fileUrls.length > 0 && (
                <div className="post-card-files" style={{ marginBottom: "16px" }}>
                  {post.fileUrls.map((url, i) => {
                    const filename = url.split("/").pop().replace(/^\d+_/, "") || `Tải liệu ${i + 1}`;
                    return (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="post-file-card">
                        <span className="file-card-icon"><DocumentIcon size={18} color="#2563EB" /></span>
                        <span className="file-card-name">{filename}</span>
                        <span className="file-card-download" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          Tải xuống <DownloadIcon size={14} color="currentColor" />
                        </span>
                      </a>
                    );
                  })}
                </div>
              )}

              {/* Poll Section */}
              {poll && (
                <div className="post-card-poll" style={{ marginBottom: "16px" }}>
                  <div className="poll-header-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <ChartIcon size={18} color="#2563EB" />
                    <span>{poll.question}</span>
                  </div>
                  
                  {poll.hideResultsBeforeVote && !poll.hasCurrentUserVoted && (
                    <div className="poll-hidden-notice" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <LockIcon size={14} color="#64748B" />
                      <span>Kết quả bị ẩn cho đến khi bạn thực hiện bình chọn</span>
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
                                  <UsersIcon size={14} color="#475569" />
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

              {/* Stats & Actions */}
              <div className="post-card-stats-row">
                <div className="post-stats-left" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="post-stats-item">
                    <span className="post-stats-icon"><UpvoteIcon size={15} color="#2563EB" /></span>
                    <span>{upvoteCount} lượt upvote</span>
                  </span>
                  <span className="post-stats-item">
                    <span className="post-stats-icon"><DownvoteIcon size={15} color="#DC2626" /></span>
                    <span>{downvoteCount} lượt downvote</span>
                  </span>
                </div>
                <div className="post-stats-right">
                  <span className="post-stats-item">
                    <span className="post-stats-icon"><CommentBubbleIcon size={15} color="#64748B" /></span>
                    <span>{commentCount} bình luận</span>
                  </span>
                </div>
              </div>

              <div className="post-card-actions-bar" style={{ marginBottom: "16px" }}>
                <button
                  type="button"
                  className={`action-segment-btn ${userVote === "UPVOTE" ? "active-upvote" : ""}`}
                  onClick={() => handleVote("UPVOTE")}
                >
                  <span className="segment-icon">
                    <UpvoteIcon size={16} color={userVote === "UPVOTE" ? "#2563EB" : "#475569"} filled={userVote === "UPVOTE"} />
                  </span>
                  <span>Upvote {upvoteCount > 0 ? `(${upvoteCount})` : ""}</span>
                </button>

                <button
                  type="button"
                  className={`action-segment-btn ${userVote === "DOWNVOTE" ? "active-downvote" : ""}`}
                  onClick={() => handleVote("DOWNVOTE")}
                >
                  <span className="segment-icon">
                    <DownvoteIcon size={16} color={userVote === "DOWNVOTE" ? "#DC2626" : "#475569"} filled={userVote === "DOWNVOTE"} />
                  </span>
                  <span>Downvote {downvoteCount > 0 ? `(${downvoteCount})` : ""}</span>
                </button>

                <button
                  type="button"
                  className={`action-segment-btn ${isSaved ? "active-saved" : ""}`}
                  onClick={handleSaveToggle}
                >
                  <span className="segment-icon">
                    <BookmarkRibbonIcon size={16} color={isSaved ? "#6366F1" : "#475569"} filled={isSaved} />
                  </span>
                  <span>{isSaved ? "Đã lưu" : "Lưu"}</span>
                </button>
              </div>

              <hr style={{ border: "none", borderTop: "1px solid #E2E8F0", margin: "16px 0" }} />

              {/* Comment Section */}
              <CommentSection
                postId={post.id}
                onCommentCountChange={handleCommentCountChange}
              />
            </div>
          </div>
        </div>
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
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                <UsersIcon size={18} color="#2563EB" />
                <span>Người chọn "{votersOptionText}"</span>
              </span>
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

      {/* Report Post Modal */}
      {showReportModal && (
        <ReportPostModal
          postId={post.id}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
}
