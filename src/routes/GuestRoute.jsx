import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { userHasAdminPortalRole } from "../constants/adminPortalRoles";

export default function GuestRoute({ children, adminPortal = false }) {
  const { isAuthenticated, initializing, user } = useAuth();

  if (initializing) return null;

  if (!isAuthenticated) {
    return children;
  }

  const roles = Array.isArray(user?.roles) ? user.roles : [];

  if (roles.includes("COMMUNITY_MODERATOR")) {
    return <Navigate to="/community-moderator/dashboard" replace />;
  }

  if (roles.includes("PAYMENT_MODERATOR")) {
    return <Navigate to="/payment-moderator/dashboard" replace />;
  }

  if (userHasAdminPortalRole(roles)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Navigate to="/" replace />;
}
