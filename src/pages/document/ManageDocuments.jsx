import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotification } from "../../context/NotificationContext";
import { documentService, loadDocumentForEdit } from "../../services/api";
import Pagination from "../../components/common/Pagination";
import "../../styles/manageDocuments.css";

const TABS = [
  { key: "ALL", label: "Tất cả" },
  { key: "APPROVED", label: "Đã duyệt" },
  { key: "PENDING", label: "Đang chờ duyệt" },
  { key: "REJECTED", label: "Bị từ chối" },
];

const PAGE_SIZE = 3;

const DocumentTypeIcon = ({ fileType }) => {
  const normalized = (fileType || "FILE").toUpperCase();

  return (
    <div className={`personal-docs-file-icon personal-docs-file-icon-${normalized.toLowerCase()}`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <path d="M8 13h8"></path>
        <path d="M8 17h5"></path>
      </svg>
      <span>{normalized}</span>
    </div>
  );
};

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
);

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"></path>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14"></path>
    <path d="M5 12h14"></path>
  </svg>
);

const ChevronIcon = ({ direction = "left" }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {direction === "left" ? <path d="M15 18l-6-6 6-6"></path> : <path d="M9 18l6-6-6-6"></path>}
  </svg>
);

const getStatusLabel = (status) => {
  if (status === "APPROVED") return "Đã duyệt";
  if (status === "REJECTED") return "Bị từ chối";
  return "Đang chờ duyệt";
};

function formatSizeMb(bytes) {
  if (bytes == null || bytes === "") return "—";
  const n = Number(bytes);
  if (Number.isNaN(n)) return String(bytes);
  return (n / (1024 * 1024)).toFixed(1);
}

function formatPriceVnd(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "0";
  return n.toLocaleString("vi-VN");
}

/**
 * Parses Java LocalDateTime string without timezone info.
 * Accepts: 2026-07-22T00:29:00, 2026-07-22T00:29:00.123
 * Rejects: 2026-07-22T00:29:00Z, 2026-07-22T00:29:00+07:00
 * Returns { date, time } or null if invalid.
 */
const LOCAL_DATE_TIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?$/;

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getDaysInMonth(year, month) {
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2 && isLeapYear(year)) return 29;
  return days[month - 1] || 0;
}

