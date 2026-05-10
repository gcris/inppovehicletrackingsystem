import React, { useState, useEffect } from 'react';
import { supabase, Vehicle, Personnel, Unit } from '../lib/supabase';
import { 
  Car, 
  Search, 
  Filter, 
  Shield, 
  User, 
  AlertTriangle, 
  Clock, 
  RefreshCcw,
  Navigation,
  CheckCircle2,
  MoreVertical
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function VehicleFleetPage() {
  const [vehicles, setVehicles] = useState<(Vehicle & { personnel?: Personnel; unit?: Unit })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('vehicles')
      .select('*, personnel(*), unit(*)')
      .order('plate_number', { ascending: true });

    if (data) setVehicles(data);
    setLoading(false);
  };

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = v.plate_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || v.load_status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Expired': return 'text-amber-600 bg-amber-100';
      case 'Normal': return 'text-green-600 bg-green-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Car className="w-6 h-6 text-blue-600" />
            INPPO Fleet Assets
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1">Registry of Ilocos Norte provincial response vehicles</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Filter by plate number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 w-64 shadow-sm"
            />
          </div>

          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-4 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
          >
            <option value="all">All Statuses</option>
            <option value="Normal">Normal</option>
            <option value="Expired">Expired</option>
          </select>

          <button 
            onClick={fetchVehicles}
            className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-blue-600 transition-colors shadow-sm"
          >
            <RefreshCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Plate Number</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned Unit</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Personnel In-Charge</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Update</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredVehicles.map((vehicle) => {
                  const isStale = Date.now() - new Date(vehicle.last_load_update).getTime() > 5 * 60 * 1000;
                  
                  return (
                    <tr key={vehicle.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${getStatusColor(vehicle.load_status)}`}>
                            <Car className="w-5 h-5" />
                          </div>
                          <span className="font-black text-slate-900 text-sm tracking-tight">{vehicle.plate_number}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{vehicle.unit?.unit_name}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                            <User className="w-3 h-3" />
                          </div>
                          <span className="text-sm font-bold text-slate-700">{vehicle.personnel?.fullname || 'Not Assigned'}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(vehicle.load_status)}`}>
                          {vehicle.load_status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Clock className={`w-3.5 h-3.5 ${isStale ? 'text-amber-500' : 'text-slate-400'}`} />
                            <span className={`text-[10px] font-bold ${isStale ? 'text-amber-600' : 'text-slate-500'}`}>
                              {formatDistanceToNow(new Date(vehicle.last_load_update))} ago
                            </span>
                          </div>
                          {isStale && (
                            <div className="flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                              <span className="text-[9px] font-black text-amber-600 uppercase">Stale Signal</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {filteredVehicles.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center py-20">
              <Car className="w-12 h-12 text-slate-100 mb-4" />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No vehicles found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
