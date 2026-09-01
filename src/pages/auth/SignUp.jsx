import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { register as registerApi } from "../../api/authApi";
import { sanitizeInternalReturnUrl } from "../../utils/pendingPurchaseSession";
import logo from "../../assets/Logo.png";

export default function SignUp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loading } = useAuth();
  const notification = useNotification();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Đọc và sanitize ?next= ngay tại mount. Source: nếu guest bấm
  // "Đăng ký" từ LoginRequiredModal thì URL sẽ có ?next=/documents/...
  // Giữ lại qua đăng ký thành công rồi đưa sang /login?next=...
  // để login xong quay lại đúng tài liệu.
  const safeNextPath = useMemo(() => {
    const raw = searchParams.get("next");
    return sanitizeInternalReturnUrl(raw);
  }, [searchParams]);

  const passwordCriteria = useMemo(() => {
    return {
      length: password.length >= 8 && password.length <= 32,
      hasUpper: /[A-Z]/.test(password),
      hasLower: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[@$!%*?&_#^~()+\-=[\]{};':"\\|,.<>/]/.test(password),
    };
  }, [password]);

  const isPasswordValid = Object.values(passwordCriteria).every(Boolean);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!fullName.trim()) {
      setFormError("Vui lòng nhập họ và tên.");
      return;
    }

    if (!email.trim()) {
      setFormError("Vui lòng nhập email.");
      return;
    }

    if (!isPasswordValid) {
      setFormError("Mật khẩu chưa đáp ứng đầy đủ các yêu cầu bảo mật.");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Mật khẩu xác nhận không khớp.");
      return;
    }

    try {
      await registerApi({ email, password, fullName });
      notification.success("Đăng ký thành công. Vui lòng đăng nhập.");
      // Sau đăng ký, đưa user sang /login và giữ ?next= để khi login
      // xong sẽ quay lại đúng tài liệu (hoặc path internal đã
      // sanitize). KHÔNG tự đăng nhập — backend register API không trả
      // token và source không có flow tự login sau đăng ký.
      const target = safeNextPath
        ? `/login?next=${encodeURIComponent(safeNextPath)}`
        : "/login";
      setTimeout(() => navigate(target, { replace: true }), 800);
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Đăng ký thất bại. Vui lòng thử lại.";
      setFormError(message);
    }
  };

  return (
    <div className="auth-form-wrap">
      <div className="auth-logo-wrapper">
        <img src={logo} alt="Logo" className="auth-logo-img" />
      </div>

      <header className="auth-header">
        <h1>Tạo tài khoản</h1>
        <p>Tham gia cộng đồng của chúng tôi ngay hôm nay.</p>
      </header>

      <form
        className="auth-form"
        onSubmit={handleSubmit}
        onChange={() => setFormError("")}
      >
        <label htmlFor="signup-name">Họ và tên</label>
        <input
          id="signup-name"
          type="text"
          placeholder="Nhập họ và tên"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

        <label htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
          type="email"
          placeholder="Nhập email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label htmlFor="signup-password">Mật khẩu</label>
        <div className="input-with-icon">
          <input
            id="signup-password"
            type={showPassword ? "text" : "password"}
            placeholder="Nhập mật khẩu"
            value={password}
            onFocus={() => setPasswordTouched(true)}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordTouched(true);
            }}
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

        {/* Hướng dẫn yêu cầu mật khẩu cho người dùng */}
        {(passwordTouched || password.length > 0) && (
          <div className="password-requirements">
            <div className="password-requirements__title">Mật khẩu phải bao gồm:</div>
            <ul className="password-requirements__list">
              <li className={`password-requirements__item ${passwordCriteria.length ? "valid" : ""}`}>
                <span className="password-requirements__icon">{passwordCriteria.length ? "✓" : "○"}</span>
                <span>Từ 8 đến 32 ký tự</span>
              </li>
              <li className={`password-requirements__item ${passwordCriteria.hasUpper ? "valid" : ""}`}>
                <span className="password-requirements__icon">{passwordCriteria.hasUpper ? "✓" : "○"}</span>
                <span>Ít nhất 1 chữ cái viết hoa (A-Z)</span>
              </li>
              <li className={`password-requirements__item ${passwordCriteria.hasLower ? "valid" : ""}`}>
                <span className="password-requirements__icon">{passwordCriteria.hasLower ? "✓" : "○"}</span>
                <span>Ít nhất 1 chữ cái viết thường (a-z)</span>
              </li>
              <li className={`password-requirements__item ${passwordCriteria.hasNumber ? "valid" : ""}`}>
                <span className="password-requirements__icon">{passwordCriteria.hasNumber ? "✓" : "○"}</span>
                <span>Ít nhất 1 chữ số (0-9)</span>
              </li>
              <li className={`password-requirements__item ${passwordCriteria.hasSpecial ? "valid" : ""}`}>
                <span className="password-requirements__icon">{passwordCriteria.hasSpecial ? "✓" : "○"}</span>
                <span>Ít nhất 1 ký tự đặc biệt (@$!%*?&_#...)</span>
              </li>
            </ul>
          </div>
        )}

        <label htmlFor="signup-confirm-password">Xác nhận mật khẩu</label>
        <div className="input-with-icon">
          <input
            id="signup-confirm-password"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Xác nhận mật khẩu"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowConfirmPassword((p) => !p)}
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {showConfirmPassword ? (
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

        {confirmPassword.length > 0 && (
          <div style={{
            fontSize: "12px",
            marginTop: "-4px",
            marginBottom: "4px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            color: password === confirmPassword ? "#16A34A" : "#EF4444",
            fontWeight: 500
          }}>
            <span>{password === confirmPassword ? "✓ Mật khẩu khớp" : "✕ Mật khẩu chưa khớp"}</span>
          </div>
        )}

        {formError && <p className="auth-form-error" role="alert">{formError}</p>}

        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? "Đang đăng ký..." : "Đăng ký"}
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
        Đã có tài khoản?{" "}
        <Link
          to={
            safeNextPath
              ? `/login?next=${encodeURIComponent(safeNextPath)}`
              : "/login"
          }
        >
          Đăng nhập
        </Link>
      </p>

    </div>
  );
}