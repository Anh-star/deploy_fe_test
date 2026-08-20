import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, requiredRoles }) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  // Nếu tài khoản bị khóa, chặn truy cập vào mọi route bảo vệ
  if (user?.status && user.status.toUpperCase() !== "ACTIVE") {
    return <Navigate to="/" replace />;
  }

  if (requiredRoles && requiredRoles.length > 0) {
    const allowed = user?.roles?.some((r) => requiredRoles.includes(r));
    if (!allowed) {
      // If the user is authenticated but not allowed, redirect them.
      // This covers cases where the user lacks the required roles for admin routes.
      return <Navigate to="/contributor-status" replace />;
    }
  }

  // If all checks pass (authenticated and authorized), render the children.
  return children;
}
