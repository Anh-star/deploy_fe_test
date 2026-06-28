import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import DocumentBookmarkControl from "../../components/common/DocumentBookmarkControl";
import { useAuth } from "../../context/AuthContext";
import {
  ChevronRightIcon,
  DownloadIcon,
  MessageIcon,
  HeartIcon,
  AlertIcon,
  ListIcon,
  ClockIcon,
} from "../../components/icons";
import "../../styles/documentDetail.css";
import { useLoginRequired } from "../../context/LoginRequiredModalContext";
import { useNotification } from "../../context/NotificationContext";
import {
  buildDocumentDownloadName,
  commentService,
  documentService,
  downloadFileViaFetch,
  getApiErrorMessage,
} from "../../services/api";
import {
  getDocumentThumbnailUrl,
  onDocumentThumbnailError,
} from "../../utils/documentThumbnail";
import { getDocumentUploaderDisplayName } from "../../utils/documentUploaderDisplay";
import DocumentPreview from "../../components/document/DocumentPreview";

function formatFileSize(bytes) {
  if (bytes == null || bytes === "") return "";
  const n = Number(bytes);
  if (Number.isNaN(n) || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCompactNumber(value) {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return "0";
  return new Intl.NumberFormat("vi", { notation: "compact" }).format(n);
}

function formatCommentTime(value) {
  if (value == null || value === "") return "";
  if (Array.isArray(value)) {
    const [y, m, d, h = 0, min = 0, sec = 0] = value;
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1, h, min, sec);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const notification = useNotification();
  const requestLogin = useLoginRequired();
  const { user } = useAuth();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [comments, setComments] = useState([]);
  const [commentsPage, setCommentsPage] = useState(0);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [totalComment, setTotalComment] = useState(0);
  const [repliesByParent, setRepliesByParent] = useState({});
  const [repliesOpen, setRepliesOpen] = useState({});
  const [repliesLoading, setRepliesLoading] = useState({});
  const repliesLoadedRef = useRef(new Set());
  const [newCommentText, setNewCommentText] = useState("");
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyBody, setReplyBody] = useState("");

  const descRef = useRef(null);
  const [showReadMoreBtn, setShowReadMoreBtn] = useState(false);
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  useEffect(() => {
    setIsDescExpanded(false);
  }, [id]);

  useEffect(() => {
    if (descRef.current && !isDescExpanded) {
      const hasOverflow =
        descRef.current.scrollHeight > descRef.current.clientHeight;
      setShowReadMoreBtn(hasOverflow);
    }
  }, [detail?.documentInfo?.description, isDescExpanded]);

  // Record view then load detail so stats match DB; view() coalesces duplicate calls (StrictMode).
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await documentService.view(id).catch(() => {});
        const data = await documentService.getDocumentById(id);
        if (!cancelled) setDetail(data);
      } catch (e) {
        if (!cancelled) {
          const msg = getApiErrorMessage(e);
          setError(msg);
          setDetail(null);
          notification.error(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast API stable enough; avoid refetch loop
  }, [id]);

  useEffect(() => {
    setNewCommentText("");
    setReplyingToId(null);
    setReplyBody("");
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    repliesLoadedRef.current = new Set();
    setRepliesByParent({});
    setRepliesOpen({});
    setRepliesLoading({});
    setComments([]);
    setCommentsPage(0);
    setCommentsHasMore(false);
    setTotalComment(0);
    (async () => {
      setCommentsLoading(true);
      try {
        const data = await commentService.getComments(id, 0);
        if (cancelled) return;
        setComments(data.content || []);
        const p = data.page ?? 0;
        setCommentsPage(p);
        setTotalComment(data.totalComment ?? 0);
        const tp = data.totalPages ?? 0;
        setCommentsHasMore(p + 1 < tp);
      } catch (e) {
        if (!cancelled) notification.error(getApiErrorMessage(e));
      } finally {
        if (!cancelled) setCommentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const redirectForAuth = useCallback(() => {
    return requestLogin({
      redirectTo: id ? `/documents/${id}` : "/documents",
    });
  }, [id, requestLogin]);

  const loginRedirectTo = location.pathname + location.search;

  const handleReportClick = useCallback(() => {
    if (!requestLogin({ redirectTo: loginRedirectTo })) return;
  }, [requestLogin, loginRedirectTo]);

  const goToQuizPreview = useCallback(
    (quizId) => {
      if (!quizId || !id) return;
      if (!requestLogin({ redirectTo: loginRedirectTo })) return;
      navigate(`/quiz/${quizId}/preview`, { state: { documentId: id } });
    },
    [id, navigate, requestLogin, loginRedirectTo]
  );

  const goToDocumentQuizzes = useCallback(() => {
    if (!id) return;
    if (!requestLogin({ redirectTo: loginRedirectTo })) return;
    navigate(`/documents/${id}/quizzes`);
  }, [id, navigate, requestLogin, loginRedirectTo]);

  const patchComment = useCallback((commentId, patch) => {
    const cid = String(commentId);
    setComments((prev) =>
      prev.map((c) => (String(c.id) === cid ? { ...c, ...patch } : c))
    );
    setRepliesByParent((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        next[k] = next[k].map((c) =>
          String(c.id) === cid ? { ...c, ...patch } : c
        );
      }
      return next;
    });
  }, []);

  const bumpReplyCount = useCallback((parentId) => {
    const pid = String(parentId);
    setComments((prev) =>
      prev.map((c) =>
        String(c.id) === pid
          ? { ...c, replyCount: (c.replyCount ?? 0) + 1 }
          : c
      )
    );
    setRepliesByParent((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        next[k] = next[k].map((c) =>
          String(c.id) === pid
            ? { ...c, replyCount: (c.replyCount ?? 0) + 1 }
            : c
        );
      }
      return next;
    });
  }, []);

  const loadRepliesFor = useCallback(
    async (commentId) => {
      const cid = String(commentId);
      setRepliesLoading((p) => ({ ...p, [cid]: true }));
      try {
        const list = await commentService.getReplies(cid);
        setRepliesByParent((p) => ({ ...p, [cid]: list || [] }));
        repliesLoadedRef.current.add(cid);
      } catch (e) {
        notification.error(getApiErrorMessage(e));
        setRepliesOpen((p) => ({ ...p, [cid]: false }));
      } finally {
        setRepliesLoading((p) => ({ ...p, [cid]: false }));
      }
    },
    [notification]
  );

  const toggleReplies = useCallback(
    (commentId) => {
      const cid = String(commentId);
      setRepliesOpen((prev) => {
        const wasOpen = !!prev[cid];
        if (wasOpen) return { ...prev, [cid]: false };
        if (!repliesLoadedRef.current.has(cid)) {
          void loadRepliesFor(cid);
        }
        return { ...prev, [cid]: true };
      });
    },
    [loadRepliesFor]
  );

  const handleToggleLike = useCallback(
    async (commentId) => {
      if (!redirectForAuth()) return;
      const cid = String(commentId);
      let target =
        comments.find((c) => String(c.id) === cid) ||
        Object.values(repliesByParent)
          .flat()
          .find((c) => String(c.id) === cid);
      if (!target) return;
      const liked = !!target.isLiked;
      const before = { isLiked: target.isLiked, likeCount: target.likeCount };
      patchComment(cid, {
        isLiked: !liked,
        likeCount: Math.max(0, (target.likeCount ?? 0) + (liked ? -1 : 1)),
      });
      try {
        const data = await commentService.toggleLike(commentId);
        patchComment(cid, {
          isLiked: data.isLiked,
          likeCount: data.likeCount,
        });
      } catch (e) {
        patchComment(cid, before);
        notification.error(getApiErrorMessage(e));
      }
    },
    [comments, repliesByParent, patchComment, notification, redirectForAuth]
  );

  const loadMoreComments = useCallback(async () => {
    if (!id || commentsLoading || !commentsHasMore) return;
    setCommentsLoading(true);
    const nextPage = commentsPage + 1;
    try {
      const data = await commentService.getComments(id, nextPage);
      const incoming = data.content || [];
      setComments((prev) => {
        const seen = new Set(prev.map((c) => String(c.id)));
        const merged = [...prev];
        for (const c of incoming) {
          const k = String(c.id);
          if (!seen.has(k)) {
            seen.add(k);
            merged.push(c);
          }
        }
        return merged;
      });
      const p = data.page ?? nextPage;
      setCommentsPage(p);
      const tp = data.totalPages ?? 0;
      setCommentsHasMore(p + 1 < tp);
    } catch (e) {
      notification.error(getApiErrorMessage(e));
    } finally {
      setCommentsLoading(false);
    }
  }, [
    id,
    commentsLoading,
    commentsHasMore,
    commentsPage,
    notification,
  ]);

  const submitRootComment = useCallback(async () => {
    if (!id) return;
    if (!redirectForAuth()) return;
    const text = newCommentText.trim();
    if (!text) return;
    try {
      const created = await commentService.postComment(id, text);
      setNewCommentText("");
      setComments((prev) => [created, ...prev]);
      setTotalComment((t) => t + 1);
    } catch (e) {
      notification.error(getApiErrorMessage(e));
    }
  }, [id, newCommentText, notification, redirectForAuth]);

  const onReplyClick = useCallback(
    (commentId) => {
      if (!redirectForAuth()) return;
      const cid = String(commentId);
      setReplyingToId((cur) => (String(cur) === cid ? null : cid));
      setReplyBody("");
    },
    [redirectForAuth]
  );

  const submitReply = useCallback(
    async (parentId) => {
      if (!redirectForAuth()) return;
      const text = replyBody.trim();
      if (!text) return;
      const pid = String(parentId);
      try {
        const created = await commentService.postReply(parentId, text);
        setReplyBody("");
        setReplyingToId(null);
        setRepliesByParent((p) => ({
          ...p,
          [pid]: [...(p[pid] || []), created],
        }));
        repliesLoadedRef.current.add(pid);
        bumpReplyCount(parentId);
        setRepliesOpen((p) => ({ ...p, [pid]: true }));
      } catch (e) {
        notification.error(getApiErrorMessage(e));
      }
    },
    [replyBody, bumpReplyCount, notification, redirectForAuth]
  );

  const handleDownload = useCallback(async () => {
    if (!id) return;
    if (
      !requestLogin({
        redirectTo: id ? `/documents/${id}` : "/documents",
      })
    )
      return;
    try {
      await documentService.download(id);
      const filePayload = await documentService.getDocumentFileUrl(id);
      const fileUrl = filePayload?.fileUrl;
      if (!fileUrl) {
        notification.error("Không lấy được đường dẫn tải xuống.");
        return;
      }
      const suggestedName = buildDocumentDownloadName(
        detail?.documentInfo?.title,
        detail?.file?.fileType
      );
      await downloadFileViaFetch(fileUrl, suggestedName);
      notification.success("Đang tải xuống tài liệu.");
      try {
        const fresh = await documentService.getDocumentById(id);
        setDetail(fresh);
      } catch {
        /* counters stay stale until next visit; download already succeeded */
      }
    } catch (e) {
      notification.error(getApiErrorMessage(e));
    }
  }, [id, requestLogin, notification, detail]);

  const info = detail?.documentInfo;
  const stats = detail?.stats;
  const file = detail?.file;
  const quizzes = detail?.quizzes || [];
  const related = detail?.relatedDocuments || [];
  const reportCount = stats?.reportCount ?? 0;
  const isFrequentlyReported = reportCount >= 3;

  const titleText = loading ? "Đang tải…" : error ? "Không tải được tài liệu" : info?.title || "";
  const downloadLabel = file?.fileSize
    ? `Tải xuống ngay (${formatFileSize(file.fileSize)})`
    : "Tải xuống ngay";

  const inputAvatarSrc = user?.avatar || "https://placehold.co/40x40";
  const commentCountDisplay =
    totalComment || detail?.comments?.totalComments || 0;

  function renderCommentRow(comment, depth = 0) {
    const cid = String(comment.id);
    const avatarSrc = comment.authorAvatar || "https://placehold.co/40x40";
    const open = !!repliesOpen[cid];
    const children = repliesByParent[cid] || [];
    const loadingReplies = !!repliesLoading[cid];

    return (
      <div
        key={cid}
        className="comment-item"
        style={depth ? { marginLeft: 24, marginTop: 12 } : undefined}
      >
        <img src={avatarSrc} alt={comment.authorName || ""} className="user-avatar" />
        <div className="comment-content-wrapper">
          <div className="comment-user-info">
            <span className="comment-user-name">{comment.authorName || "Ẩn danh"}</span>
            <span className="comment-time">• {formatCommentTime(comment.createdAt)}</span>
          </div>
          <p className="comment-text">
            {comment.replyToUserName ? (
              <span style={{ color: "#007bff", marginRight: 6 }}>
                @{comment.replyToUserName}
              </span>
            ) : null}
            {comment.body}
          </p>
          <div className="comment-actions">
            <div
              role="button"
              tabIndex={0}
              className="comment-action-item"
              onClick={() => void handleToggleLike(comment.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") void handleToggleLike(comment.id);
              }}
            >
              <HeartIcon size={14} color={comment.isLiked ? "#007bff" : "#64748b"} />
              <span>{comment.likeCount ?? 0}</span>
            </div>
            {(comment.replyCount ?? 0) > 0 ? (
              <div className="comment-action-item">
                <span>{comment.replyCount} phản hồi</span>
              </div>
            ) : null}
            <div
              role="button"
              tabIndex={0}
              className="comment-action-item"
              onClick={() => onReplyClick(comment.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onReplyClick(comment.id);
              }}
            >
              Phản hồi
            </div>
          </div>
          {(comment.replyCount ?? 0) > 0 ? (
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  color: "#007bff",
                  fontSize: "12px",
                  cursor: "pointer",
                  padding: 0,
                }}
                onClick={() => toggleReplies(comment.id)}
              >
                {open ? "Ẩn replies" : `Xem replies (${comment.replyCount})`}
              </button>
            </div>
          ) : null}
          {open ? (
            <div className="comment-list" style={{ marginTop: 8 }}>
              {loadingReplies ? (
                <div style={{ fontSize: 12, color: "#64748b" }}>Đang tải…</div>
              ) : (
                children.map((ch) => renderCommentRow(ch, depth + 1))
              )}
            </div>
          ) : null}
          {String(replyingToId) === cid ? (
            <div className="comment-textarea-wrapper" style={{ marginTop: 12 }}>
              <textarea
                className="comment-textarea"
                placeholder="Viết phản hồi…"
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                rows={2}
              />
              <button
                type="button"
                className="submit-comment-btn"
                onClick={() => void submitReply(comment.id)}
              >
                Gửi
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="document-detail-container">
      <main className="document-detail-content">
        {/* Breadcrumb */}
        <nav className="breadcrumb">
          <Link to="/" className="breadcrumb-item">
            Trang chủ
          </Link>
          <ChevronRightIcon size={12} color="#64748b" />
          <Link to="/documents" className="breadcrumb-item">
            Danh sách tài liệu
          </Link>
          <ChevronRightIcon size={12} color="#64748b" />
          <span className="breadcrumb-item active">{titleText || "—"}</span>
        </nav>

        <div className="document-main-layout">
          {/* Left Column */}
          <div className="document-left-column">
            <div className="pdf-viewer-container">
              <div className="document-preview-container">
                <DocumentPreview
                  fileUrl={file?.fileUrl}
                  fileType={file?.fileType}
                  fileName={info?.title}
                />
              </div>
            </div>

            {/* Comments Section */}
            <div className="comments-section">
              <div className="comments-header">
                <MessageIcon size={20} color="#007bff" />
                <h3 className="comments-title">Bình luận ({commentCountDisplay})</h3>
              </div>

              <div className="comment-input-container">
                <img src={inputAvatarSrc} alt="User Avatar" className="user-avatar" />
                <div className="comment-textarea-wrapper">
                  <textarea
                    className="comment-textarea"
                    placeholder="Chia sẻ cảm nghĩ của bạn về tài liệu này..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                  />
                  <button
                    type="button"
                    className="submit-comment-btn"
                    onClick={() => void submitRootComment()}
                  >
                    Gửi bình luận
                  </button>
                </div>
              </div>

              <div className="comment-list">
                {commentsLoading && comments.length === 0 ? (
                  <div style={{ fontSize: 13, color: "#64748b" }}>Đang tải bình luận…</div>
                ) : null}
                {comments.map((comment) => renderCommentRow(comment, 0))}
              </div>

              <div style={{ textAlign: "center", marginTop: "24px" }}>
                {commentsHasMore ? (
                  <button
                    type="button"
                    disabled={commentsLoading}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#64748b",
                      fontSize: "12px",
                      cursor: commentsLoading ? "wait" : "pointer",
                    }}
                    onClick={() => void loadMoreComments()}
                  >
                    {commentsLoading ? "Đang tải…" : "Xem thêm"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="document-right-column">
            {/* Main Info */}
            <div className="document-info-card">
              <div className="document-title-row">
                <h1 className="document-title">
                  {titleText}
                  {isFrequentlyReported && (
                    <span className="doc-report-warning" aria-label={`Tài liệu này đã bị báo cáo ${reportCount} lần`}>
                      <span className="doc-report-warning__icon" aria-hidden="true">
                        ⚠
                      </span>
                      <span className="doc-report-warning__tooltip" role="tooltip">
                        ⚠️ Tài liệu này đã bị báo cáo {reportCount} lần. Hãy cân nhắc trước khi sử dụng.
                      </span>
                    </span>
                  )}
                </h1>
                {id ? (
                  <DocumentBookmarkControl
                    documentId={id}
                    serverIsBookmarked={detail?.documentInfo?.isBookmarked}
                    redirectTo={location.pathname + location.search}
                  />
                ) : null}
              </div>

              <div className="author-info">
                <div className="author-details">
                  <img src="https://placehold.co/40x40" alt="Author" className="user-avatar" />
                  <div className="author-name-wrapper">
                    <span className="posted-by">Đăng bởi</span>
                    <span className="author-name">
                      {getDocumentUploaderDisplayName(info) || "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="document-description-wrapper">
                <p
                  ref={descRef}
                  className={`document-description ${!isDescExpanded ? "collapsed" : ""}`}
                >
                  {info?.description || ""}
                </p>
                {showReadMoreBtn && (
                  <button
                    type="button"
                    className="read-more-btn"
                    onClick={() => setIsDescExpanded(!isDescExpanded)}
                  >
                    {isDescExpanded ? "Thu gọn" : "Xem thêm"}
                  </button>
                )}
              </div>

              <div className="document-tags">
                {(info?.tags || []).map((tag) => (
                  <span key={tag} className="tag">
                    {tag.startsWith("#") ? tag : `#${tag}`}
                  </span>
                ))}
              </div>

              <div className="document-stats">
                <div className="stat-item">
                  <div className="stat-label">Lượt xem</div>
                  <div className="stat-value">{formatCompactNumber(stats?.totalViews)}</div>
                </div>
                <div className="stat-item">
                  <div className="stat-label">Lượt tải</div>
                  <div className="stat-value">{formatCompactNumber(stats?.totalDownloads)}</div>
                </div>
              </div>

              <button type="button" className="primary-action-btn" onClick={handleDownload}>
                <DownloadIcon size={18} />
                {downloadLabel}
              </button>

              <div className="secondary-actions">
                <button
                  type="button"
                  className="secondary-btn report"
                  style={{ flex: 1 }}
                  onClick={handleReportClick}
                >
                  <AlertIcon size={16} />
                  Báo cáo
                </button>
              </div>
            </div>

            {/* Quiz List */}
            <div className="sidebar-card">
              <div className="card-title">
                <ListIcon size={18} color="#007bff" />
                Danh sách bài tập
              </div>
              <div className="exercise-list">
                {quizzes.map((ex) => (
                  <div
                    key={ex.id}
                    className="exercise-item"
                    role="button"
                    tabIndex={0}
                    onClick={() => goToQuizPreview(ex.id)}
                    onKeyDown={(e) => e.key === "Enter" && goToQuizPreview(ex.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="exercise-name">{ex.title}</div>
                    <div className="exercise-meta">
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <MessageIcon size={12} /> {ex.totalQuestions ?? 0} câu hỏi
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <ClockIcon size={12} />{" "}
                        {ex.durationMinutes != null ? `${ex.durationMinutes} phút` : "—"}
                      </span>
                    </div>
                  </div>
                ))}
                {quizzes.length === 0 ? (
                  <div style={{ fontSize: 13, color: "#64748b" }}>Chưa có bài tập</div>
                ) : null}
              </div>
              {quizzes.length > 0 ? (
                <button type="button" className="view-all-btn" onClick={goToDocumentQuizzes}>
                  Xem tất cả bài tập
                </button>
              ) : null}
            </div>

            {/* Related Documents */}
            <div className="sidebar-card">
              <div className="card-title">Tài liệu liên quan</div>
              <div className="related-list">
                {related.map((doc) => (
                  <div
                    key={doc.id}
                    role="button"
                    tabIndex={0}
                    className="related-item"
                    onClick={() => doc.id && navigate(`/documents/${doc.id}`)}
                    onKeyDown={(e) => e.key === "Enter" && doc.id && navigate(`/documents/${doc.id}`)}
                  >
                    <img
                      src={getDocumentThumbnailUrl(doc)}
                      alt={doc.title || ""}
                      className="related-thumb"
                      onError={onDocumentThumbnailError}
                    />
                    <div className="related-info">
                      <div className="related-title">{doc.title}</div>
                      <div className="related-meta">{formatCompactNumber(doc.totalViews)} lượt xem</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
