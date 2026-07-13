import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { AuthProvider } from "@/auth/AuthContext";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ProtectedRoute } from "@/components/dashboard/ProtectedRoute";
import { UserDashboardLayout } from "@/components/dashboard/UserDashboardLayout";
import { MentorDashboardLayout } from "@/components/dashboard/MentorDashboardLayout";
import Index from "./pages/Index.tsx";
import MentorRegisterPage from "./pages/MentorRegisterPage.tsx";
import UserRegisterPage from "./pages/UserRegisterPage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.tsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.tsx";
import MentorsPage from "./pages/MentorsPage.tsx";
import MentorDetailPage from "./pages/MentorDetailPage.tsx";
import BookingPage from "./pages/BookingPage.tsx";
import PaymentPage from "./pages/PaymentPage.tsx";
import BookingSuccessPage from "./pages/BookingSuccessPage.tsx";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage.tsx";
import TermsAndConditionsPage from "./pages/TermsAndConditionsPage.tsx";
import CoachAgreementPage from "./pages/CoachAgreementPage.tsx";
import BecomeCoachPage from "./pages/BecomeCoachPage.tsx";
import MentorRegisterThankYouPage from "./pages/MentorRegisterThankYouPage.tsx";
import UserRegisterThankYouPage from "./pages/UserRegisterThankYouPage.tsx";
import NotFound from "./pages/NotFound.tsx";
import UserProfilePage from "./pages/user/UserProfilePage.tsx";
import UserDashboardHomePage from "./pages/user/UserDashboardHomePage.tsx";
import UserNotificationsPage from "./pages/user/UserNotificationsPage.tsx";
import UserAppointmentsPage from "./pages/user/UserAppointmentsPage.tsx";
import UserMentorsBrowsePage from "./pages/user/UserMentorsBrowsePage.tsx";
import UserTransactionsPage from "./pages/user/UserTransactionsPage.tsx";
import WalletPage from "./pages/user/WalletPage.tsx";
import MentorProfilePage from "./pages/mentor/MentorProfilePage.tsx";
import MentorAppointmentsPage from "./pages/mentor/MentorAppointmentsPage.tsx";
import MentorEarningsPage from "./pages/mentor/MentorEarningsPage.tsx";
import MentorMonthlyFeesPage from "./pages/mentor/MentorMonthlyFeesPage.tsx";
import MentorDashboardHomePage from "./pages/mentor/MentorDashboardHomePage.tsx";
import MentorPayoutsPage from "./pages/mentor/MentorPayoutsPage.tsx";
import ChatSessionPage from "./pages/chat/ChatSessionPage.tsx";
import ChatInboxPage from "./pages/chat/ChatInboxPage.tsx";
import { AdminDashboardLayout } from "@/components/dashboard/AdminDashboardLayout";
import AdminOverviewPage from "./pages/admin/AdminOverviewPage.tsx";
import AdminBookingsPage from "./pages/admin/AdminBookingsPage.tsx";
import AdminUsersPage from "./pages/admin/AdminUsersPage.tsx";
import AdminMentorsPage from "./pages/admin/AdminMentorsPage.tsx";
import AdminPaymentsPage from "./pages/admin/AdminPaymentsPage.tsx";
import AdminChatInvoicesPage from "./pages/admin/AdminChatInvoicesPage.tsx";
import AdminSettlementsPage from "./pages/admin/AdminSettlementsPage.tsx";
import AdminWalletOpsPage from "./pages/admin/AdminWalletOpsPage.tsx";
import AdminReviewsPage from "./pages/admin/AdminReviewsPage.tsx";
import AdminCoachApplicationsPage from "./pages/admin/AdminCoachApplicationsPage.tsx";
import AdminAnalyticsPage from "./pages/admin/AdminAnalyticsPage.tsx";
import AdminMentorInvoicesPage from "./pages/admin/AdminMentorInvoicesPage.tsx";
import AdminInvoicesPage from "./pages/admin/AdminInvoicesPage.tsx";
import AdminTransactionsPage from "./pages/admin/AdminTransactionsPage.tsx";
import AdminMarketplacePage from "./pages/admin/AdminMarketplacePage.tsx";
import SecuritySettingsPage from "./pages/settings/SecuritySettingsPage.tsx";
import { AccessibilityProvider } from "@/accessibility/AccessibilityContext";
import AccessibilityWidget from "@/components/accessibility/AccessibilityWidget";
import MentorPresenceHeartbeat from "@/components/MentorPresenceHeartbeat";
import UserPresenceHeartbeat from "@/components/UserPresenceHeartbeat";
import MetaPixel from "@/components/MetaPixel";

