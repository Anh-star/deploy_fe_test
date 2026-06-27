import { useNavigate } from "react-router-dom";

export default function PaymentCancelPage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "#F8FAFC",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#FFFFFF",
          borderRadius: "16px",
          padding: "40px 28px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
          textAlign: "center",
          boxShadow: "0 4px 16px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: "72px",
            height: "72px",
            borderRadius: "50%",
            background: "#FEF3C7",
            color: "#D97706",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "40px",
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          !
        </div>

        <h1
          style={{
            margin: 0,
            color: "#0F172A",
            fontSize: "22px",
            fontWeight: 700,
            lineHeight: "30px",
          }}
        >
          Thanh toán đã bị hủy
        </h1>

        <p
          style={{
            margin: 0,
            color: "#64748B",
            fontSize: "15px",
            lineHeight: "22px",
          }}
        >
          Bạn đã hủy thanh toán hoặc giao dịch chưa hoàn tất.
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            width: "100%",
            marginTop: "8px",
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/documents")}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "#007BFF",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "12px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Quay lại trang tài liệu
          </button>

          <button
            type="button"
            onClick={() => navigate("/")}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "#FFFFFF",
              color: "#0F172A",
              border: "1px solid #E2E8F0",
              borderRadius: "12px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Trang chủ
          </button>
        </div>
      </div>
    </div>
  );
}