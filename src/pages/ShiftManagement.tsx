import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../components/AuthProvider";
import {
  Calendar,
  Users,
  Timer,
  Plus,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  MapPin,
} from "lucide-react";

export type Personnel = {
  id: string;
  fullname: string;
  rank: string;
  badge_number: string | null;
  unit_id: string;
};

export type DutyShift = {
  id: string;
  shift_name: string;
  time_start: string;
  time_end: string;
  is_overnight: boolean;
};

export type Unit = {
  id: string;
  unit_name: string;
};

export type ShiftAssignment = {
  id: string;
  personnel_id: string;
  shift_id: string;
  unit_id: string;
  duty_date: string;
  personnel?: Personnel;
  duty_shift?: DutyShift;
  unit?: Unit;
};

export default function ShiftManagement() {
  const { unitId, isAdmin, role } = useAuth();
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [shifts, setShifts] = useState<DutyShift[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");
  const [formData, setFormData] = useState({
    personnel_ids: [] as string[],
    shift_id: "" as string,
    duty_date: selectedDate,
    unit_id: "" as string,
  });
  const [loading, setLoading] = useState({
    personnel: false,
    shifts: false,
    assignments: false,
    submit: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Automatically set unit for non-admin users
  useEffect(() => {
    if (!isAdmin && unitId) {
      setSelectedUnitId(unitId);
    }
  }, [isAdmin, unitId]);

  // Fetch units
  useEffect(() => {
    const fetchUnits = async () => {
      setLoading((prev) => ({ ...prev, personnel: true })); // reuse personnel loading state for simplicity
      try {
        let query = supabase
          .from("unit")
          .select("id, unit_name")
          .order("unit_name");

        // For non-admin users, only show their assigned unit
        if (!isAdmin && unitId) {
          query = query.eq("id", unitId);
        }

        const { data, error } = await query;

        if (error) throw error;
        setUnits(data);
      } catch (err: any) {
        setError(err.message);
        console.error("Error fetching units:", err);
      } finally {
        setLoading((prev) => ({ ...prev, personnel: false }));
      }
    };

    fetchUnits();
  }, [isAdmin, unitId]);

  // Fetch personnel based on selected unit
  useEffect(() => {
    const fetchPersonnel = async () => {
      if (!selectedUnitId) {
        setPersonnel([]);
        return;
      }
      setLoading((prev) => ({ ...prev, personnel: true }));
      try {
        const { data, error } = await supabase
          .from("personnel")
          .select("id, fullname, rank, badge_number, unit_id")
          .eq("unit_id", selectedUnitId)
          .order("fullname");

        if (error) throw error;
        setPersonnel(data);
      } catch (err: any) {
        setError(err.message);
        console.error("Error fetching personnel:", err);
      } finally {
        setLoading((prev) => ({ ...prev, personnel: false }));
      }
    };

    fetchPersonnel();
  }, [selectedUnitId]);

  // Fetch shifts
  useEffect(() => {
    const fetchShifts = async () => {
      setLoading((prev) => ({ ...prev, shifts: true }));
      try {
        const { data, error } = await supabase
          .from("duty_shifts")
          .select("id, shift_name, time_start, time_end, is_overnight")
          .order("is_overnight");

        if (error) throw error;
        setShifts(data);
      } catch (err: any) {
        setError(err.message);
        console.error("Error fetching shifts:", err);
      } finally {
        setLoading((prev) => ({ ...prev, shifts: false }));
      }
    };

    fetchShifts();
  }, []);

  // Fetch assignments for selected date and shift
  useEffect(() => {
    const fetchAssignments = async () => {
      if (!selectedDate) return;
      setLoading((prev) => ({ ...prev, assignments: true }));
      try {
        let query = supabase
          .from("shift_assignments")
          .select(
            `
            id,
            personnel_id,
            shift_id,
            unit_id,
            duty_date,
            personnel:personnel_id(id, fullname, rank, badge_number, unit_id),
            duty_shift:shift_id(id, shift_name, time_start, time_end, is_overnight),
            unit:unit_id(id, unit_name)
          `,
          )
          .eq("duty_date", selectedDate)
          .order("duty_date", { ascending: false });

        // Add unit filtering for non-admin users
        if (!isAdmin && unitId) {
          query = query.eq("unit_id", unitId);
        }

        // Add shift filter if selected
        if (selectedShiftId) {
          query = query.eq("shift_id", selectedShiftId);
        }

        const { data, error } = await query;

        if (error) throw error;
        // Map Supabase response to correct TypeScript types
        // Supabase returns arrays for joined tables when using foreign key relationships
        const mappedAssignments = data.map((assignment: any) => ({
          id: assignment.id,
          personnel_id: assignment.personnel_id,
          shift_id: assignment.shift_id,
          unit_id: assignment.unit_id,
          duty_date: assignment.duty_date,
          // Handle both array and object formats from Supabase joins
          personnel: Array.isArray(assignment.personnel)
            ? assignment.personnel[0]
            : assignment.personnel,
          duty_shift: Array.isArray(assignment.duty_shift)
            ? assignment.duty_shift[0]
            : assignment.duty_shift,
          unit: Array.isArray(assignment.unit)
            ? assignment.unit[0]
            : assignment.unit,
        }));
        setAssignments(mappedAssignments);
      } catch (err: any) {
        setError(err.message);
        console.error("Error fetching assignments:", err);
      } finally {
        setLoading((prev) => ({ ...prev, assignments: false }));
      }
    };

    fetchAssignments();
  }, [selectedDate, selectedShiftId, isAdmin, unitId]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
    setFormData({
      ...formData,
      duty_date: e.target.value,
    });
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedUnitId(e.target.value);
    setFormData({
      ...formData,
      unit_id: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading((prev) => ({ ...prev, submit: true }));

    // Validate form
    if (formData.personnel_ids.length === 0) {
      setError("Please select at least one personnel");
      setLoading((prev) => ({ ...prev, submit: false }));
      return;
    }

    if (!formData.shift_id) {
      setError("Please select a shift");
      setLoading((prev) => ({ ...prev, submit: false }));
      return;
    }

    if (!formData.unit_id) {
      setError("Please select a unit");
      setLoading((prev) => ({ ...prev, submit: false }));
      return;
    }

    if (!formData.duty_date) {
      setError("Please select a duty date");
      setLoading((prev) => ({ ...prev, submit: false }));
      return;
    }

    try {
      // Create assignments for each selected personnel
      const assignmentsToInsert = formData.personnel_ids.map(
        (personnel_id) => ({
          personnel_id,
          shift_id: formData.shift_id,
          unit_id: formData.unit_id,
          duty_date: formData.duty_date,
        }),
      );

      const { error: insertError } = await supabase
        .from("shift_assignments")
        .insert(assignmentsToInsert);

      if (insertError) {
        // Handle unique constraint error
        if (insertError.code === "23505") {
          // Unique violation
          setError(
            "One or more personnel are already assigned to a shift on this date.",
          );
        } else {
          throw insertError;
        }
      } else {
        setSuccess(
          `Shift assignments created successfully for ${formData.personnel_ids.length} personnel!`,
        );
        // Reset form (keep selected unit and date for convenience)
        setFormData({
          personnel_ids: [],
          shift_id: "",
          duty_date: selectedDate,
          unit_id: selectedUnitId,
        });
        // Refetch assignments
        let query = supabase
          .from("shift_assignments")
          .select(
            `
            id,
            personnel_id,
            shift_id,
            duty_date,
            unit_id,
            personnel:personnel_id(id, fullname, rank, badge_number, unit_id),
            duty_shift:shift_id(id, shift_name, time_start, time_end, is_overnight)
          `,
          )
          .eq("duty_date", selectedDate)
          .order("duty_date", { ascending: false });

        // Add shift filter if selected
        if (selectedShiftId) {
          query = query.eq("shift_id", selectedShiftId);
        }

        const { data } = await query;
        // Map Supabase response to correct TypeScript types
        const mappedAssignments = data.map((assignment: any) => ({
          id: assignment.id,
          personnel_id: assignment.personnel_id,
          shift_id: assignment.shift_id,
          duty_date: assignment.duty_date,
          unit_id: assignment.unit_id,
          personnel: assignment.personnel?.[0] || undefined,
          duty_shift: assignment.duty_shift?.[0] || undefined,
          unit: assignment.unit?.[0] || undefined,
        }));
        setAssignments(mappedAssignments);
      }
    } catch (err: any) {
      setError(err.message);
      console.error("Error submitting assignment:", err);
    } finally {
      setLoading((prev) => ({ ...prev, submit: false }));
    }
  };

  const handleRemoveAssignment = async (id: string) => {
    setLoading((prev) => ({ ...prev, assignments: true }));
    try {
      const { error } = await supabase
        .from("shift_assignments")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setSuccess("Assignment removed successfully!");
      // Refetch assignments
      const { data } = await supabase
        .from("shift_assignments")
        .select(
          `
          id,
          personnel_id,
          shift_id,
          duty_date,
          personnel:personnel_id(id, fullname, rank, badge_number),
          duty_shift:shift_id(id, shift_name, time_start, time_end, is_overnight)
        `,
        )
        .eq("duty_date", selectedDate)
        .order("duty_date", { ascending: false });
      // Map Supabase response to correct TypeScript types
      const mappedAssignments = data.map((assignment: any) => ({
        id: assignment.id,
        personnel_id: assignment.personnel_id,
        shift_id: assignment.shift_id,
        duty_date: assignment.duty_date,
        personnel: assignment.personnel?.[0] || undefined,
        duty_shift: assignment.duty_shift?.[0] || undefined,
      }));
      setAssignments(mappedAssignments);
    } catch (err: any) {
      setError(err.message);
      console.error("Error removing assignment:", err);
    } finally {
      setLoading((prev) => ({ ...prev, assignments: false }));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">
            Duty Schedule
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Schedule personnel for their duty shifts
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
              Assign Shifts
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Unit Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                  Unit/Station
                </label>
                <select
                  value={selectedUnitId}
                  onChange={(e) => {
                    if (isAdmin) {
                      setSelectedUnitId(e.target.value);
                    }
                  }}
                  disabled={!isAdmin || loading.personnel || loading.submit}
                  className={`w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors ${!isAdmin ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <option value="">Select Unit</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.unit_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Picker */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                  Duty Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={handleDateChange}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                  disabled={loading.assignments || loading.submit}
                />
              </div>

              {/* Personnel Multi-Select */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                  Personnel
                </label>
                <select
                  multiple
                  value={formData.personnel_ids}
                  onChange={(e) => {
                    const selectedIds = Array.from(
                      e.target.selectedOptions,
                    ).map((option) => option.value);
                    setFormData({ ...formData, personnel_ids: selectedIds });
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors min-h-[80px]"
                  disabled={loading.personnel || loading.submit}
                >
                  {personnel.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.rank} {p.fullname}
                    </option>
                  ))}
                </select>
                {personnel.length === 0 && selectedUnitId && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">
                    No personnel found for selected unit
                  </p>
                )}
                {!selectedUnitId && personnel.length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">
                    Select a unit to see personnel
                  </p>
                )}
              </div>

              {/* Shift Dropdown */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                  Shift
                </label>
                <select
                  value={formData.shift_id}
                  onChange={(e) =>
                    setFormData({ ...formData, shift_id: e.target.value })
                  }
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                  disabled={loading.shifts || loading.submit}
                  required
                >
                  <option value="">Select Shift</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shift_name} ({s.time_start} - {s.time_end})
                    </option>
                  ))}
                </select>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={
                  loading.submit ||
                  formData.personnel_ids.length === 0 ||
                  !formData.shift_id ||
                  !formData.duty_date
                }
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl font-bold tracking-widest hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading.submit ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Assign
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Data View Section */}
          <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Daily Roster
              </h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-500 dark:text-slate-400">
                    Showing assignments for:
                    <span className="font-bold">
                      {new Date(selectedDate).toLocaleDateString()}
                    </span>
                  </span>
                </div>
                <div className="relative">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                    Shift Filter
                  </label>
                  <select
                    value={selectedShiftId}
                    onChange={(e) => setSelectedShiftId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                    disabled={loading.shifts || loading.submit}
                  >
                    <option value="">All Shifts</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.shift_name} ({s.time_start} - {s.time_end})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {loading.assignments && (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            )}

            {!loading.assignments && assignments.length === 0 && (
              <div className="h-64 flex items-center justify-center text-slate-500 dark:text-slate-400">
                No assignments found for this date.
              </div>
            )}

            {!loading.assignments && assignments.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                      <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Personnel
                      </th>
                      <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Unit
                      </th>
                      <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Shift
                      </th>
                      <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Time
                      </th>
                      <th className="p-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {assignments.map((assignment) => (
                      <tr key={assignment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                {assignment.personnel?.rank ?? "N/A"}{" "}
                                {assignment.personnel?.fullname ?? "N/A"}
                              </span>
                              {assignment.personnel?.badge_number && (
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  Badge: {assignment.personnel.badge_number}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                            {assignment.unit?.unit_name}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                            {assignment.duty_shift?.shift_name}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                            {assignment.duty_shift?.time_start} -{" "}
                            {assignment.duty_shift?.time_end}
                          </span>
                          {assignment.duty_shift?.is_overnight && (
                            <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 rounded-full">
                              Overnight
                            </span>
                          )}
                        </td>
                        <td className="p-4 flex items-center justify-center gap-2">
                          <button
                            onClick={() =>
                              handleRemoveAssignment(assignment.id)
                            }
                            title="Remove Assignment"
                            className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:bg-amber-900/20 rounded-lg transition-all"
                            disabled={loading.assignments}
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
