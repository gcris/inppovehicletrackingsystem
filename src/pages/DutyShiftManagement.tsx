import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  Edit,
  AlertTriangle,
  Save,
  X,
} from "lucide-react";

export type DutyShift = {
  id: string;
  shift_name: string;
  time_start: string;
  time_end: string;
  is_overnight: boolean;
  created_at: string;
};

export default function DutyShiftManagement() {
  const [dutyShifts, setDutyShifts] = useState<DutyShift[]>([]);
  const [loading, setLoading] = useState({
    dutyShifts: false,
    submit: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    id: "",
    shift_name: "",
    time_start: "",
    time_end: "",
    is_overnight: false,
  });
  const [editMode, setEditMode] = useState(false);

  // Fetch duty shifts
  useEffect(() => {
    const fetchDutyShifts = async () => {
      setLoading((prev) => ({ ...prev, dutyShifts: true }));
      try {
        const { data, error } = await supabase
          .from("duty_shifts")
          .select(
            "id, shift_name, time_start, time_end, is_overnight, created_at",
          )
          .order("shift_name");

        if (error) throw error;
        setDutyShifts(data);
      } catch (err: any) {
        setError(err.message);
        console.error("Error fetching duty shifts:", err);
      } finally {
        setLoading((prev) => ({ ...prev, dutyShifts: false }));
      }
    };

    fetchDutyShifts();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading((prev) => ({ ...prev, submit: true }));

    // Validate form
    if (!formData.shift_name) {
      setError("Shift name is required");
      setLoading((prev) => ({ ...prev, submit: false }));
      return;
    }

    if (!formData.time_start) {
      setError("Start time is required");
      setLoading((prev) => ({ ...prev, submit: false }));
      return;
    }

    if (!formData.time_end) {
      setError("End time is required");
      setLoading((prev) => ({ ...prev, submit: false }));
      return;
    }

    try {
      let result;
      if (editMode && formData.id) {
        // Update existing duty shift
        console.log("Updating duty shift with name:", formData.shift_name);
        result = await supabase
          .from("duty_shifts")
          .update({
            shift_name: formData.shift_name,
            time_start: formData.time_start,
            time_end: formData.time_end,
            is_overnight: formData.is_overnight,
          })
          .eq("id", formData.id);
      } else {
        // Create new duty shift
        result = await supabase.from("duty_shifts").insert([
          {
            shift_name: formData.shift_name,
            time_start: formData.time_start,
            time_end: formData.time_end,
            is_overnight: formData.is_overnight,
          },
        ]);
      }

      if (result.error) throw result.error;
      console.log("Supabase response:", result);

      if (editMode && formData.id) {
        setSuccess("Duty shift updated successfully!");
      } else {
        setSuccess("Duty shift created successfully!");
      }

      // Reset form
      setFormData({
        id: "",
        shift_name: "",
        time_start: "",
        time_end: "",
        is_overnight: false,
      });
      setEditMode(false);

      // Refetch duty shifts
      const { data } = await supabase
        .from("duty_shifts")
        .select(
          "id, shift_name, time_start, time_end, is_overnight, created_at",
        )
        .order("time_start");
      setDutyShifts(data);
    } catch (err: any) {
      setError(err.message);
      console.error("Error submitting duty shift:", err);
    } finally {
      setLoading((prev) => ({ ...prev, submit: false }));
    }
  };

  const handleEdit = (dutyShift: DutyShift) => {
    setFormData({
      id: dutyShift.id,
      shift_name: dutyShift.shift_name,
      time_start: dutyShift.time_start,
      time_end: dutyShift.time_end,
      is_overnight: dutyShift.is_overnight,
    });
    setEditMode(true);
  };

  const handleRemove = async (id: string) => {
    setLoading((prev) => ({ ...prev, dutyShifts: true }));
    try {
      const { error } = await supabase
        .from("duty_shifts")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setSuccess("Duty shift removed successfully!");

      // Refetch duty shifts
      const { data } = await supabase
        .from("duty_shifts")
        .select(
          "id, shift_name, time_start, time_end, is_overnight, created_at",
        )
        .order("time_start");
      setDutyShifts(data);
    } catch (err: any) {
      setError(err.message);
      console.error("Error removing duty shift:", err);
    } finally {
      setLoading((prev) => ({ ...prev, dutyShifts: false }));
    }
  };

  const handleCancelEdit = () => {
    setFormData({
      id: "",
      shift_name: "",
      time_start: "",
      time_end: "",
      is_overnight: false,
    });
    setEditMode(false);
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">
            Duty Shift Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage duty shifts (create, edit, delete)
          </p>
        </header>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 text-green-600 dark:text-green-400 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-semibold">{success}</p>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-6">
          {/* Form Section */}
          <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-4">
              {editMode ? "Edit Duty Shift" : "Add New Duty Shift"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Shift Name */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                  Shift Name
                </label>
                <input
                  type="text"
                  name="shift_name"
                  value={formData.shift_name}
                  onChange={handleInputChange}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                  disabled={loading.submit}
                  required
                />
              </div>

              {/* Start Time */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                  Start Time
                </label>
                <input
                  type="time"
                  name="time_start"
                  value={formData.time_start}
                  onChange={handleInputChange}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                  disabled={loading.submit}
                  required
                />
              </div>

              {/* End Time */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                  End Time
                </label>
                <input
                  type="time"
                  name="time_end"
                  value={formData.time_end}
                  onChange={handleInputChange}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                  disabled={loading.submit}
                  required
                />
              </div>

              {/* Overnight Shift */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center">
                  <input
                    type="checkbox"
                    name="is_overnight"
                    checked={formData.is_overnight}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    disabled={loading.submit}
                  ></input>
                  <span className="ml-2">
                    Overnight Shift (crosses midnight)
                  </span>
                </label>
              </div>

              {/* Form Actions */}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={loading.submit}
                  className="bg-blue-600 text-white py-3 px-4 rounded-xl font-bold tracking-widest hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading.submit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {editMode ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    <>
                      {editMode ? (
                        <Save className="w-4 h-4" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      {editMode ? "Update" : "Create"}
                    </>
                  )}
                </button>

                {editMode && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 py-3 px-4 rounded-xl font-bold tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* Data View Section */}
          <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Duty Shifts List
              </h2>
              {!editMode && (
                <button
                  onClick={() => {
                    setFormData({
                      id: "",
                      shift_name: "",
                      time_start: "",
                      time_end: "",
                      is_overnight: false,
                    });
                    setEditMode(false);
                  }}
                  className="bg-blue-600 text-white py-2 px-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-3 h-3" />
                  Add New Shift
                </button>
              )}
            </div>

            {loading.dutyShifts && (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            )}

            {!loading.dutyShifts && dutyShifts.length === 0 && (
              <div className="h-64 flex items-center justify-center text-slate-500 dark:text-slate-400">
                No duty shifts found.
              </div>
            )}

            {!loading.dutyShifts && dutyShifts.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                      <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Shift Name
                      </th>
                      <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Time
                      </th>
                      <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Type
                      </th>
                      <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dutyShifts.map((shift) => (
                      <tr key={shift.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-bold text-slate-600 dark:text-slate-400">
                            {shift.shift_name}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                            {shift.time_start} - {shift.time_end}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`
                            text-xs font-bold
                            ${shift.is_overnight ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200" : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200"}
                            px-2 py-1 rounded-full
                          `}
                          >
                            {shift.is_overnight ? "Overnight" : "Day Shift"}
                          </span>
                        </td>
                        <td className="p-4 flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(shift)}
                            title="Edit Duty Shift"
                            className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:bg-amber-900/20 rounded-lg transition-all"
                            disabled={loading.dutyShifts}
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleRemove(shift.id)}
                            title="Remove Duty Shift"
                            className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:bg-amber-900/20 rounded-lg transition-all"
                            disabled={loading.dutyShifts}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
