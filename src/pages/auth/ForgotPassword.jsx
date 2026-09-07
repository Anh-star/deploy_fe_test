import { Link } from "react-router-dom";
import { useState } from "react";
import logo from "../../assets/Logo.png";

export default function ForgotPassword() {
  const [copied, setCopied] = useState(false);

  const adminEmail = "studyit.support@gmail.com";
  const emailTemplate = `Tiêu đề: [StudyIT] Yêu cầu cấp lại mật khẩu - <Email của bạn>

Nội dung:
- Email tài khoản cần khôi phục: <Nhập email đã đăng ký>
- Họ và tên người dùng: <Họ và tên của bạn>
- Số điện thoại liên hệ (nếu có): <Số điện thoại>
- Lý do: Tôi bị quên mật khẩu, kính nhờ Ban Quản Trị hỗ trợ đặt lại mật khẩu.`;

  const mailtoUrl = `mailto:${adminEmail}?subject=${encodeURIComponent(
    "[StudyIT] Yeu cau cap lai mat khau"
  )}&body=${encodeURIComponent(
    `Kính gửi Ban Quản Trị StudyIT,\n\nTôi cần hỗ trợ cấp lại mật khẩu cho tài khoản:\n- Email tài khoản: \n- Họ và tên: \n- Số điện thoại liên hệ (nếu có): \n- Lý do: Tôi bị quên mật khẩu, kính nhờ Ban Quản Trị hỗ trợ đặt lại mật khẩu.\n\nXin cảm ơn!`
  )}`;

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(emailTemplate);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="auth-form-wrap auth-form-wrap--compact">
      <div className="auth-logo-wrapper">
        <img src={logo} alt="StudyIT Logo" className="auth-logo-img" />
      </div>

      <header className="auth-header">
        <h1>Quên mật khẩu?</h1>
        <p>
          Để đảm bảo an toàn cho tài khoản, vui lòng liên hệ Ban Quản Trị qua email để được hỗ trợ cấp lại mật khẩu.
        </p>
      </header>

      <div
        style={{
          marginTop: "20px",
          padding: "20px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#334155" }}>
          <span style={{ fontSize: "18px" }}>✉️</span>
          <div>
            Email Ban Quản Trị:{" "}
            <a
              href={mailtoUrl}
              style={{
                color: "#007bff",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              {adminEmail}
            </a>
          </div>
        </div>

        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            padding: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
              📋 Cú pháp email yêu cầu:
            </span>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                background: copied ? "#dcfce7" : "#ffffff",
                color: copied ? "#166534" : "#475569",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                padding: "4px 10px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {copied ? "✓ Đã sao chép" : "Sao chép cú pháp"}
            </button>
          </div>

          <div
            style={{
              fontFamily: "monospace, Consolas, sans-serif",
              fontSize: "12px",
              lineHeight: "1.6",
              color: "#334155",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "#ffffff",
              border: "1px solid #f1f5f9",
              borderRadius: "6px",
              padding: "10px 12px",
            }}
          >
            <div><strong>Tiêu đề:</strong> [StudyIT] Yêu cầu cấp lại mật khẩu - [Email của bạn]</div>
            <div style={{ marginTop: "6px" }}><strong>Nội dung:</strong></div>
            <div>• Email tài khoản cần khôi phục: [Nhập email đã đăng ký]</div>
            <div>• Họ và tên người dùng: [Họ tên của bạn]</div>
            <div>• Số điện thoại liên hệ (nếu có): [Số điện thoại]</div>
            <div>• Lý do: Tôi bị quên mật khẩu, kính nhờ Ban Quản Trị hỗ trợ đặt lại mật khẩu.</div>
          </div>
        </div>

        <div style={{ fontSize: "12.5px", color: "#64748b", lineHeight: "1.5" }}>
          ⏱️ <em>Lưu ý: Ban Quản Trị sẽ xác thực thông tin và phản hồi hướng dẫn cấp lại mật khẩu tới bạn trong thời gian sớm nhất.</em>
        </div>

        <a
          href={mailtoUrl}
          className="primary-button"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: 600,
            padding: "10px",
            marginTop: "4px",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          Mở ứng dụng gửi Email
        </a>
      </div>

      <p className="auth-footer-text" style={{ marginTop: "24px" }}>
        Đã nhớ lại mật khẩu? <Link to="/login">Quay lại Đăng nhập</Link>
      </p>
    </div>
  );
}