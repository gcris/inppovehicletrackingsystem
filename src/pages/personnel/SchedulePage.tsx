import React, { useEffect, useMemo, useState } from "react";
import {
  supabase,
  PatrolSchedule,
  Personnel,
  Unit,
  MobilityAsset,
  Sector,
} from "../../lib/supabase";
import { useAuth } from "../../components/AuthProvider";
import { format, isToday } from "date-fns";
import {
  Calendar as CalendarIcon,
  Plus,
  Search,
  MapPin,
  Clock,
  Users,
  AlertCircle,
  X,
  Edit2,
  Copy,
  Trash,
  CheckCircle2,
  Car,
  Bike,
  Footprints,
  ShieldCheck,
  Waves,
  Activity,
  UserCheck,
  RotateCcw,
  Check,
  UserPlus,
  Shield,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ==========================================================================
   SORTING
========================================================================== */

function sortPersonnelByRankThenName(a: Personnel, b: Personnel): number {
  const rankA = a.rank?.level ?? -Infinity;
  const rankB = b.rank?.level ?? -Infinity;

  if (rankB !== rankA) {
    return rankB - rankA;
  }

  return a.fullname.localeCompare(b.fullname);
}

/* ==========================================================================
   DUTY TYPE HELPERS
========================================================================== */

const dutyStyles: Record<
  string,
  {
    icon: React.ElementType;
    className: string;
  }
> = {
  "Mobile Patrolling": {
    icon: Car,
    className:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800",
  },

  "TMRU Patrolling": {
    icon: Bike,
    className:
      "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800",
  },

  "Bike Patrolling": {
    icon: Bike,
    className:
      "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800",
  },

  "Foot Patrolling": {
    icon: Footprints,
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800",
  },

  "Seaborne Patrolling": {
    icon: Waves,
    className:
      "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800",
  },

  Checkpoint: {
    icon: ShieldCheck,
    className:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
  },

  "Simulation Exercise": {
    icon: Activity,
    className:
      "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800",
  },

  "Special Event": {
    icon: CalendarIcon,
    className:
      "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-800",
  },

  "Remain in Office": {
    icon: UserCheck,
    className:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  },
};

function getDutyStyle(type: string) {
  return (
    dutyStyles[type] || {
      icon: CalendarIcon,
      className:
        "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    }
  );
}

/* ==========================================================================
   MAIN COMPONENT
========================================================================== */

export default function SchedulePage() {
  const { unitId, isAdmin } = useAuth();

  /* ------------------------------------------------------------------------
     DATA
  ------------------------------------------------------------------------ */

  const [units, setUnits] = useState<Unit[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [schedulePersonnel, setSchedulePersonnel] = useState<Personnel[]>([]);
  const [loadingSchedulePersonnel, setLoadingSchedulePersonnel] =
    useState(false);
  const [mobilityAssets, setMobilityAssets] = useState<MobilityAsset[]>([]);
  const [monthlySchedules, setMonthlySchedules] = useState<PatrolSchedule[]>(
    [],
  );
  const [sectors, setSectors] = useState<Sector[]>([]);

  const [loading, setLoading] = useState(true);

  /* ------------------------------------------------------------------------
     FILTERS
  ------------------------------------------------------------------------ */

  const [unitFilter, setUnitFilter] = useState("");

  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );

  /* ------------------------------------------------------------------------
     MODAL
  ------------------------------------------------------------------------ */

  const [showModal, setShowModal] = useState(false);
  const [editScheduleId, setEditScheduleId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [personnelSearch, setPersonnelSearch] = useState("");
  const [showBarangayModal, setShowBarangayModal] = useState(false);
  const [selectedScheduleSector, setSelectedScheduleSector] = useState<
    PatrolSchedule["sector"] | null
  >(null);

  /* ------------------------------------------------------------------------
     FORM
  ------------------------------------------------------------------------ */

  const [formData, setFormData] = useState({
    unit_id: "",
    personnel_ids: [] as string[],
    patrol_type: "Mobile Patrolling",
    mobility_id: "",
    date: format(new Date(), "yyyy-MM-dd"),
    time_from: "08:00",
    time_to: "17:00",
    sector_id: "",
    location: "",
  });

  /* ==========================================================================
     EFFECTS
  ========================================================================== */

  useEffect(() => {
    if (!isAdmin && unitId) {
      setFormData((prev) => ({
        ...prev,
        unit_id: unitId,
      }));
    }
  }, [isAdmin, unitId]);

  useEffect(() => {
    fetchInitialData();
  }, [isAdmin, unitId, unitFilter]);

  useEffect(() => {
    fetchSchedules();
  }, [selectedDate, isAdmin, unitId, unitFilter]);

  /* ==========================================================================
     FETCH INITIAL DATA
  ========================================================================== */

  const selectedUnitId = !isAdmin ? unitId : unitFilter || null;

  const fetchInitialData = async () => {
    try {
      let unitsQuery = supabase
        .from("unit")
        .select("*")
        .order("level", { ascending: false });

      let personnelQuery = supabase
        .from("personnel")
        .select("*, rank:rank_id(*)");

      let mobilityAssetsQuery = supabase.from("mobility_assets").select("*");

      let sectorQuery = supabase
        .from("sector")
        .select(
          `
        id,
        deployment,
        sector,
        unit_id,
        sector_details:sector_detail(
          id,
          brgy_id,
          sector_id,
          barangay:brgy_id(
            id,
            city_mun_id,
            name
          )
        )
      `,
        )
        .order("sector", { ascending: true });

      // ============================================
      // FILTER BY SELECTED UNIT
      // ============================================

      if (selectedUnitId) {
        // Keep ALL units available for the schedule Unit dropdown.
        // Only filter page-specific data.
        personnelQuery = personnelQuery.eq("unit_id", selectedUnitId);
        mobilityAssetsQuery = mobilityAssetsQuery.eq("unit_id", selectedUnitId);
      }

      if (!isAdmin && unitId) {
        sectorQuery = sectorQuery.eq("unit_id", unitId);
      }

      const [unitsRes, personnelRes, mobilityAssetsRes, sectorRes] =
        await Promise.all([
          unitsQuery,
          personnelQuery,
          mobilityAssetsQuery,
          sectorQuery,
        ]);

      if (unitsRes.error) throw unitsRes.error;
      if (personnelRes.error) throw personnelRes.error;
      if (mobilityAssetsRes.error) throw mobilityAssetsRes.error;
      if (sectorRes.error) throw sectorRes.error;

      setUnits(unitsRes.data ?? []);

      setPersonnel(
        [...(personnelRes.data ?? [])].sort(sortPersonnelByRankThenName),
      );

      setMobilityAssets(mobilityAssetsRes.data ?? []);
      setSectors(sectorRes.data ?? []);
    } catch (err) {
      console.error("Error fetching initial data:", err);
    }
  };

  const fetchSchedulePersonnel = async (selectedUnitId: string) => {
    if (!selectedUnitId) {
      setSchedulePersonnel([]);
      return;
    }

    setLoadingSchedulePersonnel(true);

    try {
      const { data, error } = await supabase
        .from("personnel")
        .select("*, rank:rank_id(*)")
        .eq("unit_id", selectedUnitId);

      if (error) throw error;

      setSchedulePersonnel([...(data ?? [])].sort(sortPersonnelByRankThenName));
    } catch (err) {
      console.error("Error fetching schedule personnel:", err);
      setSchedulePersonnel([]);
    } finally {
      setLoadingSchedulePersonnel(false);
    }
  };

  /* ==========================================================================
     FETCH SCHEDULES
  ========================================================================== */

  const fetchSchedules = async () => {
    setLoading(true);

    try {
      let query = supabase
        .from("patrol_schedule")
        .select(
          `
          *,
          mobility_assets(*),
          unit(*),
          schedule_assignments(
            *,
            personnel(
              *,
              rank:rank_id(*)
            )
          ),
          sector:sector_id(
            *,
            sector_details:sector_detail(
              *,
              barangay:brgy_id(*)
            )
          )
        `,
        )
        .eq("date", selectedDate)
        .order("date", { ascending: true })
        .order("time_from", { ascending: true });

      if (!isAdmin && unitId) {
        query = query.eq("unit_id", unitId);
      } else if (isAdmin && unitFilter) {
        query = query.eq("unit_id", unitFilter);
      }

      const { data, error } = await query;

      console.log("data: ", data);

      if (error) throw error;

      setMonthlySchedules(data ?? []);
    } catch (err) {
      console.error("Error fetching schedules:", err);
      setMonthlySchedules([]);
    } finally {
      setLoading(false);
    }
  };

  /* ==========================================================================
     MODAL HELPERS
  ========================================================================== */

  const resetForm = () => {
    const defaultUnitId = !isAdmin ? unitId || "" : unitFilter || "";

    setFormData({
      unit_id: defaultUnitId,
      personnel_ids: [],
      patrol_type: "Mobile Patrolling",
      mobility_id: "",
      date: format(new Date(), "yyyy-MM-dd"),
      time_from: "08:00",
      time_to: "17:00",
      sector_id: "",
      location: "",
    });

    setPersonnelSearch("");
    setSchedulePersonnel([]);
    setError(null);
    setEditScheduleId(null);

    // Load personnel for the initial schedule unit
    if (defaultUnitId) {
      fetchSchedulePersonnel(defaultUnitId);
    }
  };

  const openNewSchedule = () => {
    resetForm();
    setShowModal(true);
  };

  const closeModal = () => {
    if (isSubmitting) return;

    setShowModal(false);
    resetForm();
  };

  const handleViewBarangays = (sector: PatrolSchedule["sector"]) => {
    setSelectedScheduleSector(sector);
    setShowBarangayModal(true);
  };

  /* ==========================================================================
     VALIDATION
  ========================================================================== */

  const validateAssignment = async () => {
    const uniquePersonnelIds = new Set(formData.personnel_ids);

    if (uniquePersonnelIds.size === 0) {
      setError("Please select at least one officer.");
      return false;
    }

    if (formData.patrol_type === "Checkpoint" && uniquePersonnelIds.size < 8) {
      setError("Checkpoint requires at least 8 police officers.");
      return false;
    }

    if (formData.time_from >= formData.time_to) {
      setError("Duty end time must be later than duty start time.");
      return false;
    }

    for (const personnelId of uniquePersonnelIds) {
      const officer = schedulePersonnel.find((p) => p.id === personnelId);

      if (officer && officer.unit_id !== formData.unit_id) {
        setError("Selected officer does not belong to the selected unit.");
        return false;
      }
    }

    return true;
  };

  /* ==========================================================================
     SAVE
  ========================================================================== */

  const handleAddSchedule = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    setError(null);
    setIsSubmitting(true);

    try {
      const valid = await validateAssignment();

      if (!valid) return;

      const uniquePersonnelIds = [...new Set(formData.personnel_ids)];

      console.log("Saving schedule:", formData);

      if (editScheduleId) {
        const { error: scheduleError } = await supabase
          .from("patrol_schedule")
          .update({
            unit_id: formData.unit_id,
            date: formData.date,
            time_from: formData.time_from,
            time_to: formData.time_to,
            sector_id: formData.sector_id,
            mobility_id: formData.mobility_id || null,
            patrol_type: formData.patrol_type,
            location: formData.location.trim() || null,
          })
          .eq("id", editScheduleId);

        if (scheduleError) throw scheduleError;

        const { error: deleteError } = await supabase
          .from("schedule_assignments")
          .delete()
          .eq("schedule_id", editScheduleId);

        if (deleteError) throw deleteError;

        if (uniquePersonnelIds.length > 0) {
          const assignments = uniquePersonnelIds.map((personnel_id) => ({
            schedule_id: editScheduleId,
            personnel_id,
          }));

          const { error } = await supabase
            .from("schedule_assignments")
            .insert(assignments);

          if (error) throw error;
        }
      } else {
        const { data, error: scheduleError } = await supabase
          .from("patrol_schedule")
          .insert([
            {
              unit_id: formData.unit_id,
              date: formData.date,
              time_from: formData.time_from,
              time_to: formData.time_to,
              sector_id: formData.sector_id,
              mobility_id: formData.mobility_id || null,
              patrol_type: formData.patrol_type,
              location: formData.location.trim() || null,
            },
          ])
          .select()
          .single();

        if (scheduleError) throw scheduleError;

        const assignments = uniquePersonnelIds.map((personnel_id) => ({
          schedule_id: data.id,
          personnel_id,
        }));

        const { error: assignmentsError } = await supabase
          .from("schedule_assignments")
          .insert(assignments);

        if (assignmentsError) {
          await supabase.from("patrol_schedule").delete().eq("id", data.id);

          throw assignmentsError;
        }
      }

      closeModal();
      await fetchSchedules();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ==========================================================================
     EDIT
  ========================================================================== */

  const handleEditSchedule = async (schedule: PatrolSchedule) => {
    setFormData({
      unit_id: schedule.unit_id,
      personnel_ids: [
        ...new Set(
          schedule.schedule_assignments?.map((a) => a.personnel_id) || [],
        ),
      ],
      patrol_type: schedule.patrol_type,
      mobility_id: schedule.mobility_id || "",
      date: schedule.date,
      time_from: schedule.time_from.slice(0, 5),
      time_to: schedule.time_to.slice(0, 5),
      sector_id: schedule.sector_id || "",
      location: schedule.location || "",
    });

    console.log("Editing schedule:", schedule);

    setPersonnelSearch("");
    setError(null);
    setEditScheduleId(schedule.id);
    setShowModal(true);

    // Load personnel belonging to this schedule's unit
    await fetchSchedulePersonnel(schedule.unit_id);
  };

  /* ==========================================================================
     COPY
  ========================================================================== */

  const handleCopySchedule = async (schedule: PatrolSchedule) => {
    setFormData({
      unit_id: schedule.unit_id,
      personnel_ids: [
        ...new Set(
          schedule.schedule_assignments?.map((a) => a.personnel_id) || [],
        ),
      ],
      patrol_type: schedule.patrol_type,
      mobility_id: schedule.mobility_id || "",
      date: format(new Date(), "yyyy-MM-dd"),
      time_from: schedule.time_from.slice(0, 5),
      time_to: schedule.time_to.slice(0, 5),
      sector_id: schedule.sector_id || "",
      location: schedule.location || "",
    });

    console.log("Copying schedule:", schedule);

    setPersonnelSearch("");
    setError(null);
    setEditScheduleId(null);
    setShowModal(true);

    // Load personnel belonging to this schedule's unit
    await fetchSchedulePersonnel(schedule.unit_id);
  };

  /* ==========================================================================
     DELETE
  ========================================================================== */

  const handleDelete = async (id: string) => {
    if (
      !window.confirm("Are you sure you want to cancel this patrol schedule?")
    ) {
      return;
    }

    try {
      const { error: assignmentError } = await supabase
        .from("schedule_assignments")
        .delete()
        .eq("schedule_id", id);

      if (assignmentError) throw assignmentError;

      const { error } = await supabase
        .from("patrol_schedule")
        .delete()
        .eq("id", id);

      if (error) throw error;

      await fetchSchedules();
    } catch (err: any) {
      console.error(err);

      window.alert(
        "Failed to delete schedule: " + (err.message || "Unexpected error."),
      );
    }
  };

  /* ==========================================================================
     PERSONNEL
  ========================================================================== */

  const availablePersonnel = useMemo(() => {
    const search = personnelSearch.trim().toLowerCase();

    return schedulePersonnel.filter((p) => {
      if (!search) return true;

      return (
        p.fullname.toLowerCase().includes(search) ||
        (p.rank?.rank_name || "").toLowerCase().includes(search)
      );
    });
  }, [schedulePersonnel, personnelSearch]);

  const unitPersonnel = schedulePersonnel;

  const allVisibleSelected =
    availablePersonnel.length > 0 &&
    availablePersonnel.every((p) => formData.personnel_ids.includes(p.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(availablePersonnel.map((p) => p.id));

      setFormData((prev) => ({
        ...prev,
        personnel_ids: prev.personnel_ids.filter((id) => !visibleIds.has(id)),
      }));
    } else {
      const ids = new Set(formData.personnel_ids);

      availablePersonnel.forEach((p) => ids.add(p.id));

      setFormData((prev) => ({
        ...prev,
        personnel_ids: [...ids],
      }));
    }
  };

  /* ==========================================================================
     MOBILITY FILTER
  ========================================================================== */

  const availableSectors = useMemo(() => {
    if (!formData.unit_id) return [];

    return sectors.filter((sector) => sector.unit_id === formData.unit_id);
  }, [sectors, formData.unit_id]);

  const selectedSectorBarangays = useMemo<string[]>(() => {
    const selectedSector = availableSectors.find(
      (sector) => sector.id === formData.sector_id,
    );

    if (!selectedSector) return [];

    const names: string[] = (selectedSector.sector_details ?? []).flatMap(
      (detail) => {
        const rawBarangay = detail.barangay;

        const barangay = Array.isArray(rawBarangay)
          ? rawBarangay[0]
          : rawBarangay;

        const name = barangay?.name;

        return typeof name === "string" && name.trim() ? [name.trim()] : [];
      },
    );

    return [...new Set<string>(names)].sort((a, b) => a.localeCompare(b));
  }, [availableSectors, formData.sector_id]);

  const availableMobility = useMemo(() => {
    return mobilityAssets.filter((asset) => {
      if (asset.unit_id !== formData.unit_id) {
        return false;
      }

      const vehicleType = asset.vehicle_type?.toLowerCase() || "";

      switch (formData.patrol_type.toLowerCase()) {
        case "Mobile Patrolling":
          return !["motorcycle", "atv", "bike", "bus", "boat", "truck"].some(
            (type) => vehicleType.includes(type),
          );

        case "TMRU Patrolling":
          return vehicleType.includes("motorcycle");

        case "Bike Patrolling":
          return vehicleType.includes("bike");

        default:
          return true;
      }
    });
  }, [mobilityAssets, formData.unit_id, formData.patrol_type]);

  const filteredSchedules = useMemo(() => {
    if (!selectedDate) {
      return monthlySchedules;
    }

    return monthlySchedules.filter(
      (schedule) => schedule.date === selectedDate,
    );
  }, [monthlySchedules, selectedDate]);

  /* ==========================================================================
     RENDER
  ========================================================================== */

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* ======================================================================
          HEADER
      ====================================================================== */}
      <div className="space-y-5">
        {/* TOP HEADER */}
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
          {/* TITLE */}
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative shrink-0">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
                <CalendarIcon className="w-7 h-7" />
              </div>

              <div className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950">
                <Check className="w-3 h-3 text-white" />
              </div>
            </div>

            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl tracking-tight text-slate-900 dark:text-white">
                Patrol Schedule
              </h1>

              <p className="mt-1 text-slate-500 text-slate-800 dark:text-slate-200 ">
                Manage personnel deployments, patrol sectors and mobility
                assignments.
              </p>
            </div>
          </div>

          {/* DAY NAVIGATION + NEW */}
          <div className="flex flex-wrap items-center gap-3">
            {/* DAY FILTER */}
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 shadow-sm w-fit">
              <CalendarIcon className="w-4 h-4 text-slate-800 dark:text-slate-200 shrink-0" />

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent border-none outline-none font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
              />

              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate("")}
                  className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Show all days"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              )}
            </div>

            {/* NEW SCHEDULE */}
            <button
              type="button"
              onClick={openNewSchedule}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
            >
              <Plus className="w-5 h-5" />
              <span>New</span>
            </button>
          </div>
        </div>

        {/* FILTER ROW */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* UNIT FILTER */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 shadow-sm w-fit">
            <Shield className="w-4 h-4 text-slate-800 dark:text-slate-200  shrink-0" />

            {isAdmin ? (
              <select
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
                className="bg-transparent border-none outline-none font-bold text-slate-700 dark:text-slate-200 min-w-[150px] cursor-pointer"
              >
                <option value="">All Units / Stations</option>

                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unit_name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-bold text-slate-700 dark:text-slate-200">
                {units.find((u) => u.id === unitId)?.unit_name || "My Unit"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================================
          TABLE
      ====================================================================== */}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* TABLE HEADER */}

        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-slate-900 dark:text-white">
              Deployment Schedule
            </h2>

            <p className="text-slate-800 dark:text-slate-200 mt-0.5">
              {selectedDate
                ? `${format(
                    new Date(`${selectedDate}T00:00:00`),
                    "EEEE, MMMM d, yyyy",
                  )} deployments`
                : "All deployments"}
            </p>
          </div>

          <button
            onClick={fetchSchedules}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Refresh schedules"
          >
            <RotateCcw
              className={cn(
                "w-4 h-4 text-slate-500",
                loading && "animate-spin",
              )}
            />
          </button>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"
              />
            ))}
          </div>
        ) : filteredSchedules.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <CalendarIcon className="w-8 h-8 text-slate-800 dark:text-slate-200 " />
            </div>

            <h3 className="text-slate-800 dark:text-slate-200">
              No patrol schedules
            </h3>

            <p className="mt-1 text-slate-800 dark:text-slate-200 max-w-sm">
              {selectedDate
                ? `There are no patrol assignments for ${format(
                    new Date(`${selectedDate}T00:00:00`),
                    "MMMM d, yyyy",
                  )}.`
                : "There are no patrol assignments for the selected unit."}
            </p>

            <button
              onClick={openNewSchedule}
              className="mt-5 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Assignment
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-5 py-3 text-left text-slate-800 dark:text-slate-200 ">
                    Actions
                  </th>

                  <th className="px-5 py-3 text-left text-slate-800 dark:text-slate-200 ">
                    Time
                  </th>

                  <th className="px-5 py-3 text-left text-slate-800 dark:text-slate-200 ">
                    Duty
                  </th>

                  <th className="px-5 py-3 text-left text-slate-800 dark:text-slate-200 ">
                    Sector
                  </th>

                  <th className="px-5 py-3 text-left text-slate-800 dark:text-slate-200 ">
                    Personnel
                  </th>

                  <th className="px-5 py-3 text-left text-slate-800 dark:text-slate-200 ">
                    Unit / Station
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSchedules.map((schedule) => {
                  const scheduleDate = new Date(`${schedule.date}T00:00:00`);

                  const assignments = schedule.schedule_assignments || [];

                  const duty = getDutyStyle(schedule.patrol_type);

                  return (
                    <tr
                      key={schedule.id}
                      className={cn(
                        "group transition-colors",
                        isToday(scheduleDate)
                          ? "bg-blue-50/50 dark:bg-blue-900/5"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/40",
                      )}
                    >
                      {/* ACTIONS */}

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditSchedule(schedule)}
                            className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20 transition-colors"
                            title="Edit schedule"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleCopySchedule(schedule)}
                            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 text-slate-800 dark:text-slate-200  dark:hover:bg-slate-800 transition-colors"
                            title="Copy schedule"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDelete(schedule.id)}
                            className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                            title="Delete schedule"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                      {/* TIME */}

                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
                          {schedule.time_from.slice(0, 5)}
                          <span className="text-slate-300">→</span>
                          {schedule.time_to.slice(0, 5)}
                        </div>
                      </td>

                      {/* DUTY */}

                      <td className="px-5 py-4">
                        <div
                          className={cn(
                            "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border whitespace-nowrap",
                            duty.className,
                          )}
                        >
                          {schedule.patrol_type}
                        </div>

                        {schedule.mobility && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-slate-800 dark:text-slate-200 ">
                            <Car className="w-3 h-3" />

                            {schedule.mobility.plate_number}
                          </div>
                        )}
                      </td>

                      {/* SECTOR */}

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
                          <button
                            type="button"
                            onClick={() => {
                              if (schedule.sector) {
                                handleViewBarangays(schedule.sector);
                              }
                            }}
                            className="text-left hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors"
                            title="View assigned barangays"
                          >
                            {schedule.sector?.deployment}
                            {" - "}
                            Sector {schedule.sector?.sector}
                          </button>
                        </div>
                      </td>

                      {/* PERSONNEL */}

                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1.5 min-w-[220px]">
                          {assignments.length > 0 ? (
                            assignments.slice(0, 4).map((assignment) => (
                              <div
                                key={assignment.id || assignment.personnel?.id}
                                className="flex items-center gap-2"
                              >
                                <div className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                                  <UserPlus className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                </div>

                                <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                                  {assignment.personnel?.rank?.rank_name}{" "}
                                  {assignment.personnel?.fullname || "Unknown"}
                                </span>
                              </div>
                            ))
                          ) : (
                            <span className="text-slate-800 dark:text-slate-200  italic">
                              No personnel
                            </span>
                          )}

                          {assignments.length > 4 && (
                            <span className="font-bold text-blue-600 dark:text-blue-400 ml-8">
                              +{assignments.length - 4} more
                            </span>
                          )}
                        </div>
                      </td>

                      {/* UNIT */}

                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {schedule.unit?.unit_name || "N/A"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ======================================================================
          MODAL
      ====================================================================== */}

      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="w-full max-w-2xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            {/* MODAL HEADER */}

            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                  {editScheduleId ? (
                    <Edit2 className="w-5 h-5" />
                  ) : (
                    <CalendarIcon className="w-5 h-5" />
                  )}
                </div>

                <div>
                  <h2 className="text-lg text-slate-900 dark:text-white">
                    {editScheduleId
                      ? "Edit Patrol Assignment"
                      : "New Patrol Assignment"}
                  </h2>

                  <p className="text-slate-800 dark:text-slate-200  mt-0.5">
                    Configure deployment personnel and patrol details.
                  </p>
                </div>
              </div>

              <button
                onClick={closeModal}
                className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* MODAL CONTENT */}

            <div className="overflow-y-auto">
              <form onSubmit={handleAddSchedule} className="p-6 space-y-6">
                {/* ERROR */}

                {error && (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                    <AlertCircle className="w-5 h-5 shrink-0" />

                    <div className="flex-1">
                      <p className="font-bold">Unable to save assignment</p>

                      <p className="mt-1">{error}</p>
                    </div>
                  </div>
                )}

                {/* ==============================================================
                    BASIC DETAILS
                ============================================================== */}

                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                      <CalendarIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>

                    <h3 className="text-slate-800 dark:text-slate-200">
                      Deployment Details
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* UNIT */}

                    <div className="md:col-span-2">
                      <label className="block text-slate-500 mb-2">
                        Unit / Station
                      </label>

                      <select
                        required
                        disabled={!isAdmin}
                        value={formData.unit_id}
                        onChange={(e) => {
                          const selectedUnit = e.target.value;

                          setFormData((prev) => ({
                            ...prev,
                            unit_id: selectedUnit,
                            personnel_ids: [],
                            mobility_id: "",
                            sector_id: "",
                          }));

                          setPersonnelSearch("");

                          // Load personnel specifically for the schedule's selected unit
                          fetchSchedulePersonnel(selectedUnit);
                        }}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="">Select Unit / Station</option>

                        {units.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.unit_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* DATE */}

                    <div>
                      <label className="block text-slate-500 mb-2">
                        Deployment Date
                      </label>

                      <input
                        required
                        type="date"
                        value={formData.date}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            date: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    {/* DUTY TYPE */}

                    <div>
                      <label className="block text-slate-500 mb-2">
                        Duty Type
                      </label>

                      <select
                        value={formData.patrol_type}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            patrol_type: e.target.value,
                            mobility_id: "",
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="Remain in Office">
                          Remain in Office
                        </option>

                        <option value="Foot Patrolling">Foot Patrolling</option>

                        <option value="Mobile Patrolling">
                          Mobile Patrolling
                        </option>

                        <option value="TMRU Patrolling">TMRU Patrolling</option>

                        <option value="Bike Patrolling">Bike Patrolling</option>

                        <option value="Seaborne Patrolling">
                          Seaborne Patrolling
                        </option>

                        <option value="Checkpoint">Checkpoint</option>

                        <option value="Special Event">Special Event</option>

                        <option value="Simulation Exercise">
                          Simulation Exercise
                        </option>

                        <option value="DODON">DODON</option>
                        <option value="Intel-Driven Operation">
                          Intel-Driven Operation
                        </option>
                        <option value="Special Laws">Special Laws</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* ==============================================================
                    TIME
                ============================================================== */}

                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>

                    <h3 className="text-slate-800 dark:text-slate-200">
                      Duty Hours
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-500 mb-2">Start</label>

                      <input
                        required
                        type="time"
                        value={formData.time_from}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            time_from: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-500 mb-2">End</label>

                      <input
                        required
                        type="time"
                        value={formData.time_to}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            time_to: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </div>

                {/* ==============================================================
                    MOBILITY
                ============================================================== */}

                {(formData.patrol_type === "Mobile Patrolling" ||
                  formData.patrol_type === "TMRU Patrolling" ||
                  formData.patrol_type === "Bike Patrolling") && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                        <Car className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </div>

                      <h3 className="text-slate-800 dark:text-slate-200">
                        Mobility Asset
                      </h3>
                    </div>

                    <select
                      required
                      value={formData.mobility_id}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          mobility_id: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">Select Mobility Asset</option>

                      {availableMobility.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.plate_number} — {asset.vehicle_type}
                        </option>
                      ))}
                    </select>

                    {availableMobility.length === 0 && (
                      <p className="mt-2 text-amber-600 dark:text-amber-400">
                        No compatible mobility assets are available for this
                        duty type.
                      </p>
                    )}
                  </div>
                )}

                {/* ==============================================================
                    PERSONNEL
                ============================================================== */}

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                        <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>

                      <h3 className="text-slate-800 dark:text-slate-200">
                        Patrol Personnel
                      </h3>
                    </div>

                    <span className="px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-black">
                      {formData.personnel_ids.length} selected
                    </span>
                  </div>

                  {/* SEARCH */}

                  <div className="flex gap-2 mb-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-800 dark:text-slate-200 " />

                      <input
                        type="text"
                        placeholder="Search by name or rank..."
                        value={personnelSearch}
                        onChange={(e) => setPersonnelSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      disabled={availablePersonnel.length === 0}
                      className="px-3 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                    >
                      {allVisibleSelected ? "Clear" : "Select All"}
                    </button>
                  </div>

                  {/* PERSONNEL LIST */}

                  <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                    <div className="max-h-[240px] overflow-y-auto bg-slate-50/50 dark:bg-slate-950/30">
                      {!formData.unit_id ? (
                        <div className="py-10 text-center text-slate-800 dark:text-slate-200">
                          Select a unit first.
                        </div>
                      ) : loadingSchedulePersonnel ? (
                        <div className="py-10 text-center text-slate-800 dark:text-slate-200">
                          Loading personnel...
                        </div>
                      ) : availablePersonnel.length === 0 ? (
                        <div className="py-10 text-center text-slate-800 dark:text-slate-200">
                          No personnel found.
                        </div>
                      ) : (
                        availablePersonnel.map((p) => {
                          const selected = formData.personnel_ids.includes(
                            p.id,
                          );

                          return (
                            <label
                              key={p.id}
                              className={cn(
                                "flex items-center gap-3 px-4 py-3 cursor-pointer border-b last:border-b-0 border-slate-100 dark:border-slate-800 transition-colors",
                                selected
                                  ? "bg-blue-50 dark:bg-blue-900/10"
                                  : "hover:bg-white dark:hover:bg-slate-800",
                              )}
                            >
                              <div
                                className={cn(
                                  "w-5 h-5 rounded-md border flex items-center justify-center shrink-0",
                                  selected
                                    ? "bg-blue-600 border-blue-600"
                                    : "border-slate-300 dark:border-slate-600",
                                )}
                              >
                                {selected && (
                                  <Check className="w-3.5 h-3.5 text-white" />
                                )}
                              </div>

                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    personnel_ids: selected
                                      ? prev.personnel_ids.filter(
                                          (id) => id !== p.id,
                                        )
                                      : [...prev.personnel_ids, p.id],
                                  }));
                                }}
                                className="sr-only"
                              />

                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                  {p.rank?.rank_name || "No Rank"} {p.fullname}
                                </p>
                              </div>

                              {selected && (
                                <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                              )}
                            </label>
                          );
                        })
                      )}
                    </div>

                    <div className="px-4 py-2.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 ">
                        {unitPersonnel.length} personnel in unit
                      </span>

                      <span className="text-blue-600 dark:text-blue-400">
                        {formData.personnel_ids.length} assigned
                      </span>
                    </div>
                  </div>

                  {formData.patrol_type === "Checkpoint" &&
                    formData.personnel_ids.length < 8 && (
                      <p className="mt-2 font-bold text-amber-600 dark:text-amber-400">
                        Checkpoint requires at least 8 personnel.
                      </p>
                    )}
                </div>

                {/* ==============================================================
                    SECTOR
                ============================================================== */}

                {formData.patrol_type !== "Remain in Office" && (
                  <>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-4 h-4 text-slate-800 dark:text-slate-200 " />

                        <label className="text-slate-500">
                          Target Sector / Area
                        </label>
                      </div>

                      <select
                        required
                        value={formData.sector_id}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            sector_id: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="">
                          {!formData.unit_id
                            ? "Select a unit/station first"
                            : availableSectors.length === 0
                              ? "No sectors for this unit/station"
                              : "Select Sector"}
                        </option>

                        {availableSectors.map((sector) => (
                          <option key={sector.id} value={sector.id}>
                            {sector.deployment ? `${sector.deployment} - ` : ""}
                            Sector {sector.sector}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-slate-800 dark:text-slate-200" />
                        <label
                          htmlFor="patrol-location"
                          className="font-black text-slate-500"
                        >
                          Patrol Location
                        </label>
                      </div>

                      <input
                        id="patrol-location"
                        type="text"
                        list="patrol-location-barangays"
                        value={formData.location}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            location: e.target.value,
                          }))
                        }
                        placeholder={
                          !formData.sector_id
                            ? "Select a sector first"
                            : selectedSectorBarangays.length > 0
                              ? "Search or enter a barangay, sitio, or landmark"
                              : "Enter a barangay, sitio, or landmark"
                        }
                        maxLength={255}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />

                      <datalist id="patrol-location-barangays">
                        {selectedSectorBarangays.map((barangay) => (
                          <option key={barangay} value={barangay} />
                        ))}
                      </datalist>

                      <p className="mt-1 text-xs text-slate-500">
                        Suggestions come from the selected sector's barangays.
                        You can also enter a specific sitio, street, or
                        landmark.
                      </p>
                    </div>
                  </>
                )}

                {/* ==============================================================
                    FOOTER
                ============================================================== */}

                <div className="pt-3 flex gap-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-[2] px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting
                      ? "Saving Assignment..."
                      : editScheduleId
                        ? "Update Assignment"
                        : "Create Assignment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showBarangayModal && selectedScheduleSector && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowBarangayModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                  Assigned Barangays
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {selectedScheduleSector.deployment}
                  {" - "}
                  Sector {selectedScheduleSector.sector}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowBarangayModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Barangay List */}
            <div className="max-h-[60vh] overflow-y-auto p-6">
              {selectedScheduleSector.sector_details &&
              selectedScheduleSector.sector_details.length > 0 ? (
                <div className="space-y-2">
                  {selectedScheduleSector.sector_details.map((detail) => (
                    <div
                      key={detail.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                        <MapPin className="h-4 w-4" />
                      </div>

                      <div>
                        <div className="font-semibold text-slate-700 dark:text-slate-200">
                          {Array.isArray(detail.barangay)
                            ? detail.barangay[0]?.name
                            : detail.barangay?.name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center">
                  <div className="mb-3 text-4xl">📍</div>

                  <p className="font-semibold text-slate-600 dark:text-slate-300">
                    No barangays assigned
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    This sector does not have any assigned barangays.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end border-t border-slate-200 px-6 py-4 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setShowBarangayModal(false)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
