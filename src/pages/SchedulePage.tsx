import React, { useState, useEffect } from "react";
import {
  supabase,
  PatrolSchedule,
  Personnel,
  Unit,
  MobilityAsset,
} from "../lib/supabase";
import { useAuth } from "../components/AuthProvider";
import {
  format,
  startOfDay,
  endOfDay,
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  subMonths,
  addMonths,
} from "date-fns";
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
  Edit2,
  Copy,
  ArrowLeft,
  ArrowRight,
  ArrowBigLeft,
  ArrowBigRight,
  Trash,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function sortPersonnelByRankThenName(a: Personnel, b: Personnel): number {
  const rankA = a.rank?.level ?? -Infinity;
  const rankB = b.rank?.level ?? -Infinity;
  if (rankB !== rankA) {
    return rankB - rankA; // descending
  }
  return a.fullname.localeCompare(b.fullname);
}

function sortAssignmentsByPersonnelRankThenName(a: any, b: any): number {
  const rankA = a.personnel?.rank?.level ?? -Infinity;
  const rankB = b.personnel?.rank?.level ?? -Infinity;
  if (rankB !== rankA) {
    return rankB - rankA;
  }
  const nameA = a.personnel?.fullname ?? "";
  const nameB = b.personnel?.fullname ?? "";
  return nameA.localeCompare(nameB);
}

