import { BookmarkIcon } from "../icons";
import "../../styles/bookmarkButton.css";

/** Chưa lưu — xám; đã lưu — primary (#007BFF, đồng bộ nút/link project) */
const COLOR_OFF = "#94A3B8";
const COLOR_ON = "#007BFF";

/** Cân đối với card Home / Document List / Detail (gần bản 16px trước đây, không phóng to) */
const DEFAULT_ICON_SIZE = 30;

/**
 * Nút icon bookmark tái sử dụng (chỉ UI; logic login/API ở parent / DocumentBookmarkControl).
 *
 * @param {boolean} isBookmarked
 * @param {(e?: React.MouseEvent) => void} onToggle
 * @param {number} [size] — kích thước icon (mặc định 20)
 * @param {boolean} [stopPropagation] — chặn bubble (card clickable)
 * @param {string} [className]
 * @param {boolean} [disabled]
 * @param {string} [title]
 */
export default function BookmarkButton({
  isBookmarked,
  onToggle,
  size = DEFAULT_ICON_SIZE,
  stopPropagation = false,
  className = "",
  disabled = false,
  title,
  ...rest
}) {
  const color = isBookmarked ? COLOR_ON : COLOR_OFF;
  const defaultTitle = isBookmarked ? "Bỏ lưu tài liệu" : "Lưu tài liệu";

  return (
    <button
      type="button"
      className={`bookmark-button ${isBookmarked ? "bookmark-button--on" : "bookmark-button--off"} ${className}`.trim()}
      disabled={disabled}
      title={title ?? defaultTitle}
      aria-pressed={isBookmarked}
      aria-label={title ?? defaultTitle}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        onToggle(e);
      }}
      {...rest}
    >
      <BookmarkIcon size={size} color={color} filled={isBookmarked} />
    </button>
  );
}
