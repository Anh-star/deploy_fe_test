import React, { useEffect, useState } from "react";
import Header from "../../components/Header";
import { EyeIcon, PlusIcon } from "../../components/icons";
import { quizService, getApiErrorMessage } from "../../services/api";
import { useNotification } from "../../context/NotificationContext";
import "../../styles/manageQuizzes.css";

const EditIcon = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>
);

const TrashIcon = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

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
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await quizService.getQuizHistory({ page, size: 10 });
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

  const canPrev = page > 0;
  const canNext = page + 1 < totalPages;

  return (
    <div className="manage-quizzes-container">
      <Header />

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
                        <button className="action-btn" title="Xem chi tiết">
                          <EyeIcon size={18} />
                        </button>
                        <button className="action-btn" title="Chỉnh sửa">
                          <EditIcon size={18} />
                        </button>
                        <button className="action-btn" title="Xóa">
                          <TrashIcon size={18} />
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
            <div className="pagination-controls">
              <button
                className="arrow-btn"
                disabled={!canPrev || loading}
                onClick={() => canPrev && setPage((p) => p - 1)}
              >
                {"<"}
              </button>
              <button className="page-btn active" type="button">
                {totalPages > 0 ? page + 1 : 0}
              </button>
              <button
                className="arrow-btn"
                disabled={!canNext || loading}
                onClick={() => canNext && setPage((p) => p + 1)}
              >
                {">"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
