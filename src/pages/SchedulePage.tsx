import React, { useState, useEffect } from 'react';
import { supabase, Schedule, Personnel, Unit } from '../lib/supabase';
import { format, startOfDay, endOfDay, addDays, subDays } from 'date-fns';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Search, 
  MapPin, 
  Clock, 
  User, 
  Shield, 
  AlertCircle,
  X,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    unit_id: '',
    personnel_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time_from: '08:00',
    time_to: '17:00',
    sector: ''
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [selectedDate]);

  const fetchInitialData = async () => {
    const [unitsRes, personnelRes] = await Promise.all([
      supabase.from('unit').select('*'),
      supabase.from('personnel').select('*')
    ]);

    if (unitsRes.data) setUnits(unitsRes.data);
    if (personnelRes.data) setPersonnel(personnelRes.data);
  };

  const fetchSchedules = async () => {
    setLoading(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    const { data } = await supabase
      .from('schedule')
      .select('*, personnel(*), unit(*)')
      .eq('date', dateStr);

    if (data) setSchedules(data);
    setLoading(false);
  };

  const validateAssignment = async () => {
    // 1. Check if officer belongs to unit
    const officer = personnel.find(p => p.id === formData.personnel_id);
    if (officer && officer.unit_id !== formData.unit_id) {
      setError("Officer does not belong to the selected unit.");
      return false;
    }

    // 2. Check for conflicts (personnel id + date)
    const { data: conflicts } = await supabase
      .from('schedule')
      .select('*')
      .eq('personnel_id', formData.personnel_id)
      .eq('date', formData.date);

    if (conflicts && conflicts.length > 0) {
      // Very basic check: any assignment on same day is a conflict for this demo
      // In production, we'd check time overlaps
      setError("Officer already has an assignment for this date.");
      return false;
    }

    return true;
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const isValid = await validateAssignment();
    if (!isValid) {
      setIsSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase
      .from('schedule')
      .insert([formData]);

    if (insertError) {
      setError(insertError.message);
    } else {
      setShowModal(false);
      fetchSchedules();
      setFormData({
        unit_id: '',
        personnel_id: '',
        date: format(selectedDate, 'yyyy-MM-dd'),
        time_from: '08:00',
        time_to: '17:00',
        sector: ''
      });
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this assignment?')) return;
    const { error } = await supabase.from('schedule').delete().eq('id', id);
    if (!error) fetchSchedules();
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-blue-600" />
            Patrol Schedule
          </h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Manage personnel deployments and sector assignments</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white rounded-xl border border-slate-200 shadow-sm p-1">
            <button 
              onClick={() => setSelectedDate(subDays(selectedDate, 1))}
              className="p-2 hover:bg-slate-50 rounded-lg text-slate-500"
            >
              <X className="w-4 h-4 rotate-45" />
            </button>
            <div className="px-4 font-black text-sm text-slate-700 min-w-[140px] text-center">
              {format(selectedDate, 'MMMM d, yyyy')}
            </div>
            <button 
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="p-2 hover:bg-slate-50 rounded-lg text-slate-500"
            >
              <Plus className="w-4 h-4 rotate-45" />
            </button>
          </div>

          <button 
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            New Assignment
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto pr-2">
          {schedules.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
              <CalendarIcon className="w-12 h-12 text-slate-200 mb-4" />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No patrol assignments scheduled for this date</p>
            </div>
          ) : (
            schedules.map((schedule) => (
              <div key={schedule.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col gap-4 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 leading-tight">{schedule.personnel?.fullname}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{schedule.personnel?.rank} • {schedule.unit?.unit_name}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDelete(schedule.id)}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sector</span>
                    </div>
                    <p className="text-sm font-bold text-slate-700">{schedule.sector}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Duty Hours</span>
                    </div>
                    <p className="text-sm font-bold text-slate-700">{schedule.time_from.slice(0, 5)} - {schedule.time_to.slice(0, 5)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Assignment Verified</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* New Assignment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-black text-slate-900">New Patrol Assignment</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSchedule} className="p-6 space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Unit</label>
                  <select 
                    required
                    className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                    value={formData.unit_id}
                    onChange={(e) => setFormData({...formData, unit_id: e.target.value})}
                  >
                    <option value="">Select Unit</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.unit_name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Patrol Officer</label>
                  <select 
                    required
                    className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                    value={formData.personnel_id}
                    onChange={(e) => setFormData({...formData, personnel_id: e.target.value})}
                  >
                    <option value="">Select Officer</option>
                    {personnel
                      .filter(p => !formData.unit_id || p.unit_id === formData.unit_id)
                      .map(p => <option key={p.id} value={p.id}>{p.rank} {p.fullname}</option>)
                    }
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Sector</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. Divisoria / Binondo Area"
                    className="w-full bg-slate-50 border-none rounded-xl py-3 pl-11 pr-4 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                    value={formData.sector}
                    onChange={(e) => setFormData({...formData, sector: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Deployment Date</label>
                <input 
                  required
                  type="date"
                  className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Duty Start</label>
                  <input 
                    required
                    type="time"
                    className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                    value={formData.time_from}
                    onChange={(e) => setFormData({...formData, time_from: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Duty End</label>
                  <input 
                    required
                    type="time"
                    className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                    value={formData.time_to}
                    onChange={(e) => setFormData({...formData, time_to: e.target.value})}
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3.5 rounded-xl font-bold text-slate-500 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {isSubmitting ? 'Processing...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
