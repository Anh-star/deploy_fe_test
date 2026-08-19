import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getApiErrorMessage, quizService } from "../../services/api";
import { useNotification } from "../../context/NotificationContext";
import "../../styles/ownerQuizEditor.css";

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function makeEmptyQuestion(sortOrder) {
  const options = [
    { key: cryptoRandomId(), optionId: null, content: "", isCorrect: true, sortOrder: 1 },
    { key: cryptoRandomId(), optionId: null, content: "", isCorrect: false, sortOrder: 2 },
    { key: cryptoRandomId(), optionId: null, content: "", isCorrect: false, sortOrder: 3 },
    { key: cryptoRandomId(), optionId: null, content: "", isCorrect: false, sortOrder: 4 },
  ];
  return {
    key: cryptoRandomId(),
    questionId: null,
    questionText: "",
    explanation: "",
    points: 1,
    sortOrder,
    options,
  };
}

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2, 11)}-${Date.now()}`;
}

function cloneServerQuestion(q, sortOrder) {
  return {
    key: cryptoRandomId(),
    questionId: q.questionId ?? null,
    questionText: q.questionText ?? "",
    explanation: q.explanation ?? "",
    points: q.points ?? 1,
    sortOrder: sortOrder,
    options: (q.options || []).map((o, idx) => ({
      key: cryptoRandomId(),
      optionId: o.optionId ?? null,
      content: o.content ?? "",
      isCorrect: !!o.isCorrect,
      sortOrder: o.sortOrder ?? idx + 1,
    })),
  };
}

function normalizeLoaded(loaded) {
  const sortedQuestions = (loaded.questions || [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  return sortedQuestions.map((q, qIdx) => cloneServerQuestion(q, qIdx + 1));
}

function toPayload(quiz) {
  return {
    title: quiz.title,
    description: quiz.description,
    durationMinutes: quiz.durationMinutes,
    passScorePercent: quiz.passScorePercent,
    questions: quiz.questions.map((q, qIdx) => ({
      questionId: q.questionId,
      questionText: q.questionText,
      explanation: q.explanation,
      points: q.points,
      sortOrder: qIdx + 1,
      options: q.options.map((o, oIdx) => ({
        optionId: o.optionId,
        content: o.content,
        isCorrect: !!o.isCorrect,
        sortOrder: oIdx + 1,
      })),
    })),
  };
}

function validateLocal(quiz) {
  if (!quiz.title || !quiz.title.trim()) {
    return "Tiêu đề không được để trống.";
  }
  if (!quiz.durationMinutes || quiz.durationMinutes < 1) {
    return "Thời gian phải lớn hơn hoặc bằng 1 phút.";
  }
  if (quiz.passScorePercent == null || quiz.passScorePercent < 0) {
    return "Điểm cần đạt không hợp lệ.";
  }
  if (!quiz.questions || quiz.questions.length === 0) {
    return "Bài đánh giá cần ít nhất một câu hỏi.";
  }
  for (let i = 0; i < quiz.questions.length; i++) {
    const q = quiz.questions[i];
    if (!q.questionText || !q.questionText.trim()) {
      return `Câu ${i + 1}: nội dung câu hỏi không được để trống.`;
    }
    if (!q.options || q.options.length < 2) {
      return `Câu ${i + 1}: cần ít nhất 2 đáp án.`;
    }
    const correctCount = q.options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
      return `Câu ${i + 1}: phải chọn đúng 1 đáp án đúng.`;
    }
    for (let j = 0; j < q.options.length; j++) {
      if (!q.options[j].content || !q.options[j].content.trim()) {
        return `Câu ${i + 1} đáp án ${OPTION_LETTERS[j] ?? j + 1}: nội dung không được để trống.`;
      }
    }
  }
  return null;
}

export default function OwnerQuizEditor({ quizId, backUrl, backLabel = "Quay lại tài liệu" }) {
  const notification = useNotification();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [saving, setSaving] = useState(false);
  const [hasAttempts, setHasAttempts] = useState(false);
  const dirtyRef = useRef(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!quizId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await quizService.getOwnerQuizEditor(quizId);
        if (cancelled) return;
        const normalized = normalizeLoaded(data);
        setQuiz({
          title: data.title ?? "",
          description: data.description ?? "",
          durationMinutes: data.durationMinutes ?? 10,
          passScorePercent: data.passScorePercent ?? 80,
          questions: normalized,
        });
        setSnapshot(normalizeLoaded(data));
        setHasAttempts(!!data.hasAttempts);
        dirtyRef.current = false;
      } catch (e) {
        if (!cancelled) {
          setLoadError(getApiErrorMessage(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quizId]);

  const updateField = (field, value) => {
    setQuiz((prev) => {
      const next = { ...prev, [field]: value };
      dirtyRef.current = true;
      return next;
    });
  };

  const updateQuestion = (qKey, patch) => {
    setQuiz((prev) => {
      const nextQuestions = prev.questions.map((q) =>
        q.key === qKey ? { ...q, ...patch } : q
      );
      dirtyRef.current = true;
      return { ...prev, questions: nextQuestions };
    });
  };

  const updateOption = (qKey, oKey, patch) => {
    setQuiz((prev) => {
      const nextQuestions = prev.questions.map((q) => {
        if (q.key !== qKey) return q;
        const nextOpts = q.options.map((o) => (o.key === oKey ? { ...o, ...patch } : o));
        return { ...q, options: nextOpts };
      });
      dirtyRef.current = true;
      return { ...prev, questions: nextQuestions };
    });
  };

  const markCorrect = (qKey, oKey) => {
    setQuiz((prev) => {
      const nextQuestions = prev.questions.map((q) => {
        if (q.key !== qKey) return q;
        const nextOpts = q.options.map((o) => ({ ...o, isCorrect: o.key === oKey }));
        return { ...q, options: nextOpts };
      });
      dirtyRef.current = true;
      return { ...prev, questions: nextQuestions };
    });
  };

  const addOption = (qKey) => {
    setQuiz((prev) => {
      const nextQuestions = prev.questions.map((q) => {
        if (q.key !== qKey) return q;
        if (q.options.length >= OPTION_LETTERS.length) return q;
        const next = q.options.map((o) => ({ ...o, isCorrect: false }));
        next.push({
          key: cryptoRandomId(),
          optionId: null,
          content: "",
          isCorrect: false,
          sortOrder: next.length + 1,
        });
        return { ...q, options: next };
      });
      dirtyRef.current = true;
      return { ...prev, questions: nextQuestions };
    });
  };

  const removeOption = (qKey, oKey) => {
    setQuiz((prev) => {
      const nextQuestions = prev.questions.map((q) => {
        if (q.key !== qKey) return q;
        if (q.options.length <= 2) return q;
        const wasCorrect = q.options.find((o) => o.key === oKey)?.isCorrect;
        let next = q.options.filter((o) => o.key !== oKey);
        if (wasCorrect && next.length > 0) {
          next = next.map((o, idx) => ({ ...o, isCorrect: idx === 0, sortOrder: idx + 1 }));
        } else {
          next = next.map((o, idx) => ({ ...o, sortOrder: idx + 1 }));
        }
        return { ...q, options: next };
      });
      dirtyRef.current = true;
      return { ...prev, questions: nextQuestions };
    });
  };

  const addQuestion = () => {
    setQuiz((prev) => {
      const newQ = makeEmptyQuestion(prev.questions.length + 1);
      dirtyRef.current = true;
      return { ...prev, questions: [...prev.questions, newQ] };
    });
  };

  const removeQuestion = (qKey) => {
    setQuiz((prev) => {
      const nextQuestions = prev.questions
        .filter((q) => q.key !== qKey)
        .map((q, idx) => ({ ...q, sortOrder: idx + 1 }));
      dirtyRef.current = true;
      return { ...prev, questions: nextQuestions };
    });
  };

  const moveQuestion = (qKey, direction) => {
    setQuiz((prev) => {
      const idx = prev.questions.findIndex((q) => q.key === qKey);
      if (idx < 0) return prev;
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.questions.length) return prev;
      const copy = prev.questions.slice();
      const [item] = copy.splice(idx, 1);
      copy.splice(target, 0, item);
      dirtyRef.current = true;
      return { ...prev, questions: copy };
    });
  };

  const moveOption = (qKey, oKey, direction) => {
    setQuiz((prev) => {
      const nextQuestions = prev.questions.map((q) => {
        if (q.key !== qKey) return q;
        const idx = q.options.findIndex((o) => o.key === oKey);
        if (idx < 0) return q;
        const target = direction === "up" ? idx - 1 : idx + 1;
        if (target < 0 || target >= q.options.length) return q;
        const copy = q.options.slice();
        const [item] = copy.splice(idx, 1);
        copy.splice(target, 0, item);
        return { ...q, options: copy };
      });
      dirtyRef.current = true;
      return { ...prev, questions: nextQuestions };
    });
  };

  const handleCancel = useCallback(() => {
    if (!snapshot) return;
    setQuiz((prev) => ({
      ...prev,
      title: snapshot.title ?? prev.title,
      description: snapshot.description ?? prev.description,
      durationMinutes: snapshot.durationMinutes ?? prev.durationMinutes,
      passScorePercent: snapshot.passScorePercent ?? prev.passScorePercent,
      questions: snapshot.questions.map((q) => ({
        ...q,
        options: q.options.map((o) => ({ ...o })),
      })),
    }));
    dirtyRef.current = false;
  }, [snapshot]);

  const handleSave = useCallback(async () => {
    if (!quiz) return;
    const err = validateLocal(quiz);
    if (err) {
      notification.error(err);
      return;
    }
    setSaving(true);
    try {
      const payload = toPayload(quiz);
      const res = await quizService.saveOwnerQuizEditor(quizId, payload);
      const normalized = normalizeLoaded(res);
      setQuiz({
        title: res.title ?? "",
        description: res.description ?? "",
        durationMinutes: res.durationMinutes ?? 10,
        passScorePercent: res.passScorePercent ?? 80,
        questions: normalized,
      });
      setSnapshot(normalizeLoaded(res));
      setHasAttempts(!!res.hasAttempts);
      dirtyRef.current = false;
      notification.success("Đã lưu bài đánh giá");
    } catch (e) {
      notification.error(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [quiz, quizId, notification]);

  const renderQuestion = (q, qIndex) => {
    return (
      <div className="oqe-question" key={q.key}>
        <div className="oqe-question-header">
          <span className="oqe-question-number">Câu {qIndex + 1}</span>
          <div className="oqe-question-actions">
            <button
              type="button"
              className="oqe-icon-btn"
              onClick={() => moveQuestion(q.key, "up")}
              disabled={qIndex === 0}
              aria-label="Di chuyển lên"
            >
              ↑
            </button>
            <button
              type="button"
              className="oqe-icon-btn"
              onClick={() => moveQuestion(q.key, "down")}
              disabled={qIndex === quiz.questions.length - 1}
              aria-label="Di chuyển xuống"
            >
              ↓
            </button>
            <button
              type="button"
              className="oqe-icon-btn danger"
              onClick={() => removeQuestion(q.key)}
              aria-label="Xóa câu hỏi"
            >
              ✕
            </button>
          </div>
        </div>
        <textarea
          className="oqe-question-text"
          placeholder="Nội dung câu hỏi"
          value={q.questionText}
          onChange={(e) => updateQuestion(q.key, { questionText: e.target.value })}
          rows={3}
        />
        <div className="oqe-question-meta">
          <label>
            Điểm:
            <input
              type="number"
              min={1}
              className="oqe-points-input"
              value={q.points}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                updateQuestion(q.key, { points: Number.isFinite(v) && v > 0 ? v : 1 });
              }}
            />
          </label>
        </div>
        <div className="oqe-options">
          {q.options.map((o, oIdx) => {
            const letter = OPTION_LETTERS[oIdx] ?? `${oIdx + 1}`;
            return (
              <div className="oqe-option-row" key={o.key}>
                <label className="oqe-correct-radio">
                  <input
                    type="radio"
                    name={`correct-${q.key}`}
                    checked={!!o.isCorrect}
                    onChange={() => markCorrect(q.key, o.key)}
                  />
                  <span className="oqe-option-letter">{letter}</span>
                </label>
                <input
                  type="text"
                  className="oqe-option-input"
                  placeholder={`Nội dung đáp án ${letter}`}
                  value={o.content}
                  onChange={(e) => updateOption(q.key, o.key, { content: e.target.value })}
                />
                <div className="oqe-option-actions">
                  <button
                    type="button"
                    className="oqe-icon-btn small"
                    onClick={() => moveOption(q.key, o.key, "up")}
                    disabled={oIdx === 0}
                    aria-label="Đáp án lên"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="oqe-icon-btn small"
                    onClick={() => moveOption(q.key, o.key, "down")}
                    disabled={oIdx === q.options.length - 1}
                    aria-label="Đáp án xuống"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="oqe-icon-btn small danger"
                    onClick={() => removeOption(q.key, o.key)}
                    disabled={q.options.length <= 2}
                    aria-label="Xóa đáp án"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="oqe-add-option-row">
          <button
            type="button"
            className="oqe-secondary-btn"
            onClick={() => addOption(q.key)}
            disabled={q.options.length >= OPTION_LETTERS.length}
          >
            + Thêm đáp án
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="oqe-container">
        <div className="oqe-content">
          <div className="oqe-card">
            <div className="oqe-loading">Đang tải bài đánh giá…</div>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="oqe-container">
        <div className="oqe-content">
          <div className="oqe-card">
            <div className="oqe-error">
              <p>{loadError}</p>
              {backUrl ? (
                <Link to={backUrl} className="oqe-back-link">
                  {backLabel}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="oqe-container">
        <div className="oqe-content">
          <div className="oqe-card">
            <div className="oqe-empty">Không có dữ liệu bài đánh giá.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="oqe-container">
      <div className="oqe-content">
        <div className="oqe-card">
          <div className="oqe-header">
            <span className="oqe-badge">Chế độ chỉnh sửa (chủ tài liệu)</span>
            <h1 className="oqe-title">{quiz.title || "Bài đánh giá"}</h1>
            {hasAttempts ? (
              <div className="oqe-warning">
                Bài đánh giá đã có lượt làm — không thể xóa câu hỏi/đáp án hiện có; chỉ có thể sửa nội dung, đổi đáp án đúng và sắp xếp lại.
              </div>
            ) : null}
          </div>

          <div className="oqe-meta-section">
            <label className="oqe-meta-field">
              <span>Tiêu đề</span>
              <input
                type="text"
                value={quiz.title}
                onChange={(e) => updateField("title", e.target.value)}
                maxLength={255}
              />
            </label>
            <label className="oqe-meta-field">
              <span>Mô tả</span>
              <textarea
                rows={2}
                value={quiz.description || ""}
                onChange={(e) => updateField("description", e.target.value)}
              />
            </label>
            <div className="oqe-meta-row">
              <label className="oqe-meta-field inline">
                <span>Thời gian (phút)</span>
                <input
                  type="number"
                  min={1}
                  value={quiz.durationMinutes}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    updateField("durationMinutes", Number.isFinite(v) && v > 0 ? v : 1);
                  }}
                />
              </label>
              <label className="oqe-meta-field inline">
                <span>Điểm cần đạt (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={quiz.passScorePercent}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    updateField("passScorePercent", Number.isFinite(v) && v >= 0 ? v : 0);
                  }}
                />
              </label>
            </div>
          </div>

          <div className="oqe-questions">
            {quiz.questions.map((q, idx) => renderQuestion(q, idx))}
          </div>

          <div className="oqe-add-question-row">
            <button type="button" className="oqe-secondary-btn" onClick={addQuestion}>
              + Thêm câu hỏi
            </button>
          </div>

          <div className="oqe-footer">
            <button
              type="button"
              className="oqe-save-btn"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Đang lưu…" : "Lưu thay đổi"}
            </button>
            <button
              type="button"
              className="oqe-cancel-btn"
              onClick={handleCancel}
              disabled={saving || !dirtyRef.current}
            >
              Hủy thay đổi
            </button>
            {backUrl ? (
              <Link to={backUrl} className="oqe-back-link">
                {backLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}