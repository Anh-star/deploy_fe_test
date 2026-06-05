import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLoginRequired } from "../../context/LoginRequiredModalContext";
import { useNotification } from "../../context/NotificationContext";
import { getApiErrorMessage, quizService } from "../../services/api";
import "../../styles/quizTaking.css";

const startQuizInFlightByQuizId = new Map();

function startQuizOnce(quizId) {
  const key = String(quizId || "");
  if (!key) {
    return Promise.reject(new Error("Thiếu quizId"));
  }
  const existingPromise = startQuizInFlightByQuizId.get(key);
  if (existingPromise) {
    return existingPromise;
  }
  const requestPromise = quizService.startQuiz(key).finally(() => {
    startQuizInFlightByQuizId.delete(key);
  });
  startQuizInFlightByQuizId.set(key, requestPromise);
  return requestPromise;
}

function normalizeQuestionsFromPreview(preview) {
  const list = preview?.questions;
  if (!Array.isArray(list)) return [];
  return list.map((q, idx) => ({
    id: q.questionId,
    number: idx + 1,
    question: q.questionText ?? "",
    options: (q.options ?? []).map((o) => ({
      id: o.id,
      text: o.content ?? "",
    })),
  }));
}

export default function QuizTaking() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const notification = useNotification();
  const requestLogin = useLoginRequired();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [attemptId, setAttemptId] = useState(null);
  const [questions, setQuestions] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const submittedRef = useRef(false);
  const startedQuizRef = useRef(false);
  const answersRef = useRef({});
  const attemptIdRef = useRef(null);
  const timerActiveRef = useRef(false);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    attemptIdRef.current = attemptId;
  }, [attemptId]);

  const total = Array.isArray(questions) ? questions.length : 0;

  const answeredQuestions = useMemo(() => {
    const set = new Set();
    for (const [qid, oid] of Object.entries(answers)) {
      if (oid) set.add(qid);
    }
    return set;
  }, [answers]);

  const answeredCount = answeredQuestions.size;
  const unansweredCount = total - answeredCount;
  const progressPercent = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

  const handleManualSubmit = useCallback(() => {
    if (unansweredCount > 0) {
      notification.error(`Bạn còn ${unansweredCount} câu chưa trả lời. Vui lòng trả lời tất cả câu hỏi trước khi nộp bài.`);
      return;
    }
    setShowConfirmDialog(true);
  }, [unansweredCount, notification]);

  const handleConfirmSubmit = useCallback(() => {
    setShowConfirmDialog(false);
    performSubmit();
  }, []);

  const handleCancelSubmit = useCallback(() => {
    setShowConfirmDialog(false);
  }, []);

  const performSubmit = useCallback(
    async (isTimeout = false) => {
      if (submittedRef.current) return;
      const aid = attemptIdRef.current;
      if (!aid) return;
      submittedRef.current = true;
      timerActiveRef.current = false;
      setSubmitting(true);
      try {
        const raw = answersRef.current || {};
        const payloadAnswers = Object.entries(raw)
          .filter(([, optionId]) => optionId)
          .map(([questionId, selectedOptionId]) => ({ questionId, selectedOptionId }));

        console.log("submitPayload", { attemptId: aid, answers: payloadAnswers, isTimeout });
        const response = await quizService.submitQuiz({ attemptId: aid, answers: payloadAnswers });
        console.log("submitResponse", response);

        navigate(`/quiz/result/${aid}`, {
          replace: true,
          state: {
            quizId,
            documentId: location.state?.documentId || null,
          },
        });
      } catch (e) {
        submittedRef.current = false;
        notification.error(getApiErrorMessage(e));
      } finally {
        setSubmitting(false);
      }
    },
    [location.state, navigate, notification, quizId]
  );

  useEffect(() => {
    window.scrollTo(0, 0);
    startedQuizRef.current = false;
  }, [quizId]);

  useEffect(() => {
    if (authLoading || !quizId) return;
    if (startedQuizRef.current) return;
    if (!isAuthenticated) {
      requestLogin({ redirectTo: `${location.pathname}${location.search}` });
      setLoading(false);
      return;
    }

    let cancelled = false;
    startedQuizRef.current = true;
    submittedRef.current = false;
    timerActiveRef.current = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const startData = await startQuizOnce(quizId);
        console.log("startQuiz response:", startData);
        console.log("remainingSeconds", "initialized to 0 (pending preview load)");

        if (cancelled) return;
        const nextAttemptId = startData?.attemptId ?? null;
        if (!nextAttemptId) {
          throw new Error("Lỗi tải bài. Vui lòng thử lại");
        }
        setAttemptId(nextAttemptId);

        const previewData = await quizService.getQuizPreview(quizId);
        if (cancelled) return;

        setQuizTitle(previewData?.quizTitle || "Bài đánh giá");
        const norm = normalizeQuestionsFromPreview(previewData);
        setQuestions(norm);
        setAnswers({});
        setCurrentQuestionIndex(0);

        const durationMinutes = Number(startData?.durationMinutes ?? previewData?.duration ?? 0);
        const fallbackSeconds = Math.max(0, Math.floor(durationMinutes * 60));
        const safeSeconds = Math.max(fallbackSeconds, 1);
        setRemainingSeconds(safeSeconds);
        timerActiveRef.current = true;

        console.log("remainingSeconds", safeSeconds, `(duration=${durationMinutes} min)`);
      } catch (e) {
        if (!cancelled) {
          startedQuizRef.current = false;
          const msg = e?.message || getApiErrorMessage(e) || "Lỗi tải bài. Vui lòng thử lại";
          setLoadError(msg);
          notification.error(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [quizId, isAuthenticated, authLoading, location.pathname, location.search, requestLogin, notification]);

  // Auto-submit ONLY when timer reaches exactly 0 AND quiz hasn't been submitted yet
  useEffect(() => {
    if (!timerActiveRef.current) return;
    if (submittedRef.current) return;
    if (remainingSeconds > 0) return;
    performSubmit(true);
  }, [remainingSeconds, performSubmit]);

  // Timer countdown — only runs when timer is active
  useEffect(() => {
    if (!attemptId) return;
    const id = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev === undefined) return 0;
        if (prev <= 0) {
          timerActiveRef.current = false;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [attemptId]);

  const displayMinutes = Math.floor(remainingSeconds / 60);
  const displaySeconds = remainingSeconds % 60;

  const handleOptionSelect = (questionId, optionId) => {
    const idx = questions.findIndex((q) => q.id === questionId);
    if (idx >= 0) setCurrentQuestionIndex(idx);
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
  };

  const scrollToQuestionIndex = (index) => {
    const q = questions[index];
    if (!q) return;
    const el = document.getElementById(`quiz-question-${q.id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleNavClick = (index) => {
    setCurrentQuestionIndex(index);
    scrollToQuestionIndex(index);
  };

  if (authLoading) {
    return (
      <div className="quiz-taking-container">
        <div className="quiz-taking-content">
          <div className="quiz-taking-loading">Đang tải…</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="quiz-taking-container">
        <div className="quiz-taking-content">
          <div className="quiz-taking-loading">Vui lòng đăng nhập để làm bài.</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="quiz-taking-container">
        <div className="quiz-taking-content">
          <div className="quiz-taking-loading">Đang tải bài và bắt đầu lượt làm…</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="quiz-taking-container">
        <div className="quiz-taking-content">
          <div className="quiz-taking-error">
            <p>{loadError}</p>
            <button type="button" className="submit-btn" onClick={() => navigate(-1)}>
              Quay lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!attemptId || questions == null) {
    return (
      <div className="quiz-taking-container">
        <div className="quiz-taking-content">
          <div className="quiz-taking-error">
            <p>Lỗi tải bài. Vui lòng thử lại</p>
            <button type="button" className="submit-btn" onClick={() => navigate(-1)}>
              Quay lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="quiz-taking-container">
        <div className="quiz-taking-content">
          <div className="quiz-taking-error">
            <p>Bài đánh giá không có câu hỏi hoặc không tải được dữ liệu.</p>
            <button type="button" className="submit-btn" onClick={() => navigate(-1)}>
              Quay lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-taking-container">
      {showConfirmDialog && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <h3>Xác nhận nộp bài</h3>
            <p>Bạn có chắc chắn muốn nộp bài không?</p>
            <div className="confirm-dialog-actions">
              <button
                type="button"
                className="confirm-cancel-btn"
                onClick={handleCancelSubmit}
              >
                Hủy
              </button>
              <button
                type="button"
                className="confirm-submit-btn"
                onClick={handleConfirmSubmit}
              >
                Nộp bài
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="quiz-taking-content">
        {/* Header: Title + Progress */}
        <div className="quiz-header">
          <div className="quiz-title-section">
            <h1>{quizTitle}</h1>
            <div className="progress-container">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>
              <span className="progress-text">
                {progressPercent}% ({answeredCount}/{total} câu)
                {unansweredCount > 0 && (
                  <span style={{ color: "#ef4444", marginLeft: 8 }}>
                    ({unansweredCount} chưa trả lời)
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Main Layout - Grid 2 cột */}
        <div className="main-content">
          {/* Cột trái: Các câu hỏi */}
          <div className="left-column">
            <div className="questions-section">
              {questions.map((q, idx) => (
                <div key={q.id} id={`quiz-question-${q.id}`} className="question-card">
                  <div className="question-header">
                    <div className="question-number">{q.number}</div>
                    <h3 className="question-text">{q.question}</h3>
                  </div>

                  <div className="options-list">
                    {q.options.map((option) => (
                      <label
                        key={option.id}
                        className={`option-item ${answers[q.id] === option.id ? "selected" : ""}`}
                        onClick={() => handleOptionSelect(q.id, option.id)}
                      >
                        <input
                          type="radio"
                          name={`question-${q.id}`}
                          checked={answers[q.id] === option.id}
                          onChange={() => handleOptionSelect(q.id, option.id)}
                        />
                        <span className="option-text">{option.text}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cột phải: Timer + Danh sách câu hỏi + Nộp bài */}
          <div className="right-column">
            {/* Timer - Ô trên bên phải */}
            <div className="timer-card">
              <div className="timer-title">THỜI GIAN CÒN LẠI</div>
              <div className="timer-values">
                <div className="timer-box">
                  <span className="timer-number">{String(displayMinutes).padStart(2, "0")}</span>
                  <span className="timer-label">PHÚT</span>
                </div>
                <div className="timer-box">
                  <span className="timer-number">{String(displaySeconds).padStart(2, "0")}</span>
                  <span className="timer-label">GIÂY</span>
                </div>
              </div>
            </div>

            {/* Danh sách câu hỏi + Nút nộp bài - Ô dưới bên phải */}
            <div className="sidebar">
              <div className="question-list-card">
                <h3 className="sidebar-title">DANH SÁCH CÂU HỎI</h3>
                <div className="question-grid">
                  {questions.map((q, idx) => {
                    const answered = answeredQuestions.has(q.id);
                    const current = idx === currentQuestionIndex;
                    const classNames = ["question-btn"];
                    if (answered) classNames.push("answered");
                    if (current) classNames.push("current");
                    return (
                      <button
                        key={q.id}
                        type="button"
                        className={classNames.join(" ")}
                        onClick={() => handleNavClick(idx)}
                      >
                        {q.number}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                className="submit-btn"
                disabled={submitting}
                onClick={handleManualSubmit}
              >
                {submitting ? "Đang nộp…" : "Nộp bài"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
