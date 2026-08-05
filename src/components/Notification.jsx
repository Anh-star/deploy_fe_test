import { useEffect } from "react";

const CheckCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const AlertTriangleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

/**
 * Base notification (toast) component.
 * Renders a pop-up: success = green + CheckCircleIcon, error = red + AlertTriangleIcon.
 * Used via useNotification() from NotificationContext.
 */
export default function Notification({
  state,
  onClose,
  autoHideMs = 4000,
}) {
  useEffect(() => {
    if (!state || !autoHideMs) return;
    const id = setTimeout(onClose, autoHideMs);
    return () => clearTimeout(id);
  }, [state, autoHideMs, onClose]);

  if (!state) return null;

  const isSuccess = state.type === "success";
  const role = isSuccess ? "status" : "alert";

  return (
    <div
      className={`notification-toast notification-toast--${state.type}`}
      role={role}
      aria-live="polite"
    >
      <span className="notification-toast__icon" aria-hidden="true" style={{ display: "inline-flex", alignItems: "center" }}>
        {isSuccess ? <CheckCircleIcon /> : <AlertTriangleIcon />}
      </span>
      <p className="notification-toast__message">{state.message}</p>
      <button
        type="button"
        className="notification-toast__close"
        onClick={onClose}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}
