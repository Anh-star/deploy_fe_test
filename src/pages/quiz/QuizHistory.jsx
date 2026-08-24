import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  LayoutIcon,
  MonitorIcon,
  NetworkIcon,
  DatabaseIcon,
  FilterIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  ShieldIcon,
  StarIcon,
  ClockIcon
} from "../../components/icons";
import { getApiErrorMessage, quizService } from "../../services/api";
import Pagination from "../../components/common/Pagination";
import "../../styles/quizHistory.css";

const PAGE_SIZE = 10;

const QUIZ_ICONS = [LayoutIcon, MonitorIcon, NetworkIcon, DatabaseIcon];

function normalizeItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    attemptId: raw.attemptId ?? raw.attempt_id,
    quizId: raw.quizId ?? raw.quiz_id,
    quizTitle: raw.quizTitle ?? raw.quiz_title ?? "",
    attemptNumber: raw.attemptNumber ?? raw.attempt_number,
    startTime: raw.startTime ?? raw.start_time ?? raw.attemptDate,
    score: raw.score,
    maxScore: raw.maxScore ?? raw.max_score,
    scorePercent: raw.scorePercent ?? raw.score_percent,
    status: raw.status ?? "",
    totalTimeSpentSeconds: raw.totalTimeSpentSeconds ?? raw.total_time_spent,
    rankingPercent: raw.rankingPercent ?? raw.ranking_percent,
    rankingLabel: raw.rankingLabel ?? raw.ranking_label,
    progressPercent: raw.progressPercent ?? raw.progress_percent,
    level: raw.level
  };
}

function formatAttemptDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function resolveRowUi(item) {
  const st = String(item.status || "").toUpperCase();
  const inProgress = st === "IN_PROGRESS";
  const passed = st === "PASSED";
  const displayStatus = passed ? "Đạt" : "Chưa đạt";
  const isPassBadge = passed;

  let scoreText = "—";
  if (!inProgress && item.score != null && item.maxScore != null) {
    const s = Number(item.score);
    const m = Number(item.maxScore);
    if (!Number.isNaN(s) && !Number.isNaN(m)) {
      const si = Number.isInteger(s) ? String(s) : s.toFixed(1);
      const mi = Number.isInteger(m) ? String(m) : m.toFixed(1);
      scoreText = `${si}/${mi}`;
    }
  }

  return { displayStatus, isPassBadge, scoreText, inProgress };
}

function QuizIcon({ index, size }) {
  const Icon = QUIZ_ICONS[index % QUIZ_ICONS.length];
  return <Icon size={size} />;
}