export default function SchedulePage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [mobilityAssets, setMobilityAssets] = useState<MobilityAsset[]>([]);
  const [loading, setLoading] = useState(true);
  // const [selectedDate, setSelectedDate] = useState(new Date());
  const [unitFilter, setUnitFilter] = useState<string>("");
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [monthlySchedules, setMonthlySchedules] = useState<PatrolSchedule[]>(
    [],
  );
  const [personnelSearch, setPersonnelSearch] = useState("");
  const { unitId, isAdmin } = useAuth();

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editScheduleId, setEditScheduleId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state - now supports multiple personnel selection
  const [formData, setFormData] = useState({
    unit_id: "",
    personnel_ids: [] as string[], // Changed to array for multiple personnel
    patrol_type: "Mobile Patrol", // Default to Mobile Patrol
    mobility_id: "",
    date: format(new Date(), "yyyy-MM-dd"),
    time_from: "08:00",
    time_to: "17:00",
    sector: "",
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
  }, [currentMonth, isAdmin, unitId, unitFilter]); // Re-fetch when month, auth, or filter changes

  useEffect(() => {
    // setSelectedDate(startOfMonth(currentMonth));
  }, [currentMonth]);

  const fetchInitialData = async () => {
    try {
      // Apply unit filtering for non-admin users
      let unitsQuery = supabase.from("unit").select("*");
      let personnelQuery = supabase
        .from("personnel")
        .select("*, rank:rank_id(*)")
        .neq("role", "admin");
      let mobilityAssetsQuery = supabase.from("mobility_assets").select("*");

      if (!isAdmin && unitId) {
        // Non-admin users: filter by their unit
        unitsQuery = unitsQuery.eq("id", unitId);
        personnelQuery = personnelQuery.eq("unit_id", unitId);
        mobilityAssetsQuery = mobilityAssetsQuery.eq("unit_id", unitId);
      } else if (isAdmin && unitFilter) {
        // Admin users: filter by selected unit if any
        unitsQuery = unitsQuery.eq("id", unitFilter);
        personnelQuery = personnelQuery.eq("unit_id", unitFilter);
        mobilityAssetsQuery = mobilityAssetsQuery.eq("unit_id", unitFilter);
      }

      const [unitsRes, personnelRes, mobilityAssetsRes] = await Promise.all([
        unitsQuery,
        personnelQuery,
        mobilityAssetsQuery,
      ]);

      if (unitsRes.error) throw unitsRes.error;
      if (personnelRes.error) throw personnelRes.error;
      if (mobilityAssetsRes.error) throw mobilityAssetsRes.error;

      if (unitsRes.data) setUnits(unitsRes.data);
      if (personnelRes.data) {
        const sortedPersonnel = [...personnelRes.data].sort(
          sortPersonnelByRankThenName,
        );
        setPersonnel(sortedPersonnel);
      }
      if (mobilityAssetsRes.data) setMobilityAssets(mobilityAssetsRes.data);
    } catch (err: any) {
      console.error("Error fetching initial data:", err);
    }
  };

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      // Build query with unit filtering for non-admin users
      let schedulesQuery = supabase
        .from("patrol_schedule")
        .select(
          "*, mobility_assets(*), unit(*), schedule_assignments(*, personnel(*, rank:rank_id(*)))",
        )
        .gte("date", format(startOfMonth(currentMonth), "yyyy-MM-dd"))
        .lte("date", format(endOfMonth(currentMonth), "yyyy-MM-dd"))
        .order("date", { ascending: true });

      // Apply unit filtering
      if (!isAdmin && unitId) {
        // Non-admin users: filter by their unit
        schedulesQuery = schedulesQuery.eq("unit_id", unitId);
      } else if (isAdmin && unitFilter) {
        // Admin users: filter by selected unit if any
        schedulesQuery = schedulesQuery.eq("unit_id", unitFilter);
      }

      const { data, error } = await schedulesQuery;

      if (error) throw error;
      if (data) setMonthlySchedules(data);
    } catch (err: any) {
      console.error("Error fetching schedules:", err);
    } finally {
      setLoading(false);
    }
  };

  const validateAssignment = async () => {
    // Create a Set of unique personnel IDs to avoid duplicates
    const uniquePersonnelIds = new Set(formData.personnel_ids);

    // Check if we have at least one personnel selected
    if (uniquePersonnelIds.size === 0) {
      setError("Please select at least one officer.");
      return false;
    }

    // TODO: Add server-side validation for Checkpoint requiring at least 8 personnel
    // If patrol type is Checkpoint, require at least 8 personnel
    if (formData.patrol_type === "Checkpoint" && uniquePersonnelIds.size < 8) {
      setError("Checkpoint requires at least 8 police officers.");
      return false;
    }

    // Validate each selected personnel (check each unique ID only once)
    for (const personnelId of uniquePersonnelIds) {
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
      const uniquePersonnelIds = [...new Set(formData.personnel_ids)];
      console.log("editScheduleId", editScheduleId);
      if (editScheduleId) {
        // Update existing schedule
        const { error: scheduleError } = await supabase
          .from("patrol_schedule")
          .update({
            unit_id: formData.unit_id,
            date: formData.date,
            time_from: formData.time_from,
            time_to: formData.time_to,
            sector: formData.sector,
            mobility_id: formData.mobility_id || null,
            patrol_type: formData.patrol_type,
          })
          .eq("id", editScheduleId);

        if (scheduleError) {
          setError(scheduleError.message);
          setIsSubmitting(false);
          return;
        }

        // Delete existing assignments and create new ones
        await supabase
          .from("schedule_assignments")
          .delete()
          .eq("schedule_id", editScheduleId);

        if (uniquePersonnelIds.length > 0) {
          const assignments = uniquePersonnelIds.map((personnel_id) => ({
            schedule_id: editScheduleId,
            personnel_id: personnel_id,
          }));

          const { error: assignmentsError } = await supabase
            .from("schedule_assignments")
            .insert(assignments);

          if (assignmentsError) {
            setError(assignmentsError.message);
            setIsSubmitting(false);
            return;
          }
        }
      } else {
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
              mobility_id: formData.mobility_id || null,
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
        const assignments = uniquePersonnelIds.map((personnel_id) => ({
          schedule_id: scheduleData[0].id,
          personnel_id: personnel_id,
        }));

        if (assignments.length > 0) {
          const { error: assignmentsError } = await supabase
            .from("schedule_assignments")
            .insert(assignments);

          if (assignmentsError) {
            // If assignments fail, we should clean up the schedule
            await supabase
              .from("patrol_schedule")
              .delete()
              .eq("id", scheduleData[0].id);
            setError(assignmentsError.message);
            setIsSubmitting(false);
            return;
          }
        }
      }

      setShowModal(false);
      setEditScheduleId(null);
      fetchSchedules();
      setFormData({
        unit_id: unitId || "",
        personnel_ids: [],
        mobility_id: "",
        date: format(new Date(), "yyyy-MM-dd"),
        time_from: "08:00",
        time_to: "17:00",
        sector: "",
        patrol_type: "Mobile Patrol",
      });
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSchedule = async (schedule: PatrolSchedule) => {
    // Set form data to existing schedule values
    setFormData({
      unit_id: schedule.unit_id,
      personnel_ids: schedule.schedule_assignments
        ? [...new Set(schedule.schedule_assignments.map((a) => a.personnel_id))]
        : [],
      patrol_type: schedule.patrol_type,
      mobility_id: schedule.mobility_id || "",
      date: schedule.date,
      time_from: schedule.time_from,
      time_to: schedule.time_to,
      sector: schedule.sector,
    });
    setPersonnelSearch("");

    setEditScheduleId(schedule.id);
    setShowModal(true);
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
    } catch (err: any) {
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
          <h1 className="text-2xl text-black flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-blue-600" />
            Patrol Schedule
          </h1>
          <p className="text-black mt-1">
            Manage personnel deployments and sector assignments
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Date navigation (commented out) */}
          {/* <div className="flex items-center gap-2 border rounded-lg shadow-sm p-1 transition-colors">
              <button
                onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                className="p-2 dark:text-white hover:bg-slate-400 rounded-lg text-black"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="font-bold px-4 text-black min-w-[140px] text-center dark:text-white">
                {format(selectedDate, "MMMM d, yyyy")}
              </div>
              <button
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                className="p-2 dark:text-white hover:bg-slate-400 rounded-lg text-black"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div> */}

          {/* Unit Filter */}
          {isAdmin ? (
            <div className="flex items-center gap-2 border rounded-lg shadow-sm p-1 transition-colors">
              <select
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-1 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none"
              >
                <option value="">All Units</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unit_name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 border rounded-lg shadow-sm p-1 transition-colors">
              <label className="text-black">Unit:</label>
              <select
                disabled
                className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-2 px-3 font-bold text-slate-900 dark:text-white"
              >
                <option value={unitId ?? ""}>
                  {units.find((u) => u.id === unitId)?.unit_name || unitId}
                </option>
              </select>
            </div>
          )}

          <div className="flex items-center gap-2 border rounded-lg shadow-sm p-1 transition-colors">
            <button
              onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
              className="p-2 dark:text-white hover:bg-slate-400 rounded-lg text-black"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="font-bold px-4 text-black min-w-[140px] text-center dark:text-white">
              {format(currentMonth, "MMMM yyyy")}
            </div>
            <button
              onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
              className="p-2 dark:text-white hover:bg-slate-400 rounded-lg text-black"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            New
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Schedule Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-slate-800 dark:text-slate-200">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-slate-800 dark:text-slate-200">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-slate-800 dark:text-slate-200">
                      Sector/Area
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-slate-800 dark:text-slate-200">
                      Duty Type
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-slate-800 dark:text-slate-200">
                      Personnel
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-slate-800 dark:text-slate-200">
                      Unit/Station
                    </th>
                    <th className="px-6 py-3 text-left font-medium text-slate-800 dark:text-slate-200">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {monthlySchedules.length > 0 ? (
                    monthlySchedules.map((schedule) => {
                      const scheduleDate = new Date(schedule.date);
                      const personnelCount =
                        schedule.schedule_assignments?.length || 0;

                      return (
                        <tr
                          key={schedule.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900 dark:text-white">
                            {format(scheduleDate, "MMM d, yyyy")}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-800 dark:text-slate-200">
                            {schedule.time_from.slice(0, 5)} -{" "}
                            {schedule.time_to.slice(0, 5)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-800 dark:text-slate-200">
                            {schedule.sector ||
                              schedule.patrol_type ||
                              "Not specified"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-800 dark:text-slate-200">
                            {schedule.patrol_type}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-800 dark:text-slate-200">
                            {personnelCount}
                            {" Personnel"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-800 dark:text-slate-200">
                            {schedule.unit?.unit_name || "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-medium space-x-3">
                            <button
                              onClick={() => {
                                const personnelIds = [
                                  ...new Set(
                                    schedule.schedule_assignments?.map(
                                      (a) => a.personnel_id,
                                    ) || [],
                                  ),
                                ];
                                setFormData({
                                  unit_id: schedule.unit_id,
                                  personnel_ids: personnelIds,
                                  patrol_type: schedule.patrol_type,
                                  mobility_id: schedule.mobility_id || "",
                                  date: schedule.date,
                                  time_from: schedule.time_from,
                                  time_to: schedule.time_to,
                                  sector: schedule.sector || "",
                                  // personnelSearch: ""
                                });
                                setEditScheduleId(schedule.id);
                                setShowModal(true);
                              }}
                              className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200"
                              title="Edit schedule"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => {
                                setTimeout(() => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    unit_id: schedule.unit_id,
                                    personnel_ids: schedule.schedule_assignments
                                      ? [
                                          ...new Set(
                                            schedule.schedule_assignments.map(
                                              (a) => a.personnel_id,
                                            ),
                                          ),
                                        ]
                                      : [],
                                    patrol_type: schedule.patrol_type,
                                    mobility_id: schedule.mobility_id || "",
                                    date: format(new Date(), "yyyy-MM-dd"),
                                    time_from: schedule.time_from,
                                    time_to: schedule.time_to,
                                    sector: schedule.sector,
                                    personnelSearch: "",
                                  }));
                                  setShowModal(true);
                                }, 100);
                              }}
                              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                              title="Copy schedule"
                            >
                              <Copy className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => {
                                if (
                                  window.confirm(
                                    "Are you sure you want to cancel this schedule?",
                                  )
                                ) {
                                  handleDelete(schedule.id);
                                }
                              }}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200"
                              title="Delete schedule"
                            >
                              <Trash className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-10 text-center text-slate-800 dark:text-slate-200"
                      >
                        No schedules found for the selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* New Assignment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 transition-colors">
              <h2 className="text-slate-900 dark:text-white">
                New Patrol Assignment
              </h2>
              <button
                onClick={() => {
                  setEditScheduleId(null);
                  setShowModal(false);
                }}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-800 dark:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[80vh]">
              <form onSubmit={handleAddSchedule} className="p-6 space-y-5">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="font-semibold">{error}</p>
                  </div>
                )}

                {/* Assigned Officers - Primary Focus */}
                <div className="space-y-1.5">
                  <label className="text-slate-800 dark:text-slate-200 ml-1">
                    Unit/Station
                  </label>
                  <select
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
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
                  <label className="text-slate-800 dark:text-slate-200 ml-1">
                    Deployment Date
                  </label>
                  <input
                    required
                    type="date"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <div className="space-y-1.5">
                    <label className="text-black dark:text-white ml-1">
                      Duty Start
                    </label>
                    <input
                      required
                      type="time"
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 font-bold text-black dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                      value={formData.time_from}
                      onChange={(e) =>
                        setFormData({ ...formData, time_from: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-black dark:text-white ml-1">
                      Duty End
                    </label>
                    <input
                      required
                      type="time"
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 font-bold text-black dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                      value={formData.time_to}
                      onChange={(e) =>
                        setFormData({ ...formData, time_to: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <label
                    htmlFor="patrol_type"
                    className="text-slate-800 dark:text-slate-200 ml-1"
                  >
                    Duty Type
                  </label>
                  <select
                    id="patrol_type"
                    name="patrol_type"
                    value={formData.patrol_type}
                    onChange={(e) =>
                      setFormData({ ...formData, patrol_type: e.target.value })
                    }
                    className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  >
                    <option value="Remain in Office">Remain in Office</option>
                    <option value="Mobile Patrol">Mobile Patrol</option>
                    <option value="TMRU Patrol">TMRU Patrol</option>
                    <option value="Bike Patrol">Bike Patrol</option>
                    <option value="Foot Patrol">Foot Patrol</option>
                    <option value="Seaborne Patrol">Seaborne Patrol</option>
                    <option value="Checkpoint">Checkpoint</option>
                    <option value="Simulation Exercise">
                      Simulation Exercise
                    </option>
                    <option value="Special Event">Special Event</option>
                  </select>
                </div>

                {(formData.patrol_type === "TMRU Patrol" ||
                  formData.patrol_type === "Mobile Patrol") && (
                  <div className="space-y-1.5">
                    <label className="text-slate-800 dark:text-slate-200 ml-1">
                      Mobility Asset
                    </label>
                    <select
                      required
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                      value={formData.mobility_id}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          mobility_id: e.target.value,
                        });
                      }}
                    >
                      <option value="">Select Mobility Asset</option>
                      {formData.unit_id ? (
                        mobilityAssets
                          .filter((a) => {
                            // Filter by unit first
                            if (a.unit_id !== formData.unit_id) {
                              return false;
                            }

                            // Filter by vehicle type based on patrol type (case-insensitive)
                            switch (formData.patrol_type.toLowerCase()) {
                              case "mobile patrol":
                                return (
                                  a.vehicle_type?.toLowerCase() ===
                                  "mobile patrol"
                                );
                              case "tmru patrol":
                                return (
                                  a.vehicle_type?.toLowerCase() === "motorcycle"
                                );
                              case "bike patrol":
                                return a.vehicle_type?.toLowerCase() === "bike";
                              case "foot patrol":
                              case "checkpoint":
                              default:
                                // For Foot Patrol and Checkpoint, show all (no vehicle type filter)
                                // Note: Checkpoint doesn't show this dropdown at all due to outer condition
                                return true;
                            }
                          })
                          .map((a) => (
                            <option
                              key={a.id}
                              value={a.id}
                              className="bg-white dark:bg-slate-900"
                            >
                              {a.plate_number} - {a.vehicle_type}
                            </option>
                          ))
                      ) : (
                        <>{/* Show empty when no unit is selected */}</>
                      )}
                    </select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-slate-800 dark:text-slate-200 ml-1">
                    Patrol Personnel
                  </label>
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search officers by name or rank..."
                        value={personnelSearch}
                        onChange={(e) => setPersonnelSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                    <div className="w-full max-h-[200px] overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
                      {formData.unit_id ? (
                        personnel
                          .filter((p) => p.unit_id === formData.unit_id)
                          .filter(
                            (p) =>
                              p.fullname
                                .toLowerCase()
                                .includes(personnelSearch.toLowerCase()) ||
                              (p.rank?.rank_name || "")
                                .toLowerCase()
                                .includes(personnelSearch.toLowerCase()),
                          )
                          .map((p) => (
                            <div key={p.id} className="flex items-center p-2">
                              <input
                                type="checkbox"
                                checked={formData.personnel_ids.includes(p.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    // Only add if not already present
                                    if (
                                      !formData.personnel_ids.includes(p.id)
                                    ) {
                                      setFormData({
                                        ...formData,
                                        personnel_ids: [
                                          ...formData.personnel_ids,
                                          p.id,
                                        ],
                                      });
                                    }
                                  } else {
                                    setFormData({
                                      ...formData,
                                      personnel_ids:
                                        formData.personnel_ids.filter(
                                          (id) => id !== p.id,
                                        ),
                                    });
                                  }
                                }}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <span className="ml-3 font-bold text-slate-900 dark:text-white">
                                {p.rank?.rank_name || "No Rank"} {p.fullname}
                              </span>
                            </div>
                          ))
                      ) : (
                        <p className="text-slate-800 dark:text-slate-200 text-center py-6">
                          Please select a unit first
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-slate-800 dark:text-slate-200">
                    Selected {formData.personnel_ids.length} personnel
                  </p>
                </div>

                {formData.patrol_type !== "Remain in Office" && (
                  <div className="space-y-1.5">
                    <label className="text-slate-800 dark:text-slate-200 ml-1">
                      Target Sector/Area
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-600" />
                      <input
                        required
                        type="text"
                        placeholder="e.g. Laoag Central District"
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 pl-11 pr-4 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                        value={formData.sector}
                        onChange={(e) =>
                          setFormData({ ...formData, sector: e.target.value })
                        }
                      />
                    </div>
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3.5 rounded-xl text-black hover:bg-slate-50 dark:bg-slate-800 transition-colors dark:text-white"
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
