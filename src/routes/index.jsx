import { createBrowserRouter, Navigate } from "react-router-dom";

import AppShell from "../components/AppShell";
import AuthLayout from "../layouts/AuthLayout";
import UserLayout from "../layouts/user/UserLayout";
import AdminLayout from "../layouts/admin/AdminLayout";

import SignIn from "../pages/auth/SignIn";
import SignUp from "../pages/auth/SignUp";
import ForgotPassword from "../pages/auth/ForgotPassword";
import OAuth2Success from "../pages/auth/OAuth2Success";
import PaymentSuccessPage from "../pages/payment/PaymentSuccessPage";
import PaymentCancelPage from "../pages/payment/PaymentCancelPage";
import PurchaseHistory from "../pages/payment/PurchaseHistory";

import GuestRoute from "./GuestRoute";
import ProtectedRoute from "./ProtectedRoute";
import Home from "../pages/home/Home";
import DocumentsList from "../components/DocumentsList";
import DocumentDetail from "../pages/document/DocumentDetail";
import ContributorRequest from "../pages/contributor/ContributorRequest";
import ContributorStatus from "../pages/contributor/ContributorStatus";
import ContributorProfile from "../pages/contributor/ContributorProfile";
import ContributorWithdrawalHistoryPage from "../pages/contributor/ContributorWithdrawalHistoryPage";
import ViewHistory from "../pages/history/ViewHistory";
import Profile from "../pages/user/Profile";
import ManageDocuments from "../pages/document/ManageDocuments";
import UploadDocumentGate from "../pages/document/UploadDocumentGate";
import SubmittedDocumentDetails from "../pages/document/SubmittedDocumentDetails.jsx";
import StyleGuide from "../pages/about/StyleGuide";
import AboutUs from "../pages/about/AboutUs";
import Leaderboard from "../pages/leaderboard/Leaderboard";
import FavoriteDocuments from "../pages/document/FavoriteDocuments";

import ManageQuizzes from "../pages/quiz/ManageQuizzes";
import QuizHistory from "../pages/quiz/QuizHistory";
import QuizListPage from "../pages/quiz/QuizListPage";
import PreviewQuiz from "../pages/quiz/PreviewQuiz";
import QuizTaking from "../pages/quiz/QuizTaking";
import QuizResult from "../pages/quiz/QuizResult";
import AdminDashboard from "../pages/admin/AdminDashboard";
import CommunityFeed from "../pages/community/CommunityFeed";
import ContributorRequests from "../pages/admin/ContributorRequests";
import AdminSignIn from "../pages/admin/AdminSignIn";
import UsersPage from "../pages/admin/UsersPage";
import RolesPage from "../pages/admin/RolesPage";
import CategoryPage from "../pages/admin/CategoryPage";
import TagPage from "../pages/admin/TagPage";
import PermissionsPage from "../pages/admin/PermissionsPage";
import AdminSettingsPage from "../pages/admin/AdminSettingsPage";
import ContentModeratorPage from "../pages/admin/ContentModeratorPage";
import AdminDocumentDetailPage from "../pages/admin/AdminDocumentDetailPage";
import UserReportsPage from "../pages/admin/UserReportsPage";
import PaymentModeratorLayout from "../layouts/paymentModerator/PaymentModeratorLayout";
import PaymentModeratorWithdrawalPage from "../pages/paymentModerator/PaymentModeratorWithdrawalPage";
import PaymentModeratorDashboardPage from "../pages/paymentModerator/PaymentModeratorDashboardPage";


