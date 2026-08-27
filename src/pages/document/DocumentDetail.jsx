import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import DocumentBookmarkControl from "../../components/common/DocumentBookmarkControl";
import { useAuth } from "../../context/AuthContext";
import {
  ChevronRightIcon,
  DownloadIcon,
  MessageIcon,
  HeartIcon,
  UpvoteIcon,
  DownvoteIcon,
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
import {
  sanitizeInternalReturnUrl,
  savePendingPurchase,
} from "../../utils/pendingPurchaseSession";
import SecureDocumentPreview from "../../components/document/SecureDocumentPreview";
import ReportDocumentModal from "../../components/document/ReportDocumentModal";
import { parseApiDate } from "../../utils/dateUtils";

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
  const d = parseApiDate(value);
  if (!d || Number.isNaN(d.getTime())) return "";
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
  const [showReportModal, setShowReportModal] = useState(false);
  const [showMustBuyModal, setShowMustBuyModal] = useState(false);

  const searchParams = new URLSearchParams(location.search);
  const targetCommentId = searchParams.get("commentId") || (location.hash ? location.hash.replace("#comment-", "") : null);
  const [highlightedCommentId, setHighlightedCommentId] = useState(null);

  useEffect(() => {
    if (!targetCommentId || commentsLoading) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`doc-comment-${targetCommentId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedCommentId(String(targetCommentId));
        setTimeout(() => setHighlightedCommentId(null), 1200);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [targetCommentId, comments, commentsLoading]);

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
  //   1. If `info?.title` is a non-empty, non-whitespace string, render
  //      it. Whitespace-only titles are treated as missing so a
  //      transient `loading` flip after the detail has already arrived
  //      cannot drop the title back to "Đang tải…" AND a whitespace
  //      string cannot render as a blank card.
  //   2. If the detail fetch is still in flight, render the loading
  //      placeholder.
  //   3. If the fetch failed, render the error placeholder.
  //   4. Otherwise render empty string (breadcrumb will fall back to "—").
  const titleText =
    typeof info?.title === "string" && info.title.trim() !== ""
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

  // ─────────────────────────────────────────────────────────────────────
  // Guest access normalization (Phase C.1C).
  //
  // Backend anonymous request resolves `currentUserId` to null and
  // therefore emits `hasAccess: null` (see DocumentQueryServiceImpl).
  // That is not a contract violation: it merely signals "we have no
  // viewer to check access for". For the UX matrix in section 7 we need
  // `effectiveHasAccess` to collapse that case to `false` for the
  // pricing gate so the guest lands on `LOGIN_TO_BUY` rather than
  // `INVALID_PRICING`. The raw `hasAccess` stays around for the strict
  // path: a logged-in user that receives `hasAccess: null` from
  // backend is a real contract violation and MUST fail closed
  // (`effectiveHasAccess = null` → INVALID_PRICING).
  //
  // Cases:
  //   A. raw boolean → effectiveHasAccess = that boolean.
  //   B. raw null AND auth hydrated AND user === null AND
  //      currentUserId === null → effectiveHasAccess = false
  //      (guest, "no viewer = no access" semantically).
  //   C. raw null/undefined/string/number/object AND user !== null →
  //      effectiveHasAccess = null (logged-in backend contract
  //      violation; INVALID_PRICING).
  //   D. raw null AND auth still hydrating → effectiveHasAccess = null
  //      so actionMode stays AUTH_LOADING; we do NOT pre-normalize
  //      guest null to false while auth context is still booting.
  //
  // We deliberately avoid Boolean(info.hasAccess) / !! / || patterns so
  // a logged-in `hasAccess: null` cannot silently turn into `false`.
  //
  // `currentUserId` MUST be declared before this block (we need its
  // hydrated value to tell guest vs. logged-in apart), so the
  // declaration above is reorganized: `currentUserId` and
  // `currentIdentityValid` are derived up here alongside the rest of
  // the contract fields, and `effectiveHasAccess` runs immediately
  // after. Anything downstream (paidPricingDataValid, canBuy,
  // actionMode, handleDownload, handlePurchase) continues to read the
  // same names.
  const currentUserIdRaw =
    typeof user?.id === "string" ? user.id.trim() : "";
  const currentUserId = currentUserIdRaw.length > 0 ? currentUserIdRaw : null;
  // If a user object exists at all, its id MUST be a non-empty string;
  // an empty/missing id on a logged-in account is a backend contract
  // violation we refuse to silently work around.
  const currentIdentityValid = user == null || currentUserId !== null;

  let effectiveHasAccess;
  if (hasAccessValid) {
    effectiveHasAccess = info.hasAccess;
  } else if (
    !authInitializing &&
    user === null &&
    currentUserId === null &&
    info?.hasAccess === null
  ) {
    effectiveHasAccess = false;
  } else {
    effectiveHasAccess = null;
  }

  const documentOwnerIdRaw =
    typeof info?.userId === "string" ? info.userId.trim() : "";
  const documentOwnerId = documentOwnerIdRaw.length > 0 ? documentOwnerIdRaw : null;

  const isOwner =
    currentUserId !== null &&
    documentOwnerId !== null &&
    currentUserId === documentOwnerId;

  // Paid pricing is valid when the wire contract for paid docs is
  // complete: strict isPaid, strict price, semantic hasAccess
  // (effectiveHasAccess is true OR false — never null — once auth has
  // hydrated), a real owner userId and a sound current identity. The
  // guest-with-hasAccess-null case is resolved into `false` by the
  // effectiveHasAccess block above, so this gate accepts the guest.
  const paidPricingDataValid =
    isPaid === true &&
    priceValid &&
    typeof effectiveHasAccess === "boolean" &&
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
  // buy-without-knowing-the-truth gap. `effectiveHasAccess === false`
  // covers both raw `false` (logged-in not yet purchased) AND the
  // guest-with-hasAccess-null normalized case, but the `currentUserId
  // !== null` guard at the bottom rules out the guest, so this gate
  // still only accepts logged-in non-owner non-purchasers.
  const canBuy =
    isPaid === true &&
    priceValid &&
    typeof effectiveHasAccess === "boolean" &&
    documentOwnerId !== null &&
    currentIdentityValid &&
    isOwner === false &&
    effectiveHasAccess === false &&
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
  //
  // Note: `effectiveHasAccess` (not raw `info.hasAccess`) is what feeds
  // PURCHASED_DOWNLOAD and the BUY/LOGIN_TO_BUY split. That way a guest
  // whose backend response carries `hasAccess: null` lands on
  // LOGIN_TO_BUY instead of INVALID_PRICING.
  let actionMode = "AUTH_LOADING";
  if (!authInitializing) {
    if (!pricingDataValid) {
      actionMode = "INVALID_PRICING";
    } else if (isPaid === false) {
      actionMode = "FREE_DOWNLOAD";
    } else if (isOwner === true) {
      actionMode = "OWNER_DOWNLOAD";
    } else if (effectiveHasAccess === true) {
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

  // Single source of truth for the standalone price row.
  //
  // The paid document Detail screen MUST NOT show a separate price line
  // under any of its modes — the price is already embedded directly in
  // the CTA label for BUY (`Mua ngay — 3.000 ₫`) and LOGIN_TO_BUY
  // (`Đăng nhập để mua — 3.000 ₫`), and paid owners / buyers never see
  // a monetary figure at all in the price area (the badge + CTA
  // communicate status). Only the FREE document keeps the explicit
  // `Miễn phí` row so the public-mode label still has a visible explainer.
  const showStandalonePrice = actionMode === "FREE_DOWNLOAD";

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
  // LOGIN_TO_BUY label: "Đăng nhập để mua — 3.000 ₫". Same single-line
  // contract as BUY so the price is communicated once (inside the CTA)
  // and never duplicated in a standalone row. When the price wire
  // token is invalid (rare for a paid doc that already passed the
  // pricingDataValid gate) we drop the dash suffix rather than render
  // a misleading "Đăng nhập để mua — ".
  const loginToBuyLabel =
    actionMode === "LOGIN_TO_BUY" && formattedPrice
      ? `Đăng nhập để mua — ${formattedPrice}`
      : "Đăng nhập để mua";

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
    if (actionMode === "LOGIN_TO_BUY") return loginToBuyLabel;
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
    setShowReportModal(true);
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

  const handleVoteComment = useCallback(
    async (commentId, voteType = "UPVOTE") => {
      if (!redirectForAuth()) return;
      const cid = String(commentId);
      let target =
        comments.find((c) => String(c.id) === cid) ||
        Object.values(repliesByParent)
          .flat()
          .find((c) => String(c.id) === cid);
      if (!target) return;
      const before = {
        isLiked: target.isLiked,
        userVote: target.userVote,
        likeCount: target.likeCount,
        upvoteCount: target.upvoteCount,
        downvoteCount: target.downvoteCount,
      };
      try {
        const data = await commentService.voteComment(commentId, voteType);
        patchComment(cid, {
          isLiked: data.isLiked,
          userVote: data.userVote,
          likeCount: data.likeCount,
          upvoteCount: data.upvoteCount,
          downvoteCount: data.downvoteCount,
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
      // Guest CTA: chuyển thẳng tới trang login bằng React Router
      // navigate, không mở LoginRequiredModal trung gian. returnUrl
      // là current document URL (path + search) đã được sanitize
      // qua sanitizeInternalReturnUrl trước khi encode — đảm bảo
      // open-redirect không thể xảy ra ngay cả khi URL search chứa
      // giá trị không mong muốn. Fallback "/" khi sanitize reject.
      // KHÔNG dùng window.location.* cho internal navigation.
      const safeNext = sanitizeInternalReturnUrl(
        location.pathname + location.search
      );
      const target = safeNext
        ? `/login?next=${encodeURIComponent(safeNext)}`
        : "/login";
      navigate(target);
      return;
    }
    // AUTH_LOADING và INVALID_PRICING: không gọi gì cả.
  }, [actionMode, handlePurchase, handleDownload, navigate, location]);

  const canAccessQuizzes =
    isPaid === false ||
    isOwner === true ||
    effectiveHasAccess === true;

  const handleOpenQuiz = useCallback(
    (quizId) => {
      if (!canAccessQuizzes) {
        setShowMustBuyModal(true);
        return;
      }
      navigate(`/quiz/${quizId}/preview?documentId=${id}`);
    },
    [canAccessQuizzes, navigate, id]
  );

  const handleOpenAllQuizzes = useCallback(() => {
    if (!canAccessQuizzes) {
      setShowMustBuyModal(true);
      return;
    }
    navigate(`/documents/${id}/quizzes`);
  }, [canAccessQuizzes, navigate, id]);

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
        id={`doc-comment-${cid}`}
        className={`comment-item ${String(highlightedCommentId) === cid ? "comment-highlight" : ""}`}
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
              onClick={() => void handleVoteComment(comment.id, "UPVOTE")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") void handleVoteComment(comment.id, "UPVOTE");
              }}
              style={{
                color: (comment.userVote === "UPVOTE" || comment.isLiked) ? "#2563EB" : "#64748b",
                fontWeight: (comment.userVote === "UPVOTE" || comment.isLiked) ? "600" : "400"
              }}
            >
              <UpvoteIcon size={14} color={(comment.userVote === "UPVOTE" || comment.isLiked) ? "#2563EB" : "#64748b"} filled={comment.userVote === "UPVOTE" || comment.isLiked} />
              <span>{(comment.upvoteCount ?? comment.likeCount) > 0 ? (comment.upvoteCount ?? comment.likeCount) : ""}</span>
            </div>
            <div
              role="button"
              tabIndex={0}
              className="comment-action-item"
              onClick={() => void handleVoteComment(comment.id, "DOWNVOTE")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") void handleVoteComment(comment.id, "DOWNVOTE");
              }}
              style={{
                color: comment.userVote === "DOWNVOTE" ? "#DC2626" : "#64748b",
                fontWeight: comment.userVote === "DOWNVOTE" ? "600" : "400"
              }}
            >
              <DownvoteIcon size={14} color={comment.userVote === "DOWNVOTE" ? "#DC2626" : "#64748b"} filled={comment.userVote === "DOWNVOTE"} />
              <span>{(comment.downvoteCount ?? 0) > 0 ? comment.downvoteCount : ""}</span>
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
                <SecureDocumentPreview
                  documentId={id}
                  fileType={file?.fileType}
                  fileName={info?.title}
                  renderBuyCta={() => (
                    <button
                      type="button"
                      className={`primary-action-btn primary-action-btn--${actionMode.toLowerCase()}`}
                      onClick={handlePrimaryAction}
                      disabled={ctaDisabled}
                    >
                      <DownloadIcon size={18} />
                      {ctaLabel}
                    </button>
                  )}
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
                      {info?.uploader?.bestRank && info.uploader.bestRank <= 10 ? (
                        <span className="contributor-badge contributor-badge--rank" aria-label={`Top ${info.uploader.bestRank}`}>
                          <span className="contributor-badge__number" aria-hidden="true">#{info.uploader.bestRank}</span>
                          <span className="contributor-badge__tooltip" role="tooltip">
                            {`Top ${info.uploader.bestRank} — ${
                              info.uploader.bestRankCategory === "views" ? "Lượt xem" :
                              info.uploader.bestRankCategory === "freeDownloads" ? "Tải miễn phí" :
                              info.uploader.bestRankCategory === "paidDownloads" ? "Tải trả phí" :
                              "Bảng xếp hạng"
                            }`}
                          </span>
                        </span>
                      ) : info?.uploader?.verified ? (
                        <span className="contributor-badge contributor-badge--verified" aria-label="Người đóng góp đã xác minh">
                          <svg className="contributor-badge__check" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <circle cx="12" cy="12" r="11" fill="#3b82f6" />
                            <path d="M7 12.5l3 3 7-7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span className="contributor-badge__tooltip" role="tooltip">
                            Người đóng góp đã xác minh
                          </span>
                        </span>
                      ) : null}
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
                    onClick={() => handleOpenQuiz(ex.id)}
                    onKeyDown={(e) => e.key === "Enter" && handleOpenQuiz(ex.id)}
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
                <button type="button" className="view-all-btn" onClick={handleOpenAllQuizzes}>
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

      {showReportModal && (
        <ReportDocumentModal
          documentId={id}
          documentTitle={info?.title}
          onClose={() => setShowReportModal(false)}
          onSuccess={() => {
            if (id) {
              documentService.getDocumentById(id).then(setDetail).catch(() => {});
            }
          }}
        />
      )}

      {/* Modal thông báo cần mua tài liệu để làm bài tập */}
      {showMustBuyModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setShowMustBuyModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "420px",
              background: "#FFFFFF",
              borderRadius: "18px",
              padding: "28px 24px 24px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "#FEF3C7",
                color: "#D97706",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>

            <h3
              style={{
                margin: "0 0 10px",
                fontSize: "18px",
                fontWeight: "700",
                color: "#0F172A",
              }}
            >
              Cần mua tài liệu
            </h3>

            <p
              style={{
                margin: "0 0 24px",
                fontSize: "14px",
                color: "#64748B",
                lineHeight: "1.6",
              }}
            >
              Bạn cần mua tài liệu để làm bài tập trắc nghiệm này.
            </p>

            <div
              style={{
                display: "flex",
                gap: "12px",
                width: "100%",
                justifyContent: "center",
              }}
            >
              <button
                type="button"
                className="cmp-btn"
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: "10px",
                  border: "1px solid #CBD5E1",
                  background: "#F8FAFC",
                  color: "#475569",
                  fontWeight: "600",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
                onClick={() => setShowMustBuyModal(false)}
              >
                Đóng
              </button>

              <button
                type="button"
                className="cmp-btn"
                style={{
                  flex: 1.3,
                  padding: "10px 16px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#2563EB",
                  color: "#FFFFFF",
                  fontWeight: "600",
                  cursor: "pointer",
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
                onClick={() => {
                  setShowMustBuyModal(false);
                  handlePrimaryAction();
                }}
              >
                {actionMode === "BUY" ? (formattedPrice ? `Mua ngay (${formattedPrice})` : "Mua ngay") : "Đăng nhập để mua"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
