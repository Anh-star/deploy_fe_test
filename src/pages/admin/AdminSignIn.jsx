import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { EyeIcon } from "../../components/icons";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { userHasAdminPortalRole } from "../../constants/adminPortalRoles";
import "../../styles/admin/adminSignIn.css";
import logo from "../../assets/Logo.png";

const LOGIN_ERROR_FALLBACK =
  "Email hoặc mật khẩu không đúng. Vui lòng thử lại hoặc liên hệ hỗ trợ nếu bạn cần tài khoản.";

const AdminSignIn = () => {
  const navigate = useNavigate();
  const { login, loading } = useAuth();
  const notification = useNotification();
  
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState("");
  const [lockedModalOpen, setLockedModalOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const user = await login({ email, password, rememberMe: trustDevice });

      if (!user) {
        setError(LOGIN_ERROR_FALLBACK);
        return;
      }

      if (user?.roles?.includes('COMMUNITY_MODERATOR')) {
        notification.success("Xác thực quyền quản trị thành công.");
        navigate("/community-moderator/dashboard", { replace: true });
        return;
      }

      if (user?.roles?.includes('PAYMENT_MODERATOR')) {
        notification.success("Xác thực quyền quản trị thành công.");
        navigate("/payment-moderator/dashboard", { replace: true });
        return;
      }

      if (userHasAdminPortalRole(user?.roles)) {
        notification.success("Xác thực quyền quản trị thành công.");
        navigate("/admin/dashboard");
      } else {
        const msg =
          "Bạn không có quyền truy cập vào trang quản trị.";
        setError(msg);
        notification.error(msg);
      }
    } catch (err) {
      const apiMsg = err?.response?.data?.message;
      const message =
        typeof apiMsg === "string" && apiMsg.trim()
          ? apiMsg
          : LOGIN_ERROR_FALLBACK;
      setError(message);
      notification.error(message);
      if (
        message.toLowerCase().includes("khóa") ||
        message.toLowerCase().includes("ngừng hoạt động") ||
        err?.response?.status === 423
      ) {
        setLockedModalOpen(true);
      }
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        <div className="admin-login-content">
          <header className="admin-login-header">
            <div className="admin-logo-wrapper">
              <img src={logo} alt="Admin Logo" className="admin-logo-img" />

            </div>
            
            <div className="admin-badge">Quản trị hệ thống</div>
            <h1 className="admin-login-title">Cổng quản trị</h1>
          </header>

          <form className="admin-login-form" onSubmit={handleSubmit}>
            <div className="admin-form-group">
              <label className="admin-form-label" htmlFor="admin-email">
                Email quản trị
              </label>
              <div className="admin-input-wrapper">
                <input
                  id="admin-email"
                  type="email"
                  className="admin-input"
                  placeholder="Nhập email quản trị"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label" htmlFor="admin-password">
                Mật khẩu
              </label>
              <div className="admin-input-wrapper">
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  className="admin-input"
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="admin-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <EyeIcon size={20} color="#718096" />
                </button>
              </div>
            </div>

            <div className="admin-checkbox-group">
              <input
                id="trust-device"
                type="checkbox"
                className="admin-checkbox"
                checked={trustDevice}
                onChange={(e) => setTrustDevice(e.target.checked)}
              />
              <label htmlFor="trust-device" className="admin-checkbox-label">
                Ghi nhớ cho lần đăng nhập sau
              </label>
            </div>

            {error && <p className="admin-error-message" style={{ color: "#e53e3e", fontSize: "14px", marginBottom: "16px", textAlign: "center" }}>{error}</p>}

            <button type="submit" className="admin-submit-btn" disabled={loading}>
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>

            <div className="admin-divider"></div>
          </form>
        </div>
      </div>

      {/* Locked Account Modal */}
      {lockedModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setLockedModalOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "460px",
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "28px 24px",
              textAlign: "center",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "#FEE2E2",
                color: "#DC2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto",
                fontSize: "24px",
              }}
            >
              🔒
            </div>
            <h3 style={{ margin: "0 0 10px", fontSize: "19px", fontWeight: 700, color: "#0F172A" }}>
              Tài khoản của bạn đã bị khóa
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "14px", color: "#475569", lineHeight: 1.6 }}>
              Tài khoản quản trị của bạn đã bị khóa hoặc ngừng hoạt động bởi Quản trị viên cấp cao.
            </p>
            <div
              style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "12px 16px",
                marginBottom: "20px",
                fontSize: "13px",
                color: "#334155",
                textAlign: "left",
              }}
            >
              Để khiếu nại hoặc yêu cầu kiểm tra mở khóa, vui lòng liên hệ qua email:
              <div style={{ marginTop: "6px", fontWeight: 700, color: "#4F46E5", fontSize: "14px" }}>
                support@itstudy.edu.vn
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLockedModalOpen(false)}
              style={{
                width: "100%",
                padding: "10px 16px",
                borderRadius: "8px",
                border: "none",
                background: "#0F172A",
                color: "#FFFFFF",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSignIn;
