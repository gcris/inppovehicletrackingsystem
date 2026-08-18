import React, { useEffect, useMemo, useState } from "react";

import {
  Plus,
  Search,
  RefreshCcw,
  Eye,
  Edit2,
  Trash2,
  ClipboardCheck,
  AlertCircle,
  X,
} from "lucide-react";

import { VehicleInspection, supabase, Unit } from "../../lib/supabase";
import InspectionFormModal from "./InspectionFormModal";
import InspectionViewModal from "./InspectionViewModal";
import { useAuth } from "../../components/AuthProvider";
import { format, parseISO } from "date-fns";
import ConfirmDeleteModal from "../../helper/ConfirmDeleteModal";

export default function VehicleInspectionPage() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [inspections, setInspections] = useState<VehicleInspection[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showFormModal, setShowFormModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedInspection, setSelectedInspection] =
    useState<VehicleInspection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const PAGE_SIZE = 10;

  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
    loadPage();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedUnit, statusFilter]);

  useEffect(() => {
    if (error || success) {
      // Automatically clear the error after 5 seconds (5000ms)
      const timer = setTimeout(() => {
        setError(null); // Replace setError with whatever your state setter is named
        setSuccess(null);
      }, 8000);

      // Clean up the timer if the component unmounts or if error changes before 5s
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const loadPage = async () => {
    setLoading(true);
    try {
      await fetchInspections();
      if (isAdmin) {
        await fetchUnits();
      }
    } catch (error) {
      setError("Failed to load inspections: " + error);
    } finally {
      setLoading(false);
    }
    setLoading(false);
  };

  const fetchInspections = async () => {
    const inspections = supabase
      .from("vehicle_inspections")
      .select(
        `
          *,
          mobility_asset:mobility_assets(
            id,
            plate_number,
            description
          ),
          designated_driver:personnel!vehicle_inspections_designated_driver_id_fkey(
            id,
            fullname,
            rank(*)
          ),
          alternate_driver:personnel!vehicle_inspections_alternate_driver_id_fkey(
            id,
            fullname,
            rank(*)
          ),
          unit:unit!vehicle_inspections_unit_id_fkey(
            id,
            unit_name
          )
        `,
      )
      .order("inspected_at", {
        ascending: false,
      });

    if (isAdmin) {
      inspections.order("unit_id", { ascending: true });
    }

    const { data, error } = await inspections;

    if (error) throw error;

    setInspections(data ?? []);
  };

  const filteredInspections = useMemo(() => {
    return inspections.filter((inspection) => {
      const matchesSearch =
        searchTerm === "" ||
        inspection.mobility_asset?.plate_number
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        inspection.mobility_asset?.description
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" || inspection.overall_status === statusFilter;

      const matchesUnit =
        selectedUnit === "" || inspection.unit?.id === selectedUnit;

      return matchesSearch && matchesStatus && matchesUnit;
    });
  }, [inspections, searchTerm, statusFilter, selectedUnit]);

  const fetchUnits = async () => {
    const { data, error } = await supabase
      .from("unit")
      .select("*")
      .order("level", { ascending: false })
      .order("unit_name");

    if (error) throw error;

    setUnits(data);
  };

  const totalPages = Math.max(
    1,
    Math.ceil(filteredInspections.length / PAGE_SIZE),
  );

  const paginatedInspections = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;

    return filteredInspections.slice(start, start + PAGE_SIZE);
  }, [filteredInspections, currentPage]);

  const statistics = useMemo(() => {
    return {
      total: inspections.length,

      passed: inspections.filter((i) => i.overall_status === "PASSED").length,

      withDefects: inspections.filter(
        (i) => i.overall_status === "WITH_DEFECTS",
      ).length,

      failed: inspections.filter((i) => i.overall_status === "FAILED").length,
    };
  }, [inspections]);

  const handleConfirmDelete = async (word: string) => {
    if (!selectedId) return;

    setDeleteLoading(true);
    setDeleteError("");

    try {
      if (word !== "DELETE") {
        setDeleteError("Incorrect word.");
        return;
      }

      await handleDelete(selectedId);

      setShowDeleteModal(false);
      setSelectedId(null);
    } catch (err) {
      console.error(err);
      setDeleteError("Unable to delete record.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase
        .from("vehicle_inspection_results")
        .delete()
        .eq("inspection_id", id);

      const { error } = await supabase
        .from("vehicle_inspections")
        .delete()
        .eq("id", id);

      if (error) throw error;

      fetchInspections();

      setSuccess("Successfully deleted!");
    } catch (error) {
      setError("Failed to delete mobility record: " + error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCcw className="h-10 w-10 animate-spin text-blue-600" />

          <p className="text-slate-500">Loading inspections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Left Side: Header Title & Subtitle */}
        <div>
          <p className="flex items-center gap-3 text-2xl font-bold text-slate-900 dark:text-white">
            Mobility Inspections
          </p>
          <p className="mt-1 text-slate-500">
            Manage periodic mobility inspections.
          </p>
        </div>

        {/* Right Side: Search, Filter, and Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 md:justify-end">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search plate or mobility..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border py-3 pl-12 pr-4 border-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="w-full sm:w-[200px] rounded-xl border border-slate-300 px-4 py-3 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            <option value="">All Unit/Station</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.unit_name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border px-4 py-3 border-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            <option value="ALL">All Status</option>
            <option value="PASSED">Passed</option>
            <option value="WITH_DEFECTS">With Defects</option>
            <option value="FAILED">Failed</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={fetchInspections}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 transition hover:bg-slate-100 border-slate-200 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <RefreshCcw className="h-5 w-5" />
            Refresh
          </button>

          {/* New Inspection Button */}
          <button
            onClick={() => {
              setSelectedInspection(null);
              setShowFormModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-white transition hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" />
            New
          </button>
        </div>
      </div>

      {/* Statistics */}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {/* Total */}

        <div className="rounded-2xl border bg-white p-6 shadow-sm border-slate-200 dark:border-slate-800 dark:bg-slate-900">
          <div className="font-medium text-slate-500">Total Inspections</div>

          <div className="mt-3 text-4xl font-bold">{statistics.total}</div>
        </div>

        {/* Passed */}

        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-900">
          <div className="font-medium text-green-700 dark:text-green-400">
            Passed
          </div>

          <div className="mt-3 text-4xl font-bold text-green-700 dark:text-green-400">
            {statistics.passed}
          </div>
        </div>

        {/* With Defects */}

        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6 dark:border-yellow-800 dark:bg-yellow-900/20">
          <div className="font-medium text-yellow-700 dark:text-yellow-400">
            With Defects
          </div>

          <div className="mt-3 text-4xl font-bold text-yellow-700 dark:text-yellow-400">
            {statistics.withDefects}
          </div>
        </div>

        {/* Failed */}

        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900">
          <div className="font-medium text-red-700 dark:text-red-400">
            Failed
          </div>

          <div className="mt-3 text-4xl font-bold text-red-700 dark:text-red-400">
            {statistics.failed}
          </div>
        </div>
      </div>

      {/* Inspection Table */}

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm border-slate-200 dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="px-5 py-4 text-left">Mobility</th>

                <th className="px-5 py-4 text-left">Inspection Date</th>

                <th className="px-5 py-4 text-left">Inspector</th>

                <th className="px-5 py-4 text-left">Supervisor</th>

                <th className="px-5 py-4 text-center">Status</th>

                <th className="px-5 py-4 text-center">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredInspections.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No inspections found.
                  </td>
                </tr>
              )}

              {paginatedInspections.map((inspection, index) => (
                <tr
                  key={inspection.id}
                  className="border-t transition hover:bg-slate-50 border-slate-200 dark:border-slate-800 dark:hover:bg-slate-800"
                >
                  <td className="px-5 py-4">
                    <div className="font-medium">
                      {inspection.mobility_asset?.plate_number}
                    </div>

                    <div className="text-base text-slate-500">
                      {inspection.mobility_asset?.description}
                    </div>

                    <div className="text-base text-slate-500">
                      {inspection.unit?.unit_name}
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    {format(parseISO(inspection.updated_at!), "MMM dd, yyyy")}
                  </td>

                  <td className="px-5 py-4">
                    {inspection.inspected_by ?? "-"}
                  </td>

                  <td className="px-5 py-4">
                    {inspection.supervisor_name ?? "-"}
                  </td>

                  <td className="px-5 py-4 text-center">
                    {inspection.overall_status === "PASSED" && (
                      <span className="rounded-full bg-green-100 px-3 py-1 font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        PASSED
                      </span>
                    )}

                    {inspection.overall_status === "WITH_DEFECTS" && (
                      <span className="rounded-full bg-yellow-100 px-3 py-1 font-semibold text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                        WITH DEFECTS
                      </span>
                    )}

                    {inspection.overall_status === "FAILED" && (
                      <span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        FAILED
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex justify-center gap-2">
                      <div className="group relative inline-block">
                        <button
                          onClick={() => {
                            setSelectedInspection(inspection);
                            setShowViewModal(true);
                          }}
                          className="rounded-lg border p-2 transition hover:bg-slate-100 border-slate-200 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          <Eye className="h-5 w-5" />
                        </button>

                        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 flex-col items-center group-hover:flex">
                          <div className="rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1 font-medium whitespace-nowrap text-slate-100 shadow-md dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900">
                            View Inspection
                          </div>

                          <div className="h-2 w-2 -mt-1 rotate-45 border-r border-b border-slate-800 bg-slate-900 dark:border-slate-200 dark:bg-slate-100" />
                        </div>
                      </div>
                      <div className="group relative inline-block">
                        <button
                          onClick={() => {
                            setSelectedInspection(inspection);
                            setShowFormModal(true);
                          }}
                          className="rounded-lg border border-slate-300 p-2 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          <Edit2 className="h-5 w-5" />
                        </button>

                        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 flex-col items-center group-hover:flex">
                          <div className="rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1 font-medium whitespace-nowrap text-slate-100 shadow-md dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900">
                            Update Inspection
                          </div>

                          <div className="h-2 w-2 -mt-1 rotate-45 border-r border-b border-slate-800 bg-slate-900 dark:border-slate-200 dark:bg-slate-100" />
                        </div>
                      </div>

                      <div className="group relative inline-block">
                        <button
                          onClick={() => {
                            setSelectedId(inspection.id);
                            setError("");
                            setShowDeleteModal(true);
                          }}
                          className="rounded-lg border border-red-300 p-2 text-red-600 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>

                        <div className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 hidden flex-col items-end group-hover:flex">
                          <div className="rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1 font-medium whitespace-nowrap text-slate-100 shadow-md dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900">
                            Delete Inspection
                          </div>

                          <div className="mr-3 h-2 w-2 -mt-1 rotate-45 border-r border-b border-slate-800 bg-slate-900 dark:border-slate-200 dark:bg-slate-100" />
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 flex items-center justify-between p-2 px-4">
            <div className="text-black dark:text-slate-300">
              Showing{" "}
              <strong>
                {filteredInspections.length === 0
                  ? 0
                  : (currentPage - 1) * PAGE_SIZE + 1}
              </strong>{" "}
              to{" "}
              <strong>
                {Math.min(currentPage * PAGE_SIZE, filteredInspections.length)}
              </strong>{" "}
              of <strong>{filteredInspections.length}</strong> records
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border px-4 py-2 disabled:opacity-40"
              >
                Previous
              </button>

              <span className="font-medium">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="rounded-lg border px-4 py-2 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {success && (
        <div className="z-1000 fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm p-4 bg-green-50 dark:bg-green-900 border border-green-500 dark:border-green-900/30 text-green-600 dark:text-green-400 rounded-xl flex items-start gap-3 shadow-2xl transition-all pointer-events-auto">
          {/* Alert Icon */}
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />

          {/* Error Text Message */}
          <div className="flex-1">
            <p className="text-base font-medium">Mobility Inspection</p>
            <p className="text-base opacity-90 mt-0.5">{success}</p>
          </div>

          {/* Manual Dismiss Button */}
          <button
            type="button"
            onClick={() => {
              setSuccess(null);
            }} // Clears the state instantly
            className="p-1 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors shrink-0"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {error && (
        <div className="z-1000 fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm p-4 bg-red-500 dark:bg-red-900 border border-red-100 dark:border-red-900/30 text-white rounded-xl flex items-start gap-3 shadow-2xl transition-all pointer-events-auto">
          {/* Alert Icon */}
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />

          {/* Error Text Message */}
          <div className="flex-1">
            <p className="text-base font-medium">Mobility Inspection</p>
            <p className="text-base opacity-90 mt-0.5">{error}</p>
          </div>

          {/* Manual Dismiss Button */}
          <button
            type="button"
            onClick={() => {
              setError(null);
            }} // Clears the state instantly
            className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 text-white transition-colors shrink-0"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modals */}

      <InspectionFormModal
        open={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setSelectedInspection(null);
        }}
        inspection={selectedInspection}
        onSaved={() => {
          setShowFormModal(false);
          setSelectedInspection(null);
          fetchInspections();
        }}
        setError={setError}
        setSuccess={setSuccess}
      />

      <InspectionViewModal
        open={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedInspection(null);
        }}
        inspection={selectedInspection}
      />

      <ConfirmDeleteModal
        open={showDeleteModal}
        loading={deleteLoading}
        error={deleteError || ""}
        onClose={() => {
          setDeleteLoading(false);
          setDeleteError("");
          setShowDeleteModal(false);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
