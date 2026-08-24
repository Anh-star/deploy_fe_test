import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { sanitizeInternalReturnUrl } from "../../utils/pendingPurchaseSession";
import logo from "../../assets/Logo.png";
import {
  GOOGLE_OAUTH_LOGIN_URL,
  GITHUB_OAUTH_LOGIN_URL,
} from "../../constants/backendOrigin";

// Fallback khi ?next= không hợp lệ: vai trò ADMIN đi dashboard,
// người dùng thường về trang chủ. SignIn vẫn giữ logic này cho
// caller không truyền next.
const SAFE_FALLBACK_PATH = "/";

export default function SignIn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, loading, setError } = useAuth();
  const notification = useNotification();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [formError, setFormError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Đọc và sanitize ?next= ngay tại mount. Không bao giờ tin trực
  // tiếp giá trị từ query string — một attacker có thể craft URL
  // /login?next=https://evil.example để mở open-redirect qua
  // navigate(...). sanitizeInternalReturnUrl reject mọi scheme /
  // protocol-relative URL và chỉ trả về internal path.
  const safeNextPath = useMemo(() => {
    const raw = searchParams.get("next");
    return sanitizeInternalReturnUrl(raw);
  }, [searchParams]);

  useEffect(() => {
    const oauthError = searchParams.get("oauthError");
    if (oauthError === "missing_email") {
      setFormError("Google không trả về email. Vui lòng thử tài khoản khác.");
    }
  }, [searchParams]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setFormError("");
    try {
      const user = await login({ email, password, rememberMe });

      if (user?.status && user.status.toUpperCase() !== "ACTIVE") {
        navigate("/", {
          replace: true,
          state: {
            accountLocked: true,
            lockedReason: "Tài khoản của bạn hiện đang bị tạm khóa hoặc ngừng hoạt động do vi phạm Tiêu chuẩn cộng đồng hoặc theo quyết định của Quản trị viên.",
          },
        });
        return;
      }

      notification.success("Đăng nhập thành công.");
      if (safeNextPath) {
        navigate(safeNextPath, { replace: true });
      } else {
        const roles = Array.isArray(user?.roles) ? user.roles : [];
        if (roles.includes("COMMUNITY_MODERATOR")) {
          navigate("/community-moderator/dashboard");
        } else if (roles.includes("PAYMENT_MODERATOR")) {
          navigate("/payment-moderator/dashboard");
        } else if (roles.includes("ADMIN") || roles.includes("USER_MODERATOR") || roles.includes("CONTENT_MODERATOR")) {
          navigate("/admin/dashboard");
        } else {
          navigate(SAFE_FALLBACK_PATH);
        }
      }
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Đăng nhập thất bại. Vui lòng thử lại.";
      setFormError(message);
      if (
        message.toLowerCase().includes("khóa") ||
        message.toLowerCase().includes("ngừng hoạt động") ||
        message.toLowerCase().includes("vô hiệu") ||
        message.toLowerCase().includes("disabled") ||
        message.toLowerCase().includes("locked") ||
        err?.response?.status === 423
      ) {
        navigate("/", {
          replace: true,
          state: {
            accountLocked: true,
            lockedReason: message,
            lockedAt: new Date().toISOString(),
          },
        });
        return;
      }
    }
  };

  return (
    <div className="auth-form-wrap">
      <div className="auth-logo-wrapper">
        <img src={logo} alt="Logo" className="auth-logo-img" />
      </div>

      <header className="auth-header">
        <h1>Chào mừng quay lại</h1>
        <p>Vui lòng nhập thông tin để đăng nhập.</p>
      </header>

      <form
        className="auth-form"
        onSubmit={handleSubmit}
        onChange={() => { setError(null); setFormError(""); }}
      >
        <label htmlFor="signin-email">Email</label>
        <input
          id="signin-email"
          type="email"
          placeholder="Nhập email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label htmlFor="signin-password">Mật khẩu</label>
        {password.length > 0 ? (
          <div className="input-with-icon">
            <input
              id="signin-password"
              type={showPassword ? "text" : "password"}
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((p) => !p)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M1 12C1 12 5 5 12 5C19 5 23 12 23 12C23 12 19 19 12 19C5 19 1 12 1 12Z"
                    stroke="#718096"
                    strokeWidth="2"
                  />
                  <circle cx="12" cy="12" r="3" stroke="#718096" strokeWidth="2" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M17.94 17.94C16.14 19.24 14.13 20 12 20C5 20 1 12 1 12C2.24 9.11 4.21 6.73 6.66 5.06M9.53 4.24C10.34 4.09 11.16 4 12 4C19 4 23 12 23 12C22.34 13.54 21.34 14.95 20.06 16.06M1 1L23 23"
                    stroke="#718096"
                    strokeWidth="2"
                  />
                </svg>
              )}
            </button>
          </div>
        ) : (
          <input
            id="signin-password"
            type="password"
            placeholder="Nhập mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
        <div className="auth-form__row">
          <label className="remember-check">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Ghi nhớ đăng nhập
          </label>

          <Link to="/forgot-password" className="text-link">
            Quên mật khẩu?
          </Link>
        </div>

        {formError && <p className="auth-form-error" role="alert">{formError}</p>}

        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>

        <div className="divider">Hoặc tiếp tục với</div>

        <div className="social-row">
          {/* Google */}
          <button
            type="button"
            className="social-button google"
            onClick={() => {
              window.location.href = GOOGLE_OAUTH_LOGIN_URL;
            }}
          >
            <img
              src="https://www.svgrepo.com/show/475656/google-color.svg"
              alt="Google"
              className="social-icon"
            />
            Đăng nhập bằng Google
          </button>

          {/* GitHub */}
          <button
            type="button"
            className="social-button github"
            onClick={() => {
              window.location.href = GITHUB_OAUTH_LOGIN_URL;
            }}
          >
            <img
              src="https://www.svgrepo.com/show/512317/github-142.svg"
              alt="GitHub"
              className="social-icon"
            />
            Đăng nhập bằng Github
          </button>
        </div>
      </form>

      <p className="auth-footer-text">
        Chưa có tài khoản?{" "}
        <Link
          to={
            safeNextPath
              ? `/sign-up?next=${encodeURIComponent(safeNextPath)}`
              : "/sign-up"
          }
        >
          Đăng ký
        </Link>
      </p>
    </div>
  );
}