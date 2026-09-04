import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLoginRequired } from "../context/LoginRequiredModalContext";
import DocumentBookmarkControl from "./common/DocumentBookmarkControl";
import { useNotification } from "../context/NotificationContext";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentIcon,
  EyeIcon,
  GlobeIcon,
  ShieldIcon,
  UsersIcon,
  DownloadIcon,
} from "./icons";
import {
  buildDocumentDownloadName,
  documentService,
  downloadFileViaFetch,
  getApiErrorMessage,
  sidebarService,
} from "../services/api";
import {
  getDocumentThumbnailUrl,
  onDocumentThumbnailError,
} from "../utils/documentThumbnail";
import { getDocumentUploaderDisplayName } from "../utils/documentUploaderDisplay";
import { formatDateDDMMYYYY } from "../utils/dateUtils";
import "../styles/documentsList.css";

const SORT_OPTIONS = [
  { label: "Nhiều lượt tải nhất", value: "downloads" },
  { label: "Nhiều lượt xem nhất", value: "views" },
  { label: "Phổ biến nhất", value: "popular" },
];


function formatCompactNumber(value) {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return "0";
  return new Intl.NumberFormat("en", { notation: "compact" }).format(n);
}

function fileTypeBadge(fileType) {
  const t = String(fileType || "").toUpperCase();
  if (t === "PDF") return { bg: "#EF4444", label: "PDF" };
  if (t === "DOC") return { bg: "#3B82F6", label: "DOC" };
  if (t === "PPTX") return { bg: "#F59E0B", label: "PPTX" };
  return { bg: "#64748B", label: t || "TỆP" };
}

function buildSearchParams({ keyword, categoryId, tagIds, sort, page, size }) {
  const sp = new URLSearchParams();
  if (keyword) sp.set("keyword", keyword);
  if (categoryId) sp.set("categoryId", categoryId);
  (tagIds || []).forEach((id) => sp.append("tagIds", id));
  if (sort) sp.set("sort", sort);
  if (typeof page === "number") sp.set("page", String(page));
  if (typeof size === "number") sp.set("size", String(size));
  return sp;
}

function computePageItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => ({ type: "page", page: i + 1 }));
  }

  const items = [];
  const addPage = (p) => items.push({ type: "page", page: p });
  const addDots = () => items.push({ type: "dots" });

  addPage(1);
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) addDots();
  for (let p = start; p <= end; p += 1) addPage(p);
  if (end < totalPages - 1) addDots();
  addPage(totalPages);

  return items;
}

