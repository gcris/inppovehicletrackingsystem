/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Routes, Route, NavLink, Navigate, Link } from 'react-router-dom';
import { useVehicleRealtime } from './hooks/useVehicleRealtime';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { ThemeProvider, useTheme } from './components/ThemeProvider';
import { Vehicle } from './lib/supabase';
import LiveMapPage from './pages/LiveMapPage';
import HistoryPage from './pages/HistoryPage';
import SchedulePage from './pages/SchedulePage';
import PersonnelPage from './pages/PersonnelPage';
import VehicleFleetPage from './pages/VehicleFleetPage';
import AnalyticsPage from './pages/AnalyticsPage';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AccountPage from './pages/AccountPage';
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
  User
} from 'lucide-react';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Layout() {
  const { vehicles, logs } = useVehicleRealtime();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  const normalCount = Object.values(vehicles).filter((v: any) => (v as Vehicle).load_status === 'Normal').length;
  const expiredCount = Object.values(vehicles).filter((v: any) => (v as Vehicle).load_status === 'Expired').length;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 selection:bg-blue-100 dark:selection:bg-blue-900/30 selection:text-blue-900 transition-colors duration-300">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 transition-colors duration-300">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 shadow-lg shadow-blue-200 dark:shadow-none overflow-hidden rounded-xl">
            <img src="/input_file_0.png" alt="INPPO Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="font-bold text-[11px] leading-tight text-slate-900 dark:text-white">INPPO PATROL</h1>
            <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-black">Ilocos Norte PPO</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <NavItem to="/dashboard" icon={<Activity className="w-5 h-5" />} label="Dashboard" />
          <NavItem to="/map" icon={<MapIcon className="w-5 h-5" />} label="Live Tracking" />
          <NavItem to="/schedule" icon={<Calendar className="w-5 h-5" />} label="Patrol Schedule" />
          <NavItem to="/personnel" icon={<Users className="w-5 h-5" />} label="Personnel List" />
          <NavItem to="/vehicles" icon={<Car className="w-5 h-5" />} label="Vehicle Fleet" />
          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
            <NavItem to="/analytics" icon={<BarChart3 className="w-5 h-5" />} label="Analytics" />
            <NavItem to="/account" icon={<User className="w-5 h-5" />} label="My Account" />
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">
            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-tighter">NETWORK STATUS</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Connected</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 z-10 shrink-0 transition-colors duration-300">
          <div className="relative w-96 font-sans">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search assets, sectors, or officers..." 
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg py-2 pl-10 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
            />
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              {theme === 'light' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
              )}
            </button>
            <button className="relative p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
            </button>
            <div className="h-8 w-px bg-slate-200 dark:border-slate-800 mx-2"></div>
            <Link to="/account" className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-black leading-none">{user?.email?.split('@')[0]}</p>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">Unit Commander</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-[10px] uppercase shadow-lg shadow-blue-100 dark:shadow-none">
                {user?.email?.slice(0, 2).toUpperCase()}
              </div>
            </Link>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-hidden flex flex-col gap-6">
          {/* Quick Stats Banner (Visible on Map) */}
          <Routes>
            <Route path="/map" element={
              <div className="grid grid-cols-4 gap-6 shrink-0">
                <StatCard label="Live Units" value={Object.keys(logs).length} sub="Real-time logs" />
                <StatCard label="Normal Status" value={normalCount} sub="Operations normal" status="success" />
                <StatCard label="Expired Status" value={expiredCount} sub="Action required" status="danger" />
                <StatCard label="Ilocos Norte Reach" value={14} sub="Officers deployed" />
              </div>
            } />
          </Routes>

          {/* Page Routes */}
          <div className="flex-1 overflow-hidden">
            <Routes>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/map" element={<LiveMapPage />} />
              <Route path="/map/:id/history" element={<HistoryPage />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/personnel" element={<PersonnelPage />} />
              <Route path="/vehicles" element={<VehicleFleetPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="*" element={
                <div className="h-full bg-white dark:bg-slate-900 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-300 dark:text-slate-600 mb-4">
                    <Shield className="w-8 h-8" />
                  </div>
                  <h3 className="text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest text-[10px] text-center">Secure Section</h3>
                </div>
              } />
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
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Authenticated Routes */}
          <Route path="/*" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}

function NavItem({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) {
  return (
    <NavLink 
      to={to} 
      className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer transition-all ${
        isActive 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 dark:shadow-none ring-4 ring-blue-50 dark:ring-blue-900/20' 
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
      }`}
    >
      {({ isActive }) => (
        <>
          <div className={`${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`}>{icon}</div>
          <span className="text-sm font-black tracking-tight">{label}</span>
          {isActive && (
            <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full ring-4 ring-blue-400/50"></div>
          )}
        </>
      )}
    </NavLink>
  );
}

function StatCard({ label, value, sub, status }: { label: string, value: number, sub: string, status?: 'success' | 'danger' }) {
  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-end gap-2 mb-1">
        <h3 className={`text-3xl font-black tracking-tighter ${
          status === 'success' ? 'text-green-600' : 
          status === 'danger' ? 'text-red-500' : 
          'text-slate-900 dark:text-white'
        }`}>{value}</h3>
      </div>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">{sub}</p>
    </div>
  );
}
