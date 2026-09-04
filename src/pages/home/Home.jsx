import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Categories from "../../components/Categories";
import ContributeSection from "../../components/ContributeSection";
import DocumentBookmarkControl from "../../components/common/DocumentBookmarkControl";
import bannerHome from "../../assets/BannerHome.jpg";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentIcon,
  DownloadIcon,
  EyeIcon,
  SearchIcon,
  TrophyIcon,
  UsersIcon,
} from "../../components/icons";
import { useNotification } from "../../context/NotificationContext";
import { homepageService } from "../../services/api";
import {
  getDocumentThumbnailUrl,
  onDocumentThumbnailError,
} from "../../utils/documentThumbnail";
import { getDocumentUploaderDisplayName } from "../../utils/documentUploaderDisplay";
import { formatDateDDMMYYYY } from "../../utils/dateUtils";
import "../../styles/home.css";

const lineClampTitle = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  lineHeight: "24px",
  minHeight: "48px",
};

function formatCompactNumber(value) {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return "0";
  return new Intl.NumberFormat("en", { notation: "compact" }).format(n);
}


function fileTypeBadgeStyle(fileType) {
  const t = String(fileType || "").toUpperCase();
  if (t === "PDF") return { bg: "#EF4444", label: "PDF" };
  if (t === "DOC") return { bg: "#3B82F6", label: "DOC" };
  if (t === "PPTX") return { bg: "#F59E0B", label: "PPTX" };
  return { bg: "#64748B", label: t || "FILE" };
}

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const notification = useNotification();
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [latest, setLatest] = useState([]);
  const [trending, setTrending] = useState([]);
  const [trendingIndex, setTrendingIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [s, l, t] = await Promise.all([
          homepageService.getStatistics(),
          homepageService.getLatestDocuments(4),
          homepageService.getTrendingDocuments(5),
        ]);
        if (cancelled) return;
        setStats(s);
        setLatest(Array.isArray(l) ? l : []);
        setTrending(Array.isArray(t) ? t : []);
        setTrendingIndex(0);
      } catch (e) {
        if (!cancelled) setError(e?.message || "Không thể tải trang chủ.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const trendingVisible = useMemo(() => {
    const items = trending || [];
    return items.slice(trendingIndex, trendingIndex + 3);
  }, [trending, trendingIndex]);

  const canPrevTrending = trendingIndex > 0;
  const canNextTrending = (trending?.length || 0) > trendingIndex + 3;

  return (
    <div className="home-wrapper">
      <div className="home-container">
        {/* HERO (homepage search) */}
        <div className="home-hero">
          <div className="home-hero__bg-gradient" />

          <div className="home-hero__content">
            <div style={{ textAlign: "center", width: "100%" }}>
              <div className="home-hero__title">
                <span>Kho tàng tri thức</span>
                <span className="home-hero__title-accent">Phong phú</span>
                <span>Chia sẻ trong cộng đồng</span>
              </div>
            </div>

            <div className="home-hero__subtitle">
              Tìm kiếm, tải xuống và chia sẻ hàng ngàn tài liệu về học thuật, kinh tế và công nghệ hoàn toàn miễn phí!
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const k = keyword.trim();
                if (k.length > 50) {
                  notification.error("Từ khóa tìm kiếm tối đa 50 ký tự.");
                  return;
                }
                navigate(k ? `/documents?keyword=${encodeURIComponent(k)}` : "/documents");
              }}
              className="home-hero__search-form"
            >
              <div className="home-hero__search-input-wrap">
                <div style={{ color: "#94A3B8", display: "flex", alignItems: "center" }}>
                  <SearchIcon size={18} />
                </div>
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Nhập tên tài liệu, chủ đề hoặc từ khóa..."
                  className="home-hero__search-input"
                />
              </div>

              <button
                type="submit"
                className="home-hero__search-btn"
              >
                Tìm kiếm
              </button>
            </form>
          </div>
        </div>

        {/* STATS */}
        <div className="home-stats-grid">
          {[
            {
              label: "Tài liệu",
              value: stats?.totalApprovedDocuments ?? 0,
              icon: <DocumentIcon size={20} />,
              iconBg: "#EFF6FF",
              iconColor: "#2563EB",
            },
            {
              label: "Thành viên",
              value: stats?.totalActiveUsers ?? 0,
              icon: <UsersIcon size={20} />,
              iconBg: "#F0FDF4",
              iconColor: "#16A34A",
            },
            {
              label: "Lượt tải",
              value: stats?.totalDownloads ?? 0,
              icon: <DownloadIcon size={18} />,
              iconBg: "#FFF7ED",
              iconColor: "#EA580C",
            },
            {
              label: "Đóng góp",
              value: stats?.totalContributors ?? 0,
              icon: <TrophyIcon size={20} />,
              iconBg: "#FAF5FF",
              iconColor: "#9333EA",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="home-stat-card"
            >
              <div className="home-stat-card__icon" style={{ background: item.iconBg }}>
                <div style={{ color: item.iconColor }}>{item.icon}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                <div className="home-stat-card__label">
                  {item.label}
                </div>
                <div className="home-stat-card__val">
                  {loading ? "…" : formatCompactNumber(item.value)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <Categories />

        {/* LATEST DOCUMENTS */}
        <div className="home-latest-wrap">
          <div className="home-section-header">
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div className="home-section-title">
                Tài liệu mới nhất
              </div>
              <div className="home-section-subtitle">
                Được cộng đồng cập nhật liên tục
              </div>
            </div>

            <div
              style={{ display: "flex", alignItems: "center", cursor: "pointer", flexShrink: 0 }}
              onClick={() => navigate("/documents?sort=newest")}
            >
              <div style={{ color: "#007BFF", fontSize: "14px", fontWeight: 600 }}>
                Xem tất cả
              </div>
              <div style={{ paddingLeft: "4px", color: "#007BFF" }}>
                <ChevronRightIcon size={14} />
              </div>
            </div>
          </div>

          {error ? (
            <div style={{ color: "#EF4444", fontSize: "14px" }}>{error}</div>
          ) : (
            <div className="home-latest-grid">
              {(latest || []).map((doc) => (
                <div
                  key={doc.id}
                  role="button"
                  tabIndex={0}
                  className="home-latest-card document-card--interactive"
                  onClick={() => doc.id != null && navigate(`/documents/${doc.id}`)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && doc.id != null && navigate(`/documents/${doc.id}`)
                  }
                >
                  <div
                    style={{ height: "180px", position: "relative", background: "#E2E8F0", display: "flex", justifyContent: "center", alignItems: "center" }}
                  >
                    <img
                      src={getDocumentThumbnailUrl(doc)}
                      alt={doc.title || "thumbnail"}
                      onError={onDocumentThumbnailError}
                      style={{ maxWidth: "100%", maxHeight: "100%", width: "100%", height: "100%", objectFit: "cover" }}
                    />

                    <div
                      style={{
                        position: "absolute",
                        top: "10px",
                        left: "10px",
                        padding: "4px 8px",
                        background: "#6366F1",
                        color: "white",
                        fontSize: "10px",
                        fontWeight: 700,
                        borderRadius: "4px",
                      }}
                    >
                      {doc.categoryName || "Không xác định"}
                    </div>
                  </div>

                  <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "16px", ...lineClampTitle }}>
                      {doc.title}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#64748B" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {getDocumentUploaderDisplayName(doc) || "Không xác định"}
                      </span>
                      <span>•</span>
                      <span style={{ whiteSpace: "nowrap" }}>{formatDateDDMMYYYY(doc.createdAt)}</span>
                    </div>

                    <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <EyeIcon size={22} color="#64748B" />
                        <span
                          style={{
                            color: "#64748B",
                            fontSize: "15px",
                            fontFamily: "Inter",
                            fontWeight: 500,
                          }}
                        >
                          {formatCompactNumber(doc.viewCount)}
                        </span>
                      </div>

                      <DocumentBookmarkControl
                        documentId={doc.id}
                        serverIsBookmarked={doc.isBookmarked}
                        redirectTo={location.pathname + location.search}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <ContributeSection />

        {/* TRENDING DOCUMENTS (popular) */}
        <div className="home-trending-wrap">
          <div className="home-section-header">
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div className="home-section-title">
                Tài liệu phổ biến
              </div>
              <div className="home-section-subtitle">
                Được cộng đồng quan tâm nhiều nhất tuần này
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
              <button
                type="button"
                disabled={!canPrevTrending}
                onClick={() => canPrevTrending && setTrendingIndex((i) => Math.max(0, i - 1))}
                style={{
                  padding: "8px",
                  borderRadius: "8px",
                  border: "1px solid #E2E8F0",
                  display: "inline-flex",
                  justifyContent: "center",
                  alignItems: "center",
                  background: "white",
                  cursor: canPrevTrending ? "pointer" : "not-allowed",
                  opacity: canPrevTrending ? 1 : 0.5,
                }}
              >
                <div style={{ color: "#0F172A" }}><ChevronLeftIcon size={14} /></div>
              </button>

              <button
                type="button"
                disabled={!canNextTrending}
                onClick={() => canNextTrending && setTrendingIndex((i) => i + 1)}
                style={{
                  padding: "8px",
                  borderRadius: "8px",
                  border: "1px solid #E2E8F0",
                  display: "inline-flex",
                  justifyContent: "center",
                  alignItems: "center",
                  background: "white",
                  cursor: canNextTrending ? "pointer" : "not-allowed",
                  opacity: canNextTrending ? 1 : 0.5,
                }}
              >
                <div style={{ color: "#0F172A" }}><ChevronRightIcon size={14} /></div>
              </button>
            </div>
          </div>

          <div className="home-trending-grid">
            {trendingVisible.map((doc) => {
              const badge = fileTypeBadgeStyle(doc.fileType);
              return (
                <div
                  key={doc.id}
                  role="button"
                  tabIndex={0}
                  className="home-trending-card document-card--interactive"
                  onClick={() => doc.id != null && navigate(`/documents/${doc.id}`)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && doc.id != null && navigate(`/documents/${doc.id}`)
                  }
                >
                  <div className="home-trending-card__thumb">
                    <img
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      src={getDocumentThumbnailUrl(doc)}
                      alt={doc.title || "thumbnail"}
                      onError={onDocumentThumbnailError}
                    />
                    <div
                      style={{
                        padding: "3px 6px",
                        left: "6px",
                        top: "6px",
                        position: "absolute",
                        background: badge.bg,
                        borderRadius: "4px",
                        color: "white",
                        fontSize: "9px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        lineHeight: 1.2,
                      }}
                    >
                      {badge.label}
                    </div>
                  </div>

                  <div className="home-trending-card__body">
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                      <div
                        title={doc.categoryName || "DANH MỤC"}
                        style={{
                          maxWidth: "100%",
                          color: "#007BFF",
                          fontSize: "10px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          lineHeight: "15px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {doc.categoryName || "DANH MỤC"}
                      </div>
                      <div style={{ width: "100%", overflow: "hidden" }}>
                        <div
                          title={doc.title}
                          style={{
                            width: "100%",
                            color: "#0F172A",
                            fontSize: "15px",
                            fontWeight: 700,
                            lineHeight: "22px",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            wordBreak: "break-word",
                          }}
                        >
                          {doc.title}
                        </div>
                      </div>
                      <div
                        title={getDocumentUploaderDisplayName(doc) || "Không xác định"}
                        style={{
                          width: "100%",
                          color: "#64748B",
                          fontSize: "12px",
                          fontWeight: 400,
                          lineHeight: "16px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Đăng bởi: {getDocumentUploaderDisplayName(doc) || "Không xác định"}
                      </div>
                    </div>

                    <div
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        marginTop: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <EyeIcon size={22} color="#64748B" />
                        <span
                          style={{
                            color: "#64748B",
                            fontSize: "15px",
                            fontFamily: "Inter",
                            fontWeight: 500,
                          }}
                        >
                          {formatCompactNumber(doc.viewCount)}
                        </span>
                      </div>
                      <DocumentBookmarkControl
                        documentId={doc.id}
                        serverIsBookmarked={doc.isBookmarked}
                        redirectTo={location.pathname + location.search}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}