import React from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./components/AuthProvider";
import {
  ThemeProvider,
  useTheme,
  useThemeActions,
} from "./components/ThemeProvider";
import LiveMapPage from "./pages/personnel/LiveMapPage";
import TrackingMapPage from "./pages/personnel/TrackingMapPage";
import SchedulePage from "./pages/personnel/SchedulePage";
import PersonnelPage from "./pages/personnel/PersonnelPage";
import AnalyticsPage from "./pages/performance/AnalyticsPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/account/LoginPage";
import RegisterPage from "./pages/account/RegisterPage";
import ForgotPasswordPage from "./pages/account/ForgotPasswordPage";
import ResetPasswordPage from "./pages/account/ResetPasswordPage";
import AccountPage from "./pages/account/AccountPage";
import MaintenanceHistoryPage from "./pages/history/MaintenanceHistoryPage";
import { EmergencyProvider } from "./services/EmergencyProvider";
import AnalyticsPerPersonnelPage from "./pages/performance/AnalyticsPerPersonnelPage";
import { AlertCircle, LogOut, User } from "lucide-react";
import CalendarPage from "./pages/personnel/CalendarPage";
import MobilityAssetsPage from "./pages/mobility/MobilityAssetsPage";
import MaintenanceTypesPage from "./pages/history/MaintenanceTypesPage";
import VehicleInspectionPage from "./pages/inspection/MobilityInspectionPage";
import MobilityDashboardPage from "./pages/MobilityDashboardPage";
import MobilityDistributionPage from "./pages/reports/MobilityDistributionPage";
import PageNotFound from "./pages/PageNotFound";
import UserManagementPage from "./pages/admin/UserManagementPage";
import { useVehicleRealtime } from "./hooks/useVehicleRealtime";
import SidebarNotifications from "./components/layout/SidebarNotifications";
import { Sidebar } from "./components/layout/Sidebar";
import { useInactivityLogout } from "./hooks/useInactivityLogout";
import AboutSection from "./pages/landing/mobility/AboutSection";
import MobilisAboutUsPage from "./pages/MobilisAboutUsPage";
import MobilityMaintenancePage from "./pages/mobility/MobilityMaintenancePage";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "admin" | "user" | "supply" | null;
}

