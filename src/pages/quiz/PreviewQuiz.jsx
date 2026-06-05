import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getApiErrorMessage, quizService } from "../../services/api";
import { useNotification } from "../../context/NotificationContext";
import { useLoginRequired } from "../../context/LoginRequiredModalContext";
import "../../styles/previewQuiz.css";

// ==================== ICONS ====================
const ClockIcon = ({ size = 20, color = "#2563eb" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const TrophyIcon = ({ size = 20, color = "#d97706" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 21h8" />
    <path d="M12 17v4" />
    <path d="M7 4h10" />
    <path d="M17 4v8a5 5 0 0 1-10 0V4" />
    <path d="M5 9h14" />
  </svg>
);

const CheckCircleIcon = ({ size = 16, color = "#10b981" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const AlertCircleIcon = ({ size = 16, color = "#ef4444" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const ChevronLeftIcon = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const UsersIcon = ({ size = 20, color = "#2563eb" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

// ==================== COMPONENT ====================
export default function PreviewQuiz() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const notification = useNotification();
  const requestLogin = useLoginRequired();

  const [quizData, setQuizData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!quizId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await quizService.getQuizPreview(quizId);
        console.log("quiz preview response:", data);
        if (!cancelled) setQuizData(data || null);
      } catch (e) {
        if (!cancelled) {
          setQuizData(null);
          notification.error(getApiErrorMessage(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quizId, notification]);

  const historyItems = useMemo(() => quizData?.recentAttempts || [], [quizData]);

  const formatDateTime = (value) => {
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
  };

  if (loading) {
    return (
      <div className="preview-quiz-container">
        <div className="preview-quiz-content">
          <div className="quiz-card">
            <div className="quiz-loading">Đang tải bài đánh giá…</div>
          </div>
        </div>
      </div>
    );
  }

  if (!quizData) {
    return (
      <div className="preview-quiz-container">
        <div className="preview-quiz-content">
          <div className="quiz-card">
            <div className="quiz-empty">Không có dữ liệu bài đánh giá.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="preview-quiz-container">
      <div className="preview-quiz-content">
        <div className="quiz-card">
          {/* Header */}
          <div className="quiz-header">
            <h1 className="quiz-title">{quizData.quizTitle || "Bài đánh giá"}</h1>
            <p className="quiz-description">{quizData.description || "Không có mô tả."}</p>
          </div>

          {/* Thông tin bài thi */}
          <div className="quiz-info">
            <div className="info-item">
              <div className="info-icon">
                <UsersIcon />
              </div>
              <div>
                <div className="info-label">Số câu hỏi</div>
                <div className="info-value">{quizData.totalQuestions ?? 0} câu</div>
              </div>
            </div>

            <div className="info-item">
              <div className="info-icon">
                <ClockIcon />
              </div>
              <div>
                <div className="info-label">Thời gian</div>
                <div className="info-value">{quizData.duration ?? 0} phút</div>
              </div>
            </div>

            <div className="info-item">
              <div className="info-icon">
                <TrophyIcon />
              </div>
              <div>
                <div className="info-label">Điểm cần đạt</div>
                <div className="info-value target-score">{quizData.passScorePercent ?? 0}%</div>
              </div>
            </div>

          </div>

          {/* Nút bắt đầu làm bài */}
          <div className="quiz-start-section">
            <button
              type="button"
              className="start-btn"
              disabled={starting}
              onClick={() => {
                if (!quizId) return;
                if (starting) return;
                setStarting(true);
                if (!requestLogin({ redirectTo: `/quiz/${quizId}/take` })) {
                  setStarting(false);
                  return;
                }
                navigate(`/quiz/${quizId}/take`, {
                  state: {
                    documentId:
                      location.state?.documentId ||
                      new URLSearchParams(location.search).get("documentId") ||
                      null,
                  },
                });
              }}
            >
              ▶ Bắt đầu làm bài
            </button>
            <p className="note-text">
              Chúc bạn làm bài may mắn.
            </p>
          </div>

          {/* Lịch sử làm bài */}
          <div className="quiz-history">
            <div className="history-header">
              <h2>Lịch sử làm bài của bạn</h2>
              <button className="download-btn">Tải bảng điểm</button>
            </div>

            <div className="history-table">
              <table>
                <thead>
                  <tr>
                    <th>Lần làm</th>
                    <th>Ngày làm</th>
                    <th>Điểm số</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map((item, index) => (
                    <tr key={item.attemptId || index}>
                      <td className="attempt">#{historyItems.length - index}</td>
                      <td className="date">{formatDateTime(item.attemptDate)}</td>
                      <td
                        className="score"
                        style={{ color: item.status === "PASSED" ? "#10b981" : "#ef4444" }}
                      >
                        {item.scorePercent != null ? `${Number(item.scorePercent).toFixed(1)}%` : "—"}
                      </td>
                      <td>
                        <div className={`status-badge ${item.status === "PASSED" ? "success" : "failed"}`}>
                          {item.status === "PASSED" ? (
                            <CheckCircleIcon color="#10b981" />
                          ) : (
                            <AlertCircleIcon color="#ef4444" />
                          )}
                          <span>{item.status === "PASSED" ? "Đạt" : "Chưa đạt"}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {historyItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", color: "#64748b" }}>
                        Chưa có lịch sử làm bài
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="back-section">
            <button className="back-btn" type="button" onClick={() => navigate(-1)}>
              <ChevronLeftIcon />
              Quay lại
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}