function parseLocalDateTime(value) {
  if (typeof value !== "string" || !value) return null;

  // Reject timezone suffixes
  if (value.endsWith("Z") || value.includes("+") || value.includes("-", 10)) {
    return null;
  }

  const match = LOCAL_DATE_TIME_RE.exec(value);
  if (!match) return null;

  const [, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const second = parseInt(secondStr, 10);

  // Validate ranges
  if (month < 1 || month > 12) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;
  if (second < 0 || second > 59) return null;

  const daysInMonth = getDaysInMonth(year, month);
  if (day < 1 || day > daysInMonth) return null;

  const date = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return { date, time };
}

/**
 * Renders the list pricing cell. Phase C.1B1 shows the Free / Paid badge
 * and gross price; Phase C.1B2 adds a small "Đã khóa giá" badge when the
 * owner detail / list reports the document is locked by a successful
 * non-owner purchase.
 *
 * <p>Strict: never silently coerces an undefined `isPaid` to `false` — when
 * the backend omits the field, the cell renders "Chưa xác định" so the
 * owner can spot data drift immediately. The lock badge uses the same
 * strict rule: only the explicit boolean {@code true} renders the lock
 * badge; missing or malformed values render the "Chưa xác định" badge
 * without a lock badge.
 */
function renderPriceCell(doc) {
  const lockBadge =
    doc?.pricingLocked === true ? (
      <span className="personal-docs-price-lock-badge" title="Tài liệu đã có người mua">
        Đã khóa giá
      </span>
    ) : null;
  const unknownLockBadge =
    doc && doc.pricingLocked !== true && doc.pricingLocked !== false ? (
      <span className="personal-docs-price-lock-badge personal-docs-price-lock-badge--unknown">
        Chưa xác định
      </span>
    ) : null;
  if (doc?.isPaid === true) {
    const price = Number(doc.price);
    if (!Number.isFinite(price) || price <= 0) {
      return (
        <div className="personal-docs-price-cell">
          <span className="personal-docs-price-amount personal-docs-price-amount--unknown">
            Chưa xác định
          </span>
          {lockBadge}
          {unknownLockBadge}
        </div>
      );
    }
    return (
      <div className="personal-docs-price-cell">
        <span className="personal-docs-price-amount">{formatPriceVnd(price)} ₫</span>
        {lockBadge}
        {unknownLockBadge}
      </div>
    );
  }
  if (doc?.isPaid === false) {
    return (
      <div className="personal-docs-price-cell">
        <span className="personal-docs-price-badge free">Miễn phí</span>
        {lockBadge}
        {unknownLockBadge}
      </div>
    );
  }
  return (
    <span className="personal-docs-price-badge unknown">Chưa xác định</span>
  );
}

const getStatusClassName = (status) => {
  if (status === "APPROVED") return "approved";
  if (status === "REJECTED") return "rejected";
  return "pending";
};

export default function ManageDocuments() {
  const navigate = useNavigate();
  const notification = useNotification();
  const [documents, setDocuments] = useState([]);
  const [activeTab, setActiveTab] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      setIsLoading(true);
      try {
        const data = await documentService.getMyDocuments();
        const next = Array.isArray(data) ? data : [];
        setDocuments(next);
      } catch (error) {
        setDocuments([]);
        notification.error(
          error?.response?.data?.message || "Không thể tải danh sách tài liệu cá nhân."
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, [notification]);

  // Reset to page 1 when tab filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  // Declare filteredDocuments BEFORE any effect that uses it
  const filteredDocuments = useMemo(() => {
    if (activeTab === "ALL") return documents;
    return documents.filter((doc) => doc.status === activeTab);
  }, [activeTab, documents]);

  const counts = useMemo(
    () => ({
      ALL: documents.length,
      APPROVED: documents.filter((doc) => doc.status === "APPROVED").length,
      PENDING: documents.filter((doc) => doc.status === "PENDING").length,
      REJECTED: documents.filter((doc) => doc.status === "REJECTED").length,
    }),
    [documents]
  );

  // Clamp currentPage to valid range — uses filteredDocuments, so must come after
  useEffect(() => {
    const filteredCount = filteredDocuments.length;
    const tp = filteredCount === 0 ? 0 : Math.ceil(filteredCount / PAGE_SIZE);
    if (tp === 0) {
      if (currentPage !== 1) setCurrentPage(1);
    } else if (currentPage > tp) {
      setCurrentPage(tp);
    }
  }, [filteredDocuments.length, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / PAGE_SIZE));
  const paginatedDocuments = filteredDocuments.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const startItem = filteredDocuments.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endItem = filteredDocuments.length === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, filteredDocuments.length);

  const handleViewDetails = (doc) => {
    if (doc?.id) navigate(`/documents/submitted/${doc.id}`);
  };

  const handleEditDocument = async (document) => {
    if (!document?.id) return;
    if (editingId === document.id) return;
    setEditingId(document.id);
    try {
      const documentToEdit = await loadDocumentForEdit(document.id);
      navigate("/upload-document", { state: { documentToEdit } });
    } catch (err) {
      const message = err?.message || "Không thể tải dữ liệu tài liệu để chỉnh sửa.";
      notification.error(message);
    } finally {
      setEditingId(null);
    }
  };

  const handleDeleteDocument = async () => {
    if (!documentToDelete) return;

    try {
      await documentService.deleteMyDocument(documentToDelete.id);
      setDocuments((prev) => prev.filter((item) => item.id !== documentToDelete.id));
      notification.success("Đã xóa tài liệu khỏi danh sách cá nhân.");
      setDocumentToDelete(null);
    } catch (error) {
      notification.error(
        error?.response?.data?.message || "Không thể xóa tài liệu."
      );
    }
  };

  const showEmpty = !isLoading && paginatedDocuments.length === 0;

  return (
    <div className="personal-docs-page">
      <div className="personal-docs-shell">
        <div className="personal-docs-header-row">
          <div>
            <h1 className="personal-docs-title">Tài liệu của tôi</h1>
            <p className="personal-docs-subtitle">
              Quản lý và theo dõi trạng thái các tài liệu bạn đã đăng tải.
            </p>
          </div>
          <button type="button" className="personal-docs-upload-btn" onClick={() => navigate("/upload-document")}>
            <PlusIcon />
            <span>Tải lên tài liệu mới</span>
          </button>
        </div>

        <section className="personal-docs-card">
          <div className="personal-docs-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`personal-docs-tab ${activeTab === tab.key ? "active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span>{tab.label}</span>
                {tab.key === "ALL" && <span className="personal-docs-tab-count">{counts[tab.key]}</span>}
              </button>
            ))}
          </div>

          <div className="personal-docs-table-wrap">
            <table className="personal-docs-table">
              <thead>
                <tr>
                  <th>TÊN TÀI LIỆU</th>
                  <th>NGÀY ĐĂNG</th>
                  <th>TRẠNG THÁI</th>
                  <th>GIÁ</th>
                  <th>LƯỢT XEM</th>
                  <th>TẢI XUỐNG</th>
                  <th>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="7" className="personal-docs-empty-cell">
                      <div className="personal-docs-empty-state">
                        <h3>Đang tải danh sách…</h3>
                      </div>
                    </td>
                  </tr>
                ) : showEmpty ? (
                  <tr>
                    <td colSpan="7" className="personal-docs-empty-cell">
                      <div className="personal-docs-empty-state">
                        <h3>Chưa có tài liệu trong mục này.</h3>
                        <p>Hãy tải lên tài liệu đầu tiên để bắt đầu quản lý.</p>
                        <button type="button" className="personal-docs-upload-btn" onClick={() => navigate("/upload-document")}>
                          <PlusIcon />
                          <span>Tải lên tài liệu mới</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedDocuments.map((document) => (
                    <tr
                      key={document.id}
                      className="personal-docs-row-clickable"
                      onClick={() => handleViewDetails(document)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleViewDetails(document);
                        }
                      }}
                    >
                      <td>
                        <div className="personal-docs-title-cell">
                          <DocumentTypeIcon fileType={document.fileType} />
                          <div className="personal-docs-title-group">
                            <div className="personal-docs-document-name">{document.title}</div>
                            <div className="personal-docs-document-meta">
                              {document.fileType} • {formatSizeMb(document.fileSize)} MB
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="personal-docs-date-cell">
                        {(() => {
                          const parts = parseLocalDateTime(document.uploadDate);
                          return parts ? (
                            <div className="personal-docs-date">
                              <span>{parts.date}</span>
                              <span>{parts.time}</span>
                            </div>
                          ) : "—";
                        })()}
                      </td>
                      <td className="personal-docs-status-cell">
                        <span className={`personal-docs-status-badge ${getStatusClassName(document.status)}`}>
                          {getStatusLabel(document.status)}
                        </span>
                      </td>
                      <td className="personal-docs-price-cell-col">{renderPriceCell(document)}</td>
                      <td className="personal-docs-number-cell">{Number(document.views || 0).toLocaleString("en-US")}</td>
                      <td className="personal-docs-number-cell">{Number(document.downloads || 0).toLocaleString("en-US")}</td>
                      <td>
                        <div className="personal-docs-actions">
                          <button
                            type="button"
                            className="personal-docs-action-btn"
                            title="Xem chi tiết"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetails(document);
                            }}
                          >
                            <EyeIcon />
                          </button>
                          <button
                            type="button"
                            className="personal-docs-action-btn"
                            title={editingId === document.id ? "Đang tải..." : "Chỉnh sửa"}
                            disabled={editingId === document.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditDocument(document);
                            }}
                          >
                            <EditIcon />
                          </button>
                          <button
                            type="button"
                            className="personal-docs-action-btn"
                            title="Xóa"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDocumentToDelete(document);
                            }}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="personal-docs-footer">
            <p className="personal-docs-footer-text">
              Hiển thị {startItem}–{endItem} / {filteredDocuments.length} tài liệu
            </p>
            <div className="personal-docs-pagination">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>
        </section>
      </div>

      {documentToDelete && (
        <div className="personal-docs-modal-overlay" onClick={() => setDocumentToDelete(null)}>
          <div className="personal-docs-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Xóa tài liệu</h3>
            <p>Bạn có chắc muốn xóa &quot;{documentToDelete.title}&quot; khỏi danh sách tài liệu cá nhân?</p>
            <div className="personal-docs-modal-actions">
              <button type="button" className="personal-docs-modal-btn personal-docs-modal-cancel" onClick={() => setDocumentToDelete(null)}>
                Hủy
              </button>
              <button type="button" className="personal-docs-modal-btn personal-docs-modal-confirm" onClick={handleDeleteDocument}>
                Xóa tài liệu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
