import React, { useState, useEffect } from "react";
import { supabase, MobilityAsset, Unit } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../components/AuthProvider";
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
  LocateFixed,
  Cross,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function MobilityAssetsPage() {
  const [vehicles, setVehicles] = useState<(MobilityAsset & { unit?: Unit })[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  // Filter status removed since load_status column was deleted
  const [editingVehicle, setEditingVehicle] = useState<
    (MobilityAsset & { unit?: Unit }) | null
  >(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    plate_number: "",
    unit_id: "",
    vehicle_type: "",
    description: "",
  });

  const [unitList, setUnitList] = useState<Unit[]>([]);
  const navigate = useNavigate();
  const { unitId, isAdmin } = useAuth();

  // Auto-fill unit_id for non-admin users and disable unit dropdown
  useEffect(() => {
    if (!isAdmin && unitId) {
      setFormData((prev) => ({ ...prev, unit_id: unitId }));
    }
  }, [isAdmin, unitId]);

  useEffect(() => {
    fetchVehicles();
    fetchSupportData();
  }, []);

  const fetchSupportData = async () => {
    try {
      // Apply unit filtering for non-admin users
      let unitQuery = supabase.from("unit").select("*");

      if (!isAdmin && unitId) {
        unitQuery = unitQuery.eq("id", unitId);
      }

      const [uRes] = await Promise.all([unitQuery]);

      if (uRes.error) console.error("Error fetching units:", uRes.error);
      else if (uRes.data) setUnitList(uRes.data);
    } catch (err) {
      console.error("Fetch support data failed:", err);
    }
  };

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      // Build query with unit filtering for non-admin users
      let vehiclesQuery = supabase
        .from("mobility_assets")
        .select("*, unit(*)")
        .order("plate_number", { ascending: true });

      // Apply unit filtering for non-admin users
      if (!isAdmin && unitId) {
        vehiclesQuery = vehiclesQuery.eq("unit_id", unitId);
      }

      const { data, error } = await vehiclesQuery;

      if (error) throw error;
      if (data) setVehicles(data);
    } catch (err: any) {
      console.error("Error fetching vehicles:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this mobility asset?"))
      return;
    try {
      const { error } = await supabase
        .from("mobility_assets")
        .delete()
        .eq("id", id);
      if (error) throw error;
      fetchVehicles();
    } catch (err: any) {
      alert("Error deleting mobility asset: " + err.message);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle) return;

    try {
      const { error } = await supabase
        .from("mobility_assets")
        .update({
          plate_number: editingVehicle.plate_number,
          unit_id: editingVehicle.unit_id,
          vehicle_type: editingVehicle.vehicle_type,
          description: editingVehicle.description,
        })
        .eq("id", editingVehicle.id);

      if (error) throw error;
      setEditingVehicle(null);
      setFormData({
        plate_number: "",
        unit_id: unitId || "",
        vehicle_type: "",
        description: "",
      });
      fetchVehicles();
    } catch (err: any) {
      alert("Error updating mobility asset: " + err.message);
    }
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from("mobility_assets").insert([
        {
          plate_number: formData.plate_number,
          unit_id: formData.unit_id || null,
          vehicle_type: formData.vehicle_type,
          description: formData.description,
        },
      ]);

      if (error) throw error;
      setShowAddModal(false);
      setFormData({
        plate_number: "",
        unit_id: unitId || "",
        vehicle_type: "",
        description: "",
      });
      fetchVehicles();
    } catch (err: any) {
      alert("Error adding mobility asset: " + err.message);
    }
  };

  const filteredVehicles = vehicles.filter((v) => {
    const matchesSearch = (v.plate_number || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    // Since load_status column was removed, we show all vehicles
    return matchesSearch;
  });

  return (
    <div className="flex flex-col gap-6 px-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-slate-900 dark:text-white flex items-center gap-2">
            <Car className="w-6 h-6 text-blue-600" />
            Mobility Assets
          </h1>
          <p className="text-slate-800 dark:text-slate-200 mt-1">
            Manage mobility assets
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-sm transition-all focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            <Car className="w-4 h-4" />
            New
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by plate number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-10 pr-4 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 w-64 shadow-sm"
            />
          </div>

          <button
            onClick={fetchVehicles}
            className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-sm"
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
                  <th className="p-4 text-slate-800 dark:text-slate-200 ">
                    Plate Number
                  </th>
                  <th className="p-4  text-slate-800 dark:text-slate-200 ">
                    Assigned Unit
                  </th>
                  <th className="p-4  text-slate-800 dark:text-slate-200 ">
                    Description
                  </th>
                  <th className="p-4  text-slate-800 dark:text-slate-200 ">
                    Mobility Type
                  </th>
                  <th className="p-4  text-slate-800 dark:text-slate-200 text-center">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {filteredVehicles.map((vehicle) => {
                  return (
                    <tr
                      key={vehicle.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <span className=" text-slate-900 dark:text-white tracking-tight">
                            {vehicle.plate_number}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-slate-800 dark:text-slate-200">
                          {vehicle.unit?.unit_name}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-slate-800 dark:text-slate-200">
                          {vehicle.description || "No description"}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-slate-800 dark:text-slate-200">
                          {vehicle.vehicle_type || "Not Specified"}
                        </span>
                      </td>
                      <td className="p-4 flex items-center justify-center gap-2">
                        <button
                          onClick={() => navigate("/trackingmap/" + vehicle.id)}
                          title="Track Vehicle"
                          className="p-2 text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                        >
                          <LocateFixed className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setEditingVehicle(vehicle)}
                          title="Edit Vehicle"
                          className="p-2 text-slate-800 dark:text-slate-200 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(vehicle.id)}
                          title="Delete Vehicle"
                          className="p-2 text-slate-800 dark:text-slate-200 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
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
              <p className="text-slate-400 dark:text-slate-800 font-bold text-sm">
                No mobility assets found
              </p>
            </div>
          )}
        </div>
      )}

      {/* Edit Vehicle Overlay */}
      {editingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-xl  text-slate-900 dark:text-white">
                Edit Mobility Asset
              </h2>
              <p className="text-slate-400 font-bold tmt-1">
                Modify Mobility asset
              </p>
            </div>

            <form onSubmit={handleUpdate} className="p-8 space-y-5">
              <div>
                <label className="text-slate-800 dark:text-slate-200 tml-1">
                  Plate Number
                </label>
                <input
                  type="text"
                  value={editingVehicle.plate_number}
                  onChange={(e) =>
                    setEditingVehicle({
                      ...editingVehicle,
                      plate_number: e.target.value,
                    })
                  }
                  className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-800 dark:text-slate-200 tml-1">
                    Unit/Station
                  </label>
                  <select
                    value={editingVehicle.unit_id || ""}
                    onChange={(e) =>
                      setEditingVehicle({
                        ...editingVehicle,
                        unit_id: e.target.value,
                      })
                    }
                    disabled={!isAdmin && !!unitId}
                    className={`w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${!isAdmin && unitId ? "bg-slate-200 dark:bg-slate-700/50 cursor-not-allowed" : ""}`}
                  >
                    <option value="">Select Unit</option>
                    {unitList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.unit_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-800 dark:text-slate-200 tml-1">
                  Description
                </label>
                <input
                  type="text"
                  value={editingVehicle.description || ""}
                  onChange={(e) =>
                    setEditingVehicle({
                      ...editingVehicle,
                      description: e.target.value,
                    })
                  }
                  placeholder="Description"
                  className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              <div>
                <label className="  text-slate-800 dark:text-slate-200 tml-1">
                  Mobility Type
                </label>
                <select
                  value={editingVehicle.vehicle_type}
                  onChange={(e) =>
                    setEditingVehicle({
                      ...editingVehicle,
                      vehicle_type: e.target.value,
                    })
                  }
                  className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                >
                  <option value="">Select Mobility Type</option>
                  <option value="Mobile Patrol">Mobile Patrol</option>
                  <option value="Motorcycle">Motorcycle</option>
                  <option value="Bike">Bike</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setEditingVehicle(null)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none transition-all"
                >
                  Save Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className=" text-slate-900 dark:text-white">
                  Add New Mobility Asset
                </h3>
                <p className="font-bold text-slate-500 mt-1">
                  Register new mobility asset
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 bg-white dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                <span className="text-slate-400 font-bold text-lg leading-none cursor-pointer">
                  ×
                </span>
              </button>
            </div>
            <form onSubmit={handleAddVehicle} className="p-6 space-y-5">
              <div>
                <label className="  text-slate-800 dark:text-slate-200 tml-1">
                  Unit/Station
                </label>
                <select
                  required
                  value={formData.unit_id}
                  onChange={(e) =>
                    setFormData({ ...formData, unit_id: e.target.value })
                  }
                  disabled={!isAdmin && !!unitId}
                  className={`w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${!isAdmin && unitId ? "bg-slate-200 dark:bg-slate-700/50 cursor-not-allowed" : ""}`}
                >
                  <option value="" disabled>
                    Select Unit Headquarters
                  </option>
                  {unitList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.unit_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="  text-slate-800 dark:text-slate-200 tml-1">
                  Plate Number
                </label>
                <div className="relative mt-1.5">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center">
                    <Car className="w-3 h-3 text-slate-500" />
                  </div>
                  <input
                    required
                    type="text"
                    value={formData.plate_number}
                    onChange={(e) =>
                      setFormData({ ...formData, plate_number: e.target.value })
                    }
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
                    placeholder="PNP-1234"
                  />
                </div>
              </div>

              <div>
                <label className="  text-slate-800 dark:text-slate-200 tml-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="Additional details about the vehicle"
                />
              </div>

              <div>
                <label className="  text-slate-800 dark:text-slate-200 tml-1">
                  Mobility Type
                </label>
                <select
                  value={formData.vehicle_type}
                  onChange={(e) =>
                    setFormData({ ...formData, vehicle_type: e.target.value })
                  }
                  className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                >
                  <option value="">Select Mobility Type</option>
                  <option value="Mobile Patrol">Mobile Patrol</option>
                  <option value="Motorcycle">Motorcycle</option>
                  <option value="Bike">Bike</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none transition-all"
                >
                  Add Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
