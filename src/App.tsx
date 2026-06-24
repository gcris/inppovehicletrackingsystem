/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Routes, Route, NavLink, Navigate, Link } from "react-router-dom";
import { supabase, MobilityAsset } from "./lib/supabase";
import { AuthProvider, useAuth } from "./components/AuthProvider";
import { ThemeProvider, useTheme } from "./components/ThemeProvider";
import LiveMapPage from "./pages/LiveMapPage";
import TrackingMapPage from "./pages/TrackingMapPage";
import SchedulePage from "./pages/SchedulePage";
import PersonnelPage from "./pages/PersonnelPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AccountPage from "./pages/AccountPage";
import ShiftManagement from "./pages/ShiftManagement";
import DutyShiftManagement from "./pages/DutyShiftManagement";
import PersonnelTrackingPage from "./pages/PersonnelTrackingPage";
import {
  Shield,
  Map as MapIcon,
  Users,
  Car,
  Calendar,
  BarChart3,
  Settings,
  Bell,
  Search,
  Activity,
  History as HistoryIcon,
  User,
  LogOut,
  AlertCircle,
  CheckCircle2,
  ListRestart,
  Clock,
  Group,
} from "lucide-react";
import MobilityAssetsPage from "./pages/MobilityAssetsPage";
import TeamManagement from "./pages/TeamManagement";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "admin" | "user" | null;
}