export default function QuizHistory() {
  const [page, setPage] = useState(1); // 1-based
  const [items, setItems] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const bgRefreshInFlightRef = useRef(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent && bgRefreshInFlightRef.current) return;
    if (silent) bgRefreshInFlightRef.current = true;

    if (!silent) {
      setLoading(true);
      setError("");
    }

    try {
      const data = await quizService.getQuizHistory({ page: page - 1, size: PAGE_SIZE });
      const rawItems = Array.isArray(data?.items) ? data.items : [];
      setItems(rawItems.map(normalizeItem).filter(Boolean));
      setTotalPages(Number(data?.totalPages) || 0);
      setTotalItems(Number(data?.totalItems) || 0);
      setSummary(data?.summary ?? null);
    } catch (e) {
      if (!silent) {
        setItems([]);
        setTotalPages(0);
        setTotalItems(0);
        setSummary(null);
        setError(getApiErrorMessage(e));
      }
      // Silent refresh failures: keep existing data, silently ignore
    } finally {
      if (silent) bgRefreshInFlightRef.current = false;
      else setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load({ silent: false });
  }, [load]);

  const fromItem = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toItem = Math.min(page * PAGE_SIZE, totalItems);

  const passRateText =
    summary?.passRatePercent != null && Number.isFinite(Number(summary.passRatePercent))
      ? `${Math.round(Number(summary.passRatePercent))}%`
      : "—";

  const avgScoreText =
    summary?.averageScore != null && Number.isFinite(Number(summary.averageScore))
      ? Number(summary.averageScore).toFixed(1)
      : "—";

  const totalMinutes = summary?.totalTimeSpentMinutes != null
    ? Number(summary.totalTimeSpentMinutes)
    : 0;
  const totalTimeText = `${Number.isFinite(totalMinutes) ? totalMinutes : 0} phút`;

  return (
    <div className="quiz-history-container">
      <main className="quiz-history-content">
        <header className="quiz-history-header">
          <div className="title-section">
            <h1>Lịch sử làm bài đánh giá</h1>
            <p className="subtitle">Xem lại kết quả và chi tiết các bài kiểm tra bạn đã hoàn thành.</p>
          </div>
          <button type="button" className="filter-btn">
            <FilterIcon size={16} />
            Bộ lọc
          </button>
        </header>

        <div className="history-table-container">
          <table className="history-table">
            <thead>
              <tr>
                <th>TÊN BÀI ĐÁNH GIÁ</th>
                <th>ĐIỂM SỐ</th>
                <th>NGÀY LÀM BÀI</th>
                <th>TRẠNG THÁI</th>
                <th>HÀNH ĐỘNG</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#64748b" }}>
                    Đang tải…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#ef4444" }}>
                    {error}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#64748b" }}>
                    Chưa có lịch sử làm bài.
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const { displayStatus, isPassBadge, scoreText } = resolveRowUi(item);
                  const title =
                    item.quizTitle +
                    (item.attemptNumber != null ? ` · Lần ${item.attemptNumber}` : "");
                  return (
                    <tr key={item.attemptId || idx}>
                      <td>
                        <div className="quiz-name-cell">
                          <div className="quiz-icon-wrapper">
                            <QuizIcon index={idx} size={20} />
                          </div>
                          <span>{title}</span>
                        </div>
                      </td>
                      <td className="score-cell">{scoreText}</td>
                      <td>{formatAttemptDate(item.startTime)}</td>
                      <td>
                        <div className={`status-badge ${isPassBadge ? "pass" : "fail"}`}>
                          {isPassBadge ? (
                            <CheckCircleIcon size={14} />
                          ) : (
                            <XCircleIcon size={14} />
                          )}
                          {displayStatus}
                        </div>
                      </td>
                      <td>
                        <Link
                          to={`/quiz/result/${item.attemptId}`}
                          className="action-link"
                        >
                          Xem chi tiết
                          <ChevronRightIcon size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="table-footer">
            <div className="entries-info">
              Hiển thị {fromItem}-{toItem} trên tổng số {totalItems} bài
            </div>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </div>

        <div className="summary-cards">
          <div className="summary-card pass-rate">
            <div className="card-icon-container">
              <ShieldIcon size={24} />
            </div>
            <div className="card-content">
              <span className="card-label">TỶ LỆ ĐẠT</span>
              <span className="card-value">{passRateText}</span>
              <p className="card-desc">Cao hơn 12% so với tháng trước</p>
            </div>
          </div>

          <div className="summary-card average-score">
            <div className="card-icon-container">
              <StarIcon size={24} />
            </div>
            <div className="card-content">
              <span className="card-label">ĐIỂM TRUNG BÌNH</span>
              <span className="card-value">{avgScoreText}</span>
              <p className="card-desc">Dựa trên tất cả các bài kiểm tra</p>
            </div>
          </div>

          <div className="summary-card total-time">
            <div className="card-icon-container">
              <ClockIcon size={24} />
            </div>
            <div className="card-content">
              <span className="card-label">TỔNG THỜI GIAN</span>
              <span className="card-value">{totalTimeText}</span>
              <p className="card-desc">Đã dành cho việc ôn luyện</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
