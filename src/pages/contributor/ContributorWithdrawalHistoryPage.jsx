import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNotification } from "../../context/NotificationContext";
import "../../styles/contributor/contributorWithdrawalHistory.css";
import {
  createContributorWithdrawal,
  getContributorBalance,
  getContributorPayoutProfile,
  listContributorWithdrawals,
  getContributorWithdrawalDetail,
  toContributorWithdrawalErrorMessage,
  toCreateWithdrawalErrorMessage,
  toPayoutProfileErrorMessage,
  upsertContributorPayoutProfile,
} from "../../api/contributorWithdrawalApi";
import {
  FALLBACK_BANKS,
  PREFERRED_BANK_CODES,
  buildBankLogoUrl,
  filterPreferredBanks,
  sortBanksByPreferred,
} from "../../constants/vietnamBanks";

const STATUS_FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "PENDING", label: "Đang chờ duyệt" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "PAID", label: "Thành công" },
  { value: "REJECTED", label: "Thất bại" },
  { value: "CANCELLED", label: "Đã hủy" },
];

const STATUS_LABELS = {
  PENDING: "Đang chờ duyệt",
  APPROVED: "Đã duyệt",
  PAID: "Thành công",
  REJECTED: "Thất bại",
  CANCELLED: "Đã hủy",
};

const STATUS_COLORS = {
  PENDING: "cww-status cww-status-pending",
  APPROVED: "cww-status cww-status-approved",
  PAID: "cww-status cww-status-paid",
  REJECTED: "cww-status cww-status-rejected",
  CANCELLED: "cww-status cww-status-cancelled",
};

const MIN_WITHDRAWAL_AMOUNT = 5001;
const MAX_WITHDRAWAL_AMOUNT = 999999;
const SELLER_NOTE_MAX_LENGTH = 1000;
const HISTORY_PAGE_SIZE = 10;

function generateClientRequestId() {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.randomUUID === "function") {
      try {
        return crypto.randomUUID();
      } catch {
        // fall through to getRandomValues
      }
    }
    if (typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      let filled = false;
      try {
        crypto.getRandomValues(bytes);
        filled = bytes && bytes.length === 16;
      } catch {
        filled = false;
      }
      if (filled) {
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
        const hex = Array.from(bytes, (b) =>
          b.toString(16).padStart(2, "0")
        ).join("");
        return (
          hex.slice(0, 8) +
          "-" +
          hex.slice(8, 12) +
          "-" +
          hex.slice(12, 16) +
          "-" +
          hex.slice(16, 20) +
          "-" +
          hex.slice(20, 32)
        );
      }
    }
  }
  throw new Error("Secure UUID generation is not supported");
}

function formatVnd(value) {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return "—";
  }
}

