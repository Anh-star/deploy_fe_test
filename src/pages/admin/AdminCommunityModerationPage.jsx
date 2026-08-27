import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  getAdminEscalatedReports,
  adminBanUserFromReport,
  adminUnbanUserFromReport,
  adminDismissEscalatedReport,
  getPostById,
} from "../../api/communityApi";
import PostCard from "../../components/community/PostCard";
import { PostCardSkeleton } from "../../components/community/CommunitySkeletons";
import AdminPagination from "../../components/admin/AdminPagination";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { useNotification } from "../../context/NotificationContext";
import { formatDateTime } from "../../utils/dateUtils";
import PostEditHistoryModal from "../../components/community/PostEditHistoryModal";
import "../../styles/communityModerationPage.css";
import "../../styles/admin/adminComponents.css";

const REASON_LABELS = {
  SPAM: "Spam / Quảng cáo rác",
  HARASSMENT: "Quấy rối / Xúc phạm",
  INAPPROPRIATE: "Nội dung phản cảm / Độc hại",
  VIOLENCE: "Bạo lực / Kích động",
  HATE_SPEECH: "Phát ngôn thù hận",
  OTHER: "Khác",
};

// Icons
function FlagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function FlameIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 23c-4.97 0-9-4.03-9-9 0-3.6 2.16-6.68 5.27-8.09.43-.2.95.03 1.05.51.34 1.54 1.25 2.87 2.51 3.69.18.12.43.08.56-.09.77-.97 1.24-2.19 1.24-3.52 0-.39-.12-.76-.32-1.09-.2-.33-.06-.77.29-.92C15.84 3.53 19 6.88 19 11c0 .73-.09 1.44-.26 2.12-.1.39.1.79.49.88.39.1.79-.1.88-.49.23-.94.39-1.92.39-2.93 0-5.8-4.2-10.6-9.75-11.45-.48-.07-.9.27-.93.75-.07 1.15-.4 2.24-.95 3.19C7.45 4.67 6 7.66 6 11c0 3.86 3.14 7 7 7s7-3.14 7-7c0-.28-.02-.55-.05-.82-.04-.38.24-.72.62-.76.38-.04.72.24.76.62.05.32.07.65.07.98 0 4.97-4.03 9-9 9z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}

function DismissIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function ModerationReasonModal({ open, title, prompt, confirmLabel, isDanger, onConfirm, onCancel }) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(reason);
  };

  return (
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
      onClick={onCancel}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "#FFFFFF",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 12px", fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>
          {title}
        </h3>
        <p style={{ margin: "0 0 16px", fontSize: "14px", color: "#64748B", lineHeight: 1.5 }}>
          {prompt}
        </p>

        <form onSubmit={handleSubmit}>
          <textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Nhập lý do chi tiết..."
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              fontSize: "14px",
              outline: "none",
              resize: "vertical",
              marginBottom: "20px",
              boxSizing: "border-box",
            }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid #E2E8F0",
                background: "#FFFFFF",
                color: "#475569",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                background: isDanger ? "#EF4444" : "#4F46E5",
                color: "#FFFFFF",
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

