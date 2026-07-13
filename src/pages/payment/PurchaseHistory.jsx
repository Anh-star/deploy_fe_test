import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  DownloadIcon,
  EyeIcon,
} from "../../components/icons";
import {
  buildDocumentDownloadName,
  documentService,
  downloadFileViaFetch,
  getApiErrorMessage,
  paymentService,
} from "../../services/api";
import { useNotification } from "../../context/NotificationContext";
import "../../styles/purchaseHistory.css";

const RefreshIcon = ({ size = 14, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 12a9 9 0 0 1-15.5 6.36L3 16" />
    <path d="M3 12a9 9 0 0 1 15.5-6.36L21 8" />
    <polyline points="21 3 21 8 16 8" />
    <polyline points="3 21 3 16 8 16" />
  </svg>
);


const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { value: "ALL", label: "Tất cả trạng thái" },
  { value: "SUCCESS", label: "Thành công" },
  { value: "PENDING", label: "Đang xử lý" },
  { value: "FAILED", label: "Thất bại" },
  { value: "CANCELLED", label: "Đã huỷ" },
];

const STATUS_LABELS = {
  SUCCESS: "Thành công",
  PENDING: "Đang xử lý",
  FAILED: "Thất bại",
  CANCELLED: "Đã huỷ",
};

const STATUS_CLASS = {
  SUCCESS: "purchase-history-status--success",
  PENDING: "purchase-history-status--pending",
  FAILED: "purchase-history-status--failed",
  CANCELLED: "purchase-history-status--cancelled",
};

function normalizePayment(raw) {
  if (!raw || typeof raw !== "object") return null;
  const status = String(raw.status || "").toUpperCase();
  return {
    paymentId: raw.paymentId ?? raw.id ?? null,
    documentId: raw.documentId ?? null,
    documentTitle: raw.documentTitle ?? raw.title ?? null,
    amount: raw.amount ?? null,
    status,
    orderCode: raw.orderCode ?? null,
    bankCode: raw.bankCode ?? null,
    transactionNo: raw.transactionNo ?? null,
    createdAt: raw.createdAt ?? null,
    paidAt: raw.paidAt ?? null,
  };
}

function formatVnd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveTransactionCode(item) {
  if (item.transactionNo) return String(item.transactionNo);
  if (item.orderCode != null && item.orderCode !== "") return String(item.orderCode);
  return "—";
}

function resolvePurchaseDate(item) {
  if (item.paidAt) return formatDateTime(item.paidAt);
  return formatDateTime(item.createdAt);
}

function documentTitleOrFallback(item) {
  if (item.documentTitle && String(item.documentTitle).trim() !== "") {
    return item.documentTitle;
  }
  return "Tài liệu không còn tồn tại";
}

