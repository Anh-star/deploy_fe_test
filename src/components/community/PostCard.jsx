import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { toggleLikePost, deletePost, updatePost } from "../../api/communityApi";
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
  const [liked, setLiked] = useState(post.isLiked || false);
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [commentCount, setCommentCount] = useState(post.commentCount || 0);
  const [showComments, setShowComments] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  // Options menu dropdown
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content || "");
  const [editImages, setEditImages] = useState([]); // { url, isExisting, file }
  const [updating, setUpdating] = useState(false);
  const editFileInputRef = useRef(null);

  // Local storage key isolated by logged-in user id
  const savedLocalStorageKey = user?.id
    ? `community_saved_posts_${user.id}`
    : "community_saved_posts_guest";

  // Saved Post state (via localStorage)
  const getSavedPosts = () => {
    try {
      const saved = localStorage.getItem(savedLocalStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  };

  const [isSaved, setIsSaved] = useState(false);

  // Check saved state whenever user changes or post changes
  useEffect(() => {
    const saved = getSavedPosts();
    setIsSaved(saved.some((p) => p.id === post.id));
  }, [user, post.id, savedLocalStorageKey]);

  const isOwner = user && post.authorId === user.id;
  const likeRef = useRef(null);

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

  const handleLike = async () => {
    if (!isAuthenticated) {
      notification.error("Vui lòng đăng nhập để thích bài viết.");
      return;
    }
    try {
      const result = await toggleLikePost(post.id);
      setLiked(result.isLiked);
      setLikeCount(result.likeCount);
      setLikeAnimating(true);
      setTimeout(() => setLikeAnimating(false), 300);
    } catch {
      notification.error("Không thể thực hiện thao tác.");
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
      
      // If deleted, also remove from local saved posts if present
      let saved = getSavedPosts();
      if (saved.some((p) => p.id === post.id)) {
        saved = saved.filter((p) => p.id !== post.id);
        localStorage.setItem(savedLocalStorageKey, JSON.stringify(saved));
      }

      if (onPostDeleted) onPostDeleted(post.id);
    } catch {
      notification.error("Không thể xóa bài viết.");
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveToggle = () => {
    let saved = getSavedPosts();
    if (isSaved) {
      saved = saved.filter((p) => p.id !== post.id);
      localStorage.setItem(savedLocalStorageKey, JSON.stringify(saved));
      setIsSaved(false);
      notification.success("Đã bỏ lưu bài viết.");
      if (onPostSavedChange) {
        onPostSavedChange(post.id, false);
      }
    } else {
      saved.push(post);
      localStorage.setItem(savedLocalStorageKey, JSON.stringify(saved));
      setIsSaved(true);
      notification.success("Đã lưu bài viết.");
      if (onPostSavedChange) {
        onPostSavedChange(post.id, true);
      }
    }
    setShowMenu(false);
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

        if (error) {
          throw new Error(`Upload failed: ${error.message}`);
        }

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

      // Cleanup preview URLs
      editImages.forEach((img) => {
        if (!img.isExisting) {
          URL.revokeObjectURL(img.url);
        }
      });

      // Update local storage if saved
      let saved = getSavedPosts();
      const idx = saved.findIndex((p) => p.id === post.id);
      if (idx !== -1) {
        saved[idx].content = updated.content;
        saved[idx].imageUrls = updated.imageUrls;
        localStorage.setItem(savedLocalStorageKey, JSON.stringify(saved));
      }

      notification.success("Đã cập nhật bài viết.");
      setIsEditing(false);
    } catch (err) {
      notification.error(err.message || "Không thể cập nhật bài viết.");
    } finally {
      setUpdating(false);
    }
  };

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
          
          {/* Edit images gallery */}
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

      {/* Images (normal mode) */}
      {!isEditing && <ImageGallery imageUrls={post.imageUrls} />}

      {/* Actions */}
      <div className="post-card-actions">
        <button
          ref={likeRef}
          className={`post-action-btn ${liked ? "liked" : ""}`}
          onClick={handleLike}
        >
          <span className={likeAnimating ? "like-pop" : ""}>
            {liked ? "👍" : "👍"}
          </span>
          {likeCount > 0 ? ` ${likeCount}` : ""} Thích
        </button>
        <button
          className="post-action-btn"
          onClick={() => setShowComments(!showComments)}
        >
          💬 {commentCount > 0 ? `${commentCount} ` : ""}Bình luận
        </button>
      </div>

      {/* Comment Section */}
      {showComments && (
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
    </div>
  );
}
