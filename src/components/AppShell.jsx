import { Outlet } from "react-router-dom";
import { BookmarkSyncProvider } from "../context/BookmarkSyncContext";
import { LoginRequiredModalProvider } from "../context/LoginRequiredModalContext";
import LockedAccountModal from "./common/LockedAccountModal";
import ScrollToTop from "../routes/ScrollToTop";
/**
 * Lớp bọc router: modal đăng nhập + đồng bộ trạng thái bookmark + modal tài khoản bị khóa.
 */
export default function AppShell() {
  return (
    <LoginRequiredModalProvider>
      <BookmarkSyncProvider>
        <ScrollToTop />
        <LockedAccountModal />
        <Outlet />
      </BookmarkSyncProvider>
    </LoginRequiredModalProvider>
  );
}