function formatAmountInput(value) {
  if (value === null || value === undefined || value === "") return "";
  const digits = String(value).replace(/[^\d]/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("vi-VN").format(Number(digits));
}

function sanitizeAmountInput(raw) {
  if (raw === null || raw === undefined) return "";
  return String(raw).replace(/[^\d]/g, "").slice(0, 12);
}

function isUuid(value) {
  if (!value || typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

function maskBankAccount(value) {
  if (!value) return "—";
  const s = String(value);
  if (s.length <= 4) return "•".repeat(s.length);
  return `${"•".repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(
    d.getMonth() + 1
  )}/${d.getFullYear()}`;
}

function formatDateOnly(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function toSafeAmount(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function safeBalanceField(value) {
  const n = toSafeAmount(value);
  return n === null ? 0 : n;
}

function BankIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 10l9-6 9 6" />
      <path d="M5 10v8h14v-8" />
      <path d="M8 14h2M14 14h2" />
      <path d="M5 18v2h14v-2" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
      <polyline points="9 12 11.5 14.5 16 10" />
    </svg>
  );
}

function MoneyIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 9.5h.01M18 14.5h.01" />
    </svg>
  );
}

function getBankInitials(code, shortName) {
  const src =
    shortName && shortName.trim().length > 0 ? shortName : code || "";
  if (!src) return "?";
  const cleaned = String(src).replace(/[^A-Za-zÀ-ỹ0-9 ]/g, "").trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

function BankLogo({
  logo,
  code,
  shortName,
  size = 36,
  className = "",
}) {
  const [errored, setErrored] = useState(false);
  const showImage = Boolean(logo) && !errored;
  const initials = getBankInitials(code, shortName);
  const style = {
    width: size,
    height: size,
    fontSize: Math.max(10, Math.round(size * 0.36)),
  };
  return (
    <span
      className={`cww-bank-logo ${showImage ? "has-image" : "is-initials"} ${className}`}
      style={style}
      aria-hidden="true"
    >
      {showImage ? (
        <img
          src={logo}
          alt=""
          loading="lazy"
          onError={() => setErrored(true)}
        />
      ) : (
        <span className="cww-bank-logo-initials">{initials}</span>
      )}
    </span>
  );
}

function BankSelect({
  banks,
  loading,
  value,
  onChange,
  disabled,
  id,
  hasError,
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const triggerRef = useRef(null);
  const listRef = useRef(null);

  const selected = useMemo(() => {
    if (!value) return null;
    const v = String(value).trim().toUpperCase();
    return banks.find((b) => b.code === v) || null;
  }, [banks, value]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setHighlight(-1);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target) &&
        listRef.current &&
        !listRef.current.contains(e.target)
      ) {
        closeDropdown();
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") closeDropdown();
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, closeDropdown]);

  useEffect(() => {
    if (open && selected) {
      const idx = banks.findIndex((b) => b.code === selected.code);
      setHighlight(idx >= 0 ? idx : 0);
    } else if (open) {
      setHighlight(0);
    }
  }, [open, selected, banks]);

  const handleSelect = useCallback(
    (bank) => {
      if (!bank) return;
      onChange(bank.code, bank);
      closeDropdown();
      if (triggerRef.current) triggerRef.current.focus();
    },
    [onChange, closeDropdown]
  );

  const handleTriggerKey = useCallback(
    (e) => {
      if (disabled) return;
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        setHighlight((i) => (i < 0 ? 0 : i));
      }
    },
    [disabled]
  );

  const handleListKey = useCallback(
    (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((i) => Math.min(banks.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const bank = banks[highlight];
        if (bank) handleSelect(bank);
      } else if (e.key === "Escape") {
        closeDropdown();
      }
    },
    [banks, highlight, handleSelect, closeDropdown]
  );

  const listboxId = id ? `${id}-listbox` : "cww-bankselect-listbox";
  const triggerAria = {
    role: undefined,
    "aria-haspopup": "listbox",
    "aria-expanded": open ? "true" : "false",
    "aria-controls": listboxId,
  };

  return (
    <div
      className={`cww-bankselect${open ? " is-open" : ""}${hasError ? " has-error" : ""}${disabled ? " is-disabled" : ""}`}
    >
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className="cww-bankselect-trigger"
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={handleTriggerKey}
        disabled={disabled}
        {...triggerAria}
      >
        {selected ? (
          <>
            <BankLogo
              logo={selected.logo}
              code={selected.code}
              shortName={selected.shortName}
              size={28}
            />
            <span className="cww-bankselect-trigger-text">
              <span className="cww-bankselect-trigger-name">
                {selected.shortName || selected.code}
              </span>
              <span className="cww-bankselect-trigger-sub">
                {selected.code} · {selected.name}
              </span>
            </span>
          </>
        ) : (
          <span className="cww-bankselect-placeholder">
            {loading ? "Đang tải danh sách ngân hàng..." : "Chọn ngân hàng"}
          </span>
        )}
        <span className="cww-bankselect-chevron">
          <ChevronDownIcon />
        </span>
      </button>

      {open ? (
        <div
          ref={listRef}
          className="cww-bankselect-list"
          role="listbox"
          id={listboxId}
          tabIndex={-1}
          onKeyDown={handleListKey}
          aria-labelledby={id}
        >
          {banks.length === 0 ? (
            <div className="cww-bankselect-empty">
              Không có ngân hàng khả dụng.
            </div>
          ) : (
            banks.map((bank, idx) => {
              const isSelected = selected && selected.code === bank.code;
              const isHighlighted = idx === highlight;
              return (
                <div
                  key={bank.code}
                  role="option"
                  aria-selected={isSelected ? "true" : "false"}
                  className={`cww-bankselect-option${isSelected ? " is-selected" : ""}${isHighlighted ? " is-highlighted" : ""}`}
                  onMouseEnter={() => setHighlight(idx)}
                  onClick={() => handleSelect(bank)}
                >
                  <BankLogo
                    logo={bank.logo}
                    code={bank.code}
                    shortName={bank.shortName}
                    size={32}
                  />
                  <span className="cww-bankselect-option-text">
                    <span className="cww-bankselect-option-name">
                      {bank.shortName || bank.code}
                    </span>
                    <span className="cww-bankselect-option-sub">
                      {bank.name}
                    </span>
                  </span>
                  <span className="cww-bankselect-option-code">{bank.code}</span>
                  {isSelected ? (
                    <span className="cww-bankselect-option-check">
                      <CheckIcon />
                    </span>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

function WalletIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 7a2 2 0 0 1 2-2h12l4 4v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M16 13h2" />
    </svg>
  );
}

function PendingIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function EarningsIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v18" />
      <path d="M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6" />
    </svg>
  );
}

function PaidIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function BankCell({ withdrawal }) {
  const code = withdrawal?.bankCode || "—";
  const number = withdrawal?.maskedBankAccountNumber || "—";
  return (
    <div className="cww-bank-cell">
      <div className="cww-bank-cell-code">{code}</div>
      <div className="cww-bank-cell-number">{number}</div>
    </div>
  );
}

function DateCell({ value }) {
  return <div className="cww-date-cell">{formatDateTime(value)}</div>;
}

function CompletionCell({ value }) {
  return <div className="cww-completion-cell">{formatDateOnly(value)}</div>;
}

function ContributorWithdrawalStatusPill({ status }) {
  const cls = STATUS_COLORS[status] || "cww-status cww-status-default";
  const label = STATUS_LABELS[status] || status || "—";
  return <span className={cls}>{label}</span>;
}

function ContributorWithdrawalTimeline({ withdrawal }) {
  const steps = useMemo(() => {
    return [
      { key: "created", label: "Đã tạo yêu cầu", at: withdrawal?.createdAt },
      { key: "approved", label: "Đã duyệt", at: withdrawal?.approvedAt },
      { key: "paid", label: "Đã thanh toán", at: withdrawal?.paidAt },
      { key: "rejected", label: "Bị từ chối", at: withdrawal?.rejectedAt },
      { key: "cancelled", label: "Đã hủy", at: withdrawal?.cancelledAt },
    ];
  }, [withdrawal]);
  return (
    <ol className="cww-timeline">
      {steps.map((s) => (
        <li
          key={s.key}
          className={`cww-timeline-item${s.at ? " is-done" : " is-pending"}`}
        >
          <span className="cww-timeline-dot" />
          <div className="cww-timeline-body">
            <div className="cww-timeline-label">{s.label}</div>
            <div className="cww-timeline-time">
              {s.at ? formatDateTime(s.at) : "—"}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function DetailModal({ withdrawal, onClose }) {
  if (!withdrawal) return null;
  return (
    <div
      className="cww-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="cww-modal"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <div className="cww-modal-header">
          <div>
            <div className="cww-modal-title">Chi tiết yêu cầu rút tiền</div>
            <div className="cww-modal-subtitle">
              Mã yêu cầu: {withdrawal?.withdrawalId || "—"}
            </div>
          </div>
          <button
            type="button"
            className="cww-icon-button"
            onClick={onClose}
            aria-label="Đóng"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="cww-modal-body">
          <div className="cww-detail-grid">
            <div>
              <div className="cww-detail-label">Số tiền</div>
              <div className="cww-detail-value">
                {formatVnd(withdrawal?.amount)}
              </div>
            </div>
            <div>
              <div className="cww-detail-label">Trạng thái</div>
              <div className="cww-detail-value">
                <ContributorWithdrawalStatusPill
                  status={withdrawal?.status}
                />
              </div>
            </div>
            <div>
              <div className="cww-detail-label">Ngân hàng</div>
              <div className="cww-detail-value">
                {withdrawal?.bankCode || "—"}
              </div>
            </div>
            <div>
              <div className="cww-detail-label">Số tài khoản</div>
              <div className="cww-detail-value">
                {withdrawal?.maskedBankAccountNumber || "—"}
              </div>
            </div>
            <div className="cww-detail-full">
              <div className="cww-detail-label">Ghi chú</div>
              <div className="cww-detail-value">
                {withdrawal?.sellerNote ? withdrawal.sellerNote : "—"}
              </div>
            </div>
            {withdrawal?.rejectionReason ? (
              <div className="cww-detail-full">
                <div className="cww-detail-label">Lý do từ chối</div>
                <div className="cww-detail-value cww-detail-rejection">
                  {withdrawal.rejectionReason}
                </div>
              </div>
            ) : null}
          </div>

          <div className="cww-detail-section-title">Tiến trình</div>
          <ContributorWithdrawalTimeline withdrawal={withdrawal} />
        </div>

        <div className="cww-modal-footer">
          <button
            type="button"
            className="cww-button cww-button-ghost"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

function PayoutProfileModal({
  open,
  profile,
  banks,
  banksLoading,
  submitting,
  errorMessage,
  onSubmit,
  onClose,
}) {
  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountHolderName, setBankAccountHolderName] = useState("");

  useEffect(() => {
    if (!open) return;
    setBankCode(profile?.bankCode || "");
    setBankName(profile?.bankName || "");
    setBankAccountNumber("");
    setBankAccountHolderName(profile?.bankAccountHolderName || "");
  }, [open, profile]);

  const handleBankSelect = useCallback(
    (code, bank) => {
      setBankCode(code);
      if (bank && bank.name) {
        setBankName(bank.name);
      } else {
        // Bank not in catalog (e.g. legacy code). Keep name as-is if user
        // already had one typed/loaded; otherwise clear.
        setBankName((prev) => prev || "");
      }
    },
    []
  );

  const selectedBankForLogo = useMemo(() => {
    if (!bankCode) return null;
    const target = String(bankCode).trim().toUpperCase();
    const found = banks.find((b) => b.code === target);
    if (found) return found;
    return {
      code: target,
      shortName: target,
      name: bankName || "",
      logo: buildBankLogoUrl(target),
    };
  }, [banks, bankCode, bankName]);

  if (!open) return null;

  const isUpdateMode = Boolean(
    profile &&
      (profile.configured === true ||
        (profile.bankCode && profile.bankAccountHolderName))
  );

  const BANK_CODE_MAX = 32;
  const BANK_NAME_MAX = 255;
  const BANK_ACCOUNT_MAX = 64;
  const HOLDER_NAME_MAX = 255;

  const hasChanges =
    bankCode.trim().length > 0 &&
    bankCode.trim().length <= BANK_CODE_MAX &&
    bankName.trim().length > 0 &&
    bankName.trim().length <= BANK_NAME_MAX &&
    bankAccountNumber.trim().length > 0 &&
    bankAccountNumber.trim().length <= BANK_ACCOUNT_MAX &&
    bankAccountHolderName.trim().length > 0 &&
    bankAccountHolderName.trim().length <= HOLDER_NAME_MAX;

  return (
    <div
      className="cww-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="cww-modal"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <div className="cww-modal-header">
          <div>
            <div className="cww-modal-title">
              {profile ? "Cập nhật" : "Thiết lập"} tài khoản nhận tiền
            </div>
            <div className="cww-modal-subtitle">
              Thông tin này sẽ được dùng cho các yêu cầu rút tiền của bạn.
            </div>
          </div>
          <button
            type="button"
            className="cww-icon-button"
            onClick={onClose}
            aria-label="Đóng"
          >
            <CloseIcon />
          </button>
        </div>

        <form
          className="cww-modal-body"
          onSubmit={(e) => {
            e.preventDefault();
            if (!hasChanges || submitting) return;
            onSubmit({
              bankCode: bankCode.trim(),
              bankName: bankName.trim(),
              bankAccountNumber: bankAccountNumber.trim(),
              bankAccountHolderName: bankAccountHolderName.trim(),
            });
          }}
        >
          <div className="cww-form-field">
            <label className="cww-form-label" id="cww-pp-bankCode-label">
              Ngân hàng
            </label>
            <BankSelect
              id="cww-pp-bankCode"
              banks={banks}
              loading={banksLoading}
              value={bankCode}
              onChange={handleBankSelect}
              disabled={submitting}
            />
          </div>

          <div className="cww-form-field">
            <label className="cww-form-label" id="cww-pp-bankName-label">
              Tên ngân hàng
            </label>
            <div
              className={`cww-bank-readonly${bankName ? " has-value" : ""}`}
              aria-labelledby="cww-pp-bankName-label"
            >
              {selectedBankForLogo ? (
                <BankLogo
                  logo={selectedBankForLogo.logo}
                  code={selectedBankForLogo.code}
                  shortName={selectedBankForLogo.shortName}
                  size={24}
                  className="cww-bank-readonly-logo"
                />
              ) : null}
              <span className="cww-bank-readonly-text">
                {bankName || "Chọn ngân hàng để hệ thống tự điền tên."}
              </span>
              <input type="hidden" value={bankName} readOnly />
            </div>
          </div>

          <div className="cww-form-field">
            <label className="cww-form-label" htmlFor="cww-pp-account">
              Số tài khoản
            </label>
            <input
              id="cww-pp-account"
              type="text"
              inputMode="numeric"
              className="cww-form-input"
              value={bankAccountNumber}
              onChange={(e) =>
                setBankAccountNumber(sanitizeAmountInput(e.target.value))
              }
              placeholder={
                isUpdateMode
                  ? "Nhập lại số tài khoản để cập nhật thông tin"
                  : "Nhập số tài khoản ngân hàng"
              }
              autoComplete="off"
              maxLength={BANK_ACCOUNT_MAX}
              disabled={submitting}
              required
            />
            {isUpdateMode ? (
              <div className="cww-form-hint">
                Vì lý do bảo mật, hệ thống chỉ lưu phần đã che. Vui lòng nhập
                lại số tài khoản đầy đủ để cập nhật.
              </div>
            ) : null}
          </div>

          <div className="cww-form-field">
            <label className="cww-form-label" htmlFor="cww-pp-holder">
              Chủ tài khoản
            </label>
            <input
              id="cww-pp-holder"
              type="text"
              className="cww-form-input"
              value={bankAccountHolderName}
              onChange={(e) => setBankAccountHolderName(e.target.value)}
              placeholder="Nhập tên chủ tài khoản (viết hoa)"
              autoComplete="off"
              maxLength={HOLDER_NAME_MAX}
              disabled={submitting}
              required
            />
          </div>

          {errorMessage ? (
            <div className="cww-form-error" role="alert">
              {errorMessage}
            </div>
          ) : null}

          <div className="cww-modal-footer cww-modal-footer-form">
            <button
              type="button"
              className="cww-button cww-button-ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="cww-button cww-button-primary"
              disabled={!hasChanges || submitting}
            >
              {submitting ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BalanceCards({ balance, loading, error }) {
  const safe = balance || {};
  const cards = [
    {
      key: "available",
      title: "Số dư khả dụng",
      value: safeBalanceField(safe.availableBalance),
      icon: <WalletIcon />,
      tone: "available",
      desc: "Có thể sử dụng để tạo yêu cầu rút tiền",
    },
    {
      key: "pending",
      title: "Thu nhập đang chờ",
      value: safeBalanceField(safe.pendingBalance),
      icon: <PendingIcon />,
      tone: "pending",
      desc: "Đang chờ đủ điều kiện để chuyển sang số dư khả dụng",
    },
    {
      key: "locked",
      title: "Tiền đang khóa",
      value: safeBalanceField(safe.lockedBalance),
      icon: <LockIcon />,
      tone: "locked",
      desc: "Đang được giữ trong yêu cầu rút tiền chờ xử lý",
    },
    {
      key: "earned",
      title: "Tổng thu nhập",
      value: safeBalanceField(safe.totalEarned),
      icon: <EarningsIcon />,
      tone: "earned",
      desc: "Tổng thu nhập tích lũy của bạn",
    },
    {
      key: "withdrawn",
      title: "Đã rút thành công",
      value: safeBalanceField(safe.totalWithdrawn),
      icon: <PaidIcon />,
      tone: "withdrawn",
      desc: "Tổng tiền đã rút thành công",
    },
  ];

  return (
    <div className="cww-balance-grid">
      {cards.map((c) => (
        <div
          key={c.key}
          className={`cww-balance-card cww-balance-card-${c.tone}`}
        >
          <div className="cww-balance-card-head">
            <span className={`cww-balance-icon cww-balance-icon-${c.tone}`}>
              {c.icon}
            </span>
            <span className="cww-balance-title">{c.title}</span>
          </div>
          <div className="cww-balance-value">
            {loading ? <span className="cww-skeleton">—</span> : formatVnd(c.value)}
          </div>
          <div className="cww-balance-desc">{c.desc}</div>
        </div>
      ))}
      {error ? (
        <div className="cww-balance-error" role="alert">
          Không thể tải số dư: {error}
        </div>
      ) : null}
    </div>
  );
}

function PayoutProfileCard({
  profile,
  loading,
  error,
  banks,
  onOpenModal,
}) {
  if (loading) {
    return (
      <div className="cww-payout-card">
        <div className="cww-payout-head">
          <h3 className="cww-card-title">Tài khoản nhận tiền</h3>
        </div>
        <div className="cww-payout-body">
          <span className="cww-skeleton">Đang tải...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cww-payout-card">
        <div className="cww-payout-head">
          <h3 className="cww-card-title">Tài khoản nhận tiền</h3>
        </div>
        <div className="cww-payout-body">
          <div className="cww-payout-error" role="alert">
            Không thể tải tài khoản nhận tiền: {error}
          </div>
          <button
            type="button"
            className="cww-button cww-button-ghost"
            onClick={onOpenModal}
          >
            Thiết lập lại
          </button>
        </div>
      </div>
    );
  }

  const isProfileConfigured =
    Boolean(profile) &&
    (profile.configured === true ||
      Boolean(profile.maskedBankAccountNumber) ||
      Boolean(profile.bankCode));

  if (!profile || !isProfileConfigured) {
    return (
      <div className="cww-payout-card cww-payout-card-empty">
        <div className="cww-payout-head">
          <span className="cww-payout-icon"><BankIcon /></span>
          <h3 className="cww-card-title">Chưa thiết lập tài khoản nhận tiền</h3>
        </div>
        <p className="cww-payout-desc">
          Bạn cần thêm tài khoản ngân hàng trước khi tạo yêu cầu rút tiền.
        </p>
        <button
          type="button"
          className="cww-button cww-button-primary"
          onClick={onOpenModal}
        >
          Thiết lập tài khoản
        </button>
      </div>
    );
  }

  // Lookup current bank in catalog to get the logo. If not in catalog (legacy
  // bank or unknown code), synthesize a minimal logo entry from the code.
  const currentCode = profile.bankCode || "";
  const catalogMatch = banks
    ? banks.find((b) => b.code === String(currentCode).trim().toUpperCase())
    : null;
  const bankForCard = catalogMatch || {
    code: currentCode,
    shortName:
      profile.bankName ||
      (currentCode ? String(currentCode).toUpperCase() : ""),
    name: profile.bankName || "",
    logo: buildBankLogoUrl(currentCode),
  };

  return (
    <div className="cww-payout-card">
      <div className="cww-payout-brand">
        <div className="cww-payout-brand-logo">
          <BankLogo
            logo={bankForCard.logo}
            code={bankForCard.code}
            shortName={bankForCard.shortName}
            size={64}
          />
        </div>
        <div className="cww-payout-brand-text">
          <div className="cww-payout-brand-name">
            {bankForCard.shortName || currentCode || "Ngân hàng"}
          </div>
          <div className="cww-payout-brand-meta">
            <span className="cww-payout-brand-code">{currentCode || "—"}</span>
            <span className="cww-payout-brand-divider">·</span>
            <span className="cww-payout-brand-sub">
              Tài khoản nhận tiền đang sử dụng
            </span>
          </div>
        </div>
        {profile?.status ? (
          <span className="cww-payout-status">{profile.status}</span>
        ) : null}
      </div>

      <div className="cww-payout-body">
        <div className="cww-payout-row">
          <div className="cww-payout-label">Tên ngân hàng</div>
          <div className="cww-payout-value">
            {profile.bankName || "—"}
          </div>
        </div>
        <div className="cww-payout-row">
          <div className="cww-payout-label">Số tài khoản</div>
          <div className="cww-payout-value">
            {maskBankAccount(
              profile.maskedBankAccountNumber || profile.bankAccountNumber
            )}
          </div>
        </div>
        <div className="cww-payout-row">
          <div className="cww-payout-label">Chủ tài khoản</div>
          <div className="cww-payout-value">
            {profile.bankAccountHolderName || "—"}
          </div>
        </div>
      </div>

      <div className="cww-info-panel">
        <span className="cww-info-panel-icon"><ShieldCheckIcon /></span>
        <span className="cww-info-panel-text">
          Tiền rút sẽ được chuyển tới tài khoản này sau khi yêu cầu được duyệt.
        </span>
      </div>

      <div className="cww-payout-actions">
        <button
          type="button"
          className="cww-button cww-button-ghost"
          onClick={onOpenModal}
        >
          Cập nhật
        </button>
      </div>
    </div>
  );
}

function CreateWithdrawalForm({
  balance,
  payoutProfile,
  balanceLoading,
  balanceError,
  onSuccess,
  onOpenPayoutModal,
}) {
  const notification = useNotification();
  const [amountInput, setAmountInput] = useState("");
  const [sellerNote, setSellerNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [validationError, setValidationError] = useState("");
  const clientRequestIdRef = useRef(null);

  const ensureRequestId = useCallback(() => {
    if (!clientRequestIdRef.current) {
      // generateClientRequestId throws if no secure RNG is available;
      // we intentionally do NOT catch here so the error propagates to handleSubmit.
      clientRequestIdRef.current = generateClientRequestId();
    }
    return clientRequestIdRef.current;
  }, []);

  const available = toSafeAmount(balance?.availableBalance);
  const profileReady = Boolean(
    payoutProfile &&
      (payoutProfile.configured === true ||
        (payoutProfile.bankCode &&
          payoutProfile.bankAccountHolderName &&
          (payoutProfile.maskedBankAccountNumber ||
            payoutProfile.bankAccountNumber)))
  );

  const balanceReady =
    !balanceLoading && !balanceError && available !== null;

  const underMinimum =
    balanceReady && available < MIN_WITHDRAWAL_AMOUNT;

  const maxAmount = balanceReady
    ? Math.min(available, MAX_WITHDRAWAL_AMOUNT)
    : MAX_WITHDRAWAL_AMOUNT;

  const trimmedNote = sellerNote.trim();
  const noteOverLimit = trimmedNote.length > SELLER_NOTE_MAX_LENGTH;

  const submitDisabled =
    submitting ||
    !balanceReady ||
    !profileReady ||
    underMinimum ||
    !amountInput ||
    noteOverLimit;

  function handleAmountChange(e) {
    const sanitized = sanitizeAmountInput(e.target.value);
    setAmountInput(sanitized);
    setValidationError("");
    setSubmitError("");
    clientRequestIdRef.current = null;
  }

  function handleNoteChange(e) {
    setSellerNote(e.target.value);
    setValidationError("");
    setSubmitError("");
    if (e.target.value !== sellerNote) {
      clientRequestIdRef.current = null;
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    if (!profileReady) {
      setValidationError(
        "Vui lòng thiết lập tài khoản nhận tiền trước khi rút."
      );
      return;
    }
    if (!balanceReady) {
      setValidationError("Không thể đọc số dư hiện tại, vui lòng làm mới.");
      return;
    }
    const parsed = Number(amountInput);
    if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
      setValidationError("Vui lòng nhập số tiền muốn rút.");
      return;
    }
    if (parsed < MIN_WITHDRAWAL_AMOUNT) {
      setValidationError(
        `Số tiền rút tối thiểu là ${formatVnd(MIN_WITHDRAWAL_AMOUNT)}.`
      );
      return;
    }
    if (parsed > MAX_WITHDRAWAL_AMOUNT) {
      setValidationError("Số tiền rút vượt quá giới hạn cho phép.");
      return;
    }
    if (parsed > available) {
      setValidationError("Số dư khả dụng của bạn không đủ.");
      return;
    }
    if (noteOverLimit) {
      setValidationError(
        `Ghi chú tối đa ${SELLER_NOTE_MAX_LENGTH} ký tự.`
      );
      return;
    }
    setValidationError("");
    setSubmitError("");

    let requestId;
    try {
      requestId = ensureRequestId();
    } catch (uuidErr) {
      // Browser does not support secure UUID generation. Do not POST.
      clientRequestIdRef.current = null;
      const safeMsg =
        "Trình duyệt không hỗ trợ tạo mã yêu cầu an toàn. Vui lòng cập nhật trình duyệt và thử lại.";
      setSubmitError(safeMsg);
      notification.error(safeMsg);
      return;
    }
    if (!requestId) {
      setSubmitError("Không thể tạo mã yêu cầu, vui lòng thử lại.");
      return;
    }

    setSubmitting(true);
    try {
      await createContributorWithdrawal({
        amount: parsed,
        clientRequestId: requestId,
        sellerNote: trimmedNote.length > 0 ? trimmedNote : null,
      });
      notification.success("Yêu cầu rút tiền đã được tạo thành công.");
      setAmountInput("");
      setSellerNote("");
      clientRequestIdRef.current = null;
      onSuccess?.();
    } catch (err) {
      const status = err?.response?.status;
      const backendMsg = err?.response?.data?.message || "";
      let mapped;
      if (status === 409) {
        if (/duplicate|đã được gửi/i.test(backendMsg)) {
          mapped = "Yêu cầu này đã được gửi trước đó. Vui lòng làm mới lịch sử.";
        } else {
          mapped = "Dữ liệu số dư đã thay đổi. Vui lòng tải lại và thử lại.";
        }
      } else if (status === 400 && /minimum|tối thiểu/i.test(backendMsg)) {
        mapped = "Số tiền rút chưa đạt mức tối thiểu.";
      } else if (status === 400 && /payout|profile|tài khoản/i.test(backendMsg)) {
        mapped = "Bạn cần thiết lập tài khoản nhận tiền trước khi rút.";
      } else if (status === 400 && /balance|số dư|insufficient/i.test(backendMsg)) {
        mapped = "Số dư khả dụng không đủ để thực hiện yêu cầu.";
      } else if (status === 403) {
        mapped = "Bạn không có quyền tạo yêu cầu rút tiền.";
      } else if (status === 500) {
        mapped = "Có lỗi xảy ra, vui lòng thử lại.";
      } else {
        mapped = toCreateWithdrawalErrorMessage(err);
      }
      setSubmitError(mapped);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="cww-form-card" onSubmit={handleSubmit}>
      <div className="cww-form-head">
        <h3 className="cww-card-title">Tạo yêu cầu rút tiền</h3>
      </div>

      <div className="cww-form-stats">
        <div className="cww-form-stat cww-form-stat-available">
          <span className="cww-form-stat-label">Số dư có thể rút</span>
          <span className="cww-form-stat-value">
            {balanceReady ? formatVnd(available) : "—"}
          </span>
        </div>
        <div className="cww-form-stat cww-form-stat-min">
          <span className="cww-form-stat-label">Tối thiểu</span>
          <span className="cww-form-stat-value">
            {formatVnd(MIN_WITHDRAWAL_AMOUNT)}
          </span>
        </div>
        <div className="cww-form-stat cww-form-stat-max">
          <span className="cww-form-stat-label">Tối đa</span>
          <span className="cww-form-stat-value">{formatVnd(maxAmount)}</span>
        </div>
      </div>

      {!profileReady ? (
        <div className="cww-form-warning" role="alert">
          Vui lòng thiết lập tài khoản nhận tiền trước khi rút.
          <button
            type="button"
            className="cww-inline-button"
            onClick={onOpenPayoutModal}
          >
            Thiết lập ngay
          </button>
        </div>
      ) : null}

      {balanceError ? (
        <div className="cww-form-warning" role="alert">
          Không thể đọc số dư hiện tại. Vui lòng làm mới trang rồi thử lại.
        </div>
      ) : null}

      {underMinimum ? (
        <div className="cww-form-warning" role="status">
          Số dư khả dụng chưa đạt mức rút tối thiểu{" "}
          {formatVnd(MIN_WITHDRAWAL_AMOUNT)}.
        </div>
      ) : null}

      <div className="cww-form-field">
        <label className="cww-form-label" htmlFor="cww-amount">
          Số tiền muốn rút
        </label>
        <div className="cww-form-input-wrap cww-form-input-with-icon">
          <span className="cww-form-input-icon" aria-hidden="true">
            <MoneyIcon />
          </span>
          <input
            id="cww-amount"
            type="text"
            inputMode="numeric"
            className="cww-form-input"
            value={amountInput}
            onChange={handleAmountChange}
            placeholder="Nhập số tiền (VND)"
            autoComplete="off"
            disabled={!balanceReady || !profileReady || underMinimum}
            maxLength={12}
          />
          <span className="cww-form-input-suffix">VND</span>
        </div>
        {amountInput ? (
          <div className="cww-form-hint">Sẽ gửi: {formatAmountInput(amountInput)} ₫</div>
        ) : null}
      </div>

      <div className="cww-form-field">
        <label className="cww-form-label" htmlFor="cww-note">
          Ghi chú (không bắt buộc)
        </label>
        <textarea
          id="cww-note"
          className="cww-form-textarea"
          value={sellerNote}
          onChange={handleNoteChange}
          placeholder="Ghi chú cho yêu cầu rút tiền (không bắt buộc)"
          maxLength={SELLER_NOTE_MAX_LENGTH}
          rows={3}
          disabled={!profileReady}
        />
        <div className="cww-form-counter">
          {trimmedNote.length}/{SELLER_NOTE_MAX_LENGTH}
        </div>
      </div>

      {validationError ? (
        <div className="cww-form-error" role="alert">
          {validationError}
        </div>
      ) : null}
      {submitError ? (
        <div className="cww-form-error" role="alert">
          {submitError}
        </div>
      ) : null}

      <div className="cww-form-actions">
        <button
          type="submit"
          className="cww-button cww-button-primary"
          disabled={submitDisabled}
        >
          {submitting ? "Đang gửi..." : "Gửi yêu cầu rút tiền"}
        </button>
      </div>
    </form>
  );
}

function HistorySection({
  history,
  loading,
  error,
  statusFilter,
  onStatusFilterChange,
  page,
  totalPages,
  onPageChange,
  refreshLoading,
  onRefresh,
  onViewDetail,
}) {
  const rows = Array.isArray(history) ? history : [];

  return (
    <section className="cww-history-section">
      <div className="cww-history-header">
        <div>
          <h3 className="cww-card-title">Lịch sử rút tiền</h3>
          <p className="cww-card-subtitle">
            Theo dõi trạng thái các yêu cầu rút tiền của bạn.
          </p>
        </div>
        <button
          type="button"
          className="cww-button cww-button-ghost"
          onClick={onRefresh}
          disabled={refreshLoading}
        >
          <RefreshIcon />
          <span>{refreshLoading ? "Đang tải..." : "Làm mới"}</span>
        </button>
      </div>

      <div className="cww-filter-bar">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value || "all"}
            type="button"
            className={`cww-filter-chip${
              (statusFilter || "") === f.value ? " is-active" : ""
            }`}
            onClick={() => onStatusFilterChange(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && rows.length === 0 ? (
        <div className="cww-history-loading">Đang tải lịch sử...</div>
      ) : null}

      {error ? (
        <div className="cww-form-error" role="alert">
          {error}
        </div>
      ) : null}

      {!loading && rows.length === 0 ? (
        <div className="cww-history-empty">
          Bạn chưa có yêu cầu rút tiền nào.
        </div>
      ) : null}

      {rows.length > 0 ? (
        <>
          <div className="cww-table-wrap">
            <table className="cww-table">
              <thead>
                <tr>
                  <th>Mã yêu cầu</th>
                  <th>Số tiền</th>
                  <th>Ngân hàng</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th>Hoàn tất</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((w) => (
                  <tr key={w?.withdrawalId || `${w?.createdAt}-${w?.amount}`}>
                    <td className="cww-mono">
                      {w?.withdrawalId
                        ? `${String(w.withdrawalId).slice(0, 8)}…`
                        : "—"}
                    </td>
                    <td>{formatVnd(w?.amount)}</td>
                    <td><BankCell withdrawal={w} /></td>
                    <td>
                      <ContributorWithdrawalStatusPill status={w?.status} />
                    </td>
                    <td><DateCell value={w?.createdAt} /></td>
                    <td>
                      <CompletionCell
                        value={
                          w?.paidAt ||
                          w?.rejectedAt ||
                          w?.cancelledAt ||
                          w?.approvedAt
                        }
                      />
                    </td>
                    <td className="cww-row-actions">
                      <button
                        type="button"
                        className="cww-button cww-button-link"
                        onClick={() => onViewDetail(w)}
                        disabled={!isUuid(w?.withdrawalId)}
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="cww-mobile-list">
            {rows.map((w) => (
              <article
                key={`m-${w?.withdrawalId || `${w?.createdAt}-${w?.amount}`}`}
                className="cww-mobile-card"
              >
                <div className="cww-mobile-card-head">
                  <div className="cww-mobile-card-amount">
                    {formatVnd(w?.amount)}
                  </div>
                  <ContributorWithdrawalStatusPill status={w?.status} />
                </div>
                <div className="cww-mobile-card-row">
                  <span>Ngân hàng</span>
                  <BankCell withdrawal={w} />
                </div>
                <div className="cww-mobile-card-row">
                  <span>Ngày tạo</span>
                  <DateCell value={w?.createdAt} />
                </div>
                <div className="cww-mobile-card-actions">
                  <button
                    type="button"
                    className="cww-button cww-button-link"
                    onClick={() => onViewDetail(w)}
                    disabled={!isUuid(w?.withdrawalId)}
                  >
                    Xem chi tiết
                  </button>
                </div>
              </article>
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="cww-pagination">
              <button
                type="button"
                className="cww-button cww-button-ghost"
                onClick={() => onPageChange(Math.max(0, page - 1))}
                disabled={page <= 0}
              >
                Trang trước
              </button>
              <span className="cww-pagination-info">
                Trang {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                className="cww-button cww-button-ghost"
                onClick={() =>
                  onPageChange(Math.min(totalPages - 1, page + 1))
                }
                disabled={page >= totalPages - 1}
              >
                Trang sau
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export default function ContributorWithdrawalHistoryPage() {
  const notification = useNotification();

  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState("");

  const [payoutProfile, setPayoutProfile] = useState(null);
  const [payoutLoading, setPayoutLoading] = useState(true);
  const [payoutError, setPayoutError] = useState("");
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);
  const [payoutModalError, setPayoutModalError] = useState("");

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const skipNextHistoryEffectRef = useRef(false);

  const [banks, setBanks] = useState(FALLBACK_BANKS);
  const [banksLoading, setBanksLoading] = useState(true);
  const [banksError, setBanksError] = useState("");
  const banksLoadedRef = useRef(false);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailWithdrawal, setDetailWithdrawal] = useState(null);

  const fetchBalance = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const data = await getContributorBalance();
      setBalance(data || null);
      setBalanceError("");
    } catch (err) {
      setBalance(null);
      setBalanceError(toContributorWithdrawalErrorMessage(err));
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  const fetchBanks = useCallback(async () => {
    if (banksLoadedRef.current) return;
    banksLoadedRef.current = true;
    setBanksLoading(true);
    try {
      const res = await fetch("https://api.vietqr.io/v2/banks", {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Banks API ${res.status}`);
      const json = await res.json();
      const rawList = Array.isArray(json?.data) ? json.data : [];
      const filtered = filterPreferredBanks(rawList)
        .map((b) => ({
          code: b.code,
          shortName: b.shortName || b.name || b.code,
          name: b.name || b.shortName || b.code,
          logo: b.logo || buildBankLogoUrl(b.code),
        }));
      const merged = filtered.length > 0 ? filtered : FALLBACK_BANKS;
      const sorted = sortBanksByPreferred(merged);
      setBanks(sorted);
      setBanksError("");
    } catch (err) {
      // Never break the page; fall back to local list silently.
      setBanks(sortBanksByPreferred(FALLBACK_BANKS));
      setBanksError("fallback");
    } finally {
      setBanksLoading(false);
    }
  }, []);

  const lookupBankByCode = useCallback(
    (code) => {
      if (!code) return null;
      const target = String(code).trim().toUpperCase();
      const found = banks.find((b) => b.code === target);
      if (found) return found;
      return {
        code: target,
        shortName: target,
        name: "",
        logo: buildBankLogoUrl(target),
      };
    },
    [banks]
  );

  const fetchPayoutProfile = useCallback(async () => {
    setPayoutLoading(true);
    try {
      const data = await getContributorPayoutProfile();
      setPayoutProfile(data || null);
      setPayoutError("");
    } catch (err) {
      const status = err?.response?.status;
      setPayoutProfile(null);
      if (status === 404) {
        setPayoutError("");
      } else {
        setPayoutError(toPayoutProfileErrorMessage(err));
      }
    } finally {
      setPayoutLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(
    async ({
      silent = false,
      pageOverride,
      sizeOverride,
      statusOverride,
    } = {}) => {
      const effectivePage =
        typeof pageOverride === "number" ? pageOverride : page;
      const effectiveSize =
        typeof sizeOverride === "number" ? sizeOverride : HISTORY_PAGE_SIZE;
      const effectiveStatus =
        typeof statusOverride === "string" ? statusOverride : statusFilter;
      if (!silent) setHistoryLoading(true);
      try {
        const data = await listContributorWithdrawals({
          page: effectivePage,
          size: effectiveSize,
          status: effectiveStatus || undefined,
        });
        const rows = Array.isArray(data?.items) ? data.items : [];
        setHistory(rows);
        const tp =
          typeof data?.totalPages === "number"
            ? data.totalPages
            : Math.max(
                1,
                Math.ceil(
                  (data?.totalItems || rows.length) / effectiveSize
                )
              );
        setTotalPages(tp);
        setHistoryError("");
      } catch (err) {
        setHistory([]);
        setHistoryError(toContributorWithdrawalErrorMessage(err));
      } finally {
        setHistoryLoading(false);
      }
    },
    [page, statusFilter]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      // Kick off banks catalog in parallel — non-blocking, used only by UI.
      fetchBanks();
      await Promise.allSettled([fetchBalance(), fetchPayoutProfile()]);
      if (!mounted) return;
    })();
    return () => {
      mounted = false;
    };
    // mount only — fetchHistory runs in its own effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (skipNextHistoryEffectRef.current) {
      skipNextHistoryEffectRef.current = false;
      return;
    }
    fetchHistory();
  }, [fetchHistory]);

  const handleRefresh = useCallback(async () => {
    setRefreshLoading(true);
    try {
      await Promise.allSettled([
        fetchBalance(),
        fetchPayoutProfile(),
        fetchHistory({ silent: true }),
      ]);
    } finally {
      setRefreshLoading(false);
    }
  }, [fetchBalance, fetchPayoutProfile, fetchHistory]);

  const handleStatusFilterChange = useCallback((value) => {
    setStatusFilter(value || "");
    setPage(0);
  }, []);

  const handlePageChange = useCallback((next) => {
    setPage(next);
  }, []);

  const handleCreateSuccess = useCallback(async () => {
    // 1. Decide whether the [fetchHistory] effect will actually fire after we
    //    reset page/filter below. It only fires when at least one of those
    //    values changes. If neither changes (user was already on page=0 /
    //    filter=""), the effect will NOT run, and a `true` skip flag would
    //    leak into the next genuine user interaction (a stale skip would
    //    wrongly swallow the next filter/page request).
    const willChangePage = page !== 0;
    const willChangeFilter = statusFilter !== "";
    const effectWillFire = willChangePage || willChangeFilter;
    skipNextHistoryEffectRef.current = effectWillFire;

    // 2. Reset filter + page to defaults so subsequent effect-driven fetches
    //    (e.g. user changes filter later) see the clean baseline.
    setStatusFilter("");
    setPage(0);

    // 3. Fire balance + history explicitly with overridden params so we get
    //    a refresh in EVERY scenario — including when state didn't change.
    //    The skip ref is consumed by the effect in the "state changed" path,
    //    and is false in the "state unchanged" path (no effect run to skip).
    try {
      await Promise.allSettled([
        fetchBalance(),
        fetchHistory({
          silent: true,
          pageOverride: 0,
          sizeOverride: HISTORY_PAGE_SIZE,
          statusOverride: "",
        }),
      ]);
    } finally {
      // Defensive: ensure the skip flag is NEVER stuck at true. The effect
      // path (state changed) consumes it on its own; this catch-all covers
      // any edge case where the effect does not fire (state unchanged path)
      // or where the API chain throws synchronously before React commits.
      if (!effectWillFire) {
        skipNextHistoryEffectRef.current = false;
      }
    }
  }, [fetchBalance, fetchHistory, page, statusFilter]);

  const handleOpenPayoutModal = useCallback(() => {
    setPayoutModalError("");
    setPayoutModalOpen(true);
  }, []);

  const handleClosePayoutModal = useCallback(() => {
    if (payoutSubmitting) return;
    setPayoutModalOpen(false);
  }, [payoutSubmitting]);

  const handleSubmitPayout = useCallback(
    async (payload) => {
      setPayoutSubmitting(true);
      try {
        await upsertContributorPayoutProfile(payload);
        notification.success("Đã cập nhật tài khoản nhận tiền.");
        setPayoutModalOpen(false);
        await fetchPayoutProfile();
      } catch (err) {
        setPayoutModalError(toPayoutProfileErrorMessage(err));
      } finally {
        setPayoutSubmitting(false);
      }
    },
    [fetchPayoutProfile, notification]
  );

  const handleViewDetail = useCallback(async (withdrawal) => {
    setDetailWithdrawal(withdrawal || null);
    setDetailModalOpen(true);
    const id = withdrawal?.withdrawalId;
    if (!isUuid(id)) return;
    setDetailLoading(true);
    try {
      const full = await getContributorWithdrawalDetail(id);
      if (full) setDetailWithdrawal(full);
    } catch (err) {
      // keep modal open with partial data, surface via notification
      notification.error(toContributorWithdrawalErrorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  }, [notification]);

  const handleCloseDetail = useCallback(() => {
    setDetailModalOpen(false);
    setDetailWithdrawal(null);
  }, []);

  const profileReady = Boolean(
    payoutProfile &&
      (payoutProfile.configured === true ||
        (payoutProfile.bankCode &&
          payoutProfile.bankAccountHolderName &&
          (payoutProfile.maskedBankAccountNumber ||
            payoutProfile.bankAccountNumber)))
  );

  return (
    <div className="cww-page">
      <header className="cww-page-header">
        <div>
          <h1 className="cww-page-title">Rút tiền</h1>
          <p className="cww-page-subtitle">
            Quản lý số dư, tài khoản nhận tiền và các yêu cầu rút tiền của bạn
          </p>
        </div>
        <button
          type="button"
          className="cww-button cww-button-primary"
          onClick={handleRefresh}
          disabled={refreshLoading}
        >
          <RefreshIcon />
          <span>{refreshLoading ? "Đang làm mới..." : "Làm mới"}</span>
        </button>
      </header>

      <section className="cww-section" aria-labelledby="cww-balance-title">
        <h2 id="cww-balance-title" className="cww-section-title">
          Tổng quan số dư
        </h2>
        <BalanceCards
          balance={balance}
          loading={balanceLoading}
          error={balanceError}
        />
      </section>

      <section className="cww-section cww-section-grid" aria-label="Payout and form">
        <PayoutProfileCard
          profile={payoutProfile}
          loading={payoutLoading}
          error={payoutError}
          banks={banks}
          onOpenModal={handleOpenPayoutModal}
        />
        <CreateWithdrawalForm
          balance={balance}
          payoutProfile={profileReady ? payoutProfile : null}
          balanceLoading={balanceLoading}
          balanceError={balanceError}
          onSuccess={handleCreateSuccess}
          onOpenPayoutModal={handleOpenPayoutModal}
        />
      </section>

      <HistorySection
        history={history}
        loading={historyLoading}
        error={historyError}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        page={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        refreshLoading={refreshLoading}
        onRefresh={handleRefresh}
        onViewDetail={handleViewDetail}
      />

      <PayoutProfileModal
        open={payoutModalOpen}
        profile={payoutProfile}
        banks={banks}
        banksLoading={banksLoading}
        submitting={payoutSubmitting}
        errorMessage={payoutModalError}
        onSubmit={handleSubmitPayout}
        onClose={handleClosePayoutModal}
      />

      {detailModalOpen ? (
        <DetailModal
          withdrawal={detailWithdrawal}
          onClose={handleCloseDetail}
        />
      ) : null}

      {detailLoading ? (
        <div className="cww-detail-loading" aria-live="polite">
          Đang tải chi tiết...
        </div>
      ) : null}
    </div>
  );
}
