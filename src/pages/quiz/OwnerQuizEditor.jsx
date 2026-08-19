import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getApiErrorMessage, quizService } from "../../services/api";
import { useNotification } from "../../context/NotificationContext";
import "../../styles/ownerQuizEditor.css";

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2, 11)}-${Date.now()}`;
}

function readBool(v) {
  if (v === true || v === "true" || v === 1 || v === "1") return true;
  return Boolean(v);
}

/**
 * Read {@code isCorrect} defensively. The wire contract on the BE is
 * {@code "isCorrect"} but the FE is also resilient to the legacy
 * {@code "correct"} key (e.g. when a stale FE build is talking to a
 * freshly-deployed BE that emits the canonical name).
 */
function pickIsCorrect(o) {
  if (!o) return false;
  if (o.isCorrect !== undefined) return readBool(o.isCorrect);
  if (o.correct !== undefined) return readBool(o.correct);
  return false;
}

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

function cloneServerQuestion(q, sortOrder) {
  return {
    key: cryptoRandomId(),
    questionId: q.questionId ?? null,
    questionText: q.questionText ?? "",
    explanation: q.explanation ?? "",
    points: q.points ?? 1,
    sortOrder,
    options: (q.options || []).map((o, idx) => ({
      key: cryptoRandomId(),
      optionId: o.optionId ?? null,
      content: o.content ?? "",
      isCorrect: pickIsCorrect(o),
      sortOrder: o.sortOrder ?? idx + 1,
    })),
  };
}

function normalizeQuestions(loaded) {
  const sortedQuestions = (loaded.questions || [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  return sortedQuestions.map((q, qIdx) => cloneServerQuestion(q, qIdx + 1));
}

function buildEditorState(data) {
  return {
    title: data.title ?? "",
    description: data.description ?? "",
    durationMinutes: data.durationMinutes ?? 10,
    passScorePercent: data.passScorePercent ?? 80,
    questions: normalizeQuestions(data),
  };
}

function deepClone(value) {
  if (value === null || typeof value !== "object") return value;
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
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
  const [isEditing, setIsEditing] = useState(false);
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
        const next = buildEditorState(data);
        setQuiz(deepClone(next));
        setSnapshot(deepClone(next));
        setHasAttempts(!!data.hasAttempts);
        setIsEditing(false);
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
    if (!isEditing) return;
    setQuiz((prev) => {
      const next = { ...prev, [field]: value };
      dirtyRef.current = true;
      return next;
    });
  };

  const updateQuestion = (qKey, patch) => {
    if (!isEditing) return;
    setQuiz((prev) => {
      const nextQuestions = prev.questions.map((q) =>
        q.key === qKey ? { ...q, ...patch } : q
      );
      dirtyRef.current = true;
      return { ...prev, questions: nextQuestions };
    });
  };

  const updateOption = (qKey, oKey, patch) => {
    if (!isEditing) return;
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
    if (!isEditing) return;
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
    if (!isEditing) return;
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
    if (!isEditing) return;
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
    if (!isEditing) return;
    setQuiz((prev) => {
      const newQ = makeEmptyQuestion(prev.questions.length + 1);
      dirtyRef.current = true;
      return { ...prev, questions: [...prev.questions, newQ] };
    });
  };

  const removeQuestion = (qKey) => {
    if (!isEditing) return;
    setQuiz((prev) => {
      const nextQuestions = prev.questions
        .filter((q) => q.key !== qKey)
        .map((q, idx) => ({ ...q, sortOrder: idx + 1 }));
      dirtyRef.current = true;
      return { ...prev, questions: nextQuestions };
    });
  };

  const moveQuestion = (qKey, direction) => {
    if (!isEditing) return;
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
    if (!isEditing) return;
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

  const handleEnterEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleCancel = useCallback(() => {
    if (!snapshot) {
      setIsEditing(false);
      return;
    }
    setQuiz(deepClone(snapshot));
    dirtyRef.current = false;
    setIsEditing(false);
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
      const next = buildEditorState(res);
      setQuiz(deepClone(next));
      setSnapshot(deepClone(next));
      setHasAttempts(!!res.hasAttempts);
      dirtyRef.current = false;
      setIsEditing(false);
      notification.success("Đã lưu bài đánh giá");
    } catch (e) {
      notification.error(getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [quiz, quizId, notification]);

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
            <div className="oqe-header-top">
              <span
                className={`oqe-badge ${isEditing ? "oqe-badge-edit" : "oqe-badge-view"}`}
              >
                {isEditing ? "Chế độ chỉnh sửa (chủ tài liệu)" : "Chế độ xem trước"}
              </span>
              {!isEditing ? (
                <button
                  type="button"
                  className="oqe-edit-btn"
                  onClick={handleEnterEdit}
                >
                  Chỉnh sửa
                </button>
              ) : null}
            </div>
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
                readOnly={!isEditing}
                maxLength={255}
              />
            </label>
            <label className="oqe-meta-field">
              <span>Mô tả</span>
              <textarea
                rows={2}
                value={quiz.description || ""}
                onChange={(e) => updateField("description", e.target.value)}
                readOnly={!isEditing}
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
                  readOnly={!isEditing}
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
                  readOnly={!isEditing}
                />
              </label>
            </div>
          </div>

          <div className="oqe-questions">
            {quiz.questions.map((q, idx) => {
              const correctIndex = q.options.findIndex((o) => o.isCorrect);
              return (
                <div className="oqe-question" key={q.key}>
                  <div className="oqe-question-header">
                    <span className="oqe-question-number">Câu {idx + 1}</span>
                    {isEditing ? (
                      <div className="oqe-question-actions">
                        <button
                          type="button"
                          className="oqe-icon-btn"
                          onClick={() => moveQuestion(q.key, "up")}
                          disabled={idx === 0}
                          title="Di chuyển lên"
                          aria-label="Di chuyển lên"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="oqe-icon-btn"
                          onClick={() => moveQuestion(q.key, "down")}
                          disabled={idx === quiz.questions.length - 1}
                          title="Di chuyển xuống"
                          aria-label="Di chuyển xuống"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="oqe-icon-btn danger"
                          onClick={() => removeQuestion(q.key)}
                          title="Xóa câu hỏi"
                          aria-label="Xóa câu hỏi"
                        >
                          ✕
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <textarea
                    className="oqe-question-text"
                    placeholder="Nội dung câu hỏi"
                    value={q.questionText}
                    onChange={(e) => updateQuestion(q.key, { questionText: e.target.value })}
                    rows={3}
                    readOnly={!isEditing}
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
                        readOnly={!isEditing}
                      />
                    </label>
                  </div>
                  <div className="oqe-options">
                    {q.options.map((o, oIdx) => {
                      const letter = OPTION_LETTERS[oIdx] ?? `${oIdx + 1}`;
                      const isCorrect = !!o.isCorrect;
                      return (
                        <div
                          className={`oqe-option-row ${isCorrect ? "is-correct" : ""} ${
                            !isEditing ? "is-locked" : ""
                          }`}
                          key={o.key}
                        >
                          <label className="oqe-correct-radio">
                            <input
                              type="radio"
                              name={`correct-${q.key}`}
                              checked={isCorrect}
                              onChange={() => markCorrect(q.key, o.key)}
                              disabled={!isEditing}
                              title={
                                isEditing
                                  ? "Đánh dấu đáp án đúng"
                                  : "Bấm Chỉnh sửa để thay đổi"
                              }
                            />
                            <span className="oqe-option-letter">{letter}</span>
                          </label>
                          <input
                            type="text"
                            className="oqe-option-input"
                            placeholder={`Nội dung đáp án ${letter}`}
                            value={o.content}
                            onChange={(e) => updateOption(q.key, o.key, { content: e.target.value })}
                            readOnly={!isEditing}
                          />
                          {isCorrect ? (
                            <span className="oqe-correct-badge">Đáp án đúng</span>
                          ) : null}
                          {isEditing ? (
                            <div className="oqe-option-actions">
                              <button
                                type="button"
                                className="oqe-icon-btn small"
                                onClick={() => moveOption(q.key, o.key, "up")}
                                disabled={oIdx === 0}
                                title="Đáp án lên"
                                aria-label="Đáp án lên"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="oqe-icon-btn small"
                                onClick={() => moveOption(q.key, o.key, "down")}
                                disabled={oIdx === q.options.length - 1}
                                title="Đáp án xuống"
                                aria-label="Đáp án xuống"
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                className="oqe-icon-btn small danger"
                                onClick={() => removeOption(q.key, o.key)}
                                disabled={q.options.length <= 2}
                                title="Xóa đáp án"
                                aria-label="Xóa đáp án"
                              >
                                ✕
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  {isEditing ? (
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
                  ) : null}
                </div>
              );
            })}
          </div>

          {isEditing ? (
            <div className="oqe-add-question-row">
              <button type="button" className="oqe-secondary-btn" onClick={addQuestion}>
                + Thêm câu hỏi
              </button>
            </div>
          ) : null}

          <div className="oqe-footer">
            {isEditing ? (
              <>
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
                  disabled={saving}
                >
                  Hủy thay đổi
                </button>
              </>
            ) : null}
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