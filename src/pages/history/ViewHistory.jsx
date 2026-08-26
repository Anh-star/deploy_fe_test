import React, { useCallback, useEffect, useState } from "react";
import {
  ClockIcon,
  UsersIcon,
  ListIcon,
  EyeIcon,
  DownloadIcon,
  LogoutIcon
} from "../../components/icons";
import Pagination from "../../components/common/Pagination";
import "../../styles/viewHistory.css";
import { documentService } from "../../services/api";
import { getDocumentUploaderDisplayName } from "../../utils/documentUploaderDisplay";
import { parseApiDate } from "../../utils/dateUtils";

const PAGE_SIZE = 10;

function formatDate(iso) {
  if (!iso) return "—";
  const d = parseApiDate(iso);
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}


export default function ViewHistory() {
  const [page, setPage] = useState(1); // 1-based
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await documentService.getMyViewHistory(page - 1, PAGE_SIZE);
      const rawItems = Array.isArray(data?.content) ? data.content : [];
      setItems(rawItems);
      const total = Number(data?.totalElements) || 0;
      setTotalItems(total);
      const tp = total === 0 ? 0 : Math.ceil(total / PAGE_SIZE);
      setTotalPages(tp);
    } catch (e) {
      setItems([]);
      setTotalPages(0);
      setTotalItems(0);
      setError(e?.response?.data?.message || e?.message || "Không thể tải lịch sử xem.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePageChange = useCallback((next) => {
    setPage(next);
  }, []);

  return (
    <div className="view-history-container">
      <main className="view-history-content">
        <header className="history-header">
          <div className="history-title-section">
            <h1>Lịch sử tài liệu đã xem</h1>
            <p className="history-subtitle">Danh sách các tài liệu bạn đã xem gần đây.</p>
          </div>
        </header>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>
            Đang tải…
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#ef4444" }}>
            {error}
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>
            Bạn chưa xem tài liệu nào.
          </div>
        ) : (
          <>
            <div className="view-history-list">
              {items.map((item) => {
                const uploaderName = getDocumentUploaderDisplayName(item) || "—";
                const title = item.title || "Tài liệu";
                const categoryName = item.categoryName || "";
                const viewCount = item.viewCount ?? 0;
                const downloadCount = item.downloadCount ?? 0;
                const lastViewedAt = item.lastViewedAt;
                const thumbnail = item.thumbnail;
                const categoryColor = "#3b82f6";

                return (
                  <div key={item.id} className="view-history-card">
                    <div className="view-history-thumb">
                      <div
                        className="view-history-category-badge"
                        style={{ backgroundColor: categoryColor }}
                      >
                        {categoryName}
                      </div>
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt={title}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <span style={{ fontSize: "24px", color: "#94a3b8" }}>
                          {title.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="view-history-card-info">
                      {lastViewedAt && (
                        <div className="view-history-view-time">
                          <ClockIcon size={14} />
                          <span>Xem lúc: {formatDate(lastViewedAt)}</span>
                        </div>
                      )}
                      <h2 className="view-history-card-title">{title}</h2>
                      <div className="view-history-card-meta">
                        <div className="view-history-meta-item">
                          <UsersIcon size={14} />
                          <span>Đăng bởi: {uploaderName}</span>
                        </div>
                        {categoryName && (
                          <div className="view-history-meta-item">
                            <ListIcon size={14} />
                            <span>Chuyên mục: {categoryName}</span>
                          </div>
                        )}
                      </div>
                      <div className="view-history-card-stats">
                        <div className="view-history-stat-item">
                          <EyeIcon size={14} />
                          <span>{viewCount.toLocaleString("vi-VN")}</span>
                        </div>
                        <div className="view-history-stat-item">
                          <DownloadIcon size={14} />
                          <span>{downloadCount.toLocaleString("vi-VN")}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      className="view-history-view-btn"
                      onClick={() => {
                        if (item.id) window.location.href = `/documents/${item.id}`;
                      }}
                    >
                      <EyeIcon size={16} color="white" />
                      Xem lại
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="view-history-pagination">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
