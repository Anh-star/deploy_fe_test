import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { supabase } from "../../supabaseClient";
import { createPost } from "../../api/communityApi";
import { UploadIcon, UpvoteIcon, CommentBubbleIcon, FilterIcon, DocumentIcon, ImageIcon, EyeIcon } from "../icons";

const COMMUNITY_BUCKET = "documents";
const MAX_IMAGES = 4;
const MAX_FILES = 3;

export default function CreatePostModal({ isOpen, onClose, onPostCreated }) {
  const { user } = useAuth();
  const notification = useNotification();

  const [activeTab, setActiveTab] = useState("discussion"); // "discussion" | "poll"

  // Tab 1: Discussion state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);

  const [previewImages, setPreviewImages] = useState([]); // { file, previewUrl }
  const [attachedFiles, setAttachedFiles] = useState([]); // { file, name, size }
  const [uploading, setUploading] = useState(false);
  const [allowComments, setAllowComments] = useState(true);

  // Tab 2: Poll state
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["Lựa chọn 1", "Lựa chọn 2"]);
  const [pollDurationDays, setPollDurationDays] = useState(1);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [allowAddOptions, setAllowAddOptions] = useState(false);
  const [hideResultsBeforeVote, setHideResultsBeforeVote] = useState(false);
  const [hideVoters, setHideVoters] = useState(false);

  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const editorRef = useRef(null);

  // Auto-sync contentEditable innerHTML with content state when modal is open
  useEffect(() => {
    if (isOpen && editorRef.current) {
      if (editorRef.current.innerHTML !== content) {
        editorRef.current.innerHTML = content || "";
      }
    }
  }, [isOpen, content]);

  if (!isOpen) return null;

  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags((prev) => prev.filter((t) => t !== tag));
    } else {
      if (selectedTags.length >= 20) {
        notification.error("Tối đa 20 thẻ cho bài viết.");
        return;
      }
      setSelectedTags((prev) => [...prev, tag]);
    }
  };

  const handleAddCustomTag = (e) => {
    if (e.key === "Enter" || e.type === "blur") {
      e.preventDefault();
      let val = customTagInput.trim();
      if (val) {
        if (!val.startsWith("#")) val = "#" + val;
        if (selectedTags.length >= 20) {
          notification.error("Tối đa 20 thẻ cho bài viết.");
          return;
        }
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
    if (e.target) e.target.value = "";
  };

  const handleDropFiles = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    const images = files.filter((f) => f.type.startsWith("image/"));
    const docs = files.filter((f) => !f.type.startsWith("image/"));

    if (images.length > 0) {
      if (previewImages.length + images.length > MAX_IMAGES) {
        notification.error(`Tối đa ${MAX_IMAGES} ảnh mỗi bài viết.`);
      } else {
        const newPreviews = images.map((file) => ({
          file,
          previewUrl: URL.createObjectURL(file),
        }));
        setPreviewImages((prev) => [...prev, ...newPreviews]);
      }
    }

    if (docs.length > 0) {
      if (attachedFiles.length + docs.length > MAX_FILES) {
        notification.error(`Tối đa ${MAX_FILES} tài liệu đính kèm.`);
      } else {
        const newFiles = docs.map((file) => ({
          file,
          name: file.name,
          size: (file.size / (1024 * 1024)).toFixed(1) + " MB",
        }));
        setAttachedFiles((prev) => [...prev, ...newFiles]);
      }
    }
  };

  const removeFile = (idx) => {
    setAttachedFiles((prev) => {
      const updated = [...prev];
      updated.splice(idx, 1);
      return updated;
    });
  };

  const handleBold = (e) => {
    e.preventDefault();
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    const sel = window.getSelection();
    const hasSelection = sel && !sel.isCollapsed && editor.contains(sel.anchorNode);

    if (hasSelection) {
      document.execCommand("bold", false, null);
    } else {
      const textContent = editor.innerText.trim();
      if (textContent) {
        const range = document.createRange();
        range.selectNodeContents(editor);
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand("bold", false, null);
        sel.removeAllRanges();
      } else {
        document.execCommand("bold", false, null);
      }
    }
    setContent(editor.innerHTML);
  };

  const handleItalic = (e) => {
    e.preventDefault();
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    const sel = window.getSelection();
    const hasSelection = sel && !sel.isCollapsed && editor.contains(sel.anchorNode);

    if (hasSelection) {
      document.execCommand("italic", false, null);
    } else {
      const textContent = editor.innerText.trim();
      if (textContent) {
        const range = document.createRange();
        range.selectNodeContents(editor);
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand("italic", false, null);
        sel.removeAllRanges();
      } else {
        document.execCommand("italic", false, null);
      }
    }
    setContent(editor.innerHTML);
  };

  const insertEmoji = (emoji) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand("insertText", false, emoji);
    setContent(editor.innerHTML);
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
    if (activeTab === "discussion" && !content.trim() && !title.trim() && previewImages.length === 0 && attachedFiles.length === 0) {
      notification.error("Vui lòng nhập nội dung bài viết hoặc đính kèm file.");
      return;
    }

    let validOptions = [];
    if (activeTab === "poll") {
      if (!pollQuestion.trim()) {
        notification.error("Vui lòng nhập câu hỏi khảo sát.");
        return;
      }
      validOptions = pollOptions.map((o) => o.trim()).filter((o) => o.length > 0);
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
          options: validOptions,
          durationDays: pollDurationDays,
          allowMultiple: allowMultiple,
          allowAddOptions: allowAddOptions,
          hideResultsBeforeVote: hideResultsBeforeVote,
          hideVoters: hideVoters,
        };
      }

      const newPost = await createPost({
        title: activeTab === "discussion" ? (title.trim() || null) : null,
        content: activeTab === "discussion" ? content.trim() : (content.trim() || pollQuestion.trim()),
        tags: activeTab === "discussion" ? selectedTags : null,
        imageUrls: imageUrls.length > 0 ? imageUrls : null,
        fileUrls: fileUrls.length > 0 ? fileUrls : null,
        poll: pollData,
        allowComments: allowComments,
      });

      // Cleanup preview URLs
      previewImages.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
      setTitle("");
      setContent("");
      if (editorRef.current) editorRef.current.innerHTML = "";
      setSelectedTags([]);
      setPreviewImages([]);
      setAttachedFiles([]);
      setPollQuestion("");
      setPollOptions(["Lựa chọn 1", "Lựa chọn 2"]);
      setAllowComments(true);
      setAllowMultiple(false);
      setAllowAddOptions(false);
      setHideResultsBeforeVote(false);
      setHideVoters(false);

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
      <div className={`post-modal-container ${activeTab === "poll" ? "is-poll-mode" : ""}`} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="post-modal-header">
          <div className="post-modal-title-box">
            <span className="title-icon-badge">🏷️</span>
            <h2>{activeTab === "poll" ? "Tạo bình chọn" : "Tạo bài viết"}</h2>
          </div>
          <button className="post-modal-close" onClick={onClose}>&times;</button>
        </div>

        {/* Tabs Switcher (Đăng bài / Thảo luận vs Khảo sát) */}
        <div className="post-modal-tabs">
          <button
            type="button"
            className={`post-modal-tab ${activeTab === "discussion" ? "active" : ""}`}
            onClick={() => setActiveTab("discussion")}
          >
            <CommentBubbleIcon size={16} color="currentColor" />
            <span>Thảo luận</span>
          </button>
          <button
            type="button"
            className={`post-modal-tab ${activeTab === "poll" ? "active" : ""}`}
            onClick={() => setActiveTab("poll")}
          >
            <FilterIcon size={16} color="currentColor" />
            <span>Khảo sát</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="post-modal-body">
          {activeTab === "discussion" ? (
            <>
              {/* Field 1: Tiêu đề bài viết */}
              <div className="post-field-group">
                <label className="post-field-label">
                  Tiêu đề bài viết
                </label>
                <input
                  type="text"
                  className="post-field-input"
                  placeholder="Nhập tiêu đề ngắn gọn, rõ ràng..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* Field 2: Nội dung */}
              <div className="post-field-group">
                <div className="post-field-label-row">
                  <label className="post-field-label">
                    Nội dung
                  </label>
                  <button
                    type="button"
                    className="post-preview-toggle-btn"
                    onClick={() => setIsPreview(!isPreview)}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <EyeIcon size={15} color="#64748B" />
                    <span>{isPreview ? "Chỉnh sửa" : "Xem trước"}</span>
                  </button>
                </div>

                {/* Preview Box */}
                {isPreview && (
                  <div className="post-modal-preview-box">
                    {content ? (
                      <div className="preview-rendered-content" dangerouslySetInnerHTML={{ __html: content }} />
                    ) : (
                      <em style={{ color: "#94A3B8" }}>Chưa có nội dung xem trước...</em>
                    )}
                  </div>
                )}

                {/* Editor Container */}
                <div className="post-editor-container" style={{ display: isPreview ? "none" : "block" }}>
                  <div className="post-editor-toolbar">
                    <button type="button" onMouseDown={handleBold} title="In đậm"><b>B</b></button>
                    <button type="button" onMouseDown={handleItalic} title="In nghiêng"><i>I</i></button>
                    <button type="button" onClick={() => insertEmoji("😊")} title="Chèn emoji">😊</button>
                  </div>
                  <div
                    ref={editorRef}
                    className="post-editor-contenteditable"
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => setContent(e.currentTarget.innerHTML)}
                    data-placeholder="Mô tả câu hỏi hoặc ý tưởng của bạn..."
                  />
                </div>
              </div>

              {/* Divider 1: THẺ */}
              <div className="post-section-divider">
                <span className="divider-line" />
                <span className="divider-label">THẺ</span>
                <span className="divider-line" />
              </div>

              {/* Field 3: THẺ BÀI VIẾT */}
              <div className="post-field-group">
                <div className="post-field-label-row">
                  <label className="post-field-sublabel">THẺ BÀI VIẾT</label>
                  <span className="post-field-counter">{selectedTags.length}/20 tối đa</span>
                </div>
                <div className="post-tags-container">
                  {selectedTags.map((tag) => (
                    <span key={tag} className="tag-chip-item">
                      {tag}
                      <button type="button" onClick={() => toggleTag(tag)} className="tag-remove-btn">&times;</button>
                    </span>
                  ))}

                  {showTagInput ? (
                    <input
                      type="text"
                      className="tag-input-field"
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
                      className="add-tag-trigger-btn"
                      onClick={() => setShowTagInput(true)}
                    >
                      (+) Thêm thẻ cho bài viết
                    </button>
                  )}
                </div>
              </div>

              {/* Divider 2: HÌNH ẢNH */}
              <div className="post-section-divider">
                <span className="divider-line" />
                <span className="divider-label">HÌNH ẢNH</span>
                <span className="divider-line" />
              </div>

              {/* Field: Hình ảnh đính kèm */}
              <div className="post-field-group">
                <div className="post-field-label-row">
                  <label className="post-field-sublabel">Hình ảnh đính kèm</label>
                  <span className="post-field-counter">{previewImages.length}/{MAX_IMAGES} tối đa</span>
                </div>

                <div
                  className="post-dropzone-box"
                  onClick={() => imageInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDropFiles}
                >
                  <div className="dropzone-icon-wrapper" style={{ background: "#EFF6FF" }}>
                    <ImageIcon size={20} color="#2563EB" />
                  </div>
                  <div className="dropzone-main-text">Kéo thả hoặc chọn hình ảnh</div>
                  <div className="dropzone-sub-text">
                    PNG, JPG, JPEG, WEBP · tối đa {MAX_IMAGES} hình ảnh
                  </div>
                </div>

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={handleImageSelect}
                />

                {previewImages.length > 0 && (
                  <div className="create-post-previews" style={{ marginTop: "12px" }}>
                    {previewImages.map((p, i) => (
                      <div className="create-post-preview-item" key={i}>
                        <img src={p.previewUrl} alt={`Preview ${i + 1}`} />
                        <button
                          type="button"
                          className="create-post-preview-remove"
                          onClick={() => removeImage(i)}
                          title="Xóa ảnh"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Divider 3: TÀI LIỆU */}
              <div className="post-section-divider">
                <span className="divider-line" />
                <span className="divider-label">TÀI LIỆU</span>
                <span className="divider-line" />
              </div>

              {/* Field 4: Tài liệu đính kèm */}
              <div className="post-field-group">
                <label className="post-field-sublabel">Tài liệu đính kèm</label>
                
                <div
                  className="post-dropzone-box"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDropFiles}
                >
                  <div className="dropzone-icon-wrapper">
                    <UploadIcon size={20} color="#2563EB" />
                  </div>
                  <div className="dropzone-main-text">Kéo thả hoặc chọn tệp</div>
                  <div className="dropzone-sub-text">
                    PDF, DOCX, PPTX, XLSX, zip · tối đa 20 MB mỗi tệp
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xlsx,.zip,.rar"
                  multiple
                  style={{ display: "none" }}
                  onChange={handleFileSelect}
                />

                {/* Previews List */}
                {previewImages.length > 0 && (
                  <div className="create-post-previews" style={{ marginTop: "12px" }}>
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

                {attachedFiles.length > 0 && (
                  <div className="post-modal-files-list">
                    {attachedFiles.map((f, i) => (
                      <div className="post-modal-file-item" key={i}>
                        <div className="file-icon-badge">
                          <DocumentIcon size={18} color="#2563EB" />
                        </div>
                        <div className="file-info-group">
                          <span className="file-name" title={f.name}>{f.name}</span>
                          <span className="file-size">{f.size}</span>
                        </div>
                        <button
                          type="button"
                          className="file-remove-btn"
                          onClick={() => removeFile(i)}
                          title="Xóa tệp"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Divider 4: THIẾT LẬP */}
              <div className="post-section-divider">
                <span className="divider-line" />
                <span className="divider-label">THIẾT LẬP</span>
                <span className="divider-line" />
              </div>

              {/* Toggle Cho phép bình luận */}
              <div className="post-comment-toggle-row">
                <span className="post-comment-toggle-label">Cho phép bình luận</span>
                <label className="purple-ios-switch">
                  <input
                    type="checkbox"
                    checked={allowComments}
                    onChange={(e) => setAllowComments(e.target.checked)}
                  />
                  <span className="purple-switch-slider" />
                </label>
              </div>
            </>
          ) : (
            /* Tab Khảo sát */
            <div className="poll-two-column-layout">
              <div className="poll-col-left">
                <div className="poll-field-group">
                  <label className="poll-field-label">Chủ đề bình chọn</label>
                  <div className="poll-textarea-wrapper">
                    <textarea
                      className="poll-textarea-field"
                      placeholder="Nhập chủ đề bình chọn..."
                      value={pollQuestion}
                      onChange={(e) => {
                        if (e.target.value.length <= 200) {
                          setPollQuestion(e.target.value);
                        }
                      }}
                      rows={4}
                    />
                    <span className="poll-char-count">{pollQuestion.length}/200</span>
                  </div>
                </div>

                <div className="poll-field-group">
                  <label className="poll-field-label">Các lựa chọn</label>
                  <div className="poll-options-inputs-list">
                    {pollOptions.map((opt, i) => (
                      <div className="poll-option-input-wrapper" key={i}>
                        <input
                          type="text"
                          className="poll-option-text-input"
                          value={opt}
                          onChange={(e) => handleOptionChange(i, e.target.value)}
                          placeholder={`${i + 1}`}
                        />
                        {pollOptions.length > 2 && (
                          <button
                            type="button"
                            className="poll-option-clear-btn"
                            onClick={() => removeOption(i)}
                            title="Xóa lựa chọn"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {pollOptions.length < 6 && (
                    <button type="button" className="poll-add-option-link-btn" onClick={addOption}>
                      <span className="plus-icon">+</span> Thêm lựa chọn
                    </button>
                  )}
                </div>
              </div>

              <div className="poll-col-right">
                <div className="poll-setting-block">
                  <label className="poll-field-label">Thời hạn bình chọn</label>
                  <div className="poll-select-wrapper">
                    <select
                      className="poll-select-field"
                      value={pollDurationDays}
                      onChange={(e) => setPollDurationDays(Number(e.target.value))}
                    >
                      <option value={0}>Không thời hạn</option>
                      <option value={1}>1 ngày</option>
                      <option value={3}>3 ngày</option>
                      <option value={7}>7 ngày</option>
                      <option value={30}>30 ngày</option>
                    </select>
                    <span className="calendar-icon">📅</span>
                  </div>
                </div>

                <div className="poll-setting-block">
                  <div className="poll-setting-heading">Thiết lập nâng cao</div>

                  <div className="poll-toggle-item">
                    <span className="poll-toggle-text">Cho phép bình luận</span>
                    <button
                      type="button"
                      className={`poll-switch-btn ${allowComments ? "active" : ""}`}
                      onClick={() => setAllowComments(!allowComments)}
                    >
                      <span className="poll-switch-thumb" />
                    </button>
                  </div>

                  <div className="poll-toggle-item">
                    <span className="poll-toggle-text">
                      Chọn nhiều phương án <span className="poll-info-badge" title="Người dùng có thể chọn nhiều hơn một lựa chọn">ⓘ</span>
                    </span>
                    <button
                      type="button"
                      className={`poll-switch-btn ${allowMultiple ? "active" : ""}`}
                      onClick={() => setAllowMultiple(!allowMultiple)}
                    >
                      <span className="poll-switch-thumb" />
                    </button>
                  </div>

                  <div className="poll-toggle-item">
                    <span className="poll-toggle-text">
                      Có thể thêm phương án <span className="poll-info-badge" title="Người dùng có thể bổ sung thêm phương án khác">ⓘ</span>
                    </span>
                    <button
                      type="button"
                      className={`poll-switch-btn ${allowAddOptions ? "active" : ""}`}
                      onClick={() => setAllowAddOptions(!allowAddOptions)}
                    >
                      <span className="poll-switch-thumb" />
                    </button>
                  </div>
                </div>

                <div className="poll-setting-block">
                  <div className="poll-setting-heading">Bình chọn ẩn danh</div>

                  <div className="poll-toggle-item">
                    <span className="poll-toggle-text">
                      Ẩn kết quả khi chưa bình chọn <span className="poll-info-badge" title="Kết quả chỉ hiện sau khi bình chọn">ⓘ</span>
                    </span>
                    <button
                      type="button"
                      className={`poll-switch-btn ${hideResultsBeforeVote ? "active" : ""}`}
                      onClick={() => setHideResultsBeforeVote(!hideResultsBeforeVote)}
                    >
                      <span className="poll-switch-thumb" />
                    </button>
                  </div>

                  <div className="poll-toggle-item">
                    <span className="poll-toggle-text">
                      Ẩn người bình chọn <span className="poll-info-badge" title="Ẩn danh sách ai đã tham gia vote">ⓘ</span>
                    </span>
                    <button
                      type="button"
                      className={`poll-switch-btn ${hideVoters ? "active" : ""}`}
                      onClick={() => setHideVoters(!hideVoters)}
                    >
                      <span className="poll-switch-thumb" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Bar */}
        <div className="post-modal-footer">
          <div className="post-modal-footer-user">
            <img className="footer-avatar" src={user?.avatar || defaultAvatar} alt="" />
            <span>Đăng với <strong>{user?.fullName || "bạn"}</strong></span>
          </div>

          <div className="post-modal-footer-actions">
            <button type="button" className="post-modal-cancel-btn" onClick={onClose} disabled={uploading}>
              Hủy
            </button>
            <button
              type="button"
              className="post-modal-submit-btn"
              onClick={handleSubmit}
              disabled={uploading}
            >
              <span className="submit-icon">✓</span>
              <span>{uploading ? "Đang xử lý..." : activeTab === "poll" ? "Tạo bình chọn" : "Đăng bài"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
