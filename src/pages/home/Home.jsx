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

function formatDateDDMMYYYY(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
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
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        background: "#F5F7F8",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1280px",
          padding: "32px",
          margin: "0 auto",
          paddingTop: "24px",
          boxSizing: "border-box",
          flexDirection: "column",
          justifyContent: "flex-start",
          alignItems: "flex-start",
          gap: "48px",
          display: "flex",
        }}
      >
        {/* HERO (homepage search) */}
        <div
          style={{
            alignSelf: "stretch",
            minHeight: "400px",
            padding: "32px",
            position: "relative",
            background: "#0F172A",
            overflow: "hidden",
            borderRadius: "24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: "1216px",
              height: "404px",
              position: "absolute",
              left: 0,
              top: 0,
              opacity: 0.4,
              mixBlendMode: "overlay",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                background:
                  "linear-gradient(174deg, #007BFF 0%, rgba(0,123,255,0) 50%, #9333EA 100%)",
              }}
            />
          </div>

          <div
            style={{
              width: "768px",
              maxWidth: "768px",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
              paddingTop: "24px",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1,
            }}
          >
            <div style={{ textAlign: "center", width: "100%" }}>
              <div
                style={{
                  alignItems: "center",
                  gap: "4px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    color: "white",
                    fontSize: "60px",
                    fontWeight: 900,
                    lineHeight: "1.05",
                  }}
                >
                  Kho tàng tri thức
                </span>
                <span
                  style={{
                    color: "#007BFF",
                    fontSize: "60px",
                    fontWeight: 900,
                    lineHeight: "1.05",
                  }}
                >
                  Phong phú
                </span>
                <span
                  style={{
                    color: "white",
                    fontSize: "60px",
                    fontWeight: 900,
                    lineHeight: "1.05",
                  }}
                >
                  Chia sẻ trong cộng đồng
                </span>
              </div>
            </div>

            <div
              style={{
                textAlign: "center",
                color: "#E2E8F0",
                fontSize: "18px",
                fontWeight: 500,
                lineHeight: "28px",
                width: "100%",
              }}
            >
              Tìm kiếm, tải xuống và chia sẻ hàng ngàn tài liệu về học thuật, kinh tế và công nghệ 
              <br />
              hoàn toàn miễn phí!
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
              style={{
                width: "672px",
                maxWidth: "672px",
                padding: "8px",
                background: "white",
                borderRadius: "16px",
                position: "relative",
                display: "flex",
                gap: "12px",
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "transparent",
                  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
                  borderRadius: "16px",
                }}
              />

              <div
                style={{
                  flex: 1,
                  padding: "0 16px",
                  borderRight: "1px solid #F1F5F9",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  zIndex: 1,
                }}
              >
                <div style={{ color: "#94A3B8" }}>
                  <SearchIcon size={18} />
                </div>
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Nhập tên tài liệu, chủ đề hoặc từ khóa..."
                  style={{
                    flex: 1,
                    padding: "14px 12px",
                    color: "#0F172A",
                    fontSize: "16px",
                    border: "none",
                    outline: "none",
                    background: "transparent",
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  padding: "12px 32px",
                  background: "#007BFF",
                  borderRadius: "12px",
                  color: "white",
                  fontSize: "16px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  cursor: "pointer",
                  zIndex: 1,
                }}
              >
                Tìm kiếm
              </button>
            </form>
          </div>
        </div>

        {/* STATS */}
        <div style={{ alignSelf: "stretch", display: "flex", gap: "16px", justifyContent: "center", alignItems: "flex-start" }}>
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
              style={{
                flex: "1 1 0",
                padding: "24px",
                background: "white",
                boxShadow: "0px 1px 2px rgba(0,0,0,0.05)",
                borderRadius: "16px",
                outline: "1px solid #F1F5F9",
                outlineOffset: "-1px",
                display: "flex",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <div style={{ padding: "12px", background: item.iconBg, borderRadius: "12px" }}>
                <div style={{ color: item.iconColor }}>{item.icon}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ color: "#64748B", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px" }}>
                  {item.label}
                </div>
                <div style={{ color: "#0F172A", fontSize: "24px", fontWeight: 700, lineHeight: "32px" }}>
                  {loading ? "…" : formatCompactNumber(item.value)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <Categories />

        {/* LATEST DOCUMENTS */}
        <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ color: "#0F172A", fontSize: "24px", fontWeight: 700 }}>
                Tài liệu mới nhất
              </div>
              <div style={{ color: "#64748B", fontSize: "14px" }}>
                Được cộng đồng cập nhật liên tục
              </div>
            </div>

            <div
              style={{ display: "flex", alignItems: "center", cursor: "pointer" }}
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
            <div style={{ display: "flex", gap: "24px" }}>
              {(latest || []).map((doc) => (
                <div
                  key={doc.id}
                  role="button"
                  tabIndex={0}
                  className="document-card--interactive"
                  onClick={() => doc.id != null && navigate(`/documents/${doc.id}`)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && doc.id != null && navigate(`/documents/${doc.id}`)
                  }
                  style={{
                    flex: 1,
                    background: "white",
                    borderRadius: "16px",
                    border: "1px solid #F1F5F9",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{ height: "192px", position: "relative", background: "#E2E8F0", display: "flex", justifyContent: "center", alignItems: "center" }}
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

                  <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "16px", ...lineClampTitle }}>
                      {doc.title}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#64748B" }}>
                      <span>{getDocumentUploaderDisplayName(doc) || "Không xác định"}</span>
                      <span>•</span>
                      <span>{formatDateDDMMYYYY(doc.createdAt)}</span>
                    </div>

                    <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <EyeIcon size={25} color="#64748B" />
                        <span
                          style={{
                            color: "#64748B",
                            fontSize: "16px",
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
        <div style={{ alignSelf: "stretch", flexDirection: "column", justifyContent: "flex-start", alignItems: "flex-start", gap: "24px", display: "flex" }}>
          <div style={{ alignSelf: "stretch", justifyContent: "space-between", alignItems: "center", display: "inline-flex" }}>
            <div style={{ flexDirection: "column", justifyContent: "flex-start", alignItems: "flex-start", display: "inline-flex" }}>
              <div style={{ alignSelf: "stretch", flexDirection: "column", justifyContent: "flex-start", alignItems: "flex-start", display: "flex" }}>
                <div style={{ width: "235px", height: "32px", justifyContent: "center", display: "flex", flexDirection: "column", color: "#0F172A", fontSize: "24px", fontWeight: 700, lineHeight: "32px" }}>
                  Tài liệu phổ biến
                </div>
              </div>
              <div style={{ width: "367px", flexDirection: "column", justifyContent: "flex-start", alignItems: "flex-start", display: "flex" }}>
                <div style={{ width: "326px", height: "20px", justifyContent: "center", display: "flex", flexDirection: "column", color: "#64748B", fontSize: "14px", fontWeight: 400, lineHeight: "20px" }}>
                  Được cộng đồng quan tâm nhiều nhất tuần này
                </div>
              </div>
            </div>

            <div style={{ justifyContent: "flex-start", alignItems: "flex-start", gap: "7.99px", display: "flex" }}>
              <button
                type="button"
                disabled={!canPrevTrending}
                onClick={() => canPrevTrending && setTrendingIndex((i) => Math.max(0, i - 1))}
                style={{
                  padding: "8px",
                  borderRadius: "8px",
                  outline: "1px solid #E2E8F0",
                  outlineOffset: "-1px",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  display: "inline-flex",
                  border: "none",
                  background: "white",
                  cursor: canPrevTrending ? "pointer" : "not-allowed",
                  opacity: canPrevTrending ? 1 : 0.5,
                }}
              >
                <div style={{ justifyContent: "center", alignItems: "flex-start", display: "inline-flex" }}>
                  <div style={{ color: "#0F172A" }}><ChevronLeftIcon size={14} /></div>
                </div>
              </button>

              <button
                type="button"
                disabled={!canNextTrending}
                onClick={() => canNextTrending && setTrendingIndex((i) => i + 1)}
                style={{
                  padding: "8px",
                  borderRadius: "8px",
                  outline: "1px solid #E2E8F0",
                  outlineOffset: "-1px",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  display: "inline-flex",
                  border: "none",
                  background: "white",
                  cursor: canNextTrending ? "pointer" : "not-allowed",
                  opacity: canNextTrending ? 1 : 0.5,
                }}
              >
                <div style={{ justifyContent: "center", alignItems: "flex-start", display: "inline-flex" }}>
                  <div style={{ color: "#0F172A" }}><ChevronRightIcon size={14} /></div>
                </div>
              </button>
            </div>
          </div>

          <div style={{ alignSelf: "stretch", justifyContent: "center", alignItems: "flex-start", gap: "24px", display: "inline-flex" }}>
            {trendingVisible.map((doc) => {
              const badge = fileTypeBadgeStyle(doc.fileType);
              return (
                <div
                  key={doc.id}
                  role="button"
                  tabIndex={0}
                  className="document-card--interactive"
                  onClick={() => doc.id != null && navigate(`/documents/${doc.id}`)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && doc.id != null && navigate(`/documents/${doc.id}`)
                  }
                  style={{
                    width: "389.33px",
                    alignSelf: "stretch",
                    padding: "16px",
                    background: "white",
                    borderRadius: "16px",
                    outline: "1px solid #F1F5F9",
                    outlineOffset: "-1px",
                    justifyContent: "flex-start",
                    alignItems: "flex-start",
                    gap: "16px",
                    display: "flex",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: "96px",
                      height: "128px",
                      background: "#F1F5F9",
                      overflow: "hidden",
                      borderRadius: "12px",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      display: "inline-flex",
                      position: "relative",
                    }}
                  >
                    <img
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      src={getDocumentThumbnailUrl(doc)}
                      alt={doc.title || "thumbnail"}
                      onError={onDocumentThumbnailError}
                    />
                    <div
                      style={{
                        padding: "4px 8px",
                        left: "8px",
                        top: "8px",
                        position: "absolute",
                        background: badge.bg,
                        borderRadius: "4px",
                        color: "white",
                        fontSize: "10px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        lineHeight: "15px",
                      }}
                    >
                      {badge.label}
                    </div>
                  </div>

                  <div style={{ width: "244px", paddingTop: "4px", paddingBottom: "4px", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-start", display: "inline-flex" }}>
                    <div style={{ width: "233px", flexDirection: "column", justifyContent: "flex-start", alignItems: "flex-start", gap: "4.5px", display: "flex" }}>
                      <div
                        title={doc.categoryName || "DANH MỤC"}
                        style={{
                          maxWidth: "200px",
                          height: "15px",
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
                      <div style={{ alignSelf: "stretch", height: "48px", overflow: "hidden", flexDirection: "column", justifyContent: "flex-start", alignItems: "flex-start", display: "flex" }}>
                        <div
                          title={doc.title}
                          style={{
                            alignSelf: "stretch",
                            color: "#0F172A",
                            fontSize: "16px",
                            fontWeight: 700,
                            lineHeight: "24px",
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
                      <div style={{ alignSelf: "stretch", flexDirection: "column", justifyContent: "flex-start", alignItems: "flex-start", display: "flex" }}>
                        <div
                          title={getDocumentUploaderDisplayName(doc) || "Không xác định"}
                          style={{
                            alignSelf: "stretch",
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
                    </div>

                    <div
                      style={{
                        alignSelf: "stretch",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <EyeIcon size={25} color="#64748B" />
                        <span
                          style={{
                            color: "#64748B",
                            fontSize: "16px",
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