const queryClient = new QueryClient();
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <GoogleOAuthProvider clientId={googleClientId || ""}>
        <LanguageProvider>
          <AccessibilityProvider>
            <TooltipProvider>
              <MentorPresenceHeartbeat />
              <UserPresenceHeartbeat />
              <Toaster />
              <Sonner />
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <MetaPixel />
                <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/register" element={<UserRegisterPage />} />
                <Route path="/user/register" element={<UserRegisterPage />} />
                <Route path="/user/register/thank-you" element={<UserRegisterThankYouPage />} />
                <Route path="/register/thank-you" element={<UserRegisterThankYouPage />} />
                <Route path="/mentor/register" element={<MentorRegisterPage />} />
                <Route path="/mentor/register/thank-you" element={<MentorRegisterThankYouPage />} />
                <Route path="/mentors" element={<MentorsPage />} />
                <Route path="/mentors/:mentorId" element={<MentorDetailPage />} />
                <Route path="/book/:mentorId" element={<BookingPage />} />
                <Route path="/payment/:mentorId" element={<PaymentPage />} />
                <Route path="/booking/success" element={<BookingSuccessPage />} />
                <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                <Route path="/terms-and-conditions" element={<TermsAndConditionsPage />} />
                <Route path="/coach-agreement" element={<CoachAgreementPage />} />
                <Route path="/become-a-coach" element={<BecomeCoachPage />} />

                <Route
                  path="/user"
                  element={
                    <ProtectedRoute role="user">
                      <UserDashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<UserDashboardHomePage />} />
                  <Route path="profile" element={<UserProfilePage />} />
                  <Route path="notifications" element={<UserNotificationsPage />} />
                  <Route path="appointments" element={<UserAppointmentsPage />} />
                  <Route path="mentors" element={<UserMentorsBrowsePage />} />
                  <Route path="transactions" element={<UserTransactionsPage />} />
                  <Route path="wallet" element={<WalletPage />} />
                  <Route path="messages" element={<ChatInboxPage />} />
                  <Route path="chat/:sessionId" element={<ChatSessionPage />} />
                  <Route path="security" element={<SecuritySettingsPage />} />
                </Route>

                <Route
                  path="/mentor"
                  element={
                    <ProtectedRoute role="mentor">
                      <MentorDashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<MentorDashboardHomePage />} />
                  <Route path="profile" element={<MentorProfilePage />} />
                  <Route path="availability" element={<Navigate to="/mentor/dashboard" replace />} />
                  <Route path="appointments" element={<MentorAppointmentsPage />} />
                  <Route path="earnings" element={<MentorEarningsPage />} />
                  <Route path="payouts" element={<MentorPayoutsPage />} />
                  <Route path="invoices" element={<MentorMonthlyFeesPage />} />
                  <Route path="messages" element={<ChatInboxPage />} />
                  <Route path="chat/:sessionId" element={<ChatSessionPage />} />
                  <Route path="security" element={<SecuritySettingsPage />} />
                </Route>

                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute role="admin">
                      <AdminDashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<AdminOverviewPage />} />
                  <Route path="bookings" element={<AdminBookingsPage />} />
                  <Route path="users" element={<AdminUsersPage />} />
                  <Route path="mentors" element={<AdminMentorsPage />} />
                  <Route path="coach-applications" element={<AdminCoachApplicationsPage />} />
                  <Route path="payments" element={<AdminPaymentsPage />} />
                  <Route path="invoices" element={<AdminInvoicesPage />} />
                  <Route path="transactions" element={<AdminTransactionsPage />} />
                  <Route path="chat-invoices" element={<AdminChatInvoicesPage />} />
                  <Route path="mentor-invoices" element={<AdminMentorInvoicesPage />} />
                  <Route path="settlements" element={<AdminSettlementsPage />} />
                  <Route path="wallet-ops" element={<AdminWalletOpsPage />} />
                  <Route path="marketplace" element={<AdminMarketplacePage />} />
                  <Route path="reviews" element={<AdminReviewsPage />} />
                  <Route path="analytics" element={<AdminAnalyticsPage />} />
                </Route>

                <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
              <AccessibilityWidget />
            </TooltipProvider>
          </AccessibilityProvider>
        </LanguageProvider>
      </GoogleOAuthProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