function ReportedPostDetailModal({
  open,
  group,
  postDetail,
  loading,
  isResolvedTab,
  onClose,
  onBanUser,
  onUnbanUser,
  onAcquit,
}) {
  if (!open || !group) return null;

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const escalationReason = group.reportsList?.[0]?.escalationReason || group.escalationReason;
  const escalatedByName = group.reportsList?.[0]?.escalatedByName || group.escalatedByName;
  const resolutionNotes = group.reportsList?.[0]?.resolutionNotes || group.resolutionNotes;
  const resolvedByName = group.reportsList?.[0]?.resolvedByName || group.resolvedByName;
  const resolvedAt = group.reportsList?.[0]?.resolvedAt || group.resolvedAt;
  const isDeleted = group.isPostDeleted || postDetail?.isDeleted;
  const isPostEdited = group.isPostEdited || group.editCount > 0 || postDetail?.isEdited || postDetail?.updatedAt;
  const editCount = group.editCount || postDetail?.editCount || 1;

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
                {isResolvedTab ? "Chi tiết tài khoản vi phạm đã xử lý" : "Báo cáo chuyển tiếp từ Moderator (Admin duyệt)"}
              </h3>
              {isDeleted ? (
                <span className="cmp-status-badge hidden" style={{ background: "#FEE2E2", color: "#DC2626", borderColor: "#FCA5A5", whiteSpace: "nowrap" }}>
                  <TrashIcon /> Tác giả đã xóa
                </span>
              ) : isResolvedTab ? (
                <span className="cmp-status-badge hidden" style={{ background: "#FEE2E2", color: "#DC2626", borderColor: "#FECACA", whiteSpace: "nowrap" }}>
                  🔒 Đã khóa tài khoản
                </span>
              ) : (
                <span className="cmp-status-badge hidden" style={{ background: "#FEF3C7", color: "#B45309", borderColor: "#FDE68A", whiteSpace: "nowrap" }}>
                  ⚠️ Chờ Admin xử lý
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
                  ✏️ Lịch sử sửa ({editCount} lần)
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
            {/* Deleted notice */}
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
                ⚠️ <span>Lưu ý: Tác giả đã tự xóa bài viết này khỏi cộng đồng. Nội dung dưới đây được hiển thị từ cơ sở dữ liệu làm bằng chứng kiểm duyệt.</span>
              </div>
            )}

            {/* Resolution Box if resolved tab */}
            {isResolvedTab && (
              <div
                style={{
                  background: "#FEF2F2",
                  border: "1px solid #FEE2E2",
                  borderRadius: "12px",
                  padding: "14px 16px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ fontWeight: 700, color: "#991B1B", fontSize: "14px", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <LockIcon /> Thông tin xử lý khóa tài khoản từ Admin:
                </div>
                <div style={{ fontSize: "13px", color: "#7F1D1D" }}>
                  <strong>Lý do khóa:</strong> {resolutionNotes || "Vi phạm quy chuẩn cộng đồng"}
                </div>
                <div style={{ fontSize: "12px", color: "#991B1B", marginTop: "4px" }}>
                  <strong>Người xử lý:</strong> {resolvedByName || "Admin"} • <strong>Thời gian:</strong>{" "}
                  {resolvedAt ? formatDateTime(resolvedAt) : "Gần đây"}
                </div>
              </div>
            )}

            {/* Escalation Notice Box */}
            <div
              style={{
                background: "#FFF7ED",
                border: "1px solid #FFEDD5",
                borderRadius: "12px",
                padding: "14px 16px",
                marginBottom: "16px",
              }}
            >
              <div style={{ fontWeight: 700, color: "#C2410C", fontSize: "14px", marginBottom: "4px" }}>
                🔺 Thông tin chuyển tiếp từ Quản lý Cộng đồng:
              </div>
              <div style={{ fontSize: "13px", color: "#431407" }}>
                <strong>Người chuyển tiếp:</strong> {escalatedByName || "Quản lý cộng đồng"}
              </div>
              {escalationReason && (
                <div style={{ fontSize: "13px", color: "#9A3412", marginTop: "4px" }}>
                  <strong>Lý do đề xuất:</strong> "{escalationReason}"
                </div>
              )}
            </div>

            {loading ? (
              <PostCardSkeleton count={1} />
            ) : (
              <PostCard
                post={postDetail || { id: group.postId, title: group.postTitle, content: group.postContent, authorName: group.postAuthorName, isHidden: group.isPostHidden }}
                hideOptionsMenu={true}
                readOnly={true}
              />
            )}

            {/* Reports summary box */}
            <div style={{ marginTop: "20px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "14px", padding: "16px" }}>
              <h4 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 700, color: "#92400E", display: "flex", alignItems: "center", gap: "6px" }}>
                <FlameIcon /> Danh sách báo cáo từ người dùng ({group.reportsList?.length || 0}):
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto", paddingRight: "4px" }}>
                {group.reportsList?.map((item, idx) => (
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
                    </div>
                    <span style={{ color: "#94A3B8", fontSize: "12px", whiteSpace: "nowrap" }}>
                      {item.createdAt ? formatDateTime(item.createdAt) : ""}
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

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {isResolvedTab ? (
                <button
                  type="button"
                  className="cmp-btn cmp-btn-view"
                  style={{ background: "#059669", color: "#FFFFFF", border: "none" }}
                  onClick={() => onUnbanUser(group)}
                  title="Mở khóa tài khoản người dùng và khôi phục hiển thị các tài liệu"
                >
                  <UnlockIcon /> Mở khóa tài khoản
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="cmp-btn cmp-btn-hide"
                    onClick={() => onAcquit(group)}
                    title="Bác bỏ báo cáo và xóa bài viết vi phạm (Tài khoản người dùng vẫn được giữ hoạt động)"
                  >
                    🗑️ Bác bỏ & Xóa bài
                  </button>

                  <button
                    type="button"
                    className="cmp-btn cmp-btn-delete"
                    onClick={() => onBanUser(group)}
                    title="Khóa vĩnh viễn tài khoản người dùng này và xóa các bài viết vi phạm"
                  >
                    🔒 Khóa tài khoản & Xóa bài
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

export default function AdminCommunityModerationPage() {
  const notification = useNotification();
  const [activeTab, setActiveTab] = useState("ESCALATED"); // ESCALATED | RESOLVED_BAN

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalElements, setTotalElements] = useState(0);

  const [keyword, setKeyword] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [expandedPostIds, setExpandedPostIds] = useState(new Set());

  const [detailModal, setDetailModal] = useState({
    open: false,
    group: null,
    postDetail: null,
    loading: false,
  });

  const [reasonModal, setReasonModal] = useState({
    open: false,
    actionType: "", // BAN | UNBAN | ACQUIT
    targetReportId: null,
    title: "",
    prompt: "",
    confirmLabel: "",
    isDanger: false,
  });

  const fetchReports = useCallback(
    async (currentPage = page, currentSize = size, tab = activeTab) => {
      setLoading(true);
      try {
        const data = await getAdminEscalatedReports(
          currentPage,
          currentSize,
          searchKeyword,
          startDate,
          endDate,
          tab
        );
        if (data) {
          setReports(data.content || []);
          setTotalElements(data.totalElements || 0);
        }
      } catch (err) {
        notification.error(err?.response?.data?.message || "Không thể tải danh sách báo cáo.");
      } finally {
        setLoading(false);
      }
    },
    [page, size, searchKeyword, startDate, endDate, activeTab, notification]
  );

  useEffect(() => {
    fetchReports(page, size, activeTab);
  }, [fetchReports, page, size, activeTab]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setPage(0);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(0);
    setSearchKeyword(keyword);
  };

  const handleResetFilters = () => {
    setKeyword("");
    setSearchKeyword("");
    setStartDate("");
    setEndDate("");
    setPage(0);
  };

  const toggleExpand = (postId) => {
    setExpandedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const openPostDetail = async (group) => {
    setDetailModal({
      open: true,
      group,
      postDetail: null,
      loading: true,
    });
    try {
      const detail = await getPostById(group.postId);
      setDetailModal((prev) => ({ ...prev, postDetail: detail, loading: false }));
    } catch {
      setDetailModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const closePostDetail = () => {
    setDetailModal({ open: false, group: null, postDetail: null, loading: false });
  };

  const promptBanUser = (group) => {
    const reportId = group.reportsList?.[0]?.id;
    setReasonModal({
      open: true,
      actionType: "BAN",
      targetReportId: reportId,
      title: "Khóa tài khoản người dùng",
      prompt: `Xác nhận khóa tài khoản "${group.postAuthorName}". Hành động này sẽ khóa quyền đăng nhập và tự động ẩn TẤT CẢ bài viết và tài liệu của người dùng này. Vui lòng nhập lý do (lưu nội bộ hệ thống):`,
      confirmLabel: "Khóa tài khoản",
      isDanger: true,
    });
  };

  const promptUnbanUser = (group) => {
    const reportId = group.reportsList?.[0]?.id;
    setReasonModal({
      open: true,
      actionType: "UNBAN",
      targetReportId: reportId,
      title: "Mở khóa tài khoản người dùng",
      prompt: `Xác nhận mở khóa tài khoản cho "${group.postAuthorName}". Người dùng sẽ có thể đăng nhập lại và toàn bộ bài viết, tài liệu sẽ được khôi phục hiển thị. Nhập ghi chú gửi cho người dùng (tùy chọn):`,
      confirmLabel: "Mở khóa tài khoản",
      isDanger: false,
    });
  };

  const promptAcquit = (group) => {
    const reportId = group.reportsList?.[0]?.id;
    setReasonModal({
      open: true,
      actionType: "ACQUIT",
      targetReportId: reportId,
      title: "Bỏ qua khóa tài khoản & Xóa bài viết",
      prompt: `Xác nhận bỏ qua việc khóa tài khoản cho "${group.postAuthorName}". Bài viết vi phạm này sẽ bị XÓA khỏi hệ thống (tài khoản người dùng vẫn hoạt động bình thường). Vui lòng nhập ghi chú (tùy chọn):`,
      confirmLabel: "Bỏ qua & Xóa bài viết",
      isDanger: false,
    });
  };

  const handleConfirmReason = async (reason) => {
    const { actionType, targetReportId } = reasonModal;
    setReasonModal((prev) => ({ ...prev, open: false }));

    try {
      if (actionType === "BAN") {
        await adminBanUserFromReport(targetReportId, reason);
        notification.success("Đã khóa tài khoản người dùng và chuyển sang tab Đã xử lý.");
        closePostDetail();
      } else if (actionType === "UNBAN") {
        await adminUnbanUserFromReport(targetReportId, reason);
        notification.success("Đã mở khóa tài khoản và hiển thị lại toàn bộ bài viết, tài liệu.");
        closePostDetail();
      } else if (actionType === "ACQUIT") {
        await adminDismissEscalatedReport(targetReportId, reason);
        notification.success("Đã bỏ qua khóa tài khoản và xóa bài viết vi phạm.");
        closePostDetail();
      }
      fetchReports(page, size, activeTab);
    } catch (err) {
      notification.error(err?.response?.data?.message || "Thao tác thất bại.");
    }
  };

  const groupedPosts = useMemo(() => {
    const groups = {};
    for (const report of reports) {
      if (!report) continue;
      const pid = report.postId || report.id;
      if (!groups[pid]) {
        groups[pid] = {
          postId: pid,
          postTitle: report.postTitle,
          postContent: report.postContent,
          postAuthorId: report.postAuthorId,
          postAuthorName: report.postAuthorName,
          postAuthorAvatar: report.postAuthorAvatar,
          authorStatus: report.authorStatus,
          isPostHidden: report.isPostHidden,
          isPostDeleted: report.isPostDeleted,
          escalationReason: report.escalationReason,
          escalatedByName: report.escalatedByName,
          escalatedAt: report.escalatedAt,
          resolutionNotes: report.resolutionNotes,
          resolvedByName: report.resolvedByName,
          resolvedAt: report.resolvedAt,
          reportsList: [],
        };
      }
      groups[pid].reportsList.push(report);
    }
    return Object.values(groups);
  }, [reports]);

  return (
    <main className="admin-main">
      <div className="cmp-container" style={{ maxWidth: '100%', margin: 0 }}>
        {/* Top Header with search on the right */}
        <AdminPageHeader
          title="Quản lý Báo cáo Chuyển tiếp (Admin)"
          description="Xem xét và quyết định xử lý các báo cáo vi phạm cộng đồng được chuyển tiếp lên Quản trị viên hệ thống."
          searchValue={keyword}
          onSearchChange={(val) => {
            setKeyword(val);
            setPage(0);
          }}
          searchPlaceholder="Tìm theo tiêu đề, nội dung, người đăng..."
        />

        {/* Metric Cards */}
        <div className="cmp-stats-grid">
          <div className="cmp-stat-card">
            <div className={`cmp-stat-icon ${activeTab === "ESCALATED" ? "pending" : "hidden"}`}>
              {activeTab === "ESCALATED" ? <FlagIcon /> : <LockIcon />}
            </div>
            <div className="cmp-stat-info">
              <h3>{totalElements}</h3>
              <p>{activeTab === "ESCALATED" ? "Báo cáo chuyển tiếp chờ duyệt" : "Tài khoản vi phạm đã khóa"}</p>
            </div>
          </div>

          <div className="cmp-stat-card">
            <div className="cmp-stat-icon resolved">
              <CheckCircleIcon />
            </div>
            <div className="cmp-stat-info">
              <h3>{groupedPosts.length}</h3>
              <p>{activeTab === "ESCALATED" ? "Bài viết vi phạm chờ quyết định" : "Bài viết trong danh sách đã xử lý"}</p>
            </div>
          </div>
        </div>

      {/* Toolbar: Tabs Switcher + Date Filters */}
      <div className="cmp-toolbar-row">
        <div className="cmp-tabs-wrapper">
          <button
            type="button"
            className={`cmp-tab-btn ${activeTab === "ESCALATED" ? "active" : ""}`}
            onClick={() => handleTabChange("ESCALATED")}
          >
            <FlagIcon />
            <span>Chờ xử lý (Báo cáo chuyển tiếp)</span>
          </button>

          <button
            type="button"
            className={`cmp-tab-btn ${activeTab === "RESOLVED_BAN" ? "active" : ""}`}
            onClick={() => handleTabChange("RESOLVED_BAN")}
          >
            <LockIcon />
            <span>Đã xử lý (Khóa tài khoản)</span>
          </button>
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
              onClick={handleResetFilters}
              title="Xóa bộ lọc"
            >
              Reset bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Table Content */}
      <div className="cmp-table-card">
        {loading ? (
          <div className="cmp-state-box">
            <div className="cmp-state-icon">⏳</div>
            <div>Đang tải danh sách báo cáo...</div>
          </div>
        ) : groupedPosts.length === 0 ? (
          <div className="cmp-state-box">
            <div className="cmp-state-icon">✓</div>
            <div>
              {activeTab === "ESCALATED"
                ? "Không có báo cáo chuyển tiếp nào chờ xử lý."
                : "Không có tài khoản nào trong danh sách đã khóa."}
            </div>
          </div>
        ) : (
          <table className="cmp-table">
            <thead>
              <tr>
                <th>Bài viết</th>
                <th>Tác giả</th>
                {activeTab === "ESCALATED" ? (
                  <>
                    <th>Lý do chuyển từ Moderator</th>
                    <th style={{ whiteSpace: "nowrap" }}>Số lượt báo cáo</th>
                    <th style={{ whiteSpace: "nowrap" }}>Trạng thái</th>
                  </>
                ) : (
                  <>
                    <th>Lý do Admin đã khóa acc</th>
                    <th>Người xử lý & Thời gian</th>
                    <th style={{ whiteSpace: "nowrap" }}>Trạng thái</th>
                  </>
                )}
                <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {groupedPosts.map((group) => {
                const isExpanded = expandedPostIds.has(group.postId);
                const firstReport = group.reportsList[0] || {};

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
                              <span style={{ fontSize: "11px", background: "#FEE2E2", color: "#DC2626", padding: "1px 6px", borderRadius: "4px", fontWeight: 600 }}>
                                [Tác giả đã tự xóa]
                              </span>
                            )}
                            {(group.isPostEdited || group.editCount > 0) && (
                              <span style={{ fontSize: "11px", background: "#EEF2FF", color: "#4F46E5", padding: "1px 6px", borderRadius: "4px", fontWeight: 600 }}>
                                ✏️ Đã sửa ({group.editCount || 1} lần)
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
                          {activeTab === "RESOLVED_BAN" && (
                            <span style={{ fontSize: "11px", background: "#FEE2E2", color: "#DC2626", padding: "2px 6px", borderRadius: "6px", fontWeight: 700 }}>
                              LOCKED
                            </span>
                          )}
                        </div>
                      </td>

                      {activeTab === "ESCALATED" ? (
                        <>
                          {/* Lý do chuyển từ Moderator */}
                          <td>
                            <div style={{ fontSize: "13px" }}>
                              <div style={{ color: "#B45309", fontWeight: 600 }}>
                                {firstReport.escalationReason || group.escalationReason || "Yêu cầu Admin xem xét"}
                              </div>
                              <small style={{ color: "#64748B" }}>
                                Bởi: {firstReport.escalatedByName || group.escalatedByName || "Moderator"}
                              </small>
                            </div>
                          </td>

                          {/* Số lượt báo cáo */}
                          <td style={{ whiteSpace: "nowrap" }}>
                            <span className="cmp-count-badge">
                              <FlameIcon /> {group.reportsList.length} báo cáo
                            </span>
                          </td>

                          {/* Trạng thái */}
                          <td style={{ whiteSpace: "nowrap" }}>
                            <span className="cmp-status-badge hidden" style={{ background: "#FEF3C7", color: "#B45309", borderColor: "#FDE68A", whiteSpace: "nowrap" }}>
                              Chờ Admin duyệt
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          {/* Lý do Admin đã khóa acc */}
                          <td>
                            <div style={{ fontSize: "13px" }}>
                              <div style={{ color: "#DC2626", fontWeight: 600 }}>
                                {firstReport.resolutionNotes || group.resolutionNotes || "Vi phạm quy chuẩn cộng đồng"}
                              </div>
                              {group.escalationReason && (
                                <small style={{ color: "#64748B", display: "block", marginTop: "2px" }}>
                                  Đề xuất mod: {group.escalationReason}
                                </small>
                              )}
                            </div>
                          </td>

                          {/* Người xử lý & Thời gian */}
                          <td>
                            <div style={{ fontSize: "13px" }}>
                              <div style={{ fontWeight: 600, color: "#1E293B" }}>
                                {firstReport.resolvedByName || group.resolvedByName || "Admin"}
                              </div>
                              <small style={{ color: "#64748B" }}>
                                {firstReport.resolvedAt || group.resolvedAt
                                  ? formatDateTime(firstReport.resolvedAt || group.resolvedAt)
                                  : "Gần đây"}
                              </small>

                            </div>
                          </td>

                          {/* Trạng thái */}
                          <td style={{ whiteSpace: "nowrap" }}>
                            <span className="cmp-status-badge hidden" style={{ background: "#FEE2E2", color: "#DC2626", borderColor: "#FECACA", whiteSpace: "nowrap" }}>
                              Đã khóa tài khoản
                            </span>
                          </td>
                        </>
                      )}

                      {/* Thao tác */}
                      <td style={{ whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                        <div className="cmp-actions">
                          {activeTab === "ESCALATED" ? (
                            <button
                              type="button"
                              className="cmp-btn cmp-btn-view"
                              onClick={() => openPostDetail(group)}
                              title="Xem chi tiết và xử lý bài viết này"
                            >
                              <EyeIcon />
                              <span>Xem & Xử lý</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="cmp-btn cmp-btn-view"
                              style={{ background: "#059669", color: "#FFFFFF", border: "none" }}
                              onClick={() => promptUnbanUser(group)}
                              title="Mở khóa tài khoản người dùng này"
                            >
                              <UnlockIcon />
                              <span>Mở khóa acc</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Reports */}
                    {isExpanded && (
                      <tr className="cmp-nested-row">
                        <td colSpan={activeTab === "ESCALATED" ? 6 : 6} style={{ padding: "0 24px 16px 24px", background: "#F8FAFC" }}>
                          <div className="cmp-nested-list">
                            {group.reportsList.map((r, idx) => (
                              <div key={r.id || idx} className="cmp-nested-item">
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                  <span style={{ fontWeight: 600, color: "#0F172A" }}>
                                    {r.reporterName || "Người báo cáo"}
                                  </span>
                                  <span className={`cmp-reason-tag ${r.reasonCode || "OTHER"}`}>
                                    {REASON_LABELS[r.reasonCode] || r.reasonCode}
                                  </span>
                                  {r.detail && <span style={{ color: "#475569" }}>"{r.detail}"</span>}
                                </div>
                                <span style={{ color: "#94A3B8", fontSize: "12px" }}>
                                  {formatDateTime(r.createdAt)}
                                </span>

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

      {/* Admin Escalated Detail Modal */}
      <AdminEscalatedDetailModal
        open={detailModal.open}
        group={detailModal.group}
        postDetail={detailModal.postDetail}
        loading={detailModal.loading}
        isResolvedTab={activeTab === "RESOLVED_BAN"}
        onClose={closePostDetail}
        onBanUser={promptBanUser}
        onUnbanUser={promptUnbanUser}
        onAcquit={promptAcquit}
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
    </main>
  );
}
