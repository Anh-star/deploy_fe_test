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
  paymentService,
  validateCreatePaymentResponse,
} from "../../services/api";
import {
  getDocumentThumbnailUrl,
  onDocumentThumbnailError,
} from "../../utils/documentThumbnail";
import { getDocumentUploaderDisplayName } from "../../utils/documentUploaderDisplay";
import { savePendingPurchase } from "../../utils/pendingPurchaseSession";
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
  // `initializing` is true while AuthProvider is hydrating from
  // localStorage / refreshing / calling /auth/me. We use it to keep the
  // CTA off INVALID_PRICING during the boot window — see actionMode.
  const { user, initializing: authInitializing } = useAuth();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);

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

  // ─────────────────────────────────────────────────────────────────────
  // Pure derived values block.
  //
  // This block MUST sit BEFORE any `useCallback` whose dependency array
  // references these symbols. Previously it was placed AFTER the callback
  // declarations, which made `actionMode`, `pricingDataValid`, `info`,
  // `price`, `currentUserId`, `isOwner`, `hasAccess`, `documentOwnerId`,
  // `currentIdentityValid`, `canBuy`, `formattedPrice`, `ctaDisabled` and
  // `ctaLabel` sit in the temporal dead zone when React evaluates the
  // dependency array on the first render — causing
  //   ReferenceError: Cannot access 'actionMode' before initialization
  // at runtime.
  //
  // All expressions are kept byte-for-byte identical to the original
  // declaration; only the textual position changes.
  // ─────────────────────────────────────────────────────────────────────
  const info = detail?.documentInfo;
  const stats = detail?.stats;
  const file = detail?.file;
  const quizzes = detail?.quizzes || [];
  const related = detail?.relatedDocuments || [];
  const reportCount = stats?.reportCount ?? 0;
  const isFrequentlyReported = reportCount >= 3;

  // Card title. Fallback priority (single source of truth):
  //   1. If `info?.title` is a non-empty string, render it. This wins
  //      over every other signal so a transient `loading` flip after
  //      the detail has already arrived cannot drop the title back to
  //      "Đang tải…".
  //   2. If the detail fetch is still in flight, render the loading
  //      placeholder.
  //   3. If the fetch failed, render the error placeholder.
  //   4. Otherwise render empty string (breadcrumb will fall back to "—").
  const titleText =
    typeof info?.title === "string" && info.title.length > 0
      ? info.title
      : loading
        ? "Đang tải…"
        : error
          ? "Không tải được tài liệu"
          : "";

  // ─────────────────────────────────────────────────────────────────────
  // Strict public-pricing derivation (Phase C.1C — corrected contract).
  //
  // Fail-closed: paid documents require strict shapes for ALL of
  // isPaid / price / hasAccess / documentOwnerId / currentUserId. Missing
  // or wrong-typed values force `actionMode = INVALID_PRICING` so the
  // UI never infers "buyer not yet purchased" from undefined/null
  // sentinel values.
  //
  // Owners are detected by strict string equality between
  // `currentUserId` and `documentOwnerId`. We never infer ownership from
  // `hasAccess`.
  // ─────────────────────────────────────────────────────────────────────
  const isPaidValid = typeof info?.isPaid === "boolean";
  const isPaid = isPaidValid ? info.isPaid : null;

  const priceValid =
    typeof info?.price === "number" &&
    Number.isFinite(info.price) &&
    Number.isInteger(info.price) &&
    info.price >= 3000;
  const price = priceValid ? info.price : null;

  const hasAccessValid = typeof info?.hasAccess === "boolean";
  const hasAccess = hasAccessValid ? info.hasAccess : null;

  const documentOwnerIdRaw =
    typeof info?.userId === "string" ? info.userId.trim() : "";
  const documentOwnerId = documentOwnerIdRaw.length > 0 ? documentOwnerIdRaw : null;

  const currentUserIdRaw =
    typeof user?.id === "string" ? user.id.trim() : "";
  const currentUserId = currentUserIdRaw.length > 0 ? currentUserIdRaw : null;
  // If a user object exists at all, its id MUST be a non-empty string;
  // an empty/missing id on a logged-in account is a backend contract
  // violation we refuse to silently work around.
  const currentIdentityValid = user == null || currentUserId !== null;

  const isOwner =
    currentUserId !== null &&
    documentOwnerId !== null &&
    currentUserId === documentOwnerId;

  const paidPricingDataValid =
    isPaid === true &&
    priceValid &&
    hasAccessValid &&
    documentOwnerId !== null &&
    currentIdentityValid;

  const freePricingDataValid = isPaid === false;

  // For paid doc fallbacks we still need price for the buy-button label.
  // For invalid paid pricing the price token is null and we never render
  // a Mua ngay CTA.
  const pricingDataValid =
    isPaidValid && (freePricingDataValid || paidPricingDataValid);

  // Derived BUY eligibility — explicit boolean fields only. We never use
  // `hasAccess !== true` because that pattern incorrectly treats
  // undefined / null / "false" as "not purchased" and could open a
  // buy-without-knowing-the-truth gap.
  const canBuy =
    isPaid === true &&
    priceValid &&
    hasAccessValid &&
    documentOwnerId !== null &&
    currentIdentityValid &&
    isOwner === false &&
    hasAccess === false &&
    currentUserId !== null;

  // Derived action mode.
  //
  // AUTH_LOADING takes precedence over every other branch while the
  // AuthProvider is still hydrating from localStorage / refresh /
  // /auth/me. This prevents the boot window — when `user` is still
  // `null` even though the buyer is logged in — from collapsing into
  // INVALID_PRICING just because the strict checks have not yet been
  // satisfied. After `initializing` flips to false, the derive re-runs
  // and lands on the real mode (BUY, PURCHASED_DOWNLOAD, etc.).
  let actionMode = "AUTH_LOADING";
  if (!authInitializing) {
    if (!pricingDataValid) {
      actionMode = "INVALID_PRICING";
    } else if (isPaid === false) {
      actionMode = "FREE_DOWNLOAD";
    } else if (isOwner === true) {
      actionMode = "OWNER_DOWNLOAD";
    } else if (hasAccess === true) {
      actionMode = "PURCHASED_DOWNLOAD";
    } else if (currentUserId !== null) {
      actionMode = "BUY";
    } else {
      actionMode = "LOGIN_TO_BUY";
    }
  }

  // Single source of truth for the status badge displayed next to the
  // title. Decoupling from raw `isPaid` / `hasAccess` / `isOwner` so the
  // badge can never render a state that disagrees with the CTA — both
  // consult the same `actionMode`.
  const statusBadge =
    actionMode === "OWNER_DOWNLOAD"
      ? "owner"
      : actionMode === "PURCHASED_DOWNLOAD"
        ? "purchased"
        : null;

  // Single source of truth for the standalone price row. The standalone
  // price is shown only for modes whose CTA does not already embed the
  // price: FREE_DOWNLOAD ("Miễn phí"), OWNER_DOWNLOAD, LOGIN_TO_BUY.
  // BUY embeds the price in the CTA label; PURCHASED_DOWNLOAD,
  // AUTH_LOADING, INVALID_PRICING never show a price.
  const showStandalonePrice =
    actionMode === "FREE_DOWNLOAD" ||
    actionMode === "OWNER_DOWNLOAD" ||
    actionMode === "LOGIN_TO_BUY";

  const formattedPrice =
    typeof price === "number" && Number.isFinite(price)
      ? `${new Intl.NumberFormat("vi-VN").format(price)} ₫`
      : "";
  const downloadSizeLabel = file?.fileSize
    ? ` (${formatFileSize(file.fileSize)})`
    : "";
  const purchaseButtonLabel =
    actionMode === "BUY" && formattedPrice
      ? `Mua ngay — ${formattedPrice}`
      : "Mua ngay";

  // Build the in-progress CTA label and disable flag for the BUY flow.
  // AUTH_LOADING is always disabled — the auth state itself is not yet
  // settled, so we refuse to branch on user identity.
  const ctaDisabled =
    actionMode === "AUTH_LOADING" ||
    actionMode === "INVALID_PRICING" ||
    (actionMode === "BUY" && isCreatingPayment);
  const ctaLabel = (() => {
    if (actionMode === "AUTH_LOADING") return "Đang xác định quyền truy cập...";
    if (actionMode === "INVALID_PRICING") return "Không thể xác định";
    if (actionMode === "FREE_DOWNLOAD") return `Tải xuống ngay${downloadSizeLabel}`;
    if (actionMode === "OWNER_DOWNLOAD")
      return `Tải xuống ngay${downloadSizeLabel}`;
    if (actionMode === "PURCHASED_DOWNLOAD")
      return `Tải xuống ngay${downloadSizeLabel}`;
    if (actionMode === "BUY") {
      return isCreatingPayment ? "Đang tạo thanh toán..." : purchaseButtonLabel;
    }
    if (actionMode === "LOGIN_TO_BUY") return "Đăng nhập để mua";
    return "Tải xuống ngay";
  })();

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

    // Defensive gate: derive eligibility from the strict pricing state, not
    // from "did the user click the button?". Even if DevTools enables a
    // hidden CTA or the visible CTA is mismounted, the guard still rejects
    // unpaid paid downloads here. Backend /file remains the final safety net.
    if (actionMode !== "FREE_DOWNLOAD" &&
        actionMode !== "OWNER_DOWNLOAD" &&
        actionMode !== "PURCHASED_DOWNLOAD") {
      notification.error(
        "Bạn cần mua tài liệu này trước khi tải xuống."
      );
      return;
    }

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
  }, [id, actionMode, notification, detail]);

  const handlePurchase = useCallback(async () => {
    if (!id) return;
    // Login guard first.
    if (!requestLogin({
      redirectTo: location.pathname + location.search,
    })) {
      return;
    }
    // Strict eligibility check — same source-of-truth as the visible CTA.
    // Every gate is required. Failing any one returns silently:
    // - no create-payment call;
    // - no sessionStorage write;
    // - no redirect;
    // - no toast that hints at server-side state we cannot prove.
    if (
      typeof info !== "object" ||
      info === null ||
      info.isPaid !== true ||
      info.hasAccess !== false ||
      isOwner !== false ||
      !pricingDataValid ||
      typeof price !== "number" ||
      typeof currentUserId !== "string" ||
      currentUserId.length === 0
    ) {
      notification.error(
        "Không thể tạo giao dịch thanh toán cho tài liệu này."
      );
      return;
    }
    if (isCreatingPayment) return;

    setIsCreatingPayment(true);
    try {
      const raw = await paymentService.createPayment(id);
      const validated = validateCreatePaymentResponse(raw);
      if (!validated) {
        notification.error(
          "Phản hồi thanh toán từ máy chủ không hợp lệ. Vui lòng thử lại."
        );
        return;
      }
      const pendingSaved = savePendingPurchase({
        documentId: id,
        returnUrl: location.pathname + location.search,
      });
      if (!pendingSaved) {
        notification.error(
          "Không thể khởi tạo phiên mua tài liệu. Vui lòng thử lại."
        );
        return;
      }
      // Redirect cùng tab để PayOS return URL trỏ về /payment/success.
      // window.location.assign thay vì navigate vì payment provider yêu
      // cầu full-page redirect với cookies/returnUrl cố định.
      window.location.assign(validated.checkoutUrl);
    } catch (e) {
      const message =
        e?.response?.data?.message ||
        getApiErrorMessage(e) ||
        "Không thể tạo giao dịch thanh toán.";
      notification.error(message);
    } finally {
      // Chỉ set false khi chưa điều hướng. Khi redirect đã diễn ra, việc
      // set state là vô nghĩa nhưng vẫn an toàn; window.location.assign
      // sẽ unload trang nên không có race.
      setIsCreatingPayment(false);
    }
  }, [
    id,
    requestLogin,
    info,
    isOwner,
    pricingDataValid,
    price,
    currentUserId,
    isCreatingPayment,
    location,
    notification,
  ]);

  const handlePrimaryAction = useCallback(() => {
    if (actionMode === "BUY") {
      void handlePurchase();
      return;
    }
    if (
      actionMode === "FREE_DOWNLOAD" ||
      actionMode === "OWNER_DOWNLOAD" ||
      actionMode === "PURCHASED_DOWNLOAD"
    ) {
      void handleDownload();
      return;
    }
    if (actionMode === "LOGIN_TO_BUY") {
      requestLogin({
        redirectTo: location.pathname + location.search,
      });
      return;
    }
    // AUTH_LOADING và INVALID_PRICING: không gọi gì cả.
  }, [actionMode, handlePurchase, handleDownload, requestLogin, location]);

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
                <div className="document-title-and-status-group">
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
                  {statusBadge === "owner" ? (
                    <span className="document-title-status-badge document-title-status-badge--owner">
                      Tài liệu của bạn
                    </span>
                  ) : null}
                  {statusBadge === "purchased" ? (
                    <span className="document-title-status-badge document-title-status-badge--purchased">
                      Đã mua
                    </span>
                  ) : null}
                </div>
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
                    <span className="author-name" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      {getDocumentUploaderDisplayName(info) || "—"}
                      {(info?.uploader?.hasManyDownloads || info?.uploader?.hasManyDocuments) && (
                        <span className="contributor-crown" aria-label="Contributor nổi bật">
                          <span className="contributor-crown__icon" aria-hidden="true">👑</span>
                          <span className="contributor-crown__tooltip" role="tooltip">
                            {info.uploader.hasManyDownloads && info.uploader.hasManyDocuments
                              ? "Người dùng có tài liệu nhiều lượt tải xuống & có nhiều tài liệu tải lên"
                              : info.uploader.hasManyDownloads
                              ? "Người dùng có tài liệu nhiều lượt tải xuống"
                              : "Người dùng có nhiều tài liệu tải lên"}
                          </span>
                        </span>
                      )}
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

              {/* Standalone price row. Visibility is driven by
                  `showStandalonePrice` (derived from `actionMode`) so the
                  price cannot appear in a state that disagrees with the
                  CTA. The badge that USED to live here is now anchored
                  next to the title in the title-and-status group above. */}
              {showStandalonePrice ? (
                <div className="document-pricing">
                  <div className="document-pricing-row">
                    <span className="document-pricing-amount">
                      {isPaid === false
                        ? "Miễn phí"
                        : formattedPrice
                          ? formattedPrice
                          : "Chưa xác định"}
                    </span>
                  </div>
                </div>
              ) : null}
              {actionMode === "INVALID_PRICING" ? (
                <p className="document-pricing-invalid" role="status">
                  Không thể xác định trạng thái mua tài liệu.
                </p>
              ) : null}

              <button
                type="button"
                className={`primary-action-btn primary-action-btn--${actionMode.toLowerCase()}`}
                onClick={handlePrimaryAction}
                disabled={ctaDisabled}
              >
                <DownloadIcon size={18} />
                {ctaLabel}
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
