import React, { useState, useEffect } from 'react';
import { supabase, Personnel, Unit, Schedule, Vehicle } from '../lib/supabase';
import { AuthProvider, useAuth } from '../components/AuthProvider';
import { 
  Users, 
  Search, 
  Filter, 
  Shield, 
  Car, 
  Calendar, 
  ChevronRight,
  User as UserIcon,
  Phone,
  Mail,
  Badge,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';

export default function PersonnelPage() {
  const [personnel, setPersonnel] = useState<(Personnel & { unit?: Unit; vehicles?: Vehicle[]; todaySchedule?: Schedule | null })[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<string>('all');

  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch fundamental data
    let personnelQuery = supabase.from('personnel').select('*, unit(*)');
    if (activeTab === 'pending') {
      personnelQuery = personnelQuery.eq('is_approved', false);
    }

    const [personnelRes, unitsRes, vehiclesRes, schedulesRes] = await Promise.all([
      personnelQuery,
      supabase.from('unit').select('*'),
      supabase.from('vehicles').select('*'),
      supabase.from('schedule').select('*').eq('date', format(new Date(), 'yyyy-MM-dd'))
    ]);

    if (personnelRes.data) {
      const enrichedPersonnel = personnelRes.data.map(p => {
        const pVehicles = vehiclesRes.data?.filter(v => v.personnel_id === p.id) || [];
        const todaySchedule = schedulesRes.data?.find(s => s.personnel_id === p.id) || null;
        return { ...p, vehicles: pVehicles, todaySchedule };
      });
      setPersonnel(enrichedPersonnel);
    }
    
    if (unitsRes.data) setUnits(unitsRes.data);
    setLoading(false);
  };

  const filteredPersonnel = personnel.filter(p => {
    const matchesSearch = p.fullname.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         p.rank.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesUnit = selectedUnit === 'all' || p.unit_id === selectedUnit;
    return matchesSearch && matchesUnit;
  });

  const handleApprove = async (id: string) => {
    const { error } = await supabase
      .from('personnel')
      .update({ is_approved: true })
      .eq('id', id);
    
    if (error) {
      alert('Error approving user: ' + error.message);
    } else {
      fetchData();
    }
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Personnel Directory
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1">Manage officers, ranks, and unit assignments</p>
        </div>

        <div className="flex items-center gap-4">
          {isAdmin && (
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button 
                onClick={() => setActiveTab('all')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-tighter transition-all ${
                  activeTab === 'all' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                All Directory
              </button>
              <button 
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-tighter transition-all ${
                  activeTab === 'pending' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Pending Approvals
              </button>
            </div>
          )}

          <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search officer name or rank..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 w-64 shadow-sm"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select 
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-10 pr-8 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none shadow-sm"
            >
              <option value="all">All Units</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.unit_name}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>

    {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 overflow-y-auto pr-2">
          {filteredPersonnel.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 transition-colors">
              <Search className="w-12 h-12 text-slate-200 dark:text-slate-800 mb-4" />
              <p className="text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest text-sm text-center">No personnel found</p>
            </div>
          ) : (
            filteredPersonnel.map((person) => (
              <div key={person.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all group relative">
                {!person.is_approved && (
                  <div className="absolute top-4 right-4 z-10">
                    <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-amber-200 flex items-center gap-1.5 animate-pulse">
                      <Clock className="w-2.5 h-2.5" />
                      Pending Approval
                    </span>
                  </div>
                )}
                {/* Header Profile */}
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-4 relative transition-colors">
                  <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xl font-black shadow-inner">
                    {person.fullname.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-full bg-blue-600/10 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-wider">{person.rank}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">{person.unit?.unit_name}</span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{person.fullname}</h3>
                  </div>
                  <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 dark:text-slate-700 group-hover:text-blue-400 transition-colors" />
                </div>

                {/* Status Body */}
                <div className="p-6 space-y-4">
                  {/* Current Vehicle */}
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <Car className="w-4 h-4 text-slate-400 dark:text-slate-600" />
                      <div>
                        <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">Current Vehicle</p>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {person.vehicles && person.vehicles.length > 0 
                            ? person.vehicles[0].plate_number 
                            : 'No Vehicle Assigned'}
                        </p>
                      </div>
                    </div>
                    {person.vehicles && person.vehicles.length > 0 && (
                      <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                    )}
                  </div>

                  {/* Today's Schedule */}
                  <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl transition-colors">
                    <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-600" />
                    <div className="flex-1">
                      <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">Today's Schedule</p>
                      {person.todaySchedule ? (
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{person.todaySchedule.sector}</p>
                          <span className="text-[10px] font-black text-blue-600 dark:text-blue-400">
                            {person.todaySchedule.time_from.slice(0, 5)} - {person.todaySchedule.time_to.slice(0, 5)}
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs font-medium text-slate-400 dark:text-slate-600">Off Duty</p>
                      )}
                    </div>
                  </div>

                  {/* Contact/Quick Actions */}
                  <div className="flex items-center gap-2 pt-2">
                    {isAdmin && !person.is_approved ? (
                      <button 
                        onClick={() => handleApprove(person.id)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100 dark:shadow-none"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        Approve Account
                      </button>
                    ) : (
                      <button className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <Shield className="w-3.5 h-3.5" />
                        View Profile
                      </button>
                    )}
                    <button className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                      <Mail className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