function ProtectedRoute({
  children,
  requiredRole = null,
}: ProtectedRouteProps) {
  const { user, loading, isApproved, clearAuthCache, isMfaVerified, role } =
    useAuth();
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

  // Role-based access control
  if (requiredRole !== null && role !== requiredRole) {
    // If user doesn't have required role, redirect to dashboard or show access denied
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-8 border border-slate-100 dark:border-slate-800">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-500" />
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
  const { user, profile, isAdmin, clearAuthCache } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // const [vehiclesList, setVehiclesList] = React.useState<MobilityAsset[]>([]);

  React.useEffect(() => {
    let isMounted = true;
    // const fetchVehicles = async () => {
    //   try {
    //     const { data, error } = await supabase
    //       .from("mobility_assets")
    //       .select("*");
    //     if (error) throw error;
    //     if (data && isMounted) {
    //       setVehiclesList(data);
    //     }
    //   } catch (err) {
    //     console.error("Error fetching layout vehicles:", err);
    //   }
    // };
    // fetchVehicles();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 selection:bg-blue-100 dark:selection:bg-blue-900/30 selection:text-blue-900 transition-colors duration-300">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 transition-colors duration-300">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 shadow-lg shadow-blue-200 dark:shadow-none overflow-hidden rounded-xl bg-blue-600 flex items-center justify-center">
            <img
              src="/assets/inppo_logo.png"
              alt="INPPO Logo"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.parentElement!.innerHTML =
                  '<svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
              }}
            />
          </div>
          <div>
            <h1 className="font-bold leading-tight text-slate-900 dark:text-white">
              INPPO PATROL
            </h1>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-black">
              Ilocos Norte PPO
            </p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <NavItem
            to="/dashboard"
            icon={
              <img
                src="/assets/dashboard.png"
                alt="Dashboard"
                className="w-7 h-7"
              />
            }
            label="Dashboard"
          />
          <NavItem
            to="/map"
            icon={<img src="/assets/map.png" alt="Map" className="w-7 h-7" />}
            label="Live Tracking"
          />
          {/* <NavItem
            to="/shift-management"
            icon={
              <img
                src="/assets/duty-schedule.png"
                alt="Duty Schedules"
                className="w-7 h-7"
              />
            }
            label="Duty Schedules"
          />
          <NavItem
            to="/duty-shift-management"
            icon={
              <img
                src="/assets/duty-shift.png"
                alt="Duty Shifts"
                className="w-7 h-7"
              />
            }
            label="Duty Shifts"
          /> */}
          <NavItem
            to="/personnel"
            icon={
              <img
                src="/assets/personnel.png"
                alt="Personnel"
                className="w-7 h-7"
              />
            }
            label="Personnel List"
          />
          {/* <NavItem
            to="/personnel-tracking"
            icon={<User className="w-7 h-7" />}
            label="Personnel Tracking"
          /> */}
          <NavItem
            to="/schedule"
            icon={
              <img
                src="/assets/patrol-schedule.png"
                alt="Schedules"
                className="w-7 h-7"
              />
            }
            label="Schedules"
          />
          <NavItem
            to="/mobility-assets"
            icon={
              <img
                src="/assets/mobility-assets.png"
                alt="Mobility Assets"
                className="w-7 h-7"
              />
            }
            label="Mobility Assets"
          />
          {/* <NavItem
            to="/team"
            icon={<Group className="w-7 h-7" />}
            label="Team"
          /> */}
          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
            <NavItem
              to="/analytics"
              icon={<BarChart3 className="w-7 h-7" />}
              label="Analytics"
            />
            <NavItem
              to="/account"
              icon={<User className="w-7 h-7" />}
              label="My Account"
            />
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 z-20 shrink-0 transition-colors duration-300">
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

            <div className="h-8 w-px bg-slate-200 dark:border-slate-800 mx-2"></div>
            <Link
              to="/account"
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
            </Link>
            <button
              onClick={clearAuthCache}
              className="p-2 text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-7 h-7" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          {/* Page Routes */}
          <div className="flex-1 min-h-0">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/map" element={<LiveMapPage />} />
              <Route path="/trackingmap/:id" element={<TrackingMapPage />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/personnel" element={<PersonnelPage />} />
              <Route
                path="/personnel-tracking"
                element={<PersonnelTrackingPage />}
              />
              <Route path="/mobility-assets" element={<MobilityAssetsPage />} />
              {/* <Route path="/team" element={<TeamManagement />} /> */}
              <Route path="/analytics" element={<AnalyticsPage />} />
              {/* <Route path="/shift-management" element={<ShiftManagement />} />
              <Route
                path="/duty-shift-management"
                element={<DutyShiftManagement />}
              /> */}
              <Route path="/account" element={<AccountPage />} />
              <Route
                path="*"
                element={
                  <div className="h-full bg-white dark:bg-slate-900 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-300 dark:text-slate-600 mb-4">
                      <Shield className="w-8 h-8" />
                    </div>
                    <h3 className="text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest  text-center">
                      Secure Section
                    </h3>
                  </div>
                }
              />
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
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

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
      </AuthProvider>
    </ThemeProvider>
  );
}

function NavItem({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer transition-all ${
          isActive
            ? "font-bold bg-blue-600 text-white shadow-lg shadow-blue-100 dark:shadow-none ring-4 ring-blue-50 dark:ring-blue-900/20"
            : "hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <div
            className={`${isActive ? "text-white" : "bg-slate-50 dark:bg-slate-800 dark:text-slate-500 rounded-lg p-0.5"} transition-colors duration-300  `}
          >
            {icon}
          </div>
          <span className="text-md tracking-tight">{label}</span>
          {isActive && (
            <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full ring-4 ring-blue-400/50"></div>
          )}
        </>
      )}
    </NavLink>
  );
}

function StatCard({
  label,
  value,
  sub,
  status,
}: {
  label: string;
  value: number;
  sub: string;
  status?: "success" | "danger";
}) {
  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
      <p className="font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
        {label}
      </p>
      <div className="flex items-end gap-2 mb-1">
        <h3
          className={`text-3xl font-black tracking-tighter ${
            status === "success"
              ? "text-green-600"
              : status === "danger"
                ? "text-red-500"
                : "text-slate-900 dark:text-white"
          }`}
        >
          {value}
        </h3>
      </div>
      <p className=" text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
        {sub}
      </p>
    </div>
  );
}
