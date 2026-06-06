import React, { useState, useEffect } from "react";
import { supabase, PatrolSchedule, Personnel, Unit } from "../lib/supabase";
import { useAuth } from "../components/AuthProvider";
import { format, startOfDay, endOfDay, addDays, subDays } from "date-fns";
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
  Trash2,
  Phone,
  MessageCircle,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<PatrolSchedule[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { unitId, isAdmin } = useAuth();

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state - now supports multiple personnel selection
  const [formData, setFormData] = useState({
    unit_id: "",
    personnel_ids: [] as string[], // Changed to array for multiple personnel
    date: format(new Date(), "yyyy-MM-dd"),
    time_from: "08:00",
    time_to: "17:00",
    sector: "",
    patrol_type: "Mobile", // Default patrol type
  });

  // Auto-fill unit_id for non-admin users
  useEffect(() => {
    if (!isAdmin && unitId) {
      setFormData((prev) => ({ ...prev, unit_id: unitId }));
    }
  }, [isAdmin, unitId]);

  useEffect(() => {
    fetchInitialData();
  }, [isAdmin, unitId]); // Re-fetch when auth changes

  useEffect(() => {
    fetchSchedules();
  }, [selectedDate, isAdmin, unitId]); // Re-fetch when auth changes

  const fetchInitialData = async () => {
    try {
      // Apply unit filtering for non-admin users
      let unitsQuery = supabase.from("unit").select("*");
      let personnelQuery = supabase
        .from("personnel")
        .select("*")
        .neq("role", "admin");

      if (!isAdmin && unitId) {
        unitsQuery = unitsQuery.eq("id", unitId);
        personnelQuery = personnelQuery.eq("unit_id", unitId);
      }

      const [unitsRes, personnelRes] = await Promise.all([
        unitsQuery,
        personnelQuery,
      ]);

      if (unitsRes.error) throw unitsRes.error;
      if (personnelRes.error) throw personnelRes.error;

      if (unitsRes.data) setUnits(unitsRes.data);
      if (personnelRes.data) setPersonnel(personnelRes.data);
    } catch (err: any) {
      console.error("Error fetching initial data:", err);
    }
  };

  const fetchSchedules = async () => {
    setLoading(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    try {
      // Build query with unit filtering for non-admin users
      let schedulesQuery = supabase
        .from("patrol_schedule")
        .select("*, unit(*), schedule_assignments(personnel(*))")
        .eq("date", dateStr);

      // Apply unit filtering for non-admin users
      if (!isAdmin && unitId) {
        schedulesQuery = schedulesQuery.eq("unit_id", unitId);
      }

      const { data, error } = await schedulesQuery;

      if (error) throw error;
      if (data) setSchedules(data);
    } catch (err: any) {
      console.error("Error fetching schedules:", err);
    } finally {
      setLoading(false);
    }
  };

  const validateAssignment = async () => {
    // Check if we have at least one personnel selected
    if (formData.personnel_ids.length === 0) {
      setError("Please select at least one officer.");
      return false;
    }

    // Validate each selected personnel
    for (const personnelId of formData.personnel_ids) {
      // 1. Check if officer belongs to unit
      const officer = personnel.find((p) => p.id === personnelId);
      if (officer && officer.unit_id !== formData.unit_id) {
        setError("Selected officer does not belong to the selected unit.");
        return false;
      }
    }

    return true;
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const isValid = await validateAssignment();
      if (!isValid) {
        setIsSubmitting(false);
        return;
      }

      // Insert schedule first (without personnel info)
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("patrol_schedule")
        .insert([
          {
            unit_id: formData.unit_id,
            date: formData.date,
            time_from: formData.time_from,
            time_to: formData.time_to,
            sector: formData.sector,
            patrol_type: formData.patrol_type,
          },
        ])
        .select(); // Return the inserted schedule

      if (scheduleError) {
        setError(scheduleError.message);
        setIsSubmitting(false);
        return;
      }

      // Now create schedule_assignments for each selected personnel
      const assignments = formData.personnel_ids.map((personnel_id) => ({
        schedule_id: scheduleData[0].id,
        personnel_id: personnel_id,
      }));

      if (assignments.length > 0) {
        const { error: assignmentsError } = await supabase
          .from("schedule_assignments")
          .insert(assignments);

        if (assignmentsError) {
          // If assignments fail, we should clean up the schedule
          await supabase.from("schedule").delete().eq("id", scheduleData[0].id);
          setError(assignmentsError.message);
          setIsSubmitting(false);
          return;
        }
      }

      setShowModal(false);
      fetchSchedules();
      setFormData({
        unit_id: "",
        personnel_ids: [],
        date: format(selectedDate, "yyyy-MM-dd"),
        time_from: "08:00",
        time_to: "17:00",
        sector: "",
        patrol_type: "Mobile",
      });
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this assignment?")) return;
    try {
      // First delete from schedule_assignments (junction table)
      const { error: assignmentsError } = await supabase
        .from("schedule_assignments")
        .delete()
        .eq("schedule_id", id);

      if (assignmentsError) throw assignmentsError;

      // Then delete from patrol_schedule
      const { error } = await supabase
        .from("patrol_schedule")
        .delete()
        .eq("id", id);
      if (error) throw error;

      fetchSchedules();
    } catch (err) {
      console.error("Delete schedule failed:", err);
      alert(
        "Failed to delete schedule: " +
          (err.message || "An unexpected error occurred."),
      );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-blue-600" />
            Patrol Schedule
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1">
            Manage personnel deployments and sector assignments
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-1 transition-colors">
            <button
              onClick={() => setSelectedDate(subDays(selectedDate, 1))}
              className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400"
            >
              <X className="w-4 h-4 rotate-45" />
            </button>
            <div className="px-4 font-black text-sm text-slate-700 dark:text-slate-300 min-w-[140px] text-center">
              {format(selectedDate, "MMMM d, yyyy")}
            </div>
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400"
            >
              <Plus className="w-4 h-4 rotate-45" />
            </button>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 transition-all active:scale-95"
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
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {schedules.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 transition-colors">
              <CalendarIcon className="w-12 h-12 text-slate-200 dark:text-slate-800 mb-4" />
              <p className="text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest text-sm">
                No patrol assignments scheduled for this date
              </p>
            </div>
          ) : (
            schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4 group transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 dark:text-white leading-tight">
                        {schedule.sector} | {schedule.time_from.slice(0, 5)} -
                        {schedule.time_to.slice(0, 5)} - {schedule.patrol_type}{" "}
                        Patrol
                      </h4>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(schedule.id)}
                    className="p-2 text-slate-300 dark:text-slate-700 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
                      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Assigned Personnel
                      </span>
                    </div>
                    <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      {/* Display all assigned personnel with expanded details */}
                      {schedule.schedule_assignments?.length > 0 ? (
                        <>
                          {schedule.schedule_assignments.map(
                            (assign, index) => (
                              <div key={index}>
                                {assign.personnel?.rank}{" "}
                                {assign.personnel?.fullname}
                                <div className="flex flex-row gap-2 text-[12px]">
                                  {assign.personnel?.phone_number && (
                                    <a
                                      href={`tel:${assign.personnel?.phone_number}`}
                                      className="flex items-center gap-2 text-blue-600 hover:text-blue-800" // Dito ang sikreto: flex + items-center + gap
                                    >
                                      <Phone className="w-5 h-5" />
                                      <span>
                                        {assign.personnel?.phone_number}
                                      </span>
                                    </a>
                                  )}
                                  {assign.personnel?.viber_number && (
                                    <a
                                      href={`viber://chat?number=${assign.personnel?.viber_number}`}
                                      className="flex items-center gap-2 text-purple-600 hover:text-purple-800" // Dito rin: flex + items-center + gap
                                    >
                                      <MessageCircle className="w-5 h-5" />
                                      <span>
                                        {assign.personnel?.viber_number}
                                      </span>
                                    </a>
                                  )}
                                </div>
                              </div>
                            ),
                          )}
                        </>
                      ) : (
                        "No personnel assigned"
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* New Assignment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 transition-colors">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                New Patrol Assignment
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[80vh]">
              <form onSubmit={handleAddSchedule} className="p-6 space-y-5">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm font-semibold">{error}</p>
                  </div>
                )}

                {/* Assigned Officers - Primary Focus */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                    Unit/Station
                  </label>
                  <select
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                    disabled={!isAdmin}
                    value={formData.unit_id}
                    onChange={(e) => {
                      const unitId = e.target.value;
                      // Filter personnel by unit when unit changes
                      if (unitId) {
                        const filteredPersonnel = personnel.filter(
                          (p) => p.unit_id === unitId,
                        );
                        // Keep only selected personnel that are still in the filtered list
                        const validSelections = formData.personnel_ids.filter(
                          (id) => filteredPersonnel.some((p) => p.id === id),
                        );
                        setFormData({
                          ...formData,
                          unit_id: unitId,
                          personnel_ids: validSelections,
                        });
                      } else {
                        setFormData({
                          ...formData,
                          unit_id: "",
                          personnel_ids: [],
                        });
                      }
                    }}
                  >
                    <option value="">Select Unit</option>
                    {units.map((u) => (
                      <option
                        key={u.id}
                        value={u.id}
                        className="bg-white dark:bg-slate-900"
                      >
                        {u.unit_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                    Patrol Officers
                  </label>
                  <select
                    multiple
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors h-[200px]"
                    value={formData.personnel_ids}
                    onChange={(e) => {
                      // Convert selected options to array
                      const selectedIds = Array.from(
                        e.target.selectedOptions,
                      ).map((option) => option.value);
                      setFormData({ ...formData, personnel_ids: selectedIds });
                    }}
                  >
                    <option value="">-- Select Officers --</option>
                    {formData.unit_id ? (
                      personnel
                        .filter((p) => p.unit_id === formData.unit_id)
                        .map((p) => (
                          <option
                            key={p.id}
                            value={p.id}
                            className="bg-white dark:bg-slate-900"
                          >
                            {p.rank} {p.fullname}
                          </option>
                        ))
                    ) : (
                      <>{/* Show empty when no unit is selected */}</>
                    )}
                  </select>
                  <p className="text-[9px] text-slate-500 dark:text-slate-400 italic mt-1">
                    Hold Ctrl (Cmd on Mac) to select multiple officers
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                    Target Sector
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-600" />
                    <input
                      required
                      type="text"
                      placeholder="e.g. Laoag Central District"
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 pl-11 pr-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                      value={formData.sector}
                      onChange={(e) =>
                        setFormData({ ...formData, sector: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                    Patrol Type
                  </label>
                  <select
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                    value={formData.patrol_type}
                    onChange={(e) =>
                      setFormData({ ...formData, patrol_type: e.target.value })
                    }
                  >
                    <option value="Mobile Patrol">Mobile Patrol</option>
                    <option value="TMRU Patrol">TMRU Patrol</option>
                    <option value="Bike Patrol">Bike Patrol</option>
                    <option value="Foot Patrol">Foot Patrol</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                    Deployment Date
                  </label>
                  <input
                    required
                    type="date"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                      Duty Start
                    </label>
                    <input
                      required
                      type="time"
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                      value={formData.time_from}
                      onChange={(e) =>
                        setFormData({ ...formData, time_from: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                      Duty End
                    </label>
                    <input
                      required
                      type="time"
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                      value={formData.time_to}
                      onChange={(e) =>
                        setFormData({ ...formData, time_to: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3.5 rounded-xl font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-[2] bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none disabled:opacity-50 transition-all active:scale-[0.98]"
                  >
                    {isSubmitting ? "Processing..." : "Confirm"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
