import { useState, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { supabase } from "../../supabaseClient";
import { createPost } from "../../api/communityApi";

const COMMUNITY_BUCKET = "documents";
const MAX_IMAGES = 4;
const MAX_FILES = 3;
const SUGGESTED_HASHTAGS = ["#AI", "#Java", "#UIUX", "#Spring", "#React", "#Python", "#Backend"];

export default function CreatePostModal({ isOpen, onClose, onPostCreated }) {
  const { user } = useAuth();
  const notification = useNotification();

  const [activeTab, setActiveTab] = useState("discussion"); // "discussion" | "poll"

  // Tab 1: Discussion state
  const [content, setContent] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);

  const [previewImages, setPreviewImages] = useState([]); // { file, previewUrl }
  const [attachedFiles, setAttachedFiles] = useState([]); // { file, name, size }
  const [uploading, setUploading] = useState(false);

  // Tab 2: Poll state
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["Lựa chọn 1", "Lựa chọn 2"]);
  const [pollDurationDays, setPollDurationDays] = useState(1);
  const [allowMultiple, setAllowMultiple] = useState(false);

  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags((prev) => prev.filter((t) => t !== tag));
    } else {
      setSelectedTags((prev) => [...prev, tag]);
    }
  };

  const handleAddCustomTag = (e) => {
    if (e.key === "Enter" || e.type === "blur") {
      e.preventDefault();
      let val = customTagInput.trim();
      if (val) {
        if (!val.startsWith("#")) val = "#" + val;
        if (!selectedTags.includes(val)) {
          setSelectedTags((prev) => [...prev, val]);
        }
        setCustomTagInput("");
        setShowTagInput(false);
      }
    }
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (previewImages.length + files.length > MAX_IMAGES) {
      notification.error(`Tối đa ${MAX_IMAGES} ảnh mỗi bài viết.`);
      return;
    }

    const newPreviews = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setPreviewImages((prev) => [...prev, ...newPreviews]);
    e.target.value = "";
  };

  const removeImage = (idx) => {
    setPreviewImages((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[idx].previewUrl);
      updated.splice(idx, 1);
      return updated;
    });
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (attachedFiles.length + files.length > MAX_FILES) {
      notification.error(`Tối đa ${MAX_FILES} tài liệu đính kèm.`);
      return;
    }

    const newFiles = files.map((file) => ({
      file,
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(1) + " MB",
    }));
    setAttachedFiles((prev) => [...prev, ...newFiles]);
    e.target.value = "";
  };

  const removeFile = (idx) => {
    setAttachedFiles((prev) => {
      const updated = [...prev];
      updated.splice(idx, 1);
      return updated;
    });
  };

  // Poll option helpers
  const handleOptionChange = (index, value) => {
    setPollOptions((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const addOption = () => {
    if (pollOptions.length >= 6) {
      notification.error("Tối đa 6 lựa chọn.");
      return;
    }
    setPollOptions((prev) => [...prev, `Lựa chọn ${prev.length + 1}`]);
  };

  const removeOption = (idx) => {
    if (pollOptions.length <= 2) {
      notification.error("Khảo sát cần ít nhất 2 lựa chọn.");
      return;
    }
    setPollOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const sanitizeFileName = (name) => {
    if (!name) return "file";
    return name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .replace(/[^a-zA-Z0-9_.-]/g, "_");
  };

  const uploadFilesToSupabase = async () => {
    const imageUrls = [];
    const fileUrls = [];

    // Upload Images
    for (const { file } of previewImages) {
      const ext = file.name.split(".").pop();
      const fileName = `community/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from(COMMUNITY_BUCKET)
        .upload(fileName, file, { upsert: false });

      if (error) throw new Error(`Upload ảnh thất bại: ${error.message}`);

      const { data } = supabase.storage.from(COMMUNITY_BUCKET).getPublicUrl(fileName);
      imageUrls.push(data.publicUrl);
    }

    // Upload Documents
    for (const { file } of attachedFiles) {
      const safeName = sanitizeFileName(file.name);
      const fileName = `community/docs/${user.id}/${Date.now()}_${safeName}`;
      const { error } = await supabase.storage
        .from(COMMUNITY_BUCKET)
        .upload(fileName, file, { upsert: false });

      if (error) throw new Error(`Upload file thất bại: ${error.message}`);

      const { data } = supabase.storage.from(COMMUNITY_BUCKET).getPublicUrl(fileName);
      fileUrls.push(data.publicUrl);
    }

    return { imageUrls, fileUrls };
  };

  const handleSubmit = async () => {
    if (activeTab === "discussion" && !content.trim() && previewImages.length === 0 && attachedFiles.length === 0) {
      notification.error("Vui lòng nhập nội dung bài viết hoặc đính kèm file.");
      return;
    }

    if (activeTab === "poll") {
      if (!pollQuestion.trim()) {
        notification.error("Vui lòng nhập câu hỏi khảo sát.");
        return;
      }
      const validOptions = pollOptions.map((o) => o.trim()).filter((o) => o.length > 0);
      if (validOptions.length < 2) {
        notification.error("Khảo sát cần ít nhất 2 lựa chọn có nội dung.");
        return;
      }
    }

    setUploading(true);
    try {
      let imageUrls = [];
      let fileUrls = [];

      if (previewImages.length > 0 || attachedFiles.length > 0) {
        const uploaded = await uploadFilesToSupabase();
        imageUrls = uploaded.imageUrls;
        fileUrls = uploaded.fileUrls;
      }

      let pollData = null;
      if (activeTab === "poll") {
        pollData = {
          question: pollQuestion.trim(),
          options: pollOptions.map((o) => o.trim()).filter((o) => o.length > 0),
          durationDays: pollDurationDays,
          allowMultiple: allowMultiple,
        };
      }

      // Append hashtags to content if selected
      let finalContent = content.trim();
      if (activeTab === "discussion" && selectedTags.length > 0) {
        const tagsString = selectedTags.join(" ");
        if (!finalContent.includes(tagsString)) {
          finalContent = finalContent ? `${finalContent}\n\n${tagsString}` : tagsString;
        }
      }

      const newPost = await createPost({
        content: activeTab === "discussion" ? finalContent : (finalContent || pollQuestion.trim()),
        imageUrls: imageUrls.length > 0 ? imageUrls : null,
        fileUrls: fileUrls.length > 0 ? fileUrls : null,
        poll: pollData,
      });

      // Cleanup preview URLs
      previewImages.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
      setContent("");
      setSelectedTags([]);
      setPreviewImages([]);
      setAttachedFiles([]);
      setPollQuestion("");
      setPollOptions(["Lựa chọn 1", "Lựa chọn 2"]);

      notification.success(activeTab === "poll" ? "Tạo khảo sát thành công!" : "Đăng bài thành công!");
      if (onPostCreated) onPostCreated(newPost);
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Đăng bài thất bại.";
      notification.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || "U")}&background=E2E8F0&color=475569&size=88`;

  return (
    <div className="post-modal-backdrop" onClick={onClose}>
      <div className="post-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="post-modal-header">
          <h2>Tạo bài viết</h2>
          <button className="post-modal-close" onClick={onClose}>&times;</button>
        </div>

        {/* User Info Bar */}
        <div className="post-modal-user">
          <img className="post-modal-avatar" src={user?.avatar || defaultAvatar} alt="" />
          <div>
            <div className="post-modal-username">{user?.fullName || "Người dùng"}</div>
            <span className="post-modal-privacy">🌐 Công khai</span>
          </div>
        </div>

        {/* Tabs Switcher */}
        <div className="post-modal-tabs">
          <button
            className={`post-modal-tab ${activeTab === "discussion" ? "active" : ""}`}
            onClick={() => setActiveTab("discussion")}
          >
            💬 Thảo luận
          </button>
          <button
            className={`post-modal-tab ${activeTab === "poll" ? "active" : ""}`}
            onClick={() => setActiveTab("poll")}
          >
            📊 Khảo sát
          </button>
        </div>

        {/* Modal Body */}
        <div className="post-modal-body">
          {activeTab === "discussion" ? (
            <>
              <textarea
                className="post-modal-textarea"
                placeholder="Hôm nay bạn đang học gì?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
              />

              {/* Hashtag Selector Section */}
              <div className="post-modal-hashtags-section">
                <div className="hashtags-list">
                  {SUGGESTED_HASHTAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        className={`hashtag-pill ${isSelected ? "active" : ""}`}
                        onClick={() => toggleTag(tag)}
                      >
                        {tag} {isSelected ? "×" : "+"}
                      </button>
                    );
                  })}
                  {selectedTags.filter((t) => !SUGGESTED_HASHTAGS.includes(t)).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="hashtag-pill active"
                      onClick={() => toggleTag(tag)}
                    >
                      {tag} ×
                    </button>
                  ))}
                  {showTagInput ? (
                    <input
                      type="text"
                      className="hashtag-custom-input"
                      placeholder="#TagMoi"
                      value={customTagInput}
                      onChange={(e) => setCustomTagInput(e.target.value)}
                      onKeyDown={handleAddCustomTag}
                      onBlur={handleAddCustomTag}
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      className="hashtag-add-btn"
                      onClick={() => setShowTagInput(true)}
                    >
                      ➕ Thẻ
                    </button>
                  )}
                </div>
              </div>

              {/* Attached Image Previews */}
              {previewImages.length > 0 && (
                <div className="create-post-previews">
                  {previewImages.map((p, i) => (
                    <div className="create-post-preview-item" key={i}>
                      <img src={p.previewUrl} alt={`Preview ${i + 1}`} />
                      <button className="create-post-preview-remove" onClick={() => removeImage(i)}>
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Attached Files list */}
              {attachedFiles.length > 0 && (
                <div className="post-modal-files-list">
                  {attachedFiles.map((f, i) => (
                    <div className="post-modal-file-item" key={i}>
                      <span className="file-icon">📄</span>
                      <span className="file-name">{f.name}</span>
                      <span className="file-size">{f.size}</span>
                      <button className="file-remove" onClick={() => removeFile(i)}>&times;</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Toolbar Buttons */}
              <div className="post-modal-toolbar">
                <button
                  type="button"
                  className="toolbar-btn"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={previewImages.length >= MAX_IMAGES || uploading}
                >
                  🖼️ Ảnh ({previewImages.length}/{MAX_IMAGES})
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={handleImageSelect}
                />

                <button
                  type="button"
                  className="toolbar-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={attachedFiles.length >= MAX_FILES || uploading}
                >
                  📄 Tài liệu ({attachedFiles.length}/{MAX_FILES})
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.rar,.txt"
                  multiple
                  style={{ display: "none" }}
                  onChange={handleFileSelect}
                />
              </div>
            </>
          ) : (
            /* Tab Khảo sát */
            <div className="poll-form-container">
              <div className="poll-section">
                <label className="poll-label">Chủ đề khảo sát</label>
                <textarea
                  className="post-modal-textarea poll-question-input"
                  placeholder="Nhập câu hỏi khảo sát..."
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="poll-section">
                <label className="poll-label">Các lựa chọn</label>
                {pollOptions.map((opt, i) => (
                  <div className="poll-option-row" key={i}>
                    <input
                      type="text"
                      className="poll-option-input"
                      value={opt}
                      onChange={(e) => handleOptionChange(i, e.target.value)}
                      placeholder={`Lựa chọn ${i + 1}`}
                    />
                    {pollOptions.length > 2 && (
                      <button
                        type="button"
                        className="poll-option-remove"
                        onClick={() => removeOption(i)}
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 6 && (
                  <button type="button" className="poll-add-option-btn" onClick={addOption}>
                    + Thêm lựa chọn
                  </button>
                )}
              </div>

              <div className="poll-settings-row">
                <div className="poll-setting-item">
                  <label className="poll-label">Thời hạn khảo sát</label>
                  <select
                    className="poll-select"
                    value={pollDurationDays}
                    onChange={(e) => setPollDurationDays(Number(e.target.value))}
                  >
                    <option value={1}>1 ngày</option>
                    <option value={3}>3 ngày</option>
                    <option value={7}>7 ngày</option>
                    <option value={30}>30 ngày</option>
                  </select>
                </div>

                <div className="poll-setting-item">
                  <label className="poll-checkbox-label">
                    <input
                      type="checkbox"
                      checked={allowMultiple}
                      onChange={(e) => setAllowMultiple(e.target.checked)}
                    />
                    Cho phép chọn nhiều phương án
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="post-modal-footer">
          <button type="button" className="post-modal-cancel" onClick={onClose} disabled={uploading}>
            Hủy
          </button>
          <button type="button" className="post-modal-submit" onClick={handleSubmit} disabled={uploading}>
            {uploading ? "Đang xử lý..." : activeTab === "poll" ? "Tạo khảo sát" : "Đăng bài"}
          </button>
        </div>
      </div>
    </div>
  );
}
