import React, { useEffect, useState, useMemo } from "react";
import {
  getReportedPosts,
  getModerationStats,
  getPostById,
  dismissReport,
  hidePost,
  unhidePost,
  moderatorDeletePost,
  escalateReport,
} from "../../api/communityApi";
import PostCard from "../../components/community/PostCard";
import { PostCardSkeleton } from "../../components/community/CommunitySkeletons";
import {
  EyeIcon,
  LockIcon,
  UnlockIcon,
  DismissIcon,
  TrashIcon,
  FlagIcon,
  ShieldIcon,
  LockCircleIcon,
  FlameIcon,
  CheckCircleIcon,
  EditIcon,
  HistoryIcon,
  WarningIcon,
  EscalateIcon,
} from "../../components/icons";
import { useNotification } from "../../context/NotificationContext";
import AdminPagination from "../../components/admin/AdminPagination";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { formatDateTime } from "../../utils/dateUtils";
import PostEditHistoryModal from "../../components/community/PostEditHistoryModal";
import "../../styles/communityModerationPage.css";
import "../../styles/admin/adminComponents.css";

const REASON_LABELS = {
  SPAM: "Spam / Quảng cáo rác",
  INAPPROPRIATE: "Nội dung không phù hợp",
  HARASSMENT: "Quấy rối / Xúc phạm",
  COPYRIGHT: "Vi phạm bản quyền",
  OTHER: "Lý do khác",
};

