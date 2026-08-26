import React, { useEffect, useReducer, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ClockIcon,
  UsersIcon,
  ListIcon,
  EyeIcon,
  DownloadIcon,
} from "../../components/icons";
import { documentService, getApiErrorMessage } from "../../services/api";
import { useNotification } from "../../context/NotificationContext";
import Pagination from "../../components/common/Pagination";
import {
  getDocumentThumbnailUrl,
  onDocumentThumbnailError,
} from "../../utils/documentThumbnail";
import { getDocumentUploaderDisplayName } from "../../utils/documentUploaderDisplay";
import { parseApiDate } from "../../utils/dateUtils";
import "../../styles/favoriteDocuments.css";

// Local Trash Icon
const TrashIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

// Local Filter Icon
const FilterIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
  </svg>
);

// Local External Link Icon
const ExternalLinkIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
    <polyline points="15 3 21 3 21 9"></polyline>
    <line x1="10" y1="14" x2="21" y2="3"></line>
  </svg>
);

const DEFAULT_CATEGORY_COLOR = "#6366f1";
const THUMB_FALLBACK_BG = "#eff6ff";
const PAGE_SIZE = 10;

/**
 * State danh sách yêu thích + metadata pagination.
 * Được cập nhật qua reducer để:
 *  - mỗi REMOVE_SUCCESS đọc previous state mới nhất (tránh stale closure);
 *  - chỉ giảm totalElements khi item thật sự còn trong items
 *    (chống double-decrement khi hai success trùng nhau);
 *  - derive totalPages atomic từ totalElements mới nhất.
 */
const initialFavoriteState = {
  items: [],
  totalElements: 0,
  totalPages: 0,
};

function deriveTotalPages(totalElements) {
  if (totalElements <= 0) return 0;
  return Math.ceil(totalElements / PAGE_SIZE);
}

function favoriteReducer(state, action) {
  switch (action.type) {
    case "FETCH_SUCCESS": {
      const totalElements = Number(action.totalElements) || 0;
      return {
        items: Array.isArray(action.items) ? action.items : [],
        totalElements,
        totalPages: deriveTotalPages(totalElements),
      };
    }
    case "FETCH_ERROR":
    case "RESET": {
      return { items: [], totalElements: 0, totalPages: 0 };
    }
    case "REMOVE_SUCCESS": {
      // Chỉ giảm count khi item thật sự còn trong state.items.
      // Hai REMOVE_SUCCESS cho cùng một item (duplicate dispatch lỡ) sẽ không
      // double-decrement nhờ check này.
      const stillPresent = state.items.some((x) => x.id === action.itemId);
      if (!stillPresent) return state;
      const nextItems = state.items.filter((x) => x.id !== action.itemId);
      const nextTotalElements = Math.max(0, state.totalElements - 1);
      const nextTotalPages = deriveTotalPages(nextTotalElements);
      return {
        items: nextItems,
        totalElements: nextTotalElements,
        totalPages: nextTotalPages,
      };
    }
    default:
      return state;
  }
}

function formatCompactNumber(value) {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return "0";
  return new Intl.NumberFormat("en", { notation: "compact" }).format(n);
}

