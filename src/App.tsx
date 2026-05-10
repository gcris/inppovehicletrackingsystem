/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Routes, Route, NavLink, Navigate, Link } from 'react-router-dom';
import { useVehicleRealtime } from './hooks/useVehicleRealtime';
import { AuthProvider, useAuth } from './components/AuthProvider';
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
  
  const activeCount = Object.values(vehicles).filter(v => v.load_status === 'On Patrol').length;
  const emergencyCount = Object.values(vehicles).filter(v => v.load_status === 'Emergency').length;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white shadow-lg shadow-blue-200">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight text-slate-900">PNP PATROL</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold text-shadow-sm">Station 6 - Manila</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <NavItem to="/dashboard" icon={<Activity className="w-5 h-5" />} label="Dashboard" />
          <NavItem to="/map" icon={<MapIcon className="w-5 h-5" />} label="Live Tracking" />
          <NavItem to="/schedule" icon={<Calendar className="w-5 h-5" />} label="Patrol Schedule" />
          <NavItem to="/personnel" icon={<Users className="w-5 h-5" />} label="Personnel List" />
          <NavItem to="/vehicles" icon={<Car className="w-5 h-5" />} label="Vehicle Fleet" />
          <div className="pt-4 mt-4 border-t border-slate-100">
            <NavItem to="/analytics" icon={<BarChart3 className="w-5 h-5" />} label="Analytics" />
            <NavItem to="/account" icon={<User className="w-5 h-5" />} label="My Account" />
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 p-4 rounded-xl">
            <p className="text-xs font-semibold text-slate-500 mb-1 leading-none uppercase tracking-tighter">NETWORK STATUS</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Supabase Connected</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10 shrink-0">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search plate number, officer, or sector..." 
              className="w-full bg-slate-50 border-none rounded-lg py-2 pl-10 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-300"
            />
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-px bg-slate-200 mx-2"></div>
            <Link to="/account" className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition-colors">
              <div className="text-right">
                <p className="text-sm font-black leading-none">{user?.email?.split('@')[0]}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Unit Commander</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-[10px] uppercase shadow-lg shadow-blue-100">
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
                <StatCard label="Total Units" value={Object.keys(logs).length} sub="Active logs" />
                <StatCard label="On Patrol" value={activeCount} sub="Sector coverage" status="success" />
                <StatCard label="Emergencies" value={emergencyCount} sub="Immediate priority" status="danger" />
                <StatCard label="Total Reach" value={14} sub="Officers on duty" />
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
                <div className="h-full bg-white rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-slate-200">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-4">
                    <Shield className="w-8 h-8" />
                  </div>
                  <h3 className="text-slate-400 font-black uppercase tracking-widest text-[10px] text-center">Section Not Accessible</h3>
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
  );
}

function NavItem({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) {
  return (
    <NavLink 
      to={to} 
      className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer transition-all ${
        isActive 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 ring-4 ring-blue-50' 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
      }`}
    >
      {({ isActive }) => (
        <>
          <div className={`${isActive ? 'text-white' : 'text-slate-400'}`}>{icon}</div>
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
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-end gap-2 mb-1">
        <h3 className={`text-3xl font-black tracking-tighter ${
          status === 'success' ? 'text-green-600' : 
          status === 'danger' ? 'text-red-500' : 
          'text-slate-900'
        }`}>{value}</h3>
      </div>
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{sub}</p>
    </div>
  );
}
