import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { EyeIcon, PlusIcon } from "../../components/icons";
import { quizService, documentService, getApiErrorMessage } from "../../services/api";
import { useNotification } from "../../context/NotificationContext";
import Pagination from "../../components/common/Pagination";
import "../../styles/manageQuizzes.css";

const FileTextIcon = ({ size = 24, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
    <polyline points="10 9 9 9 8 9"></polyline>
  </svg>
);

const CheckCircleIcon = ({ size = 24, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

const ClockIcon = ({ size = 24, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

const LinkIcon = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
  </svg>
);

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStatus(status) {
  if (!status) return null;
  switch (status.toUpperCase()) {
    case "PASSED": return "Đạt";
    case "FAILED": return "Chưa đạt";
    case "IN_PROGRESS": return "Đang làm";
    default: return status;
  }
}

export default function ManageQuizzes() {
  const notification = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "documents" ? "documents" : "history";

  const setTab = (tab) => {
    setSearchParams(tab === "history" ? {} : { tab: "documents" });
  };

  return (
    <div className="manage-quizzes-container">
      <main className="manage-quizzes-content">
        <nav className="breadcrumb">
          <span>CÁ NHÂN</span>
          <span>/</span>
          <span className="active">QUẢN LÝ BÀI ĐÁNH GIÁ</span>
        </nav>

        <div className="manage-quizzes-header">
          <h1>Quản lý bài đánh giá cá nhân</h1>
          <button className="create-new-btn">
            <PlusIcon size={18} />
            Tạo bài đánh giá mới
          </button>
        </div>

        <div className="manage-quizzes-tabs">
          <button
            type="button"
            className={`tab-btn${activeTab === "history" ? " tab-btn--active" : ""}`}
            onClick={() => setTab("history")}
          >
            Đã làm
          </button>
          <button
            type="button"
            className={`tab-btn${activeTab === "documents" ? " tab-btn--active" : ""}`}
            onClick={() => setTab("documents")}
          >
            Từ tài liệu của tôi
          </button>
        </div>

        {activeTab === "history" ? (
          <HistoryTab notification={notification} />
        ) : (
          <DocumentsTab notification={notification} />
        )}
      </main>
    </div>
  );
}

function HistoryTab({ notification }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [page, setPage] = useState(1); // 1-based
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await quizService.getQuizHistory({ page: page - 1, size: 10 });
        if (cancelled) return;
        setItems(data?.items || []);
        setTotalPages(Number(data?.totalPages || 0));
        setTotalItems(Number(data?.totalItems || 0));
        if (data?.summary) {
          setSummary(data.summary);
        }
      } catch (e) {
        if (!cancelled) {
          notification.error(getApiErrorMessage(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, notification]);

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon-box blue">
            <FileTextIcon />
          </div>
          <div className="stat-info">
            <span className="stat-label">Tổng bài đã làm</span>
            <span className="stat-value">{summary?.totalItems ?? totalItems}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-box green">
            <CheckCircleIcon />
          </div>
          <div className="stat-info">
            <span className="stat-label">Tỷ lệ đạt</span>
            <span className="stat-value">
              {summary?.passRatePercent != null
                ? `${(summary.passRatePercent).toFixed(1)}%`
                : "—"}
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-box orange">
            <ClockIcon />
          </div>
          <div className="stat-info">
            <span className="stat-label">Điểm trung bình</span>
            <span className="stat-value">
              {summary?.averageScore != null
                ? `${(summary.averageScore).toFixed(1)}%`
                : "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="quizzes-table-container">
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
            Đang tải…
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
            Chưa có lịch sử làm bài đánh giá
          </div>
        ) : (
          <table className="quizzes-table">
            <thead>
              <tr>
                <th>Tên bài đánh giá</th>
                <th>Lần thứ</th>
                <th>Ngày làm</th>
                <th>Điểm số</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: "right" }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.attemptId}>
                  <td>
                    <div className="quiz-title-cell">
                      <span className="quiz-name">{item.quizTitle || "Bài đánh giá"}</span>
                      <span className="quiz-id">ID: {item.attemptId}</span>
                    </div>
                  </td>
                  <td>
                    <span className="date-cell">Lần #{item.attemptNumber ?? 1}</span>
                  </td>
                  <td>
                    <span className="date-cell">{formatDate(item.attemptDate)}</span>
                  </td>
                  <td>
                    <span className="questions-count-cell">
                      {item.scorePercent != null
                        ? `${Number(item.scorePercent).toFixed(1)}%`
                        : "—"}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${item.status === "PASSED" ? "approved" : item.status === "FAILED" ? "rejected" : "pending"}`}>
                      {formatStatus(item.status)}
                    </span>
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button
                        className="action-btn action-btn--text"
                        title="Xem kết quả"
                        onClick={() => navigate(`/quiz/result/${item.attemptId}`)}
                      >
                        <EyeIcon size={15} />
                        Xem kết quả
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="table-footer">
          <div className="pagination-info">
            {loading
              ? "Đang tải…"
              : `Hiển thị ${items.length} / ${totalItems} bài đánh giá`}
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      </div>
    </>
  );
}

function DocumentsTab({ notification }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1); // 1-based
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await documentService.getMyDocumentQuizzes(page - 1, 10);
        if (cancelled) return;
        setItems(data?.items || []);
        setTotalPages(Number(data?.totalPages || 0));
        setTotalItems(Number(data?.totalItems || 0));
      } catch (e) {
        if (!cancelled) {
          notification.error(getApiErrorMessage(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, notification]);

  return (
    <div className="quizzes-table-container">
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
          Đang tải…
        </div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
          Chưa có bài đánh giá nào từ tài liệu của bạn
        </div>
      ) : (
        <table className="quizzes-table">
          <thead>
            <tr>
              <th>Tên bài đánh giá</th>
              <th>Tài liệu nguồn</th>
              <th>Câu</th>
              <th>Ngày tạo</th>
              <th>Loại</th>
              <th style={{ textAlign: "right" }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.quizId}>
                <td>
                  <div className="quiz-title-cell">
                    <span className="quiz-name">{item.quizTitle || "Bài đánh giá"}</span>
                    {item.description ? (
                      <span className="quiz-id">{item.description}</span>
                    ) : null}
                  </div>
                </td>
                <td>
                  <div className="quiz-title-cell">
                    <span className="quiz-name">{item.documentTitle || "—"}</span>
                    {item.documentFileName ? (
                      <span className="quiz-id">{item.documentFileName}</span>
                    ) : null}
                  </div>
                </td>
                <td>
                  <span className="questions-count-cell">
                    {item.totalQuestions ?? 0}
                  </span>
                </td>
                <td>
                  <span className="date-cell">{formatDateTime(item.createdAt)}</span>
                </td>
                <td>
                  <span className={`type-badge ${item.isAutoGenerated ? "type-badge--auto" : "type-badge--manual"}`}>
                    {item.isAutoGenerated ? "Auto" : "Manual"}
                  </span>
                </td>
                <td>
                  <div className="actions-cell">
                    <a
                      href={`/quiz/${item.quizId}/preview?from=manage&documentId=${item.documentId}`}
                      className="action-btn action-btn--link"
                      title="Xem trước"
                    >
                      <EyeIcon size={18} />
                    </a>
                    <a
                      href={`/documents/submitted/${item.documentId}`}
                      className="action-btn action-btn--link"
                      title="Xem tài liệu"
                    >
                      <LinkIcon size={18} />
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="table-footer">
        <div className="pagination-info">
          {loading
            ? "Đang tải…"
            : `Hiển thị ${items.length} / ${totalItems} bài đánh giá`}
        </div>
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
