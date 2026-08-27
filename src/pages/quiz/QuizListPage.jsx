import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, ListIcon } from "../../components/icons";
import { documentService, getApiErrorMessage } from "../../services/api";
import { useNotification } from "../../context/NotificationContext";
import { useAuth } from "../../context/AuthContext";
import "../../styles/quizListPage.css";

export default function QuizListPage() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const notification = useNotification();
  const { user } = useAuth();

  const [docDetail, setDocDetail] = useState(null);
  const [showMustBuyModal, setShowMustBuyModal] = useState(false);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [detail, quizPage] = await Promise.all([
          documentService.getDocumentById(documentId),
          documentService.getDocumentQuizzes(documentId, page, 10),
        ]);
        if (cancelled) return;
        setDocDetail(detail || null);
        setItems(quizPage?.items || []);
        setTotalPages(Number(quizPage?.totalPages || 0));
        setTotalItems(Number(quizPage?.totalItems || 0));
      } catch (e) {
        if (!cancelled) notification.error(getApiErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [documentId, page, notification]);

  const canPrev = page > 0;
  const canNext = page + 1 < totalPages;

  const info = docDetail?.documentInfo;
  const isPaid = info?.isPaid === true;
  const isOwner = user?.id && info?.userId && String(user.id) === String(info.userId);
  const hasAccess = info?.hasAccess === true;
  const canAccessQuiz = !isPaid || isOwner || hasAccess;

  const handlePreviewClick = (quizId) => {
    if (!canAccessQuiz) {
      setShowMustBuyModal(true);
      return;
    }
    navigate(`/quiz/${quizId}/preview?documentId=${documentId}`);
  };

  return (
    <div className="quiz-list-page-container">
      <main className="quiz-list-page-content">
        <nav className="breadcrumb">
          <Link to="/" className="breadcrumb-item">
            Trang chủ
          </Link>
          <ChevronRightIcon size={12} color="#64748b" />
          <Link to={`/documents/${documentId}`} className="breadcrumb-item">
            Chi tiết tài liệu
          </Link>
          <ChevronRightIcon size={12} color="#64748b" />
          <span className="breadcrumb-item active">Bài đánh giá</span>
        </nav>

        <header className="quiz-list-header">
          <h1>Bài đánh giá của tài liệu</h1>
          <p>{info?.title || "—"}</p>
        </header>

        {loading ? (
          <div className="quiz-list-loading">Đang tải bài đánh giá…</div>
        ) : items.length === 0 ? (
          <div className="quiz-list-empty">Chưa có bài đánh giá</div>
        ) : (
          <>
            <div className="quiz-list-grid">
              {items.map((quiz) => (
                <article key={quiz.quizId} className="quiz-list-card">
                  <h3>{quiz.title}</h3>
                  <p>{quiz.description || "Không có mô tả."}</p>
                  <div className="quiz-list-meta">
                    <span>
                      <ListIcon size={14} /> {quiz.totalQuestions ?? 0} câu hỏi
                    </span>
                    <span>
                      <ClockIcon size={14} /> {quiz.durationMinutes ?? "—"} phút
                    </span>
                    <span>Điểm đạt: {quiz.passScorePercent ?? 0}%</span>
                  </div>
                  <button
                    type="button"
                    className="quiz-list-preview-btn"
                    onClick={() => handlePreviewClick(quiz.quizId)}
                  >
                    Xem preview
                  </button>
                </article>
              ))}
            </div>

            <div className="quiz-list-pagination">
              <div className="entries-info">
                Trang {totalPages > 0 ? page + 1 : 0} / {totalPages} • {totalItems} bài đánh giá
              </div>
              <div className="pagination-controls">
                <button
                  type="button"
                  className="page-btn"
                  disabled={!canPrev}
                  onClick={() => canPrev && setPage((p) => p - 1)}
                >
                  <ChevronLeftIcon size={12} />
                </button>
                <button className="page-btn active" type="button">
                  {totalPages > 0 ? page + 1 : 0}
                </button>
                <button
                  type="button"
                  className="page-btn"
                  disabled={!canNext}
                  onClick={() => canNext && setPage((p) => p + 1)}
                >
                  <ChevronRightIcon size={12} />
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Modal thông báo cần mua tài liệu để làm bài tập */}
      {showMustBuyModal && (
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
          onClick={() => setShowMustBuyModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "420px",
              background: "#FFFFFF",
              borderRadius: "18px",
              padding: "28px 24px 24px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "#FEF3C7",
                color: "#D97706",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>

            <h3
              style={{
                margin: "0 0 10px",
                fontSize: "18px",
                fontWeight: "700",
                color: "#0F172A",
              }}
            >
              Cần mua tài liệu
            </h3>

            <p
              style={{
                margin: "0 0 24px",
                fontSize: "14px",
                color: "#64748B",
                lineHeight: "1.6",
              }}
            >
              Bạn cần mua tài liệu này để làm bài tập trắc nghiệm.
            </p>

            <div
              style={{
                display: "flex",
                gap: "12px",
                width: "100%",
                justifyContent: "center",
              }}
            >
              <button
                type="button"
                className="cmp-btn"
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: "10px",
                  border: "1px solid #CBD5E1",
                  background: "#F8FAFC",
                  color: "#475569",
                  fontWeight: "600",
                  cursor: "pointer",
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                }}
                onClick={() => setShowMustBuyModal(false)}
              >
                Đóng
              </button>

              <button
                type="button"
                className="cmp-btn"
                style={{
                  flex: 1.3,
                  padding: "10px 16px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#2563EB",
                  color: "#FFFFFF",
                  fontWeight: "600",
                  cursor: "pointer",
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
                onClick={() => {
                  setShowMustBuyModal(false);
                  navigate(`/documents/${documentId}`);
                }}
              >
                Xem tài liệu để mua
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
