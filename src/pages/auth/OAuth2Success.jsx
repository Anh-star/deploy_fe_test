import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getCurrentUser } from "../../api/authApi";
import {
  setAccessToken,
  setRefreshToken,
  setRoles,
  setPermissions,
  clearTokens,
} from "../../api/tokenStorage";
import BrandLogo from "../../components/BrandLogo";

export default function OAuth2Success() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState("Đang hoàn tất đăng nhập...");

  useEffect(() => {
    const error = searchParams.get("error");
    const accessToken = searchParams.get("accessToken");
    const refreshToken = searchParams.get("refreshToken");

    if (error) {
      if (
        error.toLowerCase().includes("khóa") ||
        error.toLowerCase().includes("locked") ||
        error.toLowerCase().includes("disabled")
      ) {
        navigate("/", {
          replace: true,
          state: {
            accountLocked: true,
            lockedReason: "Tài khoản của bạn đã bị tạm khóa do vi phạm Tiêu chuẩn cộng đồng hoặc bị quản trị viên đình chỉ hoạt động.",
          },
        });
        return;
      }
      setMessage("Đăng nhập thất bại. Đang chuyển hướng...");
      const q = new URLSearchParams({ oauthError: error });
      navigate(`/login?${q.toString()}`, { replace: true });
      return;
    }

    if (!accessToken || !refreshToken) {
      setMessage("Thiếu thông tin xác thực. Đang chuyển hướng...");
      navigate("/login", { replace: true });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setAccessToken(accessToken);
        setRefreshToken(refreshToken);
        const user = await getCurrentUser();
        if (cancelled) return;
        setRoles(user.roles || []);
        setPermissions(user.permissions || []);
        window.location.replace("/");
      } catch {
        if (cancelled) return;
        clearTokens();
        setMessage("Không thể xác thực phiên đăng nhập. Đang chuyển hướng...");
        navigate("/login", { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, navigate]);

  return (
    <div className="auth-form-wrap">
      <img 
        src="/Logo_Icon.png" 
        alt="StudyIT Logo" 
        className="auth-logo"
      />
      <header className="auth-header">
        <h1>Đang đăng nhập</h1>
        <p>{message}</p>
      </header>
    </div>
  );
}
