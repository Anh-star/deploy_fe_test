import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getApiErrorMessage, quizService } from "../../services/api";
import "../../styles/quizResult.css";

export default function QuizResult() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [attemptId]);

  useEffect(() => {
    if (!attemptId) {
      setError("Thiếu attemptId.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await quizService.getQuizResult(attemptId);
        if (!cancelled) setResult(data || null);
      } catch (e) {
        if (!cancelled) {
          setResult(null);
          setError(getApiErrorMessage(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  const quizId =
    location.state?.quizId ||
    new URLSearchParams(location.search).get("quizId") ||
    "";
  const documentId =
    location.state?.documentId ||
    new URLSearchParams(location.search).get("documentId") ||
    "";

  const score = Number(result?.score ?? 0);
  const maxScore = Number(result?.maxScore ?? 0);
  const scorePercent = Number(result?.scorePercent ?? 0);
  const totalQuestions = Number(result?.totalQuestions ?? 0);
  const correctCount = Number(result?.correctCount ?? 0);
  const wrongCount = Number(result?.wrongCount ?? 0);
  const skippedCount = Number(result?.skippedCount ?? 0);

  const completionRate = useMemo(() => {
    if (!totalQuestions) return "0%";
    return `${Math.round((correctCount / totalQuestions) * 100)}%`;
  }, [correctCount, totalQuestions]);

  const spentDurationText = useMemo(() => {
    if (!result?.startTime || !result?.endTime) return "—";
    const start = new Date(result.startTime);
    const end = new Date(result.endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "—";
    const diffMs = Math.max(0, end.getTime() - start.getTime());
    const totalSeconds = Math.floor(diffMs / 1000);
    const hh = Math.floor(totalSeconds / 3600);
    const mm = Math.floor((totalSeconds % 3600) / 60);
    const ss = totalSeconds % 60;
    if (hh > 0) return `${hh}h ${mm}m ${ss}s`;
    return `${mm}m ${ss}s`;
  }, [result?.startTime, result?.endTime]);

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
      second: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="quiz-result-container">
        <div className="quiz-result-content">
          <div className="completion-section">Đang tải kết quả bài quiz...</div>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="quiz-result-container">
        <div className="quiz-result-content">
          <div className="completion-section">
            <p>{error || "Không tải được kết quả bài quiz."}</p>
            <div className="header-actions" style={{ marginTop: 12 }}>
              <button className="btn-retry" type="button" onClick={() => navigate(-1)}>
                Quay lại
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-result-container">
      <div className="quiz-result-content">

        {/* Header */}
        <div className="result-header">
          <div>
            <div className="header-badge">HOÀN THÀNH</div>
            <h1 className="result-title">Kết quả bài tập</h1>
            <p className="result-subtitle">Chúc mừng bạn đã hoàn thành bài tập của tài liệu.</p>
          </div>

          <div className="header-actions">
            <button
              className="btn-retry"
              type="button"
              disabled={!quizId}
              onClick={() => quizId && navigate(`/quiz/${quizId}/preview`)}
            >
              Làm lại
            </button>
            <button
              className="btn-view-review"
              type="button"
              disabled={!documentId}
              onClick={() => documentId && navigate(`/documents/${documentId}`)}
            >
              Xem tài liệu
            </button>
          </div>
        </div>

        {/* Score Cards */}
        <div className="score-cards">
          {/* Tổng điểm số */}
          <div className="score-card total-score">
            <div className="score-value">{`${score}/${maxScore}`}</div>
            <div className="score-label">TỔNG ĐIỂM SỐ</div>
            <div className="score-percent">{`${scorePercent.toFixed(1)}%`}</div>
            <div className="score-note">{result.status === "PASSED" ? "Đạt yêu cầu" : "Chưa đạt yêu cầu"}</div>
          </div>

          {/* Số câu đúng */}
          <div className="score-card correct">
            <div className="icon-circle correct-icon" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="score-value">{correctCount} câu</div>
            <div className="score-label">SỐ CÂU ĐÚNG</div>
            <div className="score-sub">{`Trên tổng ${totalQuestions} câu hỏi`}</div>
          </div>

          {/* Số câu sai */}
          <div className="score-card wrong">
            <div className="icon-circle wrong-icon" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <div className="score-value">{wrongCount} câu</div>
            <div className="score-label">SỐ CÂU SAI</div>
            <div className="score-sub">{`Bỏ qua: ${skippedCount} câu`}</div>
          </div>
        </div>

        {/* Tiến độ hoàn thành */}
        <div className="completion-section">
          <div className="completion-header">
            <span>Tiến độ hoàn thành & trạng thái</span>
            <span className="completion-rate">{completionRate}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, scorePercent))}%` }}></div>
          </div>
          <p className="rank-text">{`Trạng thái: ${result.status || "—"} | Bắt đầu: ${formatDateTime(
            result.startTime
          )} | Kết thúc: ${formatDateTime(result.endTime)} | Thời gian làm: ${spentDurationText}`}</p>
        </div>

        {/* Chi tiết câu hỏi */}
        <div className="questions-detail">
          <h2 className="detail-title">Chi tiết câu hỏi</h2>

          {(result.questions || []).map((q, index) => (
            <div key={q.questionId || index} className={`question-detail-card ${q.isCorrect ? "correct" : "wrong"}`}>
              <div className="question-header-detail">
                <div className="question-number">{`CÂU HỎI ${index + 1}`}</div>
                {q.isCorrect ? (
                  <div className="status correct">ĐÚNG</div>
                ) : (
                  <div className="status wrong">SAI</div>
                )}
              </div>

              <h3 className="question-text">{q.content}</h3>

              <div className="options-list">
                {(q.answers || []).map((opt, answerIndex) => (
                  <div
                    key={opt.answerId || answerIndex}
                    className={`option-row ${opt.isSelected ? "selected" : ""} ${opt.isCorrect ? "correct-option" : ""}`}
                  >
                    <span className="option-label">{String.fromCharCode(65 + answerIndex)}.</span>
                    <span className="option-text">{opt.content}</span>
                    {opt.isSelected && opt.isCorrect && <span className="check-icon">✓</span>}
                    {opt.isSelected && !opt.isCorrect && <span className="wrong-icon">✕</span>}
                    {opt.isCorrect && !opt.isSelected && <span className="correct-mark">✓</span>}
                  </div>
                ))}
              </div>
              {q.explanation ? (
                <p className="rank-text" style={{ marginTop: 12 }}>
                  {`Giải thích: ${q.explanation}`}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}