import { useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { supabase } from "../../supabaseClient";
import { createPost } from "../../api/communityApi";

const COMMUNITY_BUCKET = "documents";
const MAX_IMAGES = 4;

export default function CreatePostBox({ onPostCreated }) {
  const { user } = useAuth();
  const notification = useNotification();
  const [content, setContent] = useState("");
  const [previewFiles, setPreviewFiles] = useState([]); // { file, previewUrl }
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (previewFiles.length + files.length > MAX_IMAGES) {
      notification.error(`Tối đa ${MAX_IMAGES} ảnh mỗi bài viết.`);
      return;
    }

    const newPreviews = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setPreviewFiles((prev) => [...prev, ...newPreviews]);

    // Reset input so the same file can be selected again
    e.target.value = "";
  };

  const removeImage = (idx) => {
    setPreviewFiles((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[idx].previewUrl);
      updated.splice(idx, 1);
      return updated;
    });
  };

  const uploadImagesToSupabase = async () => {
    const urls = [];
    for (const { file } of previewFiles) {
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
    return urls;
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      notification.error("Vui lòng nhập nội dung bài viết.");
      return;
    }

    setUploading(true);
    try {
      let imageUrls = [];
      if (previewFiles.length > 0) {
        imageUrls = await uploadImagesToSupabase();
      }

      const newPost = await createPost({
        content: content.trim(),
        imageUrls: imageUrls.length > 0 ? imageUrls : null,
      });

      // Cleanup
      previewFiles.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
      setContent("");
      setPreviewFiles([]);

      notification.success("Đăng bài thành công!");
      if (onPostCreated) onPostCreated(newPost);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Đăng bài thất bại.";
      notification.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || "U")}&background=E2E8F0&color=475569&size=88`;

  return (
    <div className="create-post-box">
      <div className="create-post-header">
        <img
          className="create-post-avatar"
          src={user?.avatar || defaultAvatar}
          alt=""
        />
        <textarea
          ref={textareaRef}
          className="create-post-textarea"
          placeholder={`${user?.fullName || "Bạn"} ơi, bạn đang nghĩ gì?`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
        />
      </div>

      {/* Image previews */}
      {previewFiles.length > 0 && (
        <div className="create-post-previews">
          {previewFiles.map((p, i) => (
            <div className="create-post-preview-item" key={i}>
              <img src={p.previewUrl} alt={`Preview ${i + 1}`} />
              <button
                className="create-post-preview-remove"
                onClick={() => removeImage(i)}
                title="Xóa ảnh"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="create-post-actions">
        <div>
          <button
            className="create-post-image-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={previewFiles.length >= MAX_IMAGES || uploading}
          >
            🖼️ Ảnh ({previewFiles.length}/{MAX_IMAGES})
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={handleImageSelect}
          />
        </div>

        <button
          className="create-post-submit"
          onClick={handleSubmit}
          disabled={!content.trim() || uploading}
        >
          {uploading ? "Đang đăng..." : "Đăng bài"}
        </button>
      </div>
    </div>
  );
}
