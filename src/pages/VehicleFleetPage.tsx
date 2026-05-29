import React, { useState, useEffect } from 'react';
import { supabase, Vehicle, Personnel, Unit } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
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
  MoreVertical,
  Trash2,
  Edit2,
  Activity,
  LocateFixed
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function VehicleFleetPage() {
  const [vehicles, setVehicles] = useState<(Vehicle & { personnel?: Personnel; unit?: Unit })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editingVehicle, setEditingVehicle] = useState<(Vehicle & { personnel?: Personnel; unit?: Unit }) | null>(null);
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [unitList, setUnitList] = useState<Unit[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchVehicles();
    fetchSupportData();
  }, []);

  const fetchSupportData = async () => {
    try {
      const [pRes, uRes] = await Promise.all([
        supabase.from('personnel').select('*'),
        supabase.from('unit').select('*')
      ]);
      if (pRes.error) console.error('Error fetching personnel:', pRes.error);
      else if (pRes.data) setPersonnelList(pRes.data);

      if (uRes.error) console.error('Error fetching units:', uRes.error);
      else if (uRes.data) setUnitList(uRes.data);
    } catch (err) {
      console.error('Fetch support data failed:', err);
    }
  };

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*, personnel(*), unit(*)')
        .order('plate_number', { ascending: true });

      if (error) throw error;
      if (data) setVehicles(data);
    } catch (err: any) {
      console.error('Error fetching vehicles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this vehicle?')) return;
    try {
      const { error } = await supabase.from('vehicles').delete().eq('id', id);
      if (error) throw error;
      fetchVehicles();
    } catch (err: any) {
      alert('Error deleting vehicle: ' + err.message);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle) return;

    try {
      const { error } = await supabase
        .from('vehicles')
        .update({
          plate_number: editingVehicle.plate_number,
          load_status: editingVehicle.load_status,
          unit_id: editingVehicle.unit_id,
          personnel_id: editingVehicle.personnel_id
        })
        .eq('id', editingVehicle.id);

      if (error) throw error;
      setEditingVehicle(null);
      fetchVehicles();
    } catch (err: any) {
      alert('Error updating vehicle: ' + err.message);
    }
  };

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = (v.plate_number || '').toLowerCase().includes(searchQuery.toLowerCase());
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
    <div className="flex flex-col gap-6 px-1">
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
            className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-sm"
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
        <div className="flex-1 overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                  <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Plate Number</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Assigned Unit</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Personnel In-Charge</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Last Update</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {filteredVehicles.map((vehicle) => {
                  const isStale = Date.now() - new Date(vehicle.last_load_update).getTime() > 5 * 60 * 1000;
                  
                  return (
                    <tr key={vehicle.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${getStatusColor(vehicle.load_status).replace('bg-', 'dark:bg-opacity-20 bg-')}`}>
                            <Car className="w-5 h-5" />
                          </div>
                          <span className="font-black text-slate-900 dark:text-white text-sm tracking-tight">{vehicle.plate_number}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{vehicle.unit?.unit_name}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-600">
                            <User className="w-3 h-3" />
                          </div>
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{vehicle.personnel?.fullname || 'Not Assigned'}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(vehicle.load_status).replace('bg-', 'dark:bg-opacity-20 bg-')}`}>
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
                      <td className="p-4 flex items-center justify-center gap-2">
                        <button 
                          onClick={() => navigate('/trackingmap/' + vehicle.id)}
                          title="Track Vehicle"
                          className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                        >
                          <LocateFixed className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setEditingVehicle(vehicle)}
                          title="Edit Vehicle"
                          className="p-2 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(vehicle.id)}
                          title="Delete Vehicle"
                          className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
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
              <Car className="w-12 h-12 text-slate-100 dark:text-slate-800 mb-4" />
              <p className="text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest text-sm">No vehicles found</p>
            </div>
          )}
        </div>
      )}

      {/* Edit Vehicle Overlay */}
      {editingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Edit Fleet Asset</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Modify vehicle registration & status</p>
            </div>
            
            <form onSubmit={handleUpdate} className="p-8 space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Plate Number</label>
                <input 
                  type="text" 
                  value={editingVehicle.plate_number}
                  onChange={(e) => setEditingVehicle({...editingVehicle, plate_number: e.target.value})}
                  className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Unit Assignment</label>
                  <select 
                    value={editingVehicle.unit_id || ''}
                    onChange={(e) => setEditingVehicle({...editingVehicle, unit_id: e.target.value})}
                    className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  >
                    <option value="">Select Unit</option>
                    {unitList.map(u => <option key={u.id} value={u.id}>{u.unit_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Load Status</label>
                  <select 
                    value={editingVehicle.load_status}
                    onChange={(e) => setEditingVehicle({...editingVehicle, load_status: e.target.value as 'Normal' | 'Expired' | 'Maintenance'})}
                    className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Expired">Expired</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Personnel In-Charge</label>
                <select 
                  value={editingVehicle.personnel_id || ''}
                  onChange={(e) => setEditingVehicle({...editingVehicle, personnel_id: e.target.value})}
                  className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                >
                  <option value="">No Assignment</option>
                  {personnelList.map(p => <option key={p.id} value={p.id}>{p.fullname}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-3 pt-6">
                <button 
                  type="button"
                  onClick={() => setEditingVehicle(null)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-black uppercase tracking-tighter hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-tighter hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none transition-all"
                >
                  Save Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