export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
  {
    path: "/",
    element: <UserLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "style-guide", element: <StyleGuide /> },
      { path: "about-us", element: <AboutUs /> },
      { path: "leaderboard", element: <Leaderboard /> },
      { path: "favorite-documents", element: <FavoriteDocuments /> },
      { path: "manage-quizzes", element: <ManageQuizzes /> },
      { path: "quiz-history", element: <QuizHistory /> },
      { path: "profile", element: <Profile /> },
      { path: "manage-documents", element: <ManageDocuments /> },
      { path: "upload-document", element: <UploadDocumentGate /> },
      { path: "documents/submitted/:submissionId", element: <SubmittedDocumentDetails /> },
      { path: "submitted-document-details", element: <SubmittedDocumentDetails /> },
      { path: "document/:id", element: <DocumentDetail /> },
      { path: "view-history", element: <ViewHistory /> },
      { path: "purchase-history", element: <PurchaseHistory /> },
      { path: "contributor-request", element: <ContributorRequest /> },
      { path: "contributor-status", element: <ContributorStatus /> },
      { path: "contributor-profile", element: <ContributorProfile /> },
      {
        path: "contributor/withdrawals",
        element: (
          <ProtectedRoute requiredRoles={["CONTRIBUTOR"]}>
            <ContributorWithdrawalHistoryPage />
          </ProtectedRoute>
        ),
      },
      { path: "documents/:id", element: <DocumentDetail /> },
      { path: "documents/:documentId/quizzes", element: <QuizListPage /> },
      { path: "quiz/:quizId/preview", element: <PreviewQuiz /> },
      { path: "quiz/:quizId/take", element: <QuizTaking /> },
      { path: "quiz/result/:attemptId", element: <QuizResult /> },
      { path: "documents", element: <DocumentsList /> },
      { path: "community", element: <CommunityFeed /> },
      { path: "community/saved", element: <CommunityFeed savedMode={true} /> },
    ],
  },
  {
    path: "/admin",
    children: [
      {
        path: "login",
        element: (
          <GuestRoute adminPortal>
            <AdminSignIn />
          </GuestRoute>
        ),
      },
      {
        element: (
          <ProtectedRoute
            requiredRoles={["ADMIN", "USER_MODERATOR", "CONTENT_MODERATOR"]}
          >
            <AdminLayout />
          </ProtectedRoute>
        ),
        children: [
          { path: "dashboard", element: <AdminDashboard /> },
          { path: "documents/pending", element: <ContentModeratorPage /> },
          { path: "documents/:documentId", element: <AdminDocumentDetailPage /> },
          { path: "contributor-requests", element: <ContributorRequests /> },
          { path: "users", element: <UsersPage /> },
          { path: "roles", element: <RolesPage /> },
          { path: "permissions", element: <PermissionsPage /> },
          { path: "categories", element: <CategoryPage /> },
          { path: "tags", element: <TagPage /> },
          { path: "reports", element: <UserReportsPage /> },
          { path: "config", element: <AdminSettingsPage /> },
        ],
      },
    ],
  },
  {
    path: "/payment-moderator",
    element: (
      <ProtectedRoute requiredRoles={["PAYMENT_MODERATOR"]}>
        <PaymentModeratorLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: "dashboard", element: <PaymentModeratorDashboardPage /> },
      { path: "withdrawals", element: <PaymentModeratorWithdrawalPage /> },
    ],
  },
  {
    path: "/login",
    element: (
      <GuestRoute>
        <AuthLayout>
          <SignIn />
        </AuthLayout>
      </GuestRoute>
    ),
  },
  {
    path: "/sign-up",
    element: (
      <GuestRoute>
        <AuthLayout>
          <SignUp />
        </AuthLayout>
      </GuestRoute>
    ),
  },
  {
    path: "/forgot-password",
    element: (
      <AuthLayout>
        <ForgotPassword />
      </AuthLayout>
    ),
  },
  {
    path: "/oauth2-success",
    element: (
      <AuthLayout>
        <OAuth2Success />
      </AuthLayout>
    ),
  },
  {
    path: "/payment/success",
    element: <PaymentSuccessPage />,
  },
  {
    path: "/payment/cancel",
    element: <PaymentCancelPage />,
  },
    ],
  },
]);