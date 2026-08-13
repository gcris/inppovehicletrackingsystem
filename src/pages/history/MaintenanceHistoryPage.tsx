import React, { useEffect, useMemo, useState } from "react";
import { supabase, Unit } from "../../lib/supabase";
import { useAuth } from "../../components/AuthProvider";
import MaintenanceHistoryFormModal from "./MaintenanceHistoryFormModal";

import type {
  MaintenanceHistory,
  MobilityAsset,
  MaintenanceType,
} from "../../lib/supabase";

import {
  Plus,
  Edit2,
  Trash2,
  RefreshCcw,
  Search,
  X,
  AlertCircle,
  Image,
} from "lucide-react";

import { useRef } from "react";
import MaintenanceHistoryTable from "./MaintenanceHistoryTable";
import ConfirmDeleteModal from "../../helper/ConfirmDeleteModal";

export default function MaintenanceHistoryPage() {
  const { isAdmin, unitId } = useAuth();

  const [loading, setLoading] = useState(true);

  const [maintenanceHistory, setMaintenanceHistory] = useState<
    MaintenanceHistory[]
  >([]);

  const [mobilityAssets, setMobilityAssets] = useState<MobilityAsset[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [maintenanceTypes, setMaintenanceTypes] = useState<MaintenanceType[]>(
    [],
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedMaintenanceType, setSelectedMaintenanceType] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRecord, setSelectedRecord] =
    useState<MaintenanceHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const PAGE_SIZE = 10;

  const [currentPage, setCurrentPage] = useState(1);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  useEffect(() => {
    setCurrentPage(1);
    loadData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedUnit, selectedVehicle, selectedMaintenanceType]);

  const loadData = async () => {
    setLoading(true);

    try {
      if (isAdmin) {
        await fetchUnits();
      }

      await Promise.all([
        fetchMaintenanceHistory(),
        fetchMobilityAssets(),
        fetchMaintenanceTypes(),
      ]);
    } catch (error) {
      console.error("Failed loading maintenance data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnits = async () => {
    const { data, error } = await supabase
      .from("unit")
      .select("*")
      .order("level", { ascending: false })
      .order("unit_name");

    if (error) throw error;

    setUnits(data);
  };

  const fetchMaintenanceHistory = async () => {
    let query = supabase.from("mobility_assets_maintenance_history").select(`
        *,
        mobility_asset:mobility_asset_id(
            *,
            unit:unit_id(*),
            personnel:driver_id(
                *,
                rank(*)
            )
        ),

        personnel:changed_by(
            *,
            rank(*)
        ),

        items:mobility_assets_maintenance_history_items(
            id,
            maintenance_type_id,

            maintenance_type:maintenance_type_id(
                id,
                name,
                description
            )
        )
    `);

    if (!isAdmin && unitId) {
      query = query.eq("mobility_asset.unit_id", unitId);
    }

    const { data, error } = await query.order("changed_at", {
      ascending: false,
    });

    if (error) throw error;

    setMaintenanceHistory(data ?? []);
  };

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
      const { data, error } = await supabase
        .from("mobility_assets_maintenance_history")
        .delete()
        .eq("id", id)
        .select("proof_photo_url") // 👈 Request the column you need
        .single();

      if (error) throw error;

      if (data.proof_photo_url) {
        await supabase.storage
          .from("pms-proofs")
          .remove([data.proof_photo_url]);
      }

      await fetchMaintenanceHistory();
      setSuccess("Successfully deleted.");
    } catch (error) {
      setError("Delete PMS History error:" + error);
    }
  };

  const fetchMobilityAssets = async () => {
    let query = supabase
      .from("mobility_assets")
      .select(
        `
      *,
      unit:unit_id(*),
      personnel:driver_id(
        *,
        rank(*)
      )
    `,
      )
      .order("plate_number", {
        ascending: true,
      });

    if (!isAdmin && unitId) {
      query = query.eq("unit_id", unitId);
    }

    const { data, error } = await query;

    if (error) throw error;

    setMobilityAssets(data ?? []);
  };

  const fetchMaintenanceTypes = async () => {
    const { data, error } = await supabase
      .from("maintenance_types")
      .select("*")
      .order("name", {
        ascending: true,
      });

    if (error) throw error;

    setMaintenanceTypes(data ?? []);
  };

  const filteredVehicles = selectedUnit
    ? mobilityAssets.filter((asset) =>
        isAdmin ? asset.unit_id === selectedUnit : asset.unit_id === unitId,
      )
    : mobilityAssets;

  const filteredHistory = useMemo(() => {
    return maintenanceHistory.filter((item) => {
      const search = searchTerm.toLowerCase();

      const matchesSearch =
        searchTerm === "" ||
        item.mobility_asset?.plate_number?.toLowerCase().includes(search) ||
        item.personnel?.fullname?.toLowerCase().includes(search) ||
        item.items?.some((historyItem) =>
          historyItem.maintenance_type?.name?.toLowerCase().includes(search),
        );

      const matchesVehicle =
        selectedVehicle === "" || item.mobility_asset_id === selectedVehicle;

      const matchesMaintenanceType =
        selectedMaintenanceType === "" ||
        item.items?.some(
          (historyItem) =>
            historyItem.maintenance_type_id === selectedMaintenanceType,
        );

      return matchesSearch && matchesVehicle && matchesMaintenanceType;
    });
  }, [
    maintenanceHistory,
    searchTerm,
    selectedVehicle,
    selectedMaintenanceType,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));

  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;

    return filteredHistory.slice(start, start + PAGE_SIZE);
  }, [filteredHistory, currentPage]);

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCcw className="h-10 w-10 animate-spin text-blue-600" />

          <p className="text-slate-500 dark:text-slate-400">
            Loading PMS History...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            PMS History
          </h1>

          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Manage all maintenance records of mobility assets.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
          >
            <RefreshCcw className="h-5 w-5" />
            Refresh
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" />
            Add
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        {/* Changed justify-end to justify-between */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Left side: Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-300 py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          {/* Right side: Dropdowns group */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            {/* Unit Select Dropdown */}
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

            {/* Vehicle Select Dropdown */}
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              className="w-full sm:w-[200px] rounded-xl border border-slate-300 px-4 py-3 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="">All Mobility</option>
              {filteredVehicles.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.plate_number} - {asset.description}
                </option>
              ))}
            </select>

            {/* Maintenance Type Select Dropdown */}
            <select
              value={selectedMaintenanceType}
              onChange={(e) => setSelectedMaintenanceType(e.target.value)}
              className="w-full sm:w-[250px] rounded-xl border border-slate-300 px-4 py-3 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="">All PMS Catalog</option>
              {maintenanceTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div ref={parentRef} className="max-h-[700px] overflow-auto">
          <table className="min-w-full">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="px-5 py-4 text-left font-semibold">No.</th>
                <th className="px-5 py-4 text-left font-semibold">
                  Date/Time Entry
                </th>

                <th className="px-5 py-4 text-left font-semibold">Mobility</th>

                <th className="px-5 py-4 text-left font-semibold">Catalog</th>

                <th className="px-5 py-4 text-left font-semibold">
                  Last Service
                </th>

                <th className="px-5 py-4 text-left font-semibold">
                  Service Center/Shop
                </th>

                <th className="px-5 py-4 text-left font-semibold">
                  Next Service
                </th>

                <th className="px-5 py-4 text-left font-semibold">
                  Updated By
                </th>

                <th className="px-5 py-4 text-center font-semibold">Actions</th>
              </tr>
            </thead>

            <MaintenanceHistoryTable
              history={filteredHistory}
              onEdit={(history) => {
                setSelectedRecord(history);
                setShowEditModal(true);
              }}
              onDelete={(id) => {
                setSelectedId(id);
                setError("");
                setShowDeleteModal(true);
              }}
              currentPage={currentPage}
              pageSize={PAGE_SIZE}
            />
          </table>
          <div className="mt-6 flex items-center justify-between p-2 px-4">
            <div className="text-black dark:text-slate-300">
              Showing{" "}
              <strong>
                {paginatedHistory.length === 0
                  ? 0
                  : (currentPage - 1) * PAGE_SIZE + 1}
              </strong>{" "}
              to{" "}
              <strong>
                {Math.min(currentPage * PAGE_SIZE, filteredHistory.length)}
              </strong>{" "}
              of <strong>{filteredHistory.length}</strong> records
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

      {/* Add Modal */}
      {showAddModal && (
        <MaintenanceHistoryFormModal
          mode="add"
          mobilityAssets={mobilityAssets}
          maintenanceTypes={maintenanceTypes}
          setError={setError}
          setSuccess={setSuccess}
          onClose={() => setShowAddModal(false)}
          onSaved={async () => {
            setShowAddModal(false);
            await fetchMaintenanceHistory();
          }}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && selectedRecord && (
        <MaintenanceHistoryFormModal
          mode="edit"
          record={selectedRecord}
          mobilityAssets={mobilityAssets}
          maintenanceTypes={maintenanceTypes}
          setError={setError}
          setSuccess={setSuccess}
          onClose={() => {
            setShowEditModal(false);
            setSelectedRecord(null);
          }}
          onSaved={async () => {
            setShowEditModal(false);
            setSelectedRecord(null);
            await fetchMaintenanceHistory();
          }}
        />
      )}

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

      {success && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm p-4 bg-green-50 dark:bg-green-900 border border-green-500 dark:border-green-900/30 text-green-600 dark:text-green-400 rounded-xl flex items-start gap-3 shadow-2xl transition-all pointer-events-auto">
          {/* Alert Icon */}
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />

          {/* Error Text Message */}
          <div className="flex-1">
            <p className="font-medium">PMS History</p>
            <p className="opacity-90 mt-0.5">{success}</p>
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
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm p-4 bg-red-500 dark:bg-red-900 border border-red-100 dark:border-red-900/30 text-white rounded-xl flex items-start gap-3 shadow-2xl transition-all pointer-events-auto">
          {/* Alert Icon */}
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />

          {/* Error Text Message */}
          <div className="flex-1">
            <p className="font-medium">PMS History</p>
            <p className="opacity-90 mt-0.5">{error}</p>
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
    </div>
  );
}
