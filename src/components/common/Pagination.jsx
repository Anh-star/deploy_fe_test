import React from "react";
import "../../styles/commonPagination.css";

/**
 * Builds compact pagination items with ellipsis — matching exact spec.
 *
 * Spec for totalPages = 15:
 *   currentPage = 1  →  1 2 3 ... 15
 *   currentPage = 2  →  1 2 3 ... 15
 *   currentPage = 3  →  1 2 3 4 ... 15   (special: show 4 to avoid "3 ... 15")
 *   currentPage = 7  →  1 ... 6 7 8 ... 15
 *   currentPage = 13 →  1 ... 12 13 14 15  (special: show 12 to avoid "... 13 14 15")
 *   currentPage = 14 →  1 ... 13 14 15
 *   currentPage = 15 →  1 ... 13 14 15
 *
 * Spec for totalPages ≤ 5:
 *   → show all pages, no ellipsis
 *
 * @param {number} currentPage - 1-indexed
 * @param {number} totalPages
 * @returns {Array<{type: 'page'|'ellipsis', page?: number}>}
 */
function buildPaginationItems(currentPage, totalPages) {
  if (totalPages <= 1) return [];

  // Small total: show every page, no ellipsis
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => ({
      type: "page",
      page: i + 1,
    }));
  }

  // General case: always show first (1) and last (totalPages)
  const items = [{ type: "page", page: 1 }];

  // Determine the range of "middle" pages to show around current
  let left;
  let right;

  if (currentPage <= 2) {
    // page 1 or 2: show 1 2 3 ... last
    left = 2;
    right = 3;
  } else if (currentPage === 3) {
    // page 3: show 1 2 3 4 ... last  (special — show 4 so we don't have "3 ... last")
    left = 2;
    right = 4;
  } else if (currentPage >= totalPages - 1) {
    // last or second-to-last: show 1 ... last-2 last-1 last
    left = totalPages - 3;
    right = totalPages - 1;
  } else if (currentPage === totalPages - 2) {
    // third-to-last: show 1 ... last-3 last-2 last-1 last  (special — show last-3)
    left = totalPages - 4;
    right = totalPages - 1;
  } else {
    // middle: show 1 ... current-1 current current+1 ... last
    left = currentPage - 1;
    right = currentPage + 1;
  }

  // Add ellipsis before middle range if there's a gap
  if (left > 2) {
    items.push({ type: "ellipsis" });
  }

  // Add the middle pages
  for (let p = left; p <= right; p++) {
    if (p >= 2 && p <= totalPages - 1) {
      items.push({ type: "page", page: p });
    }
  }

  // Add ellipsis after middle range if there's a gap
  if (right < totalPages - 1) {
    items.push({ type: "ellipsis" });
  }

  // Add last page (if not already added via middle range)
  if (!items.find((i) => i.type === "page" && i.page === totalPages)) {
    items.push({ type: "page", page: totalPages });
  }

  return items;
}

/**
 * Shared Pagination component.
 *
 * Props:
 *   currentPage   — 1-indexed page number (required)
 *   totalPages   — total number of pages (required)
 *   onPageChange — called with new 1-indexed page number (required)
 *
 * No prev/next arrows. No data-info line. Pure page-number control.
 */
export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (!totalPages || totalPages < 1) return null;

  // Always render at least [1] so the pagination bar is never empty
  if (totalPages === 1) {
    return (
      <nav className="shared-pagination" aria-label="Phân trang">
        <button
          type="button"
          className="shared-pagination__btn shared-pagination__btn--active"
          aria-label="Trang 1"
          aria-current="page"
        >
          1
        </button>
      </nav>
    );
  }

  const items = buildPaginationItems(currentPage, totalPages);

  return (
    <nav className="shared-pagination" aria-label="Phân trang">
      {items.map((item, idx) =>
        item.type === "page" ? (
          <button
            key={`page-${item.page}`}
            type="button"
            className={`shared-pagination__btn${
              currentPage === item.page ? " shared-pagination__btn--active" : ""
            }`}
            onClick={() => onPageChange(item.page)}
            aria-label={`Trang ${item.page}`}
            aria-current={currentPage === item.page ? "page" : undefined}
          >
            {item.page}
          </button>
        ) : (
          <span
            key={`ellipsis-${idx}`}
            className="shared-pagination__ellipsis"
            aria-hidden="true"
          >
            …
          </span>
        )
      )}
    </nav>
  );
}