export default function DocumentsList() {
  const navigate = useNavigate();
  const location = useLocation();
  const notification = useNotification();
  const requestLogin = useLoginRequired();

  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialKeyword = (query.get("keyword") || "").trim();
  const initialSort = query.get("sort") || "downloads";
  const initialCategoryId = query.get("categoryId") || "";
  const initialTagIds = query.getAll("tagIds");
  const initialPage = Number(query.get("page") ?? "0");
  const initialSize = Number(query.get("size") ?? "4");

  const size = Number.isFinite(initialSize) && initialSize > 0 ? initialSize : 4;

  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const [sidebarError, setSidebarError] = useState(null);

  const [pendingCategoryId, setPendingCategoryId] = useState(initialCategoryId);
  const [pendingTagIds, setPendingTagIds] = useState(new Set(initialTagIds));
  const [pendingSort, setPendingSort] = useState(
    SORT_OPTIONS.some((o) => o.value === initialSort) ? initialSort : (initialSort === "newest" ? "newest" : "downloads")
  );
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const [appliedKeyword, setAppliedKeyword] = useState(initialKeyword);
  const [appliedCategoryId, setAppliedCategoryId] = useState(initialCategoryId);
  const [appliedTagIds, setAppliedTagIds] = useState(initialTagIds);
  const [appliedSort, setAppliedSort] = useState(
    SORT_OPTIONS.some((o) => o.value === initialSort) ? initialSort : (initialSort === "newest" ? "newest" : "downloads")
  );
  const [page, setPage] = useState(Number.isFinite(initialPage) && initialPage >= 0 ? initialPage : 0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [totalPages, setTotalPages] = useState(1);

  const isSearchMode = !!appliedKeyword;

  useEffect(() => {
    let cancelled = false;
    async function loadSidebar() {
      try {
        setSidebarLoading(true);
        setSidebarError(null);
        const [c, t] = await Promise.all([
          sidebarService.getCategories(),
          sidebarService.getPopularTags(),
        ]);
        if (cancelled) return;
        setCategories(Array.isArray(c) ? c : []);
        setTags(Array.isArray(t) ? t : []);
      } catch (e) {
        if (!cancelled) setSidebarError(getApiErrorMessage(e));
      } finally {
        if (!cancelled) setSidebarLoading(false);
      }
    }
    loadSidebar();
    return () => {
      cancelled = true;
    };
  }, []);

  async function fetchDocuments({
    nextPage,
    keyword = appliedKeyword,
    categoryId = appliedCategoryId,
    tagIds = appliedTagIds,
    sort = appliedSort,
  }) {
    try {
      setLoading(true);
      setError(null);
      const payload = await documentService.getDocuments({
        keyword: keyword || undefined,
        categoryId: categoryId || undefined,
        tagIds: tagIds?.length ? tagIds : undefined,
        sort: sort || undefined,
        page: nextPage,
        size,
      });

      // openapi: ApiResponsePagedDocumentCard.data = { content, page, size, totalElements, totalPages }
      const content = Array.isArray(payload?.content) ? payload.content : [];
      setDocuments(content);
      setTotalPages(Number(payload?.totalPages) || 1);
      setPage(Number(payload?.page) || 0);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setError(msg);
      notification.error(msg);
      setDocuments([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }

  // Initial load: if we arrive with keyword or sort/page params, fetch immediately.
  useEffect(() => {
    fetchDocuments({ nextPage: page });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep state & data in sync with URL changes (e.g. header search on /documents)
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const nextKeyword = (sp.get("keyword") || "").trim();
    const nextSort = sp.get("sort") || "newest";
    const nextCategoryId = sp.get("categoryId") || "";
    const nextTagIds = sp.getAll("tagIds");
    const nextPageRaw = Number(sp.get("page") ?? "0");
    const nextPage = Number.isFinite(nextPageRaw) && nextPageRaw >= 0 ? nextPageRaw : 0;
    const normalizedSort = SORT_OPTIONS.some((o) => o.value === nextSort) ? nextSort : (nextSort === "newest" ? "newest" : "downloads");

    setPendingCategoryId(nextCategoryId);
    setPendingTagIds(new Set(nextTagIds));
    setPendingSort(normalizedSort);

    setAppliedKeyword(nextKeyword);
    setAppliedCategoryId(nextCategoryId);
    setAppliedTagIds(nextTagIds);
    setAppliedSort(normalizedSort);
    setPage(nextPage);

    fetchDocuments({
      nextPage,
      keyword: nextKeyword,
      categoryId: nextCategoryId,
      tagIds: nextTagIds,
      sort: normalizedSort,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  function applyFilters() {
    const nextTagIds = Array.from(pendingTagIds);
    setAppliedCategoryId(pendingCategoryId);
    setAppliedTagIds(nextTagIds);
    setAppliedSort(pendingSort);
    setPage(0);

    const sp = buildSearchParams({
      keyword: appliedKeyword || undefined,
      categoryId: pendingCategoryId || undefined,
      tagIds: nextTagIds,
      sort: pendingSort,
      page: 0,
      size,
    });
    navigate({ pathname: "/documents", search: `?${sp.toString()}` }, { replace: false });

    fetchDocuments({
      nextPage: 0,
      keyword: appliedKeyword,
      categoryId: pendingCategoryId,
      tagIds: nextTagIds,
      sort: pendingSort,
    });
  }

  function handleSelectCategory(catId) {
    setPendingCategoryId(catId);
    setAppliedCategoryId(catId);
    setPage(0);

    const nextTagIds = Array.from(pendingTagIds);
    const sp = buildSearchParams({
      keyword: appliedKeyword || undefined,
      categoryId: catId || undefined,
      tagIds: nextTagIds,
      sort: pendingSort,
      page: 0,
      size,
    });
    navigate({ pathname: "/documents", search: `?${sp.toString()}` }, { replace: false });

    fetchDocuments({
      nextPage: 0,
      keyword: appliedKeyword,
      categoryId: catId,
      tagIds: nextTagIds,
      sort: pendingSort,
    });
  }

  function goToPage(uiPage) {
    const nextPage = Math.max(0, Math.min(totalPages - 1, uiPage - 1));
    const sp = buildSearchParams({
      keyword: appliedKeyword || undefined,
      categoryId: appliedCategoryId || undefined,
      tagIds: appliedTagIds || [],
      sort: appliedSort,
      page: nextPage,
      size,
    });
    navigate({ pathname: "/documents", search: `?${sp.toString()}` }, { replace: false });
    fetchDocuments({
      nextPage,
      keyword: appliedKeyword,
      categoryId: appliedCategoryId,
      tagIds: appliedTagIds,
      sort: appliedSort,
    });
  }

  async function handleDownload(doc) {
    if (
      !requestLogin({
        redirectTo: location.pathname + location.search,
      })
    )
      return;

    try {
      await documentService.download(doc.id);
      const filePayload = await documentService.getDocumentFileUrl(doc.id);
      const fileUrl = filePayload?.fileUrl;
      if (!fileUrl) {
        const msg = "Không lấy được đường dẫn tải xuống.";
        setError(msg);
        notification.error(msg);
        return;
      }
      const suggestedName = buildDocumentDownloadName(doc.title, doc.fileType);
      await downloadFileViaFetch(fileUrl, suggestedName);
      await fetchDocuments({
        nextPage: page,
        keyword: appliedKeyword,
        categoryId: appliedCategoryId,
        tagIds: appliedTagIds,
        sort: appliedSort,
      });
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setError(msg);
      notification.error(msg);
    }
  }

  const title = isSearchMode ? "Kết quả tìm kiếm" : "Danh sách tài liệu";
  const subtitle = isSearchMode
    ? "Kết quả tìm kiếm của bạn"
    : "Tìm kiếm và tải xuống tài liệu học IT chất lượng cao.";

  const sortLabel = SORT_OPTIONS.find((o) => o.value === pendingSort)?.label || (pendingSort === "newest" ? "Mới nhất" : "Nhiều lượt tải nhất");
  const pageItems = computePageItems(page + 1, totalPages);

  const categoryRows = useMemo(() => {
    const rows = [{ id: "", name: "Tất cả" }, ...(categories || [])];
    const icons = [GlobeIcon, UsersIcon, EyeIcon, DocumentIcon, ShieldIcon];
    return rows.map((c, idx) => ({
      ...c,
      Icon: icons[idx % icons.length],
    }));
  }, [categories]);

  return (
    <div className="docs-page-wrapper">
      <div className="docs-page-container">
        <div className="docs-filter-sidebar">
          <button
            type="button"
            className="docs-filter-mobile-toggle"
            onClick={() => setMobileFilterOpen((v) => !v)}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#007BFF" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Bộ lọc tìm kiếm
            </span>
            <span style={{ fontSize: "13px", color: "#007BFF" }}>
              {mobileFilterOpen ? "Thu gọn ▲" : "Mở rộng ▼"}
            </span>
          </button>

          <div className={`docs-filter-content ${!mobileFilterOpen ? "docs-filter-content--collapsed" : ""}`}>
          <div
            style={{
              alignSelf: "stretch",
              paddingTop: "10px",
              flexDirection: "column",
              justifyContent: "flex-start",
              alignItems: "flex-start",
              gap: "24px",
              display: "flex",
            }}
          >
            
          <div
            style={{
              alignSelf: "stretch",
              justifyContent: "flex-start",
              alignItems: "center",
              gap: "8px",
              display: "inline-flex",
            }}
          >
            <div style={{ flexDirection: "column", justifyContent: "flex-start", alignItems: "flex-start", display: "inline-flex" }}>
              {/* Icon Filter thay vì DocumentIcon */}
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#007BFF" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
            </div>
            
            <div style={{ flexDirection: "column", justifyContent: "flex-start", alignItems: "flex-start", display: "inline-flex" }}>
              <div
                style={{
                  color: "#0F172A",
                  fontSize: "18px",
                  fontFamily: "Inter",
                  fontWeight: 700,
                  lineHeight: "28px",
                }}
              >
                Bộ lọc tìm kiếm
              </div>
            </div>
          </div>

            {/* Categories */}
            <div
              style={{
                alignSelf: "stretch",
                flexDirection: "column",
                justifyContent: "flex-start",
                alignItems: "flex-start",
                gap: "12px",
                display: "flex",
              }}
            >
              <div
                style={{
                  alignSelf: "stretch",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  alignItems: "flex-start",
                  display: "flex",
                }}
              >
                <div
                  style={{
                    alignSelf: "stretch",
                    justifyContent: "center",
                    display: "flex",
                    flexDirection: "column",
                    color: "#94A3B8",
                    fontSize: "12px",
                    fontFamily: "Inter",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    lineHeight: "16px",
                    letterSpacing: "0.60px",
                  }}
                >
                  Lĩnh vực IT
                </div>
              </div>

              {sidebarError ? (
                <div style={{ color: "#EF4444", fontSize: "12px" }}>{sidebarError}</div>
              ) : (
                <div
                  style={{
                    alignSelf: "stretch",
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    alignItems: "flex-start",
                    gap: "4px",
                    display: "flex",
                    opacity: sidebarLoading ? 0.6 : 1,
                  }}
                >
                  {categoryRows.map((c) => {
                    const selected = pendingCategoryId === c.id;
                    const Icon = c.Icon;
                    return (
                      <button
                        key={c.id || "all"}
                        type="button"
                        onClick={() => handleSelectCategory(c.id)}
                        style={{
                          width: "100%",
                          alignSelf: "stretch",
                          paddingLeft: "12px",
                          paddingRight: "12px",
                          paddingTop: "8px",
                          paddingBottom: "8px",
                          background: selected ? "rgba(0, 123, 255, 0.10)" : "transparent",
                          borderRadius: "8px",
                          justifyContent: "flex-start",
                          alignItems: "center",
                          gap: "12px",
                          display: "inline-flex",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ flexDirection: "column", justifyContent: "flex-start", alignItems: "flex-start", display: "inline-flex", flexShrink: 0 }}>
                          <Icon size={15} color={selected ? "#007BFF" : "#94A3B8"} />
                        </div>
                        <div style={{ flexDirection: "column", justifyContent: "flex-start", alignItems: "flex-start", display: "inline-flex", flex: 1, minWidth: 0 }}>
                          <div
                            title={c.name}
                            style={{
                              width: "100%",
                              maxWidth: "185px",
                              height: "20px",
                              justifyContent: "center",
                              display: "flex",
                              flexDirection: "column",
                              color: selected ? "#007BFF" : "#0F172A",
                              fontSize: "14px",
                              fontFamily: "Inter",
                              fontWeight: 500,
                              lineHeight: "20px",
                              textAlign: "left",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {c.name}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Popular Tags */}
            <div
              style={{
                alignSelf: "stretch",
                flexDirection: "column",
                justifyContent: "flex-start",
                alignItems: "flex-start",
                gap: "12px",
                display: "flex",
              }}
            >
              <div
                style={{
                  alignSelf: "stretch",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  alignItems: "flex-start",
                  display: "flex",
                }}
              >
                <div
                  style={{
                    alignSelf: "stretch",
                    justifyContent: "center",
                    display: "flex",
                    flexDirection: "column",
                    color: "#94A3B8",
                    fontSize: "12px",
                    fontFamily: "Inter",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    lineHeight: "16px",
                    letterSpacing: "0.60px",
                  }}
                >
                  Tag phổ biến
                </div>
              </div>

              <div
                style={{
                  alignSelf: "stretch",
                  minHeight: "120px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  opacity: sidebarLoading ? 0.6 : 1,
                }}
              >
                {(tags || []).map((tag) => {
                  const selected = pendingTagIds.has(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        setPendingTagIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(tag.id)) next.delete(tag.id);
                          else next.add(tag.id);
                          return next;
                        });
                      }}
                      style={{
                        height: "24px",
                        paddingLeft: "8px",
                        paddingRight: "8px",
                        paddingTop: "4px",
                        paddingBottom: "4px",
                        background: selected ? "rgba(0, 123, 255, 0.10)" : "#F1F5F9",
                        borderRadius: "4px",
                        border: "none",
                        cursor: "pointer",
                        maxWidth: "200px",
                      }}
                    >
                      <div
                        title={tag.name}
                        style={{
                          height: "16px",
                          maxWidth: "184px",
                          justifyContent: "center",
                          display: "flex",
                          flexDirection: "column",
                          color: selected ? "#007BFF" : "#0F172A",
                          fontSize: "12px",
                          fontFamily: "Inter",
                          fontWeight: 500,
                          lineHeight: "16px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tag.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sort */}
            <div
              style={{
                alignSelf: "stretch",
                flexDirection: "column",
                justifyContent: "flex-start",
                alignItems: "flex-start",
                gap: "12px",
                display: "flex",
                position: "relative",
              }}
            >
              <div style={{ color: "#94A3B8", fontSize: "12px", fontFamily: "Inter", fontWeight: 700, textTransform: "uppercase", lineHeight: "16px", letterSpacing: "0.60px" }}>
                Sắp xếp theo
              </div>

              <button
                type="button"
                onClick={() => setIsSortOpen((prev) => !prev)}
                style={{
                  width: "100%",
                  height: "36px",
                  border: "none",
                  background: "#F1F5F9",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  color: "#0F172A",
                  fontSize: "14px",
                  fontFamily: "Inter",
                  cursor: "pointer",
                }}
              >
                <span>{sortLabel}</span>
                <span style={{ color: "#6B7280" }}>{isSortOpen ? "▴" : "▾"}</span>
              </button>

              {isSortOpen && (
                <div
                  style={{
                    width: "100%",
                    background: "#FFFFFF",
                    borderRadius: "8px",
                    outline: "1px solid #E2E8F0",
                    boxShadow: "0px 8px 10px -6px rgba(0,0,0,0.10), 0px 20px 25px -5px rgba(0,0,0,0.10)",
                    overflow: "hidden",
                  }}
                >
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setPendingSort(option.value);
                        setIsSortOpen(false);
                      }}
                      style={{
                        width: "100%",
                        border: "none",
                        background: option.value === pendingSort ? "rgba(0, 123, 255, 0.10)" : "#FFFFFF",
                        color: option.value === pendingSort ? "#007BFF" : "#0F172A",
                        textAlign: "left",
                        padding: "8px 16px",
                        fontSize: "14px",
                        lineHeight: "20px",
                        fontFamily: "Inter",
                        cursor: "pointer",
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter button */}
            <button
              type="button"
              onClick={applyFilters}
              style={{
                width: "100%",
                height: "40px",
                border: "none",
                background: "#007BFF",
                borderRadius: "10px",
                color: "white",
                fontSize: "14px",
                fontFamily: "Inter",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow:
                  "0px 4px 6px -4px rgba(0,123,255,0.25), 0px 10px 15px -3px rgba(0,123,255,0.25)",
              }}
            >
              Áp dụng lọc
            </button>
          </div>
        </div>
        </div>

        {/* Main content */}
        <div className="docs-main-content">
          {/* Breadcrumb + Title */}
          <div
            style={{
              alignSelf: "stretch",
              paddingTop: "18px",
              flexDirection: "column",
              justifyContent: "flex-start",
              alignItems: "flex-start",
              gap: "8px",
              display: "flex",
            }}
          >
            <div
              style={{
                alignSelf: "stretch",
                justifyContent: "flex-start",
                alignItems: "center",
                gap: "8px",
                display: "inline-flex",
              }}
            >
              <div style={{ flexDirection: "column", justifyContent: "flex-start", alignItems: "flex-start", display: "inline-flex" }}>
                <div
                  style={{
                    width: "66.73px",
                    height: "20px",
                    justifyContent: "center",
                    display: "flex",
                    flexDirection: "column",
                    color: "#64748B",
                    fontSize: "14px",
                    fontFamily: "Inter",
                    fontWeight: 400,
                    lineHeight: "20px",
                  }}
                >
                  Trang chủ
                </div>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center" }}>
                <ChevronRightIcon size={12} color="#64748B" />
              </div>
              <div style={{ flexDirection: "column", justifyContent: "flex-start", alignItems: "flex-start", display: "inline-flex" }}>
                <div
                  style={{
                    width: "200px",
                    height: "20px",
                    justifyContent: "center",
                    display: "flex",
                    flexDirection: "column",
                    color: "#0F172A",
                    fontSize: "14px",
                    fontFamily: "Inter",
                    fontWeight: 500,
                    lineHeight: "20px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {title}
                </div>
              </div>
            </div>

            <div style={{ alignSelf: "stretch", flexDirection: "column", justifyContent: "flex-start", alignItems: "flex-start", display: "flex" }}>
              <div
                style={{
                  alignSelf: "stretch",
                  justifyContent: "center",
                  display: "flex",
                  flexDirection: "column",
                  color: "#0F172A",
                  fontSize: "30px",
                  fontFamily: "Inter",
                  fontWeight: 700,
                  lineHeight: "36px",
                }}
              >
                {title}
              </div>
            </div>

            <div style={{ alignSelf: "stretch", flexDirection: "column", justifyContent: "flex-start", alignItems: "flex-start", display: "flex" }}>
              <div
                style={{
                  alignSelf: "stretch",
                  justifyContent: "center",
                  display: "flex",
                  flexDirection: "column",
                  color: "#64748B",
                  fontSize: "16px",
                  fontFamily: "Inter",
                  fontWeight: 400,
                  lineHeight: "24px",
                }}
              >
                {subtitle}
              </div>
            </div>

            {isSearchMode && (
              <div style={{ color: "#94A3B8", fontSize: "12px", fontFamily: "Inter", fontWeight: 500 }}>
                Từ khóa: <span style={{ color: "#0F172A" }}>{appliedKeyword}</span>
              </div>
            )}
          </div>

          {error && (
            <div style={{ width: "100%", color: "#EF4444", fontSize: "14px" }}>{error}</div>
          )}

          {/* Cards grid (Responsive CSS Grid) */}
          <div className="docs-cards-grid" style={{ opacity: loading ? 0.7 : 1 }}>
            {(documents || []).map((doc) => {
              const badge = fileTypeBadge(doc.fileType);
              return (
                <div
                  key={doc.id}
                  role="button"
                  tabIndex={0}
                  className="doc-list-card document-card--interactive"
                  onClick={() => doc.id != null && navigate(`/documents/${doc.id}`)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && doc.id != null && navigate(`/documents/${doc.id}`)
                  }
                >
                  <div className="doc-list-card__thumb">
                    <img
                      src={getDocumentThumbnailUrl(doc)}
                      alt={doc.title || "thumbnail"}
                      onError={onDocumentThumbnailError}
                      className="doc-list-card__img"
                    />

                    <div
                      className="doc-list-card__badge"
                      style={{ background: badge.bg }}
                    >
                      {badge.label}
                    </div>
                  </div>

                  <div className="doc-list-card__details">
                    <div>
                      <div className="doc-list-card__top">
                        <div
                          className="doc-list-card__category"
                          title={doc.categoryName || "Chưa phân loại"}
                        >
                          {doc.categoryName || "Chưa phân loại"}
                        </div>

                        <div className="doc-list-card__date">
                          {formatDateDDMMYYYY(doc.createdAt)}
                        </div>
                      </div>

                      <div
                        className="doc-list-card__title"
                        title={doc.title}
                      >
                        {doc.title}
                      </div>

                      <div
                        className="doc-list-card__uploader"
                        title={getDocumentUploaderDisplayName(doc) || "Không rõ"}
                      >
                        <UsersIcon size={12} color="#64748B" />
                        <span>{getDocumentUploaderDisplayName(doc) || "Không rõ"}</span>
                      </div>
                    </div>

                    <div className="doc-list-card__footer">
                      <div className="doc-list-card__stats">
                        {/* View Count */}
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <EyeIcon size={20} color="#64748B" />
                          <span>{formatCompactNumber(doc.viewCount)}</span>
                        </div>

                        {/* Download Count */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(doc);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            padding: 0,
                            color: "#64748B",
                          }}
                          title="Tải xuống"
                        >
                          <DownloadIcon size={20} color="#64748B" />
                          <span>{formatCompactNumber(doc.downloadCount)}</span>
                        </button>
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

            {!loading && documents.length === 0 && (
              <div style={{ gridColumn: "1 / -1", padding: "48px 16px", textAlign: "center", color: "#94A3B8" }}>
                Không tìm thấy tài liệu nào.
              </div>
            )}
          </div>

          {/* Pagination */}
          <div
            style={{
              alignSelf: "stretch",
              paddingTop: "16px",
              justifyContent: "center",
              alignItems: "center",
              gap: "8px",
              display: "inline-flex",
              flexWrap: "wrap",
              opacity: loading ? 0.6 : 1,
            }}
          >
            <button
              type="button"
              disabled={page <= 0 || loading}
              onClick={() => goToPage(page)}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "8px",
                outline: "1px solid #E2E8F0",
                outlineOffset: "-1px",
                justifyContent: "center",
                alignItems: "center",
                display: "flex",
                border: "none",
                background: "white",
                cursor: page > 0 && !loading ? "pointer" : "not-allowed",
              }}
            >
              <div style={{ flexDirection: "column", justifyContent: "flex-start", alignItems: "center", display: "inline-flex" }}>
                <ChevronLeftIcon size={14} color="#0F172A" />
              </div>
            </button>

            {pageItems.map((it, idx) => {
              if (it.type === "dots") {
                return (
                  <div key={`dots-${idx}`} style={{ paddingLeft: "8px", paddingRight: "8px", flexDirection: "column", justifyContent: "flex-start", alignItems: "flex-start", display: "inline-flex" }}>
                    <div
                      style={{
                        width: "13.83px",
                        height: "24px",
                        justifyContent: "center",
                        display: "flex",
                        flexDirection: "column",
                        color: "#94A3B8",
                        fontSize: "16px",
                        fontFamily: "Inter",
                        fontWeight: 400,
                        lineHeight: "24px",
                      }}
                    >
                      ...
                    </div>
                  </div>
                );
              }

              const active = it.page === page + 1;
              return (
                <button
                  key={`page-${it.page}`}
                  type="button"
                  disabled={loading}
                  onClick={() => goToPage(it.page)}
                  style={{
                    width: "40px",
                    height: "40px",
                    background: active ? "#007BFF" : "transparent",
                    borderRadius: "8px",
                    justifyContent: "center",
                    alignItems: "center",
                    display: "flex",
                    outline: active ? "none" : "1px solid #E2E8F0",
                    outlineOffset: "-1px",
                    border: "none",
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  <div
                    style={{
                      width: "16px",
                      height: "24px",
                      textAlign: "center",
                      justifyContent: "center",
                      display: "flex",
                      flexDirection: "column",
                      color: active ? "white" : "#0F172A",
                      fontSize: "16px",
                      fontFamily: "Inter",
                      fontWeight: active ? 700 : 400,
                      lineHeight: "24px",
                    }}
                  >
                    {it.page}
                  </div>
                </button>
              );
            })}

            <button
              type="button"
              disabled={page >= totalPages - 1 || loading}
              onClick={() => goToPage(page + 2)}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "8px",
                outline: "1px solid #E2E8F0",
                outlineOffset: "-1px",
                justifyContent: "center",
                alignItems: "center",
                display: "flex",
                border: "none",
                background: "white",
                cursor: page < totalPages - 1 && !loading ? "pointer" : "not-allowed",
              }}
            >
              <div style={{ flexDirection: "column", justifyContent: "flex-start", alignItems: "center", display: "inline-flex" }}>
                <ChevronRightIcon size={14} color="#0F172A" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