function formatLastViewedAt(value) {
  if (!value) {
    return "Chưa có";
  }
  const date = parseApiDate(value);
  if (!date || Number.isNaN(date.getTime())) {
    return "Chưa có";
  }
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function categoryColor(name) {
  if (!name) return DEFAULT_CATEGORY_COLOR;
  let h = 0;
  for (let i = 0; i < name.length; i += 1) {
    h = name.charCodeAt(i) + ((h << 5) - h);
  }
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 65%, 48%)`;
}

/**
 * Sub-component tách vùng hiển thị thumbnail + info ra khỏi link wrapper,
 * tránh inline JSX khổng lồ bên trong <Link>/<div>.
 */
function MainCardContent({ item, cat, catColor }) {
  return (
    <>
      <div
        className="card-thumb-wrapper"
        style={{ backgroundColor: THUMB_FALLBACK_BG }}
      >
        <div className="category-badge" style={{ backgroundColor: catColor }}>
          {cat}
        </div>
        <img
          src={getDocumentThumbnailUrl(item)}
          alt=""
          onError={onDocumentThumbnailError}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      <div className="card-info">
        <div className="view-time">
          <ClockIcon size={14} />
          <span>Xem lúc: {formatLastViewedAt(item.lastViewedAt)}</span>
        </div>
        <h2 className="card-title">{item.title || "—"}</h2>
        <div className="card-meta">
          <div className="meta-item">
            <UsersIcon size={16} />
            <span>Đăng bởi: {getDocumentUploaderDisplayName(item) || "—"}</span>
          </div>
          <div className="meta-item">
            <ListIcon size={16} />
            <span>Danh mục: {cat}</span>
          </div>
        </div>
        <div className="favorite-card__stats">
          <div className="favorite-card__stat">
            <EyeIcon size={14} />
            <span>{formatCompactNumber(item.viewCount)}</span>
          </div>
          <div className="favorite-card__stat">
            <DownloadIcon size={14} />
            <span>{formatCompactNumber(item.downloadCount)}</span>
          </div>
        </div>
      </div>
    </>
  );
}

export default function FavoriteDocuments() {
  const navigate = useNavigate();
  const location = useLocation();
  const notification = useNotification();

  // Gom items + pagination thành một state duy nhất để mọi mutation dùng
  // previous state mới nhất (tránh stale closure giữa các remove gần nhau).
  const [favoriteState, dispatch] = useReducer(
    favoriteReducer,
    initialFavoriteState
  );
  const { items, totalPages } = favoriteState;

  const [page, setPage] = useState(1); // 1-based
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Per-item loading — Set các documentId đang được xử lý.
  // KHÔNG tính toán count/cursor từ stale closure; chỉ dùng để disable UI.
  const [removingIds, setRemovingIds] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await documentService.getMyBookmarks(page - 1, PAGE_SIZE);
        if (cancelled) return;
        dispatch({
          type: "FETCH_SUCCESS",
          items: Array.isArray(data?.content) ? data.content : [],
          totalElements: Number(data?.totalElements) || 0,
        });
      } catch (e) {
        if (!cancelled) {
          setError(getApiErrorMessage(e));
          dispatch({ type: "FETCH_ERROR" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, location.pathname, location.key]);

  // Điều chỉnh page dựa trên totalPages mới nhất.
  // Effect riêng — KHÔNG gọi setPage trong reducer. Có guard để không set
  // khi giá trị đã đúng (tránh re-render thừa) và không vòng lặp.
  useEffect(() => {
    if (totalPages === 0) {
      if (page !== 1) setPage(1);
      return;
    }
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openDocument = (id) => {
    if (!id) return;
    navigate(`/documents/${id}`);
  };

  /**
   * Xóa một tài liệu khỏi danh sách yêu thích.
   *  - Backend toggleBookmark là NON-idempotent; chỉ gửi đúng MỘT DELETE.
   *  - Per-item busy state (removingIds Set); hai item khác nhau có loading riêng.
   *  - KHÔNG optimistic remove trước API success.
   *  - KHÔNG compute totalElements/page/items.length từ closure.
   *  - Counter/totalPages chỉ được cập nhật thông qua REMOVE_SUCCESS dispatch,
   *    reducer đọc previous state qua React (luôn là state mới nhất).
   *  - KHÔNG gọi refetch trong handler — pagination adjustment đã có effect riêng
   *    dựa trên state mới nhất.
   */
  const removeFromFavorites = (itemId) => async () => {
    if (!itemId) return;
    if (removingIds.has(itemId)) return;

    setRemovingIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });

    try {
      await documentService.unbookmark(itemId);
      // Chỉ dispatch khi request thành công; reducer sẽ check item còn tồn tại
      // trước khi giảm count (chống double-decrement).
      dispatch({ type: "REMOVE_SUCCESS", itemId });
    } catch (e) {
      notification.error(getApiErrorMessage(e));
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  return (
    <div className="favorite-documents-container">
      <main className="favorite-documents-content">
        <header className="favorite-header">
          <div className="favorite-title-section">
            <h1>Tài liệu yêu thích</h1>
            <p className="favorite-subtitle">Danh sách các tài liệu đã lưu.</p>
          </div>
        </header>

        {error && (
          <div style={{ color: "#ef4444", fontSize: "14px", marginBottom: "16px" }}>{error}</div>
        )}

        <div className="favorite-list">
          {loading ? (
            <div style={{ padding: "24px", color: "#64748b" }}>Đang tải…</div>
          ) : (
            items.map((item) => {
              const cat = item.categoryName || "—";
              const catColor = categoryColor(cat);
              const isRemoving = removingIds.has(item.id);
              const open = () => openDocument(item.id);
              const hasValidId = Boolean(item.id);
              const detailPath = hasValidId ? `/documents/${item.id}` : null;

              return (
                <article key={item.id} className="favorite-card">
                  {hasValidId ? (
                    <Link
                      to={detailPath}
                      className="favorite-card__main"
                      aria-label={`Mở tài liệu ${item.title || "tài liệu"}`}
                    >
                      <MainCardContent
                        item={item}
                        cat={cat}
                        catColor={catColor}
                      />
                    </Link>
                  ) : (
                    <div
                      className="favorite-card__main favorite-card__main--static"
                      aria-label="Tài liệu"
                    >
                      <MainCardContent
                        item={item}
                        cat={cat}
                        catColor={catColor}
                      />
                    </div>
                  )}

                  <div className="favorite-card__actions">
                    <button
                      type="button"
                      className="view-btn"
                      onClick={hasValidId ? open : undefined}
                      disabled={!hasValidId}
                    >
                      <ExternalLinkIcon size={18} color="white" />
                      Xem lại
                    </button>

                    <button
                      type="button"
                      className="favorite-card__remove-btn"
                      onClick={hasValidId ? removeFromFavorites(item.id) : undefined}
                      disabled={!hasValidId || isRemoving}
                      aria-label={`Bỏ lưu ${item.title || "tài liệu"}`}
                      aria-busy={isRemoving}
                    >
                      <TrashIcon
                        size={18}
                        color={
                          !hasValidId || isRemoving ? "#94a3b8" : "#ef4444"
                        }
                      />
                      {!hasValidId
                        ? "—"
                        : isRemoving
                        ? "Đang bỏ lưu..."
                        : "Bỏ lưu"}
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {!loading && !error && items.length === 0 && (
          <div style={{ padding: "24px", color: "#64748b" }}>Chưa có tài liệu đã lưu.</div>
        )}

        {totalPages > 0 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}
      </main>
    </div>
  );
}