export default function PurchaseHistory() {
  const navigate = useNavigate();
  const notification = useNotification();

  const [items, setItems] = useState([]);
  const [rawLoaded, setRawLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await paymentService.getMyHistory();
      const list = Array.isArray(data) ? data : [];
      setItems(list.map(normalizePayment).filter(Boolean));
      setRawLoaded(true);
    } catch (e) {
      setItems([]);
      setRawLoaded(false);
      setError("Không thể tải lịch sử mua tài liệu");
      notification.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [notification]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSearchChange = useCallback((e) => {
    setSearch(e.target.value);
    setPage(0);
  }, []);

  const handleStatusChange = useCallback((e) => {
    setStatusFilter(e.target.value);
    setPage(0);
  }, []);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const title = String(item.documentTitle || "").toLowerCase();
      const orderCode = String(item.orderCode || "").toLowerCase();
      const transactionNo = String(item.transactionNo || "").toLowerCase();
      return (
        title.includes(q) ||
        orderCode.includes(q) ||
        transactionNo.includes(q)
      );
    });
  }, [items, search, statusFilter]);

  const totalItems = filteredItems.length;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(totalPages - 1, 0));
  const fromItem = totalItems === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const toItem = Math.min((safePage + 1) * PAGE_SIZE, totalItems);

  const visiblePageIndices = useMemo(() => {
    if (totalPages === 0) return [];
    const maxShown = 7;
    if (totalPages <= maxShown) {
      return Array.from({ length: totalPages }, (_, i) => i);
    }
    const half = Math.floor(maxShown / 2);
    let start = Math.max(0, safePage - half);
    let end = Math.min(totalPages - 1, start + maxShown - 1);
    start = Math.max(0, end - maxShown + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [totalPages, safePage]);

  const paginatedItems = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, safePage]);

  const handleViewDocument = useCallback(
    (item) => {
      if (!item.documentId) return;
      navigate(`/document/${item.documentId}`);
    },
    [navigate]
  );

  const handleDownload = useCallback(
    async (item) => {
      if (!item.documentId) {
        notification.error("Không thể tải tài liệu này.");
        return;
      }
      if (item.status !== "SUCCESS") return;
      const docId = item.documentId;
      setDownloadingId(docId);
      try {
        await documentService.download(docId);
        const filePayload = await documentService.getDocumentFileUrl(docId);
        const fileUrl = filePayload?.fileUrl;
        if (!fileUrl) {
          notification.error("Không lấy được đường dẫn tải xuống.");
          return;
        }
        const suggestedName = buildDocumentDownloadName(
          item.documentTitle,
          filePayload?.fileType
        );
        await downloadFileViaFetch(fileUrl, suggestedName);
        notification.success("Đang tải xuống tài liệu.");
      } catch (e) {
        notification.error(getApiErrorMessage(e));
      } finally {
        setDownloadingId(null);
      }
    },
    [notification]
  );

  const handleRetry = useCallback(() => {
    void load();
  }, [load]);

  const renderStatusBadge = (status) => {
    const label = STATUS_LABELS[status] || status || "—";
    const cls = STATUS_CLASS[status] || "purchase-history-status--default";
    return (
      <span className={`purchase-history-status ${cls}`}>{label}</span>
    );
  };

  const renderActions = (item) => {
    const status = item.status;
    if (status === "SUCCESS") {
      const hasDoc = Boolean(item.documentId);
      return (
        <div className="purchase-history-actions">
          <button
            type="button"
            className="purchase-history-action-btn purchase-history-action-btn--ghost"
            onClick={() => handleViewDocument(item)}
            disabled={!hasDoc}
          >
            <EyeIcon size={14} />
            Xem tài liệu
          </button>
          <button
            type="button"
            className="purchase-history-action-btn purchase-history-action-btn--primary"
            onClick={() => handleDownload(item)}
            disabled={!hasDoc || downloadingId === item.documentId}
          >
            <DownloadIcon size={14} />
            {downloadingId === item.documentId ? "Đang tải…" : "Tải xuống"}
          </button>
        </div>
      );
    }
    if (status === "FAILED" || status === "CANCELLED") {
      const hasDoc = Boolean(item.documentId);
      return (
        <div className="purchase-history-actions">
          <button
            type="button"
            className="purchase-history-action-btn purchase-history-action-btn--primary"
            onClick={() => handleViewDocument(item)}
            disabled={!hasDoc}
          >
            <RefreshIcon size={14} />
            Mua lại
          </button>
        </div>
      );
    }
    if (status === "PENDING") {
      return (
        <div className="purchase-history-actions">
          <span className="purchase-history-action-note">Đang chờ thanh toán</span>
        </div>
      );
    }
    return (
      <div className="purchase-history-actions">
        <span className="purchase-history-action-note">—</span>
      </div>
    );
  };

  const hasTransactions = rawLoaded && items.length > 0;
  const noMatch = hasTransactions && totalItems === 0;

  return (
    <div className="purchase-history-page">
      <div className="purchase-history-container">
        <nav className="purchase-history-breadcrumb" aria-label="Breadcrumb">
          <Link to="/" className="purchase-history-breadcrumb-link">
            Trang chủ
          </Link>
          <span className="purchase-history-breadcrumb-sep">›</span>
          <span className="purchase-history-breadcrumb-current">
            Lịch sử mua tài liệu
          </span>
        </nav>

        <header className="purchase-history-header">
          <h1>Lịch sử mua tài liệu</h1>
          <p className="purchase-history-subtitle">
            Theo dõi và quản lý các giao dịch mua tài liệu của bạn.
          </p>
        </header>

        <div className="purchase-history-toolbar">
          <div className="purchase-history-search">
            <SearchIcon size={16} />
            <input
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="Tìm theo tên tài liệu, mã đơn hàng hoặc mã giao dịch…"
              aria-label="Tìm kiếm giao dịch"
              disabled={loading && !rawLoaded}
            />
          </div>
          <div className="purchase-history-filter">
            <select
              value={statusFilter}
              onChange={handleStatusChange}
              aria-label="Lọc trạng thái"
              disabled={loading && !rawLoaded}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="purchase-history-table-wrapper">
          {error ? (
            <div className="purchase-history-state purchase-history-state--error">
              <p>{error}</p>
              <button
                type="button"
                className="purchase-history-retry-btn"
                onClick={handleRetry}
              >
                <RefreshIcon size={14} />
                Thử lại
              </button>
            </div>
          ) : loading && !rawLoaded ? (
            <div className="purchase-history-state">Đang tải…</div>
          ) : !hasTransactions ? (
            <div className="purchase-history-state">
              Bạn chưa có giao dịch mua tài liệu nào.
            </div>
          ) : noMatch ? (
            <div className="purchase-history-state">
              Không tìm thấy giao dịch phù hợp.
            </div>
          ) : (
            <div className="purchase-history-table-scroll">
              <table className="purchase-history-table">
                <thead>
                  <tr>
                    <th>Tài liệu</th>
                    <th>Số tiền</th>
                    <th>Ngày mua</th>
                    <th>Trạng thái</th>
                    <th>Mã giao dịch</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((item, idx) => (
                    <tr key={item.paymentId || `${item.orderCode}-${idx}`}>
                      <td>{documentTitleOrFallback(item)}</td>
                      <td className="purchase-history-amount">
                        {formatVnd(item.amount)}
                      </td>
                      <td>{resolvePurchaseDate(item)}</td>
                      <td>{renderStatusBadge(item.status)}</td>
                      <td className="purchase-history-tx">{resolveTransactionCode(item)}</td>
                      <td>{renderActions(item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {hasTransactions && !noMatch && (
            <div className="purchase-history-pagination">
              <div className="purchase-history-entries">
                Hiển thị {fromItem}–{toItem} trên tổng số {totalItems} giao dịch
              </div>
              <div className="purchase-history-page-controls">
                <button
                  type="button"
                  className="purchase-history-page-btn"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage <= 0}
                  aria-label="Trang trước"
                >
                  <ChevronLeftIcon size={14} />
                </button>
                {visiblePageIndices.map((p) => (
                  <button
                    type="button"
                    key={p}
                    className={`purchase-history-page-btn${
                      p === safePage ? " purchase-history-page-btn--active" : ""
                    }`}
                    onClick={() => setPage(p)}
                  >
                    {p + 1}
                  </button>
                ))}
                <button
                  type="button"
                  className="purchase-history-page-btn"
                  onClick={() =>
                    setPage((p) =>
                      Math.min(Math.max(totalPages - 1, 0), p + 1)
                    )
                  }
                  disabled={safePage >= totalPages - 1}
                  aria-label="Trang sau"
                >
                  <ChevronRightIcon size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