function ProtectedRoute({
  children,
  requiredRole = null,
}: ProtectedRouteProps) {
  const {
    user,
    loading,
    isApproved,
    clearAuthCache,
    isMfaVerified,
    role,
    isPnpIdExpires,
  } = useAuth();
  if (loading) return null;

  if (!user) return <Navigate to="/login" replace />;

  // Enforce MFA verification - if not verified, redirect to login (which handles MFA setup)
  if (!isMfaVerified) {
    return <Navigate to="/login" replace />;
  }

  if (!isApproved && !loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-8 border border-slate-100 dark:border-slate-800">
          <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-amber-600 dark:text-amber-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
            Approval Pending
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">
            Your account is currently waiting for administrator approval. Once
            approved, you will have access to the system.
          </p>
          <button
            onClick={clearAuthCache}
            className="flex items-center justify-center gap-2 w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (isPnpIdExpires && !loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-8 border border-slate-100 dark:border-slate-800">
          <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-amber-600 dark:text-amber-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
            PNP ID Expires
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">
            We detect that your PNP ID in our system is expired. Please contact
            the administrator to help you with this problem.
          </p>
          <button
            onClick={clearAuthCache}
            className="flex items-center justify-center gap-2 w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Role-based access control
  if (requiredRole !== null && role !== requiredRole) {
    // If user doesn't have required role, redirect to dashboard or show access denied
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-8 border border-slate-100 dark:border-slate-800">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-600 dark:red-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
            Access Denied
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">
            You don't have permission to access this page.
            {requiredRole === "admin" &&
              "This page is restricted to administrators only."}
          </p>
          <button
            onClick={clearAuthCache}
            className="flex items-center justify-center gap-2 w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function Layout() {
  useInactivityLogout(true);

  const { user, profile, isAdmin, clearAuthCache } = useAuth();
  const theme = useTheme();
  const { toggleTheme } = useThemeActions();
  const { notificationCounts, pmsNotifications } = useVehicleRealtime();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-blue-100 dark:selection:bg-blue-900/30 selection:text-blue-900 transition-colors duration-300">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 z-20 shrink-0 transition-colors duration-300">
          {/* Left side: Unit/Station */}
          {!isAdmin && (
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white shadow-lg">
              <p className="tracking-widest text-blue-100">Unit/Station</p>
              <p className="mt-2 text-2xl">{profile?.unit?.unit_name}</p>
            </div>
          )}

          {/* Right side: Actions & Profile */}
          <div className="flex items-center gap-4 ml-auto">
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
            >
              {theme === "light" ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2" />
                  <path d="M12 20v2" />
                  <path d="m4.93 4.93 1.41 1.41" />
                  <path d="m17.66 17.66 1.41 1.41" />
                  <path d="M2 12h2" />
                  <path d="M20 12h2" />
                  <path d="m6.34 17.66-1.41 1.41" />
                  <path d="m19.07 4.93-1.41 1.41" />
                </svg>
              )}
            </button>

            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-2"></div>

            <div className="h-13 w-13 overflow-hidden rounded border border-white bg-slate-100 shadow-md dark:border-slate-700 dark:bg-slate-800">
              {profile?.photo_url ? (
                <img
                  src={profile.photo_url}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
              )}
            </div>

            <a
              href="/account"
              className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors"
            >
              <div className="text-right hidden sm:block">
                <p className="font-bold leading-none">
                  {profile?.rank?.rank_name}{" "}
                  {profile?.fullname || user?.email?.split("@")[0]}
                </p>
                <p className="text-slate-800 dark:text-slate-200 mt-1">
                  {isAdmin ? "Administrator" : "Welcome back!"}
                </p>
              </div>
            </a>

            <SidebarNotifications
              overdueCount={notificationCounts.overdue}
              dueSoonCount={notificationCounts.dueSoon}
              pmsNotifications={pmsNotifications}
              onViewPms={() => {
                navigate("/mobility-assets?query=Due for PMS");
              }}
            />

            <button
              onClick={clearAuthCache}
              className="p-2 font-bold text-blue-600 dark:text-blue-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"
              title="Sign Out"
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          {/* Page Routes */}
          <div className="flex-1 min-h-0">
            <Routes>
              {!profile?.role.includes("supply") && (
                <>
                  <Route
                    path="/"
                    element={<Navigate to="/dashboard" replace />}
                  />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/map" element={<LiveMapPage />} />
                  <Route
                    path="/trackingmap/:id"
                    element={<TrackingMapPage />}
                  />
                  <Route path="/schedule" element={<SchedulePage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  {isAdmin && (
                    <>
                      <Route path="/personnel" element={<PersonnelPage />} />
                      <Route path="/analytics" element={<AnalyticsPage />} />
                      <Route
                        path="/analytics-per-personnel/:id"
                        element={<AnalyticsPerPersonnelPage />}
                      />
                    </>
                  )}
                </>
              )}

              {(profile?.role.includes("supply") || isAdmin) && (
                <>
                  <Route
                    path="/"
                    element={<Navigate to="/dashboard-mobility" replace />}
                  />
                  <Route
                    path="/dashboard-mobility"
                    element={<MobilityDashboardPage />}
                  />
                  <Route
                    path="/reports/mobility-distribution"
                    element={<MobilityDistributionPage />}
                  />
                  <Route
                    path="/mobility-maintenance"
                    element={<MobilityMaintenancePage />}
                  />
                  <Route
                    path="/mobility-assets"
                    element={<MobilityAssetsPage />}
                  />
                  <Route
                    path="/pms-history"
                    element={<MaintenanceHistoryPage />}
                  />
                  <Route path="/pms-type" element={<MaintenanceTypesPage />} />
                  <Route
                    path="/mobility-inspection"
                    element={<VehicleInspectionPage />}
                  />
                  <Route
                    path="/mobilis-aboutus"
                    element={<MobilisAboutUsPage />}
                  />
                </>
              )}

              {isAdmin && (
                <>
                  <Route path="/users" element={<UserManagementPage />} />
                </>
              )}

              <Route path="/account" element={<AccountPage />} />
              <Route path="*" element={<PageNotFound />} />
            </Routes>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <EmergencyProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Landing Page */}
            {/* <Route path="/mobility" element={<MobilityLandingPage />} />
            <Route path="/" element={<LandingPage />} /> */}

            {/* Authenticated Routes */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            />
          </Routes>
        </EmergencyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
