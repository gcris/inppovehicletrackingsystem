/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useVehicleRealtime } from './hooks/useVehicleRealtime';
import TrackingMap from './components/TrackingMap';
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
  Activity
} from 'lucide-react';

export default function App() {
  const { vehicles, logs } = useVehicleRealtime();
  
  const activeCount = Object.values(vehicles).filter(v => v.load_status === 'On Patrol').length;
  const emergencyCount = Object.values(vehicles).filter(v => v.load_status === 'Emergency').length;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight text-slate-900 group-hover:text-blue-600">PNP PATROL</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Station 6 - Manila</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <NavItem icon={<Activity className="w-5 h-5" />} label="Dashboard" active={false} />
          <NavItem icon={<MapIcon className="w-5 h-5" />} label="Live Tracking" active={true} />
          <NavItem icon={<Calendar className="w-5 h-5" />} label="Patrol Schedule" active={false} />
          <NavItem icon={<Users className="w-5 h-5" />} label="Personnel List" active={false} />
          <NavItem icon={<Car className="w-5 h-5" />} label="Vehicle Fleet" active={false} />
          <div className="pt-4 mt-4 border-t border-slate-100">
            <NavItem icon={<BarChart3 className="w-5 h-5" />} label="Analytics" active={false} />
            <NavItem icon={<Settings className="w-5 h-5" />} label="Unit Settings" active={false} />
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 p-4 rounded-xl">
            <p className="text-xs font-semibold text-slate-500 mb-1">REAL-TIME STATUS</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-xs font-medium text-slate-700 capitalize">Connected to Supabase</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search plate number, officer, or sector..." 
              className="w-full bg-slate-50 border-none rounded-lg py-2 pl-10 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-px bg-slate-200 mx-2"></div>
            <div className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition-colors">
              <div className="text-right">
                <p className="text-sm font-bold leading-none">Cpt. Ricardo Dalisay</p>
                <p className="text-[10px] text-slate-500 mt-1">Unit Commander</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">RD</div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-hidden flex flex-col gap-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-6 shrink-0">
            <StatCard label="Live Vehicles" value={Object.keys(logs).length} sub="Reporting updates" />
            <StatCard label="On Patrol" value={activeCount} sub="Active deployments" status="success" />
            <StatCard label="Emergency Alerts" value={emergencyCount} sub="Priority response" status="danger" />
            <StatCard label="Active Personnel" value={14} sub="Officers on duty" />
          </div>

          {/* Map View */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-2 flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 shrink-0">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-blue-600" />
                NCR Sector 6 Tracking Map
              </h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                  <span className="text-[10px] font-bold text-slate-500">PATROL</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                  <span className="text-[10px] font-bold text-slate-500">AVAILABLE</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                  <span className="text-[10px] font-bold text-slate-500">EMERGENCY</span>
                </div>
              </div>
            </div>
            <div className="flex-1 relative">
              <TrackingMap vehicles={vehicles} logs={logs} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active }: { icon: React.ReactNode, label: string, active: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
      active ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
    }`}>
      {icon}
      <span className="text-sm font-semibold">{label}</span>
      {active && <div className="ml-auto w-1 h-4 bg-blue-600 rounded-full"></div>}
    </div>
  );
}

function StatCard({ label, value, sub, status }: { label: string, value: number, sub: string, status?: 'success' | 'danger' }) {
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-end gap-2 mb-1">
        <h3 className={`text-3xl font-black ${
          status === 'success' ? 'text-green-600' : 
          status === 'danger' ? 'text-red-600' : 
          'text-slate-900'
        }`}>{value}</h3>
      </div>
      <p className="text-[10px] text-slate-400 font-medium uppercase">{sub}</p>
    </div>
  );
}
