import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, Personnel, Unit, Rank } from "../../lib/supabase";
import { useAuth } from "../../components/AuthProvider";
import { useSearchParams } from "react-router-dom";
import {
  Users,
  Search,
  Phone,
  MessageCircle,
  Edit,
  RefreshCw,
  Trash,
  AlertCircle,
  CheckCircle2,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Check,
} from "lucide-react";
import { format } from "date-fns";

type PersonnelWithRelations = Personnel & {
  unit_name: string | null;
  rank_name: string | null;
};

type Designation = {
  id: string;
  unit_classification: number;
  name: string;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function PersonnelPage() {
  const { isAdmin, role, unitId } = useAuth();

  // ============================================================
  // DATA
  // ============================================================

  const [personnel, setPersonnel] = useState<PersonnelWithRelations[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [rankList, setRankList] = useState<Rank[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);

  // ============================================================
  // PAGINATION
  // ============================================================

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // ============================================================
  // FILTERS
  // ============================================================

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("all");

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // ============================================================
  // UI
  // ============================================================

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [viewingPerson, setViewingPerson] =
    useState<PersonnelWithRelations | null>(null);

  const [editingPerson, setEditingPerson] =
    useState<PersonnelWithRelations | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchParams] = useSearchParams();
  const filter = searchParams.get("filter");

  // ============================================================
  // FORM
  // ============================================================

  const defaultFormData = useCallback(
    () => ({
      email: "",
      password: "",
      fullname: "",
      rank_id: "",
      badge_number: "",
      phone_number: "",
      viber_number: "",
      designation: "",
      duty_status: "Active Duty",
      ds_to: "",
      augmented_to: "",
      remarks: "",
      unit_id: isAdmin ? "" : unitId || "",
      createAuth: false,
    }),
    [isAdmin, unitId],
  );

  const [formData, setFormData] = useState(defaultFormData());

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEditMode = !!editingPerson;

  // ============================================================
  // DEBOUNCE SEARCH
  // ============================================================

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedUnit, pageSize]);

  // ============================================================
  // LOAD STATIC DATA
  // ============================================================

  useEffect(() => {
    loadReferenceData();
  }, []);

  const loadReferenceData = async () => {
    try {
      const [unitsRes, ranksRes, designationsRes] = await Promise.all([
        supabase
          .from("unit")
          .select("*")
          .order("level", { ascending: false })
          .order("unit_name", { ascending: true }),

        supabase.from("rank").select("*").order("level", { ascending: false }),

        supabase
          .from("designation")
          .select("id, unit_classification, name")
          .order("name", { ascending: true }),
      ]);

      if (unitsRes.error) throw unitsRes.error;
      if (ranksRes.error) throw ranksRes.error;
      if (designationsRes.error) throw designationsRes.error;

      setUnits(unitsRes.data || []);
      setRankList(ranksRes.data || []);
      setDesignations(designationsRes.data || []);
    } catch (error) {
      console.error("Error loading reference data:", error);
    }
  };

  // ============================================================
  // FETCH PERSONNEL - SERVER SIDE PAGINATION
  // ============================================================

  const fetchPersonnel = useCallback(
    async (showRefreshing = false) => {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
          .from("personnel_with_details")
          .select("*", { count: "exact" })
          .order("rank_level", {
            ascending: false,
          })
          .order("unit_level", {
            ascending: false,
          })
          .range(from, to);

        // ========================================================
        // UNIT FILTER
        // ========================================================

        if (!isAdmin && unitId) {
          query = query.eq("unit_id", unitId);
        } else if (isAdmin && selectedUnit !== "all") {
          query = query.eq("unit_id", selectedUnit);
        }

        // ========================================================
        // DASHBOARD FILTER
        // ========================================================

        if (filter) {
          const todayDate = format(new Date(), "yyyy-MM-dd");

          // ======================================================
          // ACTUAL PRESENT
          // Active Duty + Detached Service
          // ======================================================

          if (filter === "actual-present") {
            query = query.in("duty_status", [
              "Active Duty",
              "Detached Service",
            ]);
          }

          // ======================================================
          // INEFFECTIVE
          // Anything other than Active Duty / Detached Service
          // ======================================================
          else if (filter === "ineffective") {
            query = query.not(
              "duty_status",
              "in",
              '("Active Duty","Detached Service")',
            );
          }

          // ======================================================
          // OFFICE DUTY
          // Personnel assigned to "Remain in Office" today
          // ======================================================
          else if (filter === "office-duty") {
            let officeScheduleQuery = supabase
              .from("patrol_schedule")
              .select(
                `
        schedule_assignments(
          personnel_id
        )
      `,
              )
              .eq("date", todayDate)
              .eq("patrol_type", "Remain in Office");

            // UNIT FILTER
            if (!isAdmin && unitId) {
              officeScheduleQuery = officeScheduleQuery.eq("unit_id", unitId);
            } else if (isAdmin && selectedUnit !== "all") {
              officeScheduleQuery = officeScheduleQuery.eq(
                "unit_id",
                selectedUnit,
              );
            }

            const { data: officeSchedules, error: officeScheduleError } =
              await officeScheduleQuery;

            if (officeScheduleError) {
              throw officeScheduleError;
            }

            const officePersonnelIds = [
              ...new Set(
                officeSchedules
                  ?.flatMap((schedule) => schedule.schedule_assignments ?? [])
                  .map((assignment) => assignment.personnel_id)
                  .filter(Boolean) ?? [],
              ),
            ];

            if (officePersonnelIds.length > 0) {
              query = query.in("id", officePersonnelIds);
            } else {
              // No office-duty personnel today
              query = query.in("id", ["00000000-0000-0000-0000-000000000000"]);
            }
          }

          // ======================================================
          // PATROL DUTY
          // Personnel assigned to patrol schedules today
          // Excludes "Remain in Office"
          // ======================================================
          else if (filter === "patrol-duty") {
            let patrolScheduleQuery = supabase
              .from("patrol_schedule")
              .select(
                `
                schedule_assignments(
                  personnel_id
                )
              `,
              )
              .eq("date", todayDate)
              .neq("patrol_type", "Remain in Office");

            // UNIT FILTER
            if (!isAdmin && unitId) {
              patrolScheduleQuery = patrolScheduleQuery.eq("unit_id", unitId);
            } else if (isAdmin && selectedUnit !== "all") {
              patrolScheduleQuery = patrolScheduleQuery.eq(
                "unit_id",
                selectedUnit,
              );
            }

            const { data: patrolSchedules, error: patrolScheduleError } =
              await patrolScheduleQuery;

            if (patrolScheduleError) {
              throw patrolScheduleError;
            }

            const patrolPersonnelIds = [
              ...new Set(
                patrolSchedules
                  ?.flatMap((schedule) => schedule.schedule_assignments ?? [])
                  .map((assignment) => assignment.personnel_id)
                  .filter(Boolean) ?? [],
              ),
            ];

            if (patrolPersonnelIds.length > 0) {
              query = query.in("id", patrolPersonnelIds);
            } else {
              // No patrol-duty personnel today
              query = query.in("id", ["00000000-0000-0000-0000-000000000000"]);
            }
          }

          // ======================================================
          // OFF DUTY
          //
          // Active personnel who are NOT assigned to:
          // - Remain in Office
          // - Any patrol duty
          //
          // ======================================================
          else if (filter === "off-duty") {
            // First get today's schedules
            let scheduleQuery = supabase
              .from("patrol_schedule")
              .select(
                `
                schedule_assignments(
                  personnel_id
                )
              `,
              )
              .eq("date", todayDate);

            // UNIT FILTER
            if (!isAdmin && unitId) {
              scheduleQuery = scheduleQuery.eq("unit_id", unitId);
            } else if (isAdmin && selectedUnit !== "all") {
              scheduleQuery = scheduleQuery.eq("unit_id", selectedUnit);
            }

            const { data: schedules, error: scheduleError } =
              await scheduleQuery;

            if (scheduleError) {
              throw scheduleError;
            }

            const scheduledPersonnelIds = [
              ...new Set(
                schedules
                  ?.flatMap((schedule) => schedule.schedule_assignments ?? [])
                  .map((assignment) => assignment.personnel_id)
                  .filter(Boolean) ?? [],
              ),
            ];

            // Off Duty = Actual Present but not scheduled today
            query = query.in("duty_status", [
              "Active Duty",
              "Detached Service",
            ]);

            if (scheduledPersonnelIds.length > 0) {
              query = query.not(
                "id",
                "in",
                `(${scheduledPersonnelIds.join(",")})`,
              );
            }
          }
        }

        // ========================================================
        // SEARCH
        //
        // Search personnel table fields.
        // Related unit/rank searching is not included here because
        // Supabase/PostgREST does not reliably support arbitrary
        // OR searches across embedded relations.
        // ========================================================

        if (debouncedSearch) {
          const search = debouncedSearch.replace(/[%_]/g, "\\$&");

          query = query.or(
            [
              `fullname.ilike.%${search}%`,
              `badge_number.ilike.%${search}%`,
              `designation.ilike.%${search}%`,
              `phone_number.ilike.%${search}%`,
              `viber_number.ilike.%${search}%`,
              `duty_status.ilike.%${search}%`,
            ].join(","),
          );
        }

        // ========================================================
        // ORDER
        //
        // Unit level and rank level are relation columns, so the
        // final ordering is done client-side for this page.
        //
        // Primary database ordering keeps the result deterministic.
        // ========================================================

        const { data, error, count } = await query;

        if (error) throw error;

        setPersonnel(data);
        setTotalCount(count || 0);

        // If current page no longer exists after delete/filter,
        // move back to the last available page.
        const calculatedPages = Math.max(1, Math.ceil((count || 0) / pageSize));

        if (page > calculatedPages) {
          setPage(calculatedPages);
        }
      } catch (error) {
        console.error("Error fetching personnel:", error);
        setPersonnel([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, pageSize, isAdmin, unitId, selectedUnit, debouncedSearch],
  );

  useEffect(() => {
    fetchPersonnel();
  }, [fetchPersonnel]);

  // ============================================================
  // FILTERED DESIGNATIONS
  // ============================================================

  const filteredDesignations = useMemo(() => {
    const unitIdForForm = formData.unit_id;

    if (!unitIdForForm) {
      return designations;
    }

    const selectedUnitObject = units.find((unit) => unit.id === unitIdForForm);

    if (!selectedUnitObject) {
      return [];
    }

    return designations.filter(
      (designation) =>
        designation.unit_classification === selectedUnitObject.classification,
    );
  }, [designations, units, formData.unit_id]);

  // ============================================================
  // FORM INITIALIZATION
  // ============================================================

  useEffect(() => {
    if (editingPerson) {
      setFormData({
        email: "",
        password: "",
        fullname: editingPerson.fullname || "",
        rank_id: editingPerson.rank_id || "",
        badge_number: editingPerson.badge_number || "",
        phone_number: editingPerson.phone_number || "",
        viber_number: editingPerson.viber_number || "",
        designation: editingPerson.designation || "",
        duty_status: editingPerson.duty_status || "Active Duty",
        ds_to: editingPerson.ds_to || "",
        augmented_to: editingPerson.augmented_to || "",
        remarks: editingPerson.remarks || "",
        unit_id: editingPerson.unit_id || "",
        createAuth: false,
      });
    } else {
      setFormData(defaultFormData());
    }

    setFormError(null);
    setFormSuccess(null);
  }, [editingPerson, defaultFormData]);

  // ============================================================
  // OPEN ADD
  // ============================================================

  const openAddModal = () => {
    setEditingPerson(null);
    setFormData(defaultFormData());
    setFormError(null);
    setFormSuccess(null);
    setShowAddModal(true);
  };

  // ============================================================
  // CLOSE FORM MODAL
  // ============================================================

  const closeFormModal = () => {
    setShowAddModal(false);
    setEditingPerson(null);
    setFormError(null);
    setFormSuccess(null);
  };

  // ============================================================
  // APPROVAL REMOVED
  // ============================================================
  //
  // There is intentionally NO handleApprove().
  // There is intentionally NO pending tab.
  // There is intentionally NO approval button.
  //
  // ============================================================

  // ============================================================
  // DELETE
  // ============================================================

  const handleDelete = async (id: string) => {
    const person = personnel.find((p) => p.id === id);

    const confirmed = window.confirm(
      `Are you sure you want to delete ${
        person?.fullname || "this officer"
      }?\n\nThis may also remove related assignments depending on your database foreign-key rules.`,
    );

    if (!confirmed) return;

    try {
      setRefreshing(true);

      const { error } = await supabase.from("personnel").delete().eq("id", id);

      if (error) throw error;

      // Refetch current page.
      await fetchPersonnel(true);
    } catch (error: any) {
      console.error(error);

      setFormError(
        "Error deleting personnel: " + (error?.message || "Unknown error"),
      );

      setRefreshing(false);
    }
  };

  // ============================================================
  // ADD / EDIT PERSONNEL
  // ============================================================

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    setFormError(null);
    setFormSuccess(null);
    setSaving(true);

    try {
      // ========================================================
      // EDIT
      // ========================================================

      if (isEditMode && editingPerson) {
        const { error } = await supabase
          .from("personnel")
          .update({
            fullname: formData.fullname.trim(),
            rank_id: formData.rank_id || null,
            badge_number: formData.badge_number.trim(),
            phone_number: formData.phone_number.trim(),
            viber_number: formData.viber_number.trim(),
            designation: formData.designation,
            duty_status: formData.duty_status,
            remarks:
              formData.duty_status === "Others" ? formData.remarks.trim() : "",
            unit_id: formData.unit_id || null,
            ds_to: formData.ds_to || null,
            augmented_to: formData.augmented_to || null,
          })
          .eq("id", editingPerson.id);

        if (error) throw error;

        setFormSuccess("Personnel successfully updated.");

        closeFormModal();

        await fetchPersonnel(true);

        return;
      }

      // ========================================================
      // ADD
      // ========================================================

      const canCreateAuth = formData.createAuth && role === "admin";

      if (canCreateAuth) {
        const confirmed = window.confirm(
          "Security Notice:\n\nRegistering a new personnel account directly may affect the current authentication session.\n\nContinue?",
        );

        if (!confirmed) return;

        // ------------------------------------------------------
        // CREATE AUTH ACCOUNT
        // ------------------------------------------------------

        const { data: authData, error: signUpError } =
          await supabase.auth.signUp({
            email: formData.email.trim(),
            password: formData.password,
          });

        if (signUpError) throw signUpError;

        if (!authData.user) {
          throw new Error("Authentication account was not created.");
        }

        const { error: profileError } = await supabase
          .from("personnel")
          .insert({
            id: authData.user.id,
            fullname: formData.fullname.trim(),
            rank_id: formData.rank_id || null,
            badge_number: formData.badge_number.trim(),
            phone_number: formData.phone_number.trim(),
            viber_number: formData.viber_number.trim(),
            designation: formData.designation,
            duty_status: formData.duty_status,
            remarks:
              formData.duty_status === "Others" ? formData.remarks.trim() : "",
            unit_id: formData.unit_id || null,
            ds_to: formData.ds_to || null,
            augmented_to: formData.augmented_to || null,

            // No approval workflow.
            is_approved: true,

            role: "user",
          });

        if (profileError) throw profileError;

        setFormSuccess("Personnel account successfully created.");
      } else {
        // ------------------------------------------------------
        // CREATE PERSONNEL WITHOUT AUTH
        // ------------------------------------------------------

        const { error } = await supabase.from("personnel").insert({
          fullname: formData.fullname.trim(),
          rank_id: formData.rank_id || null,
          badge_number: formData.badge_number.trim(),
          phone_number: formData.phone_number.trim(),
          viber_number: formData.viber_number.trim(),
          designation: formData.designation,
          duty_status: formData.duty_status,
          remarks:
            formData.duty_status === "Others" ? formData.remarks.trim() : "",
          unit_id: formData.unit_id || null,
          ds_to: formData.ds_to || null,
          augmented_to: formData.augmented_to || null,

          // Kept true for compatibility with existing schema.
          is_approved: true,

          role: "user",
        });

        if (error) throw error;

        setFormSuccess(
          "Personnel successfully created without login credentials.",
        );
      }

      closeFormModal();

      await fetchPersonnel(true);
    } catch (error: any) {
      console.error(error);

      setFormError(
        "Error saving personnel: " + (error?.message || "Unknown error"),
      );
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // PAGINATION HELPERS
  // ============================================================

  const startRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;

  const endRecord = Math.min(page * pageSize, totalCount);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];

    const maxVisiblePages = 5;

    let start = Math.max(1, page - Math.floor(maxVisiblePages / 2));

    let end = Math.min(totalPages, start + maxVisiblePages - 1);

    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(1, end - maxVisiblePages + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  }, [page, totalPages]);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="flex flex-col gap-6">
      {/* ====================================================== */}
      {/* HEADER */}
      {/* ====================================================== */}

      <div className="space-y-4">
        {/* ===== TOP: PAGE TITLE ===== */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
                <Users className="h-7 w-7" />
              </div>

              <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500 dark:border-slate-950">
                <Check className="h-3 w-3 text-white" />
              </div>
            </div>

            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Personnel Directory
              </h1>

              <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                Manage officers, ranks, and unit assignments
              </p>
            </div>
          </div>

          {/* NEW */}
          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-bold text-white shadow-sm transition-all hover:bg-blue-700"
          >
            <Users className="h-4 w-4" />
            New
          </button>
        </div>

        {/* ===== BOTTOM: FILTERS ===== */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(240px,1.5fr)_minmax(200px,1fr)_auto]">
            {/* SEARCH */}
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="text"
                placeholder="Search personnel..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* UNIT */}
            <select
              value={selectedUnit}
              onChange={(e) => {
                if (isAdmin) {
                  setSelectedUnit(e.target.value);
                }
              }}
              disabled={!isAdmin}
              className={`h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white ${
                !isAdmin ? "cursor-not-allowed opacity-50" : ""
              }`}
            >
              <option value="all">All Units/Stations</option>

              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.unit_name}
                </option>
              ))}
            </select>

            {/* REFRESH */}
            <button
              onClick={() => fetchPersonnel(true)}
              disabled={refreshing}
              title="Refresh"
              className="flex h-11 items-center justify-center rounded-xl bg-slate-100 px-4 transition hover:bg-slate-200 disabled:opacity-60 dark:bg-slate-800 dark:hover:bg-slate-700 sm:col-span-2 lg:col-span-1 lg:w-11 lg:px-0"
            >
              <RefreshCw
                className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ====================================================== */}
      {/* TABLE */}
      {/* ====================================================== */}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
        {loading ? (
          <div className="min-h-[400px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                    <th className="p-4 text-center whitespace-nowrap">
                      Actions
                    </th>

                    <th className="p-4 whitespace-nowrap">Badge Number</th>

                    <th className="p-4 whitespace-nowrap">Rank/Name</th>

                    <th className="p-4 whitespace-nowrap">Designation</th>

                    <th className="p-4 whitespace-nowrap">Unit/Station</th>

                    <th className="p-4 whitespace-nowrap">Contact Info</th>

                    <th className="p-4 whitespace-nowrap">Duty Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {personnel.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-6 py-16 text-center text-slate-500"
                      >
                        <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />

                        <p className="font-bold">No personnel found</p>

                        {debouncedSearch && (
                          <p className="mt-1">Try changing your search.</p>
                        )}
                      </td>
                    </tr>
                  ) : (
                    personnel.map((person, index) => {
                      return (
                        <tr
                          key={person.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                        >
                          {/* ACTIONS */}

                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-1">
                              {/* VIEW */}

                              <button
                                onClick={() => setViewingPerson(person)}
                                title="View Personnel"
                                className="p-2 text-slate-700 dark:text-slate-200 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                              >
                                <Eye className="w-5 h-5" />
                              </button>

                              {/* EDIT */}

                              <button
                                onClick={() => {
                                  setEditingPerson(person);
                                  setShowAddModal(true);
                                }}
                                title="Edit Officer"
                                className="p-2 text-slate-700 dark:text-slate-200 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                              >
                                <Edit className="w-5 h-5" />
                              </button>

                              {/* ADMIN ACTIONS */}

                              {isAdmin && (
                                <>
                                  <button
                                    onClick={() => handleDelete(person.id)}
                                    title="Delete Officer"
                                    className="p-2 text-slate-700 dark:text-slate-200 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                  >
                                    <Trash className="w-5 h-5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>

                          {/* BADGE */}

                          <td className="px-6 py-4 whitespace-nowrap font-mono">
                            {person.badge_number || "-"}
                          </td>

                          {/* NAME */}

                          <td className="px-6 py-4 whitespace-nowrap">
                            {person.rank_name || "No Rank"} {person.fullname}
                          </td>

                          {/* DESIGNATION */}

                          <td className="px-6 py-4 whitespace-nowrap">
                            {person.designation || "-"}
                          </td>

                          {/* UNIT */}

                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div>{person.unit_name || "Not Assigned"}</div>

                              {person.remarks && (
                                <div className="text-slate-500">
                                  {person.remarks}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* CONTACT */}

                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              {person.phone_number && (
                                <a
                                  href={`tel:${person.phone_number}`}
                                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                                >
                                  <Phone className="w-4 h-4" />

                                  <span>{person.phone_number}</span>
                                </a>
                              )}

                              {person.viber_number && (
                                <a
                                  href={`viber://chat?number=${person.viber_number}`}
                                  className="flex items-center gap-2 text-purple-600 hover:text-purple-800"
                                >
                                  <MessageCircle className="w-4 h-4" />

                                  <span>{person.viber_number}</span>
                                </a>
                              )}

                              {!person.phone_number && !person.viber_number && (
                                <span className="text-slate-400">-</span>
                              )}
                            </div>
                          </td>

                          {/* DUTY */}

                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2.5 py-1 rounded-lg font-bold ${
                                person.duty_status === "Active Duty"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                              }`}
                            >
                              {person.duty_status || "Not Assigned"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ================================================== */}
            {/* PAGINATION */}
            {/* ================================================== */}

            <div className="border-t border-slate-200 dark:border-slate-800 px-4 py-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                {/* RECORD INFO */}

                <div className="flex items-center gap-3 text-slate-500">
                  <span>
                    Showing{" "}
                    <strong className="text-slate-900 dark:text-white">
                      {startRecord}
                    </strong>{" "}
                    to{" "}
                    <strong className="text-slate-900 dark:text-white">
                      {endRecord}
                    </strong>{" "}
                    of{" "}
                    <strong className="text-slate-900 dark:text-white">
                      {totalCount}
                    </strong>{" "}
                    personnel
                  </span>

                  {/* PAGE SIZE */}

                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 font-bold text-slate-700 dark:text-slate-200"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}/page
                      </option>
                    ))}
                  </select>
                </div>

                {/* PAGE NAVIGATION */}

                <div className="flex items-center gap-1">
                  {/* FIRST */}

                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(1)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="First page"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>

                  {/* PREVIOUS */}

                  <button
                    disabled={page <= 1}
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {/* PAGE NUMBERS */}

                  {pageNumbers.map((pageNumber) => (
                    <button
                      key={pageNumber}
                      onClick={() => setPage(pageNumber)}
                      className={`min-w-9 h-9 px-2 rounded-lg font-bold transition ${
                        page === pageNumber
                          ? "bg-blue-600 text-white"
                          : "border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {pageNumber}
                    </button>
                  ))}

                  {/* NEXT */}

                  <button
                    disabled={page >= totalPages}
                    onClick={() =>
                      setPage((current) => Math.min(totalPages, current + 1))
                    }
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  {/* LAST */}

                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(totalPages)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Last page"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ====================================================== */}
      {/* VIEW PERSONNEL MODAL */}
      {/* ====================================================== */}

      {viewingPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* HEADER */}

            <div className="p-6 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Personnel Information
                </h2>

                <p className="text-slate-500 mt-1">View officer details</p>
              </div>

              <button
                onClick={() => setViewingPerson(null)}
                className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* BODY */}

            <div className="p-6 space-y-6">
              {/* NAME */}

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Users className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                </div>

                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {viewingPerson.rank_name || "No Rank"}{" "}
                    {viewingPerson.fullname}
                  </h3>

                  <p className="text-slate-500">
                    {viewingPerson.designation || "No designation"}
                  </p>
                </div>
              </div>

              {/* DETAILS */}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailItem
                  label="Badge Number"
                  value={viewingPerson.badge_number || "-"}
                />

                <DetailItem
                  label="Rank"
                  value={viewingPerson.rank?.rank_name || "No Rank"}
                />

                <DetailItem
                  label="Designation"
                  value={viewingPerson.designation || "-"}
                />

                <DetailItem
                  label="Unit / Station"
                  value={viewingPerson.unit_name || "Not Assigned"}
                />

                <DetailItem
                  label="Duty Status"
                  value={viewingPerson.duty_status || "Not Assigned"}
                />

                <DetailItem
                  label="Phone Number"
                  value={viewingPerson.phone_number || "-"}
                />

                <DetailItem
                  label="Viber Number"
                  value={viewingPerson.viber_number || "-"}
                />

                {viewingPerson.remarks && (
                  <div className="sm:col-span-2">
                    <DetailItem label="Remarks" value={viewingPerson.remarks} />
                  </div>
                )}
              </div>

              {/* CONTACT BUTTONS */}

              <div className="flex flex-wrap gap-3 pt-2">
                {viewingPerson.phone_number && (
                  <a
                    href={`tel:${viewingPerson.phone_number}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700"
                  >
                    <Phone className="w-4 h-4" />
                    Call
                  </a>
                )}

                {viewingPerson.viber_number && (
                  <a
                    href={`viber://chat?number=${viewingPerson.viber_number}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Viber
                  </a>
                )}
              </div>
            </div>

            {/* FOOTER */}

            <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setViewingPerson(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================== */}
      {/* ADD / EDIT MODAL */}
      {/* ====================================================== */}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
            {/* HEADER */}

            <div className="p-6 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white text-xl">
                  {isEditMode ? "Edit Personnel" : "Add New Personnel"}
                </h2>

                <p className="text-slate-500 mt-1">
                  {isEditMode
                    ? "Update officer information"
                    : "Register new officer"}
                </p>
              </div>

              <button
                onClick={closeFormModal}
                className="p-2 bg-white dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* FORM */}

            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-4 max-h-[70vh] overflow-y-auto"
            >
              {/* ERROR */}

              {formError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />

                  <p className="font-semibold">{formError}</p>
                </div>
              )}

              {/* SUCCESS */}

              {formSuccess && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 text-green-600 dark:text-green-400 p-4 rounded-xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />

                  <p className="font-semibold">{formSuccess}</p>
                </div>
              )}

              {/* AUTH */}

              {!isEditMode && role === "admin" && (
                <>
                  <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <input
                      type="checkbox"
                      checked={formData.createAuth}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          createAuth: e.target.checked,
                        })
                      }
                      className="h-5 w-5 text-blue-600 rounded"
                    />

                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      Create Login Credentials
                    </span>
                  </label>

                  {formData.createAuth && (
                    <>
                      <div className="bg-amber-50 dark:bg-amber-900/20 px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-900/50">
                        <p className="font-bold text-amber-700 dark:text-amber-400">
                          Creating login credentials may affect the current
                          authentication session.
                        </p>
                      </div>

                      <FormInput
                        label="Email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={(value) =>
                          setFormData({
                            ...formData,
                            email: value,
                          })
                        }
                        placeholder="officer@inppo.ph"
                      />

                      <FormInput
                        label="Temporary Password"
                        type="password"
                        required
                        value={formData.password}
                        onChange={(value) =>
                          setFormData({
                            ...formData,
                            password: value,
                          })
                        }
                        placeholder="••••••••"
                      />
                    </>
                  )}
                </>
              )}

              {/* FULL NAME */}

              <FormInput
                label="Full Name"
                required
                value={formData.fullname}
                onChange={(value) =>
                  setFormData({
                    ...formData,
                    fullname: value,
                  })
                }
                placeholder="Juan Dela Cruz"
              />

              {/* RANK / BADGE */}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-200">
                    Rank
                  </label>

                  <select
                    value={formData.rank_id}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rank_id: e.target.value,
                      })
                    }
                    className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 font-bold outline-none"
                  >
                    <option value="">Select Rank</option>

                    {rankList.map((rank) => (
                      <option key={rank.id} value={rank.id}>
                        {rank.description || rank.rank_name}
                      </option>
                    ))}
                  </select>
                </div>

                <FormInput
                  label="Badge Number"
                  value={formData.badge_number}
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      badge_number: value,
                    })
                  }
                  placeholder="12345"
                />
              </div>

              {/* UNIT */}

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-200">
                  Unit / Station
                </label>

                <select
                  required
                  value={formData.unit_id}
                  onChange={(e) => {
                    if (!isAdmin) return;

                    setFormData({
                      ...formData,
                      unit_id: e.target.value,
                      designation: "",
                    });
                  }}
                  disabled={!isAdmin}
                  className={`w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 font-bold outline-none ${
                    !isAdmin ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  <option value="">Select Unit/Station</option>

                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.unit_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* DS TO */}

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-200">
                  DS To (Detail Station)
                </label>

                <select
                  value={formData.ds_to}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      ds_to: e.target.value,
                    })
                  }
                  className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 font-bold outline-none"
                >
                  <option value="">Select DS To</option>

                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.unit_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Augmented To */}

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-200">
                  Augmented To
                </label>

                <select
                  value={formData.augmented_to}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      augmented_to: e.target.value,
                    })
                  }
                  className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 font-bold outline-none"
                >
                  <option value="">Select Augmented Unit</option>

                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.unit_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* DESIGNATION */}

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-200">
                  Designation
                </label>

                <select
                  value={formData.designation}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      designation: e.target.value,
                    })
                  }
                  className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 font-bold outline-none"
                >
                  <option value="">Select Designation</option>

                  {filteredDesignations.map((designation) => (
                    <option key={designation.id} value={designation.name}>
                      {designation.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* CONTACT */}

              <div className="grid grid-cols-2 gap-4">
                <FormInput
                  label="Phone Number"
                  value={formData.phone_number}
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      phone_number: value,
                    })
                  }
                  placeholder="+63 912 345 6789"
                />

                <FormInput
                  label="Viber Number"
                  value={formData.viber_number}
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      viber_number: value,
                    })
                  }
                  placeholder="+63 912 345 6789"
                />
              </div>

              {/* DUTY STATUS */}

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-200">
                  Duty Status
                </label>

                <select
                  value={formData.duty_status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      duty_status: e.target.value,
                      remarks:
                        e.target.value === "Others" ? formData.remarks : "",
                    })
                  }
                  className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 font-bold outline-none"
                >
                  <option value="Active Duty">Active Duty</option>
                  <option value="Detached Service">Detached Service</option>
                  <option value="Under schooling">Under Schooling</option>
                  <option value="Mandatory Leave">Mandatory Leave</option>
                  <option value="Vacation Leave">Vacation Leave</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Maternity Leave">Maternity Leave</option>
                  <option value="Paternity Leave">Paternity Leave</option>
                  <option value="Study Leave">Study Leave</option>
                  <option value="Emergency Leave">Emergency Leave</option>
                  <option value="Suspended">Suspended</option>
                  <option value="AWOL">AWOL</option>
                  <option value="Non-Duty Status">Non-Duty Status</option>
                  <option value="Others">Others</option>
                </select>
              </div>

              {/* REMARKS */}

              {formData.duty_status === "Others" && (
                <FormInput
                  label="Remarks"
                  value={formData.remarks}
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      remarks: value,
                    })
                  }
                  placeholder="Please specify duty status details"
                />
              )}

              {/* BUTTONS */}

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeFormModal}
                  disabled={saving}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {saving ? "Saving..." : isEditMode ? "Update" : "Register"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// FORM INPUT
// ============================================================

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="font-bold text-slate-700 dark:text-slate-200">
        {label}
      </label>

      <input
        required={required}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 transition"
      />
    </div>
  );
}

// ============================================================
// DETAIL ITEM
// ============================================================

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
      <p className="text-slate-800 dark:text-slate-200 mb-1">{label}</p>

      <p className="text-slate-900 dark:text-white break-words">{value}</p>
    </div>
  );
}
