/**
 * Safely parses any date/time format received from backend or local storage into a local Date object.
 * 
 * Handles:
 * - ISO string with 'Z' or timezone offset (e.g. "2026-08-26T21:00:00Z" -> converts to UTC+7 local date)
 * - Naive ISO string without timezone (e.g. "2026-08-26T21:00:00" -> treats as UTC since backend stores UTC)
 * - Array format [YYYY, MM, DD, HH, mm, ss] (treats as UTC)
 * - Existing Date instances or epoch timestamps
 */
export function parseApiDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  // Handle Jackson array format: [y, m, d, h, min, sec, ms]
  if (Array.isArray(value)) {
    const [y, m = 1, d = 1, h = 0, min = 0, sec = 0, ms = 0] = value;
    return new Date(Date.UTC(y, m - 1, d, h, min, sec, ms));
  }

  // Handle number (epoch millis / seconds)
  if (typeof value === "number") {
    return new Date(value < 10000000000 ? value * 1000 : value);
  }

  let s = String(value).trim();
  if (!s) return null;

  // Replace SQL space format "YYYY-MM-DD HH:mm:ss" with "YYYY-MM-DDTHH:mm:ss"
  if (s.includes(" ") && !s.includes("T")) {
    s = s.replace(" ", "T");
  }

  // If string has no timezone offset (neither Z nor +HH:mm/-HH:mm)
  if (!s.endsWith("Z") && !/[+-]\d{2}(:\d{2})?$/.test(s)) {
    s += "Z";
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date(value) : d;
}

export function formatDateTime(value, options = {}) {
  const d = parseApiDate(value);
  if (!d || isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
}

export function formatDate(value, options = {}) {
  const d = parseApiDate(value);
  if (!d || isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...options,
  });
}

export function formatDateDDMMYYYY(value) {
  const d = parseApiDate(value);
  if (!d || isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function timeAgo(dateStr) {
  if (!dateStr) return "";
  const d = parseApiDate(dateStr);
  if (!d || isNaN(d.getTime())) return "";
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "Vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} ngày trước`;
  return formatDate(d);
}