function ModerationReasonModal({ open, title, prompt, confirmLabel, isDanger, onConfirm, onCancel }) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(reason.trim());
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "#FFFFFF",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            style={{ border: "none", background: "none", fontSize: "20px", color: "#94A3B8", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <p style={{ fontSize: "14px", color: "#475569", marginTop: 0, marginBottom: "12px", lineHeight: "1.4" }}>
            {prompt}
          </p>
          <textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Nhập lý do chi tiết..."
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid #CBD5E1",
              outline: "none",
              fontSize: "14px",
              boxSizing: "border-box",
              resize: "vertical",
              marginBottom: "20px",
            }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: "8px 16px",
                borderRadius: "10px",
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#475569",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              style={{
                padding: "8px 20px",
                borderRadius: "10px",
                border: "none",
                background: isDanger ? "#EF4444" : "#4F46E5",
                color: "#FFFFFF",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {confirmLabel || "Xác nhận"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReportedPostDetailModal({ open, group, postDetail, loading, activeTab, onClose, onHide, onUnhide, onDelete, onDismiss, onEscalate }) {
  if (!open || !group) return null;

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const isDeleted = group.isPostDeleted || postDetail?.isDeleted;
  const isHidden = group.isPostHidden || postDetail?.isHidden;
  const isDismissedTab = activeTab === "DISMISSED";
  const isEscalated = group.reportsList?.some((r) => r.status === "ESCALATED") || activeTab === "ESCALATED";
  const isPostEdited = group.isPostEdited || group.editCount > 0 || postDetail?.isEdited || postDetail?.updatedAt;
  const editCount = group.editCount || postDetail?.editCount || 1;

  const resolvedReport = group.reportsList?.find((r) => r.status === "RESOLVED_BAN" || r.status === "RESOLVED_UNBAN" || r.resolvedByName);

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(4px)",
          zIndex: 9990,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
        onClick={onClose}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "800px",
            maxHeight: "90vh",
            background: "#FFFFFF",
            borderRadius: "18px",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            overflow: "hidden",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px 24px",
              borderBottom: "1px solid #E2E8F0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#F8FAFC",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#0F172A" }}>
                Chi tiết bài viết bị báo cáo
              </h3>
              {isDeleted ? (
                <span className="cmp-status-badge hidden" style={{ background: "#FEE2E2", color: "#DC2626", borderColor: "#FCA5A5", whiteSpace: "nowrap" }}>
                  <TrashIcon size={13} color="#DC2626" /> Tác giả đã tự xóa
                </span>
              ) : isEscalated ? (
                resolvedReport?.status === "RESOLVED_BAN" ? (
                  <span className="cmp-status-badge hidden" style={{ background: "#FEE2E2", color: "#DC2626", borderColor: "#FCA5A5", whiteSpace: "nowrap" }}>
                    <LockIcon size={13} color="#DC2626" /> Admin đã khóa tài khoản & xóa bài
                  </span>
                ) : (
                  <span className="cmp-status-badge hidden" style={{ background: "#FEF3C7", color: "#B45309", borderColor: "#FDE68A", whiteSpace: "nowrap" }}>
                    <WarningIcon size={13} color="#B45309" /> Đã chuyển lên Admin
                  </span>
                )
              ) : isHidden ? (
                <span className="cmp-status-badge hidden" style={{ whiteSpace: "nowrap" }}>
                  <LockIcon size={13} color="currentColor" /> Đã ẩn
                </span>
              ) : (
                <span className="cmp-status-badge visible" style={{ whiteSpace: "nowrap" }}>
                  <EyeIcon size={13} color="currentColor" /> Hiển thị
                </span>
              )}

              {isPostEdited && (
                <button
                  type="button"
                  className="cmp-btn"
                  style={{
                    background: "#EEF2FF",
                    color: "#4F46E5",
                    border: "1px solid #C7D2FE",
                    fontSize: "12px",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  onClick={() => setShowHistoryModal(true)}
                  title="Xem các phiên bản nội dung trước khi tác giả chỉnh sửa"
                >
                  <EditIcon size={12} color="#4F46E5" /> Lịch sử sửa
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                border: "none",
                background: "none",
                fontSize: "22px",
                color: "#64748B",
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: "8px",
              }}
            >
              ✕
            </button>
          </div>

          {/* Modal Scrollable Body */}
          <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
            {isDeleted && (
              <div
                style={{
                  background: "#FEF2F2",
                  border: "1px solid #FCA5A5",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  marginBottom: "14px",
                  color: "#B91C1C",
                  fontSize: "13px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <WarningIcon size={16} color="#B91C1C" /> <span>Lưu ý: Tác giả đã tự xóa bài viết này khỏi cộng đồng. Nội dung dưới đây được hiển thị từ cơ sở dữ liệu làm bằng chứng kiểm duyệt.</span>
              </div>
            )}

            {loading ? (
              <PostCardSkeleton count={1} />
            ) : (
              <PostCard post={postDetail || { id: group.postId, title: group.postTitle, content: group.postContent, authorName: group.postAuthorName, isHidden: group.isPostHidden }} hideOptionsMenu={true} readOnly={true} />
            )}

            {/* Reports summary box */}
            <div style={{ marginTop: "20px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "14px", padding: "16px" }}>
              <h4 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 700, color: "#92400E", display: "flex", alignItems: "center", gap: "6px" }}>
                <FlameIcon /> Danh sách các lượt báo cáo ({group.reportsList.length}):
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "240px", overflowY: "auto", paddingRight: "4px" }}>
                {group.reportsList.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #FEF3C7",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                      fontSize: "13px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, color: "#1E293B" }}>
                        {item.reporterName || "Người báo cáo"}
                      </span>
                      <span className={`cmp-reason-tag ${item.reasonCode || "OTHER"}`}>
                        {REASON_LABELS[item.reasonCode] || item.reasonCode}
                      </span>
                      {item.detail && (
                        <span style={{ color: "#475569", fontStyle: "italic" }}>
                          "{item.detail}"
                        </span>
                      )}
                      {item.escalationReason && (
                        <span style={{ color: "#B45309", fontWeight: 600 }}>
                          [Lý do chuyển Admin: {item.escalationReason}]
                        </span>
                      )}
                      {item.resolutionNotes && (
                        <span style={{ color: "#059669", fontWeight: 600 }}>
                          [Kết quả xử lý: {item.resolutionNotes}]
                        </span>
                      )}
                    </div>
                    <span style={{ color: "#94A3B8", fontSize: "12px", whiteSpace: "nowrap" }}>
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div
            style={{
              padding: "16px 24px",
              borderTop: "1px solid #E2E8F0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#F8FAFC",
            }}
          >
            <button
              type="button"
              className="cmp-btn cmp-btn-dismiss"
              onClick={onClose}
            >
              Đóng
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {isDeleted ? (
                <span className="cmp-status-badge hidden" style={{ background: "#FEE2E2", color: "#DC2626", borderColor: "#FCA5A5" }}>
                  Bài viết đã bị xóa
                </span>
              ) : isEscalated ? (
                resolvedReport?.status === "RESOLVED_BAN" ? (
                  <span className="cmp-status-badge hidden" style={{ background: "#FEE2E2", color: "#DC2626", borderColor: "#FCA5A5" }}>
                    Admin đã khóa tài khoản & xóa bài
                  </span>
                ) : (
                  <span className="cmp-status-badge hidden" style={{ background: "#FEF3C7", color: "#B45309", borderColor: "#FDE68A" }}>
                    Bài viết đã được chuyển tiếp lên Ban Quản Trị (Admin)
                  </span>
                )
              ) : isDismissedTab ? (
                <>
                  <span className="cmp-status-badge visible" style={{ background: "#F1F5F9", color: "#475569", borderColor: "#CBD5E1", marginRight: "4px" }}>
                    Đã bỏ qua báo cáo
                  </span>
                  {isHidden ? (
                    <button
                      type="button"
                      className="cmp-btn cmp-btn-unhide"
                      onClick={() => onUnhide(group.postId)}
                    >
                      <UnlockIcon /> Hiện bài
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="cmp-btn cmp-btn-hide"
                      onClick={() => onHide(group.postId)}
                    >
                      <LockIcon /> Ẩn bài
                    </button>
                  )}
                  <button
                    type="button"
                    className="cmp-btn"
                    style={{ background: "#F59E0B", color: "#FFFFFF", border: "none", display: "inline-flex", alignItems: "center", gap: "5px" }}
                    onClick={() => onEscalate(group)}
                    title="Chuyển báo cáo này lên Ban Quản Trị (Admin) kèm lý do"
                  >
                    <EscalateIcon size={14} color="#FFFFFF" /> Chuyển lên Admin
                  </button>
                  <button
                    type="button"
                    className="cmp-btn cmp-btn-delete"
                    onClick={() => onDelete(group.postId)}
                  >
                    <TrashIcon /> Xóa bài
                  </button>
                </>
              ) : (
                <>
                  {isHidden ? (
                    <button
                      type="button"
                      className="cmp-btn cmp-btn-unhide"
                      onClick={() => onUnhide(group.postId)}
                    >
                      <UnlockIcon /> Hiện bài
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="cmp-btn cmp-btn-hide"
                      onClick={() => onHide(group.postId)}
                    >
                      <LockIcon /> Ẩn bài
                    </button>
                  )}

                  <button
                    type="button"
                    className="cmp-btn cmp-btn-dismiss"
                    onClick={() => onDismiss(group)}
                  >
                    <DismissIcon /> Bỏ qua
                  </button>

                  <button
                    type="button"
                    className="cmp-btn"
                    style={{ background: "#F59E0B", color: "#FFFFFF", border: "none", display: "inline-flex", alignItems: "center", gap: "5px" }}
                    onClick={() => onEscalate(group)}
                    title="Chuyển báo cáo này lên Ban Quản Trị (Admin) kèm lý do"
                  >
                    <EscalateIcon size={14} color="#FFFFFF" /> Chuyển lên Admin
                  </button>

                  <button
                    type="button"
                    className="cmp-btn cmp-btn-delete"
                    onClick={() => onDelete(group.postId)}
                  >
                    <TrashIcon /> Xóa bài
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {showHistoryModal && (
        <PostEditHistoryModal
          postId={group.postId}
          currentPost={postDetail || { title: group.postTitle, content: group.postContent }}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </>
  );
}

export default function CommunityModerationPage() {
  const notification = useNotification();
  const [activeTab, setActiveTab] = useState("PENDING"); // PENDING | RESOLVED | DISMISSED
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [stats, setStats] = useState(null);
  const [expandedPosts, setExpandedPosts] = useState({});

  // Post Detail Modal state
  const [detailModal, setDetailModal] = useState({
    open: false,
    group: null,
    postDetail: null,
    loading: false,
  });

  // Reason Dialog Modal state
  const [reasonModal, setReasonModal] = useState({
    open: false,
    actionType: null, // "HIDE" | "DELETE" | "DISMISS_GROUP"
    targetId: null,
    title: "",
    prompt: "",
    confirmLabel: "",
    isDanger: false,
  });

  const [keyword, setKeyword] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchStats = async () => {
    try {
      const data = await getModerationStats();
      if (data) setStats(data);
    } catch (err) {
      console.error("Failed to fetch moderation stats:", err);
    }
  };

  const fetchReports = async (
    tabStatus = activeTab,
    pageNum = page,
    pageSize = size,
    searchKw = keyword,
    sDate = startDate,
    eDate = endDate
  ) => {
    setLoading(true);
    try {
      const data = await getReportedPosts(tabStatus, pageNum, pageSize, searchKw, sDate, eDate);
      if (data) {
        setReports((data.content || []).filter(Boolean));
        setTotalElements(data.totalElements || 0);
      }
    } catch (err) {
      notification.error("Không thể tải danh sách báo cáo bài viết.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports(activeTab, page, size, keyword, startDate, endDate);
    fetchStats();
  }, [activeTab, page, size, keyword, startDate, endDate]);

  // Group raw report items by Post ID
  const groupedPosts = useMemo(() => {
    const map = new Map();
    reports.forEach((item) => {
      const key = item.postId || item.id;
      if (!map.has(key)) {
        map.set(key, {
          postId: item.postId,
          postTitle: item.postTitle,
          postContent: item.postContent,
          postAuthorName: item.postAuthorName,
          isPostHidden: Boolean(item.isPostHidden),
          isPostDeleted: Boolean(item.isPostDeleted),
          reportsList: [item],
        });
      } else {
        const existing = map.get(key);
        existing.reportsList.push(item);
        if (item.isPostHidden) existing.isPostHidden = true;
        if (item.isPostDeleted) existing.isPostDeleted = true;
      }
    });
    return Array.from(map.values());
  }, [reports]);

  const toggleExpand = (postId) => {
    setExpandedPosts((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  const openPostDetail = async (group) => {
    setDetailModal({
      open: true,
      group,
      postDetail: null,
      loading: true,
    });

    try {
      const data = await getPostById(group.postId);
      setDetailModal((prev) => ({
        ...prev,
        postDetail: data || null,
        loading: false,
      }));
    } catch {
      setDetailModal((prev) => ({
        ...prev,
        loading: false,
      }));
    }
  };

  const closePostDetail = () => {
    setDetailModal({ open: false, group: null, postDetail: null, loading: false });
  };

  // Open Reason Box Modal for Hide, Delete, or Dismiss Group
  const promptHidePost = (postId) => {
    setReasonModal({
      open: true,
      actionType: "HIDE",
      targetId: postId,
      title: "Ẩn bài viết khỏi cộng đồng",
      prompt: "Vui lòng nhập lý do ẩn bài viết (thông báo lý do này sẽ được gửi tới người đăng bài):",
      confirmLabel: "Xác nhận Ẩn bài",
      isDanger: false,
    });
  };

  const promptUnhidePost = (postId) => {
    setReasonModal({
      open: true,
      actionType: "UNHIDE",
      targetId: postId,
      title: "Hiển thị lại bài viết",
      prompt: "Vui lòng nhập lý do hiển thị lại bài viết (thông báo lý do này sẽ được gửi tới tác giả và người báo cáo):",
      confirmLabel: "Xác nhận Hiển thị lại",
      isDanger: false,
    });
  };

  const promptDeletePost = (postId) => {
    setReasonModal({
      open: true,
      actionType: "DELETE",
      targetId: postId,
      title: "Xóa vĩnh viễn bài viết",
      prompt: "Vui lòng nhập lý do xóa bài viết (thông báo lý do này sẽ được gửi tới người đăng bài):",
      confirmLabel: "Xóa vĩnh viễn",
      isDanger: true,
    });
  };

  const promptDismissReportGroup = (group) => {
    const reportIds = group.reportsList.map((r) => r.id).filter(Boolean);
    setReasonModal({
      open: true,
      actionType: "DISMISS_GROUP",
      targetId: reportIds,
      title: "Từ chối / Bỏ qua báo cáo",
      prompt: "Vui lòng nhập lý do bỏ qua báo cáo (thông báo lý do này sẽ được gửi tới người gửi tố cáo):",
      confirmLabel: "Xác nhận Bỏ qua",
      isDanger: false,
    });
  };

  const promptEscalateReport = (group) => {
    const reportId = group.reportsList?.[0]?.id;
    setReasonModal({
      open: true,
      actionType: "ESCALATE",
      targetId: reportId,
      title: "Chuyển tiếp báo cáo lên Ban Quản Trị (Admin)",
      prompt: "Vui lòng nhập lý do chuyển tiếp báo cáo lên Admin (bài viết sẽ bị ẩn ngay và chỉ Admin mới có quyền mở lại hoặc khóa tài khoản):",
      confirmLabel: "Xác nhận Chuyển lên Admin",
      isDanger: false,
    });
  };

  const handleConfirmReason = async (reason) => {
    const { actionType, targetId } = reasonModal;
    setReasonModal((prev) => ({ ...prev, open: false }));

    try {
      if (actionType === "HIDE") {
        await hidePost(targetId, reason);
        notification.success("Đã ẩn bài viết và gửi lý do cho tác giả.");
        setReports((prev) =>
          prev.map((r) => (r.postId === targetId ? { ...r, isPostHidden: true } : r))
        );
        setDetailModal((prev) =>
          prev.group?.postId === targetId
            ? {
                ...prev,
                group: { ...prev.group, isPostHidden: true },
                postDetail: prev.postDetail ? { ...prev.postDetail, isHidden: true } : null,
              }
            : prev
        );
      } else if (actionType === "UNHIDE") {
        await unhidePost(targetId, reason);
        notification.success("Đã hiện lại bài viết và gửi lý do cho tác giả & người báo cáo.");
        setReports((prev) =>
          prev.map((r) => (r.postId === targetId ? { ...r, isPostHidden: false } : r))
        );
        setDetailModal((prev) =>
          prev.group?.postId === targetId
            ? {
                ...prev,
                group: { ...prev.group, isPostHidden: false },
                postDetail: prev.postDetail ? { ...prev.postDetail, isHidden: false } : null,
              }
            : prev
        );
      } else if (actionType === "DELETE") {
        await moderatorDeletePost(targetId, reason);
        notification.success("Đã xóa bài viết và gửi lý do cho tác giả.");
        setReports((prev) => prev.filter((r) => r.postId !== targetId));
        closePostDetail();
      } else if (actionType === "DISMISS_GROUP") {
        const ids = Array.isArray(targetId) ? targetId : [targetId];
        await Promise.all(ids.map((id) => dismissReport(id, reason)));
        notification.success("Đã bỏ qua báo cáo và gửi lý do cho người tố cáo.");
        closePostDetail();
      } else if (actionType === "ESCALATE") {
        await escalateReport(targetId, reason);
        notification.success("Đã chuyển báo cáo lên Admin và ẩn bài viết.");
        closePostDetail();
      }
      fetchReports(activeTab, page, size);
      fetchStats();
    } catch (err) {
      notification.error(err?.response?.data?.message || "Thao tác thất bại.");
    }
  };

  const hiddenPostsCount = useMemo(() => {
    const uniqueHidden = new Set(
      reports.filter((r) => r.isPostHidden).map((r) => r.postId)
    );
    return uniqueHidden.size;
  }, [reports]);

  return (
    <div className="cmp-container">
      {/* Top Header with search on the right */}
      <AdminPageHeader
        title="Quản lý Báo cáo Bài viết"
        description="Kiểm duyệt và xử lý các bài viết bị người dùng báo cáo vi phạm tiêu chuẩn cộng đồng."
        searchValue={keyword}
        onSearchChange={(val) => {
          setKeyword(val);
          setPage(0);
        }}
        searchPlaceholder="Tìm theo tên user, bài viết..."
      />

      {/* Metric Cards */}
      <div className="cmp-stats-grid">
        <div className="cmp-stat-card">
          <div className="cmp-stat-icon pending">
            <FlagIcon />
          </div>
          <div className="cmp-stat-info">
            <h3>
              {stats
                ? activeTab === "PENDING"
                  ? stats.pendingPostsCount
                  : activeTab === "RESOLVED"
                  ? stats.resolvedPostsCount
                  : stats.dismissedPostsCount
                : totalElements}
            </h3>
            <p>Bài viết bị báo cáo</p>
          </div>
        </div>

        <div className="cmp-stat-card">
          <div className="cmp-stat-icon hidden">
            <LockCircleIcon />
          </div>
          <div className="cmp-stat-info">
            <h3>{stats ? stats.hiddenPostsCount : hiddenPostsCount}</h3>
            <p>Bài viết đang bị ẩn</p>
          </div>
        </div>

        <div className="cmp-stat-card">
          <div className="cmp-stat-icon resolved">
            <ShieldIcon />
          </div>
          <div className="cmp-stat-info">
            <h3>
              {stats
                ? activeTab === "PENDING"
                  ? stats.pendingReportsCount
                  : activeTab === "RESOLVED"
                  ? stats.resolvedReportsCount
                  : stats.dismissedReportsCount
                : totalElements}
            </h3>
            <p>Tổng số lượt báo cáo</p>
          </div>
        </div>
      </div>

      {/* Toolbar: Status Tabs + Date Filters */}
      <div className="cmp-toolbar-row">
        {/* Status Filter Tabs */}
        <div className="cmp-tabs-wrapper">
          {[
            { key: "PENDING", label: "Chờ xử lý" },
            { key: "ESCALATED", label: "Đã chuyển Admin" },
            { key: "RESOLVED", label: "Đã xử lý" },
            { key: "DISMISSED", label: "Đã bỏ qua" },
          ].map((tab) => {
            const tabPostCount = stats
              ? tab.key === "PENDING"
                ? stats.pendingPostsCount
                : tab.key === "RESOLVED"
                ? stats.resolvedPostsCount
                : tab.key === "DISMISSED"
                ? stats.dismissedPostsCount
                : 0
              : 0;

            return (
              <button
                key={tab.key}
                type="button"
                className={`cmp-tab-btn ${activeTab === tab.key ? "active" : ""}`}
                onClick={() => {
                  setActiveTab(tab.key);
                  setPage(0);
                }}
              >
                <span>{tab.label}</span>
                {tabPostCount > 0 && (
                  <span className="cmp-tab-badge">{tabPostCount}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Date Filters beside tabs */}
        <div className="cmp-date-filters">
          <div className="cmp-date-group">
            <span className="cmp-date-label">Từ ngày:</span>
            <input
              type="date"
              className="cmp-date-input"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(0);
              }}
            />
          </div>

          <div className="cmp-date-group">
            <span className="cmp-date-label">Đến ngày:</span>
            <input
              type="date"
              className="cmp-date-input"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(0);
              }}
            />
          </div>

          {(keyword || startDate || endDate) && (
            <button
              type="button"
              className="cmp-reset-btn"
              onClick={() => {
                setKeyword("");
                setStartDate("");
                setEndDate("");
                setPage(0);
              }}
              title="Xóa bộ lọc"
            >
              Reset bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Reports Table Card */}
      <div className="cmp-table-card">
        {loading ? (
          <div className="cmp-state-box">
            <div className="cmp-state-icon">⏳</div>
            <div>Đang tải danh sách báo cáo...</div>
          </div>
        ) : groupedPosts.length === 0 ? (
          <div className="cmp-state-box">
            <div className="cmp-state-icon"><CheckCircleIcon /></div>
            <div>Không có báo cáo nào ở trạng thái này.</div>
          </div>
        ) : (
          <table className="cmp-table">
            <thead>
              <tr>
                <th>Bài viết</th>
                <th>Tác giả</th>
                <th>Lý do</th>
                <th style={{ whiteSpace: "nowrap" }}>Số lượt báo cáo</th>
                <th style={{ whiteSpace: "nowrap" }}>Trạng thái</th>
                <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {groupedPosts.map((group) => {
                const isExpanded = Boolean(expandedPosts[group.postId]);
                const uniqueReasons = Array.from(
                  new Set(group.reportsList.map((r) => r.reasonCode).filter(Boolean))
                );

                return (
                  <React.Fragment key={group.postId}>
                    <tr
                      style={{ cursor: "pointer", transition: "background 0.15s ease" }}
                      onClick={() => toggleExpand(group.postId)}
                    >
                      {/* Bài viết */}
                      <td className="cmp-post-cell">
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            style={{
                              fontSize: "12px",
                              color: "#6366F1",
                              display: "inline-block",
                              transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                              transition: "transform 0.2s ease",
                            }}
                          >
                            ▶
                          </span>
                          <div
                            className="cmp-post-title"
                            style={{ fontWeight: 700, color: "#1E293B", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openPostDetail(group);
                            }}
                            title="Xem chi tiết bài viết này trong popup"
                          >
                            <span>{group.postTitle || "Bài viết thảo luận"}</span>
                            {group.isPostDeleted && (
                              <span style={{ fontSize: "11px", background: "#FEE2E2", color: "#DC2626", padding: "1px 6px", borderRadius: "4px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                                <TrashIcon size={10} color="#DC2626" /> Tác giả đã tự xóa
                              </span>
                            )}
                            {(group.isPostEdited || group.editCount > 0) && (
                              <span style={{ fontSize: "11px", background: "#EEF2FF", color: "#4F46E5", padding: "1px 6px", borderRadius: "4px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                                <EditIcon size={11} color="#4F46E5" /> Đã sửa ({group.editCount || 1} lần)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="cmp-post-snippet" style={{ marginLeft: "20px" }}>
                          {group.postContent?.replace(/<[^>]+>/g, "")}
                        </div>
                      </td>

                      {/* Tác giả */}
                      <td>
                        <div className="cmp-user-pill">
                          <div className="cmp-avatar-small">
                            {(group.postAuthorName || "A").charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, color: "#1E293B" }}>
                            {group.postAuthorName || "Tác giả"}
                          </span>
                        </div>
                      </td>

                      {/* Lý do (Gộp các lý do của bài viết) */}
                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          {uniqueReasons.map((code) => (
                            <span key={code} className={`cmp-reason-tag ${code}`}>
                              {REASON_LABELS[code] || code}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Số lượt báo cáo */}
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span className="cmp-count-badge">
                          <FlameIcon /> {group.reportsList.length} báo cáo
                        </span>
                      </td>

                      {/* Trạng thái Bài */}
                      <td style={{ whiteSpace: "nowrap" }}>
                        {group.isPostDeleted ? (
                          <span className="cmp-status-badge hidden" style={{ background: "#FEE2E2", color: "#DC2626", borderColor: "#FCA5A5", whiteSpace: "nowrap" }}>
                            <TrashIcon size={12} color="#DC2626" /> Tác giả đã xóa
                          </span>
                        ) : activeTab === "ESCALATED" ? (
                          group.reportsList?.some((r) => r.status === "RESOLVED_BAN") ? (
                            <span className="cmp-status-badge hidden" style={{ background: "#FEE2E2", color: "#DC2626", borderColor: "#FCA5A5", whiteSpace: "nowrap" }}>
                              <LockIcon size={12} color="#DC2626" /> Admin đã khóa tài khoản & xóa bài
                            </span>
                          ) : (
                            <span className="cmp-status-badge hidden" style={{ background: "#FEF3C7", color: "#B45309", borderColor: "#FDE68A", whiteSpace: "nowrap" }}>
                              <WarningIcon size={12} color="#B45309" /> Chờ Admin duyệt
                            </span>
                          )
                        ) : group.isPostHidden ? (
                          <span className="cmp-status-badge hidden" style={{ whiteSpace: "nowrap" }}>
                            <LockIcon size={12} color="currentColor" /> Đã ẩn
                          </span>
                        ) : (
                          <span className="cmp-status-badge visible" style={{ whiteSpace: "nowrap" }}>
                            <EyeIcon size={12} color="currentColor" /> Hiển thị
                          </span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td style={{ whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                        <div className="cmp-actions">
                          <button
                            type="button"
                            className="cmp-btn cmp-btn-view"
                            onClick={() => openPostDetail(group)}
                            title="Xem chi tiết và kiểm duyệt bài viết này"
                          >
                            <EyeIcon />
                            <span>Xem bài</span>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable sub-list of individual reports (List only) */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} style={{ background: "#F8FAFC", padding: "12px 16px" }}>
                          <div style={{ fontWeight: 700, fontSize: "13px", color: "#334155", marginBottom: "8px" }}>
                            📋 Danh sách chi tiết các báo cáo ({group.reportsList.length}):
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {group.reportsList.map((item, idx) => (
                              <div
                                key={item.id || idx}
                                style={{
                                  background: "#FFFFFF",
                                  border: "1px solid #E2E8F0",
                                  borderRadius: "8px",
                                  padding: "10px 14px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: "12px",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%" }}>
                                  <div className="cmp-user-pill">
                                    <div className="cmp-avatar-small" style={{ background: "#EEF2FF", color: "#4F46E5" }}>
                                      {(item.reporterName || "R").charAt(0).toUpperCase()}
                                    </div>
                                    <span style={{ fontWeight: 600, fontSize: "13px", color: "#1E293B" }}>
                                      {item.reporterName || "Người báo cáo"}
                                    </span>
                                  </div>

                                  <span className={`cmp-reason-tag ${item.reasonCode || "OTHER"}`}>
                                    {REASON_LABELS[item.reasonCode] || item.reasonCode}
                                  </span>

                                  {item.detail && (
                                    <span style={{ fontSize: "13px", color: "#475569", fontStyle: "italic" }}>
                                      "{item.detail}"
                                    </span>
                                  )}

                                  <span style={{ fontSize: "12px", color: "#94A3B8", marginLeft: "auto", whiteSpace: "nowrap" }}>
                                    {formatDateTime(item.createdAt)}
                                  </span>

                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}

        {!loading && groupedPosts.length > 0 && (
          <div style={{ padding: "16px 20px", borderTop: "1px solid #E2E8F0" }}>
            <AdminPagination
              page={page}
              size={size}
              total={totalElements}
              onPageChange={(newPage) => setPage(newPage)}
              onSizeChange={(newSize) => {
                setSize(newSize);
                setPage(0);
              }}
            />
          </div>
        )}
      </div>

      {/* Reported Post Detail Modal */}
      <ReportedPostDetailModal
        open={detailModal.open}
        group={detailModal.group}
        postDetail={detailModal.postDetail}
        loading={detailModal.loading}
        activeTab={activeTab}
        onClose={closePostDetail}
        onHide={promptHidePost}
        onUnhide={promptUnhidePost}
        onDelete={promptDeletePost}
        onDismiss={promptDismissReportGroup}
        onEscalate={promptEscalateReport}
      />

      {/* Moderation Reason Modal */}
      <ModerationReasonModal
        open={reasonModal.open}
        title={reasonModal.title}
        prompt={reasonModal.prompt}
        confirmLabel={reasonModal.confirmLabel}
        isDanger={reasonModal.isDanger}
        onConfirm={handleConfirmReason}
        onCancel={() => setReasonModal((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
