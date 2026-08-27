import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { votePost, toggleSavePost, deletePost, updatePost, votePollOption, getPollVoters, addPollOption, deletePollOption, togglePostNotifications, togglePinPost } from "../../api/communityApi";
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

export default function PostCard({
  post,
  onPostDeleted,
  onPostSavedChange,
  onPostUpdated,
  hideOptionsMenu = false,
  defaultShowComments = false,
  showPinnedBadge = false,
  targetCommentId = null,
  onCloseCommentsModal = null,
  readOnly = false,
}) {
  const { user, isAuthenticated } = useAuth();
  const notification = useNotification();

  // Vote state
  const [userVote, setUserVote] = useState(post.currentUserVote || null);
  const [upvoteCount, setUpvoteCount] = useState(post.upvoteCount || 0);
  const [downvoteCount, setDownvoteCount] = useState(post.downvoteCount || 0);
  const [isVoting, setIsVoting] = useState(false);

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
  const [showCommentsModal, setShowCommentsModal] = useState(defaultShowComments || Boolean(targetCommentId));

  useEffect(() => {
    if (targetCommentId) {
      setShowCommentsModal(true);
    }
  }, [targetCommentId]);

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
        if (typeof data.commentCount === "number") {
          setCommentCount(data.commentCount);
        }
      }
    },
  });

  const handleCloseCommentsModal = () => {
    setShowCommentsModal(false);
    if (onCloseCommentsModal) onCloseCommentsModal();
  };
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
  const [editFiles, setEditFiles] = useState([]);
  const [editPollQuestion, setEditPollQuestion] = useState("");
  const [editPollOptions, setEditPollOptions] = useState([]);
  const [updating, setUpdating] = useState(false);
  const editFileInputRef = useRef(null);
  const editDocInputRef = useRef(null);
  const editEditorRef = useRef(null);

  // Auto-sync contentEditable innerHTML when editing starts
  useEffect(() => {
    if (isEditing && editEditorRef.current) {
      editEditorRef.current.innerHTML = editContent || "";
    }
  }, [isEditing]);

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
      notification.warning("Vui lòng đăng nhập để tương tác bài viết.");
      return;
    }
    if (isVoting) return;
    setIsVoting(true);

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
        setUpvoteCount(typeof res.upvoteCount === "number" ? res.upvoteCount : 0);
        setDownvoteCount(typeof res.downvoteCount === "number" ? res.downvoteCount : 0);
      }
    } catch (err) {
      setUserVote(prevVote);
      setUpvoteCount(prevUp);
      setDownvoteCount(prevDown);
      notification.error("Thao tác bình chọn thất bại.");
    } finally {
      setIsVoting(false);
    }
  };

  const handleSaveToggle = async () => {
    if (!isAuthenticated) {
      notification.warning("Vui lòng đăng nhập để lưu bài viết.");
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

  const handleCommentCountChange = useCallback((value, isExact = false) => {
    queueMicrotask(() => {
      if (isExact && typeof value === "number") {
        setCommentCount(value);
      } else if (typeof value === "number") {
        setCommentCount((c) => Math.max(0, c + value));
      }
    });
  }, []);

  const handleToggleNotifications = async () => {
    if (!isAuthenticated) {
      notification.warning("Vui lòng đăng nhập để bật/tắt thông báo.");
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
      notification.warning("Vui lòng đăng nhập để bình chọn.");
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

  const handleDeletePollOption = async (e, optionId) => {
    e.stopPropagation();
    try {
      const updatedPoll = await deletePollOption(optionId);
      setPoll(updatedPoll);
      notification.success("Đã xóa phương án khảo sát.");
    } catch (err) {
      notification.error(err.response?.data?.message || err.message || "Không thể xóa phương án.");
    }
  };

  const hasPoll = Boolean(poll || post.poll);

  const cleanEditorHtml = (html) => {
    if (!html) return "";
    let s = html.trim();
    if (!s || s === "<br>" || s === "<p><br></p>" || s === "<div><br></div>") return "";

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(s, "text/html");

      function sanitize(node) {
        if (!node) return;
        const children = Array.from(node.childNodes);
        children.forEach(sanitize);

        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node;
          const tag = el.tagName.toLowerCase();

          // 1. Remove style, class, and id attributes
          el.removeAttribute("style");
          el.removeAttribute("class");
          el.removeAttribute("id");

          // 2. Normalize <strong> and <em>
          if (tag === "strong") {
            const b = doc.createElement("b");
            while (el.firstChild) b.appendChild(el.firstChild);
            el.parentNode.replaceChild(b, el);
            return;
          }
          if (tag === "em") {
            const i = doc.createElement("i");
            while (el.firstChild) i.appendChild(el.firstChild);
            el.parentNode.replaceChild(i, el);
            return;
          }

          // 3. Remove useless wrapper spans/fonts
          if (tag === "span" || tag === "font") {
            while (el.firstChild) {
              el.parentNode.insertBefore(el.firstChild, el);
            }
            el.remove();
            return;
          }

          // 4. Remove empty inline formatting tags
          if ((tag === "b" || tag === "i" || tag === "u") && !el.textContent.trim() && !el.querySelector("img")) {
            el.remove();
            return;
          }
        }
      }

      sanitize(doc.body);

      let result = doc.body.innerHTML;
      result = result.replace(/<\/b>(\s*)<b>/gi, "$1");
      result = result.replace(/<\/i>(\s*)<i>/gi, "$1");
      return result.trim();
    } catch (e) {
      return s;
    }
  };

  const handleEditBold = (e) => {
    e.preventDefault();
    if (!editEditorRef.current) return;
    editEditorRef.current.focus();
    try {
      document.execCommand("styleWithCSS", false, false);
    } catch (ignored) {}
    document.execCommand("bold", false, null);
    setEditContent(editEditorRef.current.innerHTML);
  };

  const handleEditItalic = (e) => {
    e.preventDefault();
    if (!editEditorRef.current) return;
    editEditorRef.current.focus();
    try {
      document.execCommand("styleWithCSS", false, false);
    } catch (ignored) {}
    document.execCommand("italic", false, null);
    setEditContent(editEditorRef.current.innerHTML);
  };

  const insertEditEmoji = (emoji) => {
    if (!editEditorRef.current) return;
    editEditorRef.current.focus();
    document.execCommand("insertText", false, emoji);
    setEditContent(editEditorRef.current.innerHTML);
  };

  const startEditing = () => {
    const cleanInitial = cleanEditorHtml(post.content || "");
    setEditContent(cleanInitial);
    if (hasPoll) {
      const currentPoll = poll || post.poll;
      setEditPollQuestion(currentPoll?.question || "");
      const opts = (currentPoll?.options || []).map((opt) => ({
        id: opt.id,
        optionText: opt.optionText || "",
      }));
      if (opts.length === 0) {
        opts.push({ id: null, optionText: "" }, { id: null, optionText: "" });
      } else if (opts.length === 1) {
        opts.push({ id: null, optionText: "" });
      }
      setEditPollOptions(opts);
      setEditImages([]);
      setEditFiles([]);
    } else {
      const existing = (post.imageUrls || []).map((url) => ({
        url,
        isExisting: true,
      }));
      setEditImages(existing);

      const existingDocs = (post.fileUrls || []).map((url) => ({
        url,
        name: url.split("/").pop().replace(/^\d+_/, "") || "Tài liệu đính kèm",
        isExisting: true,
      }));
      setEditFiles(existingDocs);
    }
    setIsEditing(true);
    setShowMenu(false);
  };

  const handleEditOptionChange = (idx, text) => {
    setEditPollOptions((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], optionText: text };
      return updated;
    });
  };

  const handleAddEditOption = () => {
    if (editPollOptions.length >= 10) {
      notification.error("Tối đa 10 lựa chọn khảo sát.");
      return;
    }
    setEditPollOptions((prev) => [...prev, { id: null, optionText: "" }]);
  };

  const handleRemoveEditOption = (idx) => {
    if (editPollOptions.length <= 2) {
      notification.error("Khảo sát cần ít nhất 2 lựa chọn.");
      return;
    }
    setEditPollOptions((prev) => prev.filter((_, i) => i !== idx));
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

  const handleDocSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (editFiles.length + files.length > 5) {
      notification.error("Tối đa 5 tài liệu đính kèm.");
      return;
    }
    const newItems = files.map((file) => ({
      file,
      name: file.name,
      isExisting: false,
    }));
    setEditFiles((prev) => [...prev, ...newItems]);
    e.target.value = "";
  };

  const removeEditDoc = (idx) => {
    setEditFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadNewImages = async () => {
    const urls = [];
    for (const img of editImages) {
      if (img.isExisting) {
        urls.push(img.url);
      } else {
        const file = img.file;
        const ext = file.name.split(".").pop();
        const fileName = `community/${user?.id || "user"}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error } = await supabase.storage
          .from(COMMUNITY_BUCKET)
          .upload(fileName, file, { upsert: false });

        if (error) throw new Error(`Upload ảnh thất bại: ${error.message}`);

        const { data: urlData } = supabase.storage
          .from(COMMUNITY_BUCKET)
          .getPublicUrl(fileName);

        urls.push(urlData.publicUrl);
      }
    }
    return urls;
  };

  const uploadNewFiles = async () => {
    const finalFileUrls = [];
    for (const item of editFiles) {
      if (item.isExisting) {
        finalFileUrls.push(item.url);
      } else if (item.file) {
        const safeName = item.name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[đĐ]/g, "d")
          .replace(/[^a-zA-Z0-9_.-]/g, "_");
        const fileName = `community/docs/${user?.id || "user"}/${Date.now()}_${safeName}`;
        const { error } = await supabase.storage
          .from(COMMUNITY_BUCKET)
          .upload(fileName, item.file, { upsert: false });

        if (error) throw new Error(`Upload tài liệu thất bại: ${error.message}`);

        const { data } = supabase.storage.from(COMMUNITY_BUCKET).getPublicUrl(fileName);
        finalFileUrls.push(data.publicUrl);
      }
    }
    return finalFileUrls;
  };

  const handleUpdate = async () => {
    const cleanedContent = cleanEditorHtml(editContent);

    if (hasPoll) {
      if (!editPollQuestion.trim()) {
        notification.error("Câu hỏi khảo sát không được để trống.");
        return;
      }
      const validOptions = editPollOptions.filter((opt) => opt.optionText.trim());
      if (validOptions.length < 2) {
        notification.error("Khảo sát cần ít nhất 2 lựa chọn không được để trống.");
        return;
      }

      setUpdating(true);
      try {
        const payload = {
          content: cleanedContent || editPollQuestion.trim(),
          poll: {
            question: editPollQuestion.trim(),
            pollOptions: validOptions.map((opt) => ({
              id: opt.id || null,
              optionText: opt.optionText.trim(),
            })),
          },
        };

        const updated = await updatePost(post.id, payload);

        post.content = updated.content;
        if (updated.poll) {
          setPoll(updated.poll);
          post.poll = updated.poll;
        }

        notification.success("Đã cập nhật bài viết khảo sát.");
        setIsEditing(false);
        if (onPostUpdated) onPostUpdated(updated);
      } catch (err) {
        notification.error(err.response?.data?.message || err.message || "Không thể cập nhật bài viết.");
      } finally {
        setUpdating(false);
      }
    } else {
      if (!cleanedContent && editImages.length === 0 && editFiles.length === 0) {
        notification.error("Nội dung không được để trống.");
        return;
      }
      setUpdating(true);
      try {
        const uploadedUrls = await uploadNewImages();
        const uploadedFileUrls = await uploadNewFiles();
        const updated = await updatePost(post.id, {
          content: cleanedContent,
          imageUrls: uploadedUrls,
          fileUrls: uploadedFileUrls,
        });

        post.content = updated.content;
        post.imageUrls = updated.imageUrls;
        post.fileUrls = updated.fileUrls;

        editImages.forEach((img) => {
          if (!img.isExisting) URL.revokeObjectURL(img.url);
        });

        notification.success("Đã cập nhật bài viết.");
        setIsEditing(false);
        if (onPostUpdated) onPostUpdated(updated);
      } catch (err) {
        notification.error(err.response?.data?.message || err.message || "Không thể cập nhật bài viết.");
      } finally {
        setUpdating(false);
      }
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
            {(post.isEdited || (post.updatedAt && post.updatedAt !== post.createdAt)) && (
              <span className="post-edited-indicator" title="Bài viết đã qua chỉnh sửa" style={{ fontSize: "12px", color: "#9CA3AF", marginLeft: "4px" }}>
                (Đã chỉnh sửa)
              </span>
            )}
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
          <label style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#475569", marginBottom: "6px" }}>
            {hasPoll ? "Nội dung mô tả (tùy chọn):" : "Nội dung bài viết:"}
          </label>

          {/* Rich Editor with Toolbar */}
          <div className="post-editor-container" style={{ marginBottom: "12px" }}>
            <div className="post-editor-toolbar" style={{ display: "flex", gap: "6px", marginBottom: "6px", alignItems: "center" }}>
              <button
                type="button"
                onMouseDown={handleEditBold}
                title="In đậm"
                style={{ fontWeight: "700", padding: "4px 10px", borderRadius: "4px", border: "1px solid #CBD5E1", background: "#F8FAFC", cursor: "pointer" }}
              >
                <b>B</b>
              </button>
              <button
                type="button"
                onMouseDown={handleEditItalic}
                title="In nghiêng"
                style={{ fontStyle: "italic", padding: "4px 10px", borderRadius: "4px", border: "1px solid #CBD5E1", background: "#F8FAFC", cursor: "pointer" }}
              >
                <i>I</i>
              </button>
              <button
                type="button"
                onClick={() => insertEditEmoji("😊")}
                title="Chèn emoji"
                style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", background: "#F8FAFC", cursor: "pointer" }}
              >
                😊
              </button>
              <button
                type="button"
                onClick={() => insertEditEmoji("👍")}
                title="Chèn emoji"
                style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", background: "#F8FAFC", cursor: "pointer" }}
              >
                👍
              </button>
              <button
                type="button"
                onClick={() => insertEditEmoji("🔥")}
                title="Chèn emoji"
                style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #CBD5E1", background: "#F8FAFC", cursor: "pointer" }}
              >
                🔥
              </button>
            </div>
            <div
              ref={editEditorRef}
              className="post-editor-contenteditable"
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => setEditContent(e.currentTarget.innerHTML)}
              data-placeholder={hasPoll ? "Nhập nội dung/mô tả bài viết..." : "Nhập nội dung bài viết..."}
              style={{
                minHeight: hasPoll ? "70px" : "110px",
                padding: "10px 12px",
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                background: "#FFFFFF",
                outline: "none",
                fontSize: "14px",
                lineHeight: "1.6",
                maxHeight: "300px",
                overflowY: "auto",
              }}
            />
          </div>

          {hasPoll ? (
            <div className="post-edit-poll-section">
              <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#1E293B", marginBottom: "6px" }}>
                📊 Câu hỏi khảo sát:
              </label>
              <input
                type="text"
                className="post-edit-poll-input"
                value={editPollQuestion}
                onChange={(e) => setEditPollQuestion(e.target.value)}
                placeholder="Nhập câu hỏi khảo sát..."
                disabled={updating}
              />

              <div style={{ marginTop: "12px" }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#475569", marginBottom: "6px" }}>
                  Các phương án lựa chọn:
                </label>
                <div className="post-edit-poll-options-list">
                  {editPollOptions.map((opt, idx) => (
                    <div key={idx} className="post-edit-poll-option-row">
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748B", minWidth: "20px" }}>
                        {idx + 1}.
                      </span>
                      <input
                        type="text"
                        className="post-edit-poll-input"
                        value={opt.optionText}
                        onChange={(e) => handleEditOptionChange(idx, e.target.value)}
                        placeholder={`Lựa chọn ${idx + 1}...`}
                        disabled={updating}
                      />
                      {editPollOptions.length > 2 && (
                        <button
                          type="button"
                          className="post-edit-poll-option-remove"
                          onClick={() => handleRemoveEditOption(idx)}
                          title="Xóa lựa chọn này"
                          disabled={updating}
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {editPollOptions.length < 10 && (
                  <button
                    type="button"
                    className="post-edit-poll-add-btn"
                    onClick={handleAddEditOption}
                    disabled={updating}
                  >
                    + Thêm lựa chọn ({editPollOptions.length}/10)
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="post-edit-attachments-section">
              {/* Images in edit */}
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

              {/* Documents/Files in edit */}
              <div className="post-edit-files-section" style={{ marginTop: "10px", marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#475569", marginBottom: "6px" }}>
                  Tài liệu đính kèm ({editFiles.length}/5):
                </label>
                {editFiles.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "8px" }}>
                    {editFiles.map((fileItem, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "6px 12px",
                          background: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                          borderRadius: "6px",
                          fontSize: "13px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                          <DocumentIcon size={16} color="#2563EB" />
                          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "320px", color: "#1E293B" }}>
                            {fileItem.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeEditDoc(idx)}
                          style={{
                            border: "none",
                            background: "none",
                            color: "#DC2626",
                            cursor: "pointer",
                            fontWeight: "700",
                            fontSize: "16px",
                            padding: "0 4px",
                          }}
                          title="Xóa tài liệu này"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {editFiles.length < 5 && (
                  <div>
                    <button
                      type="button"
                      className="create-post-image-btn"
                      onClick={() => editDocInputRef.current?.click()}
                      disabled={updating}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        background: "#F1F5F9",
                        color: "#334155",
                        border: "1px solid #CBD5E1",
                        borderRadius: "6px",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <DocumentIcon size={14} color="#334155" /> Thêm tài liệu ({editFiles.length}/5)
                    </button>
                    <input
                      ref={editDocInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                      multiple
                      style={{ display: "none" }}
                      onChange={handleDocSelect}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

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
      {!isEditing && poll && (() => {
        const isReadOnlyPoll = Boolean(readOnly || post.isReported || post.isHidden);
        return (
          <div className="post-card-poll">
            <div className="poll-header-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <ChartIcon size={18} color="#2563EB" />
              <span>{poll.question}</span>
            </div>
            
            {!isReadOnlyPoll && poll.hideResultsBeforeVote && !poll.hasCurrentUserVoted && (
              <div className="poll-hidden-notice" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <LockIcon size={14} color="#64748B" />
                <span>Kết quả bị ẩn cho đến khi bạn thực hiện bình chọn</span>
              </div>
            )}

            <div className="poll-options-list">
              {poll.options && poll.options.map((opt) => {
                const showStats = isReadOnlyPoll || !(poll.hideResultsBeforeVote && !poll.hasCurrentUserVoted);
                const pct = (showStats && poll.totalVotes > 0) ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0;
                const isVoted = opt.isVotedByCurrentUser;
                const canViewVoters = !poll.hideVoters && showStats && opt.voteCount > 0;

                return (
                  <div
                    key={opt.id}
                    className={`poll-option-bar-item ${isVoted ? "voted" : ""} ${isReadOnlyPoll ? "read-only" : ""}`}
                    style={isReadOnlyPoll ? { cursor: "default" } : undefined}
                    onClick={() => !isReadOnlyPoll && handlePollVote(opt.id)}
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
                        {!isReadOnlyPoll && (opt.canDelete || isOwner || (user?.id && opt.createdById && String(user.id) === String(opt.createdById))) && poll.options && poll.options.length > 2 && (
                          <button
                            type="button"
                            className="poll-option-delete-btn"
                            onClick={(e) => handleDeletePollOption(e, opt.id)}
                            title="Xóa phương án này"
                          >
                            <TrashIcon size={13} color="#DC2626" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Option Form */}
            {!isReadOnlyPoll && poll.allowAddOptions && (
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
              {!isReadOnlyPoll && poll.hideResultsBeforeVote && !poll.hasCurrentUserVoted ? (
                <span>Hãy chọn 1 phương án để bình chọn</span>
              ) : (
                <span>Tổng số lượt bình chọn: {poll.totalVotes || 0}</span>
              )}
            </div>
          </div>
        );
      })()}

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
                <span>{post.allowComments === false ? "Tắt bình luận" : `${commentCount} bình luận`}</span>
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
              disabled={isVoting}
              style={{ pointerEvents: isVoting ? "none" : "auto" }}
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
              disabled={isVoting}
              style={{ pointerEvents: isVoting ? "none" : "auto" }}
            >
              <span className="segment-icon">
                <DownvoteIcon size={16} color={userVote === "DOWNVOTE" ? "#DC2626" : "#475569"} filled={userVote === "DOWNVOTE"} />
              </span>
              <span>Downvote {downvoteCount > 0 ? `(${downvoteCount})` : ""}</span>
            </button>

            <button
              type="button"
              className={`action-segment-btn ${showCommentsModal ? "active-comments" : ""} ${post.allowComments === false ? "disabled-comments" : ""}`}
              onClick={() => {
                if (post.allowComments === false) {
                  notification.info("Tác giả đã tắt tính năng bình luận cho bài viết này.");
                } else {
                  setShowCommentsModal(true);
                }
              }}
              style={
                post.allowComments === false
                  ? { opacity: 0.45, cursor: "not-allowed" }
                  : {}
              }
              title={post.allowComments === false ? "Tác giả đã tắt tính năng bình luận cho bài viết này" : "Bình luận"}
            >
              <span className="segment-icon">
                <CommentBubbleIcon size={16} color={post.allowComments === false ? "#94A3B8" : (showCommentsModal ? "#2563EB" : "#475569")} />
              </span>
              <span>{post.allowComments === false ? "Đã tắt bình luận" : "Bình luận"}</span>
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
          onClick={handleCloseCommentsModal}
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
                onClick={handleCloseCommentsModal}
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
                allowComments={post.allowComments !== false}
                targetCommentId={targetCommentId}
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
