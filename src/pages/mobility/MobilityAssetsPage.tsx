import { useEffect, useMemo, useState } from "react";
import { supabase, MobilityAsset, Personnel, Unit } from "../../lib/supabase";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../components/AuthProvider";
import {
  Search,
  RefreshCcw,
  X,
  AlertCircle,
  FileSpreadsheet,
  Car,
  Check,
} from "lucide-react";
import MobilityTable from "./MobilityTable";
import MobilityAssetViewModal from "./MobilityAssetViewModal";
import DriverLicenseModal, {
  DriverLicensePersonnel,
} from "./DriverLicenseModal";

import * as XLSX from "xlsx";

type VehicleForm = {
  plate_number: string;
  vehicle_type: string;
  unit_id: string;

  description: string;
  status: string;

  current_odometer: number;

  year_model: string;

  or_number: string;
  cr_number: string;
  engine_number: string;
  chassis_number: string;

  source: "Organic" | "Loaned" | "Donated";
  date_of_last_registration: string;
  date_registration_expires: string;

  insurance_provider: string;
  insurance_coverage_date: string;

  driver_id: string;
  remarks: string;

  photos: File[];
  //existing_photos: MobilityPhoto[];
};

const emptyForm: VehicleForm = {
  plate_number: "",
  vehicle_type: "",
  unit_id: "",

  description: "",
  status: "Serviceable",

  current_odometer: 0,

  year_model: "",

  or_number: "",
  cr_number: "",
  engine_number: "",
  chassis_number: "",

  source: "Organic",

  date_of_last_registration: "",
  date_registration_expires: "",

  insurance_provider: "",
  insurance_coverage_date: "",

  driver_id: "",
  remarks: "",

  photos: [],
  //existing_photos: [],
};

export default function MobilityAssetsPage() {
  const { isAdmin, unitId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<MobilityAsset[]>([]);
  const [unitList, setUnitList] = useState<Unit[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [unitFilter, setUnitFilter] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // query string from url
  const [searchParams] = useSearchParams();
  const queryString = searchParams.get("filter") ?? "";

  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const [viewAsset, setViewAsset] = useState<MobilityAsset | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const [selectedDriverForLicense, setSelectedDriverForLicense] =
    useState<DriverLicensePersonnel | null>(null);

  const [showDriverLicenseModal, setShowDriverLicenseModal] = useState(false);

  const handleCloseView = () => {
    setIsViewModalOpen(false);
    setViewAsset(null);
  };

  const handleView = (asset: MobilityAsset) => {
    setViewAsset(asset);
    setIsViewModalOpen(true);
  };

  const handleViewDriverLicense = (driver: Personnel | null | undefined) => {
    if (!driver) return;

    setSelectedDriverForLicense({
      id: driver.id,
      rank: driver.rank?.rank_name ?? "",
      fullname: driver.fullname,

      drivers_license_no: driver.drivers_license_no ?? null,

      drivers_license_expiration: driver.drivers_license_expiration ?? null,

      drivers_license_type: driver.drivers_license_type ?? null,

      drivers_license_transmission: driver.drivers_license_transmission ?? null,

      drivers_license_restrictions: driver.drivers_license_restrictions ?? null,

      drivers_license_photo_path: driver.drivers_license_photo_path ?? null,
    });
    setShowDriverLicenseModal(true);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, unitFilter]);

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
    fetchUnits();
  }, []);

  useEffect(() => {
    if (!unitFilter && isAdmin && !queryString) {
      setLoading(false);
      return;
    }
    setCurrentPage(1);

    const loadFilteredData = async () => {
      setLoading(true);

      try {
        await fetchMobility();
      } finally {
        setLoading(false);
      }
    };

    loadFilteredData();
  }, [unitFilter, unitId, isAdmin]);

  const fetchUnits = async () => {
    const { data, error } = await supabase
      .from("unit")
      .select("*")
      .order("level", { ascending: false })
      .order("unit_name", { ascending: true });

    if (!error && data) {
      setUnitList(data);
    }
  };

  const fetchMobility = async () => {
    let query = supabase
      .from("mobility_assets")
      .select(
        `
        *,
        updated_by_personnel:personnel!mobility_assets_updated_by_fkey(
          *,
          rank(*)
        ),
        unit(
          id,
          unit_name
        ),
        driver:personnel!mobility_assets_driver_id_fkey(
          *,
          rank(*)
        ),
        photos: mobility_photos(
          *
        )
      `,
      )
      .order("plate_number");

    if (!queryString) {
      if (!isAdmin && unitId) {
        query = query.eq("unit_id", unitId);
      } else if (unitFilter) {
        query = query.eq("unit_id", unitFilter);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error(error);
      return;
    }

    // Keep the original data
    setVehicles(data);
  };

  const filteredMobilities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return vehicles.filter((vehicle) => {
      // -----------------------------
      // Dashboard / Summary Card Filter
      // -----------------------------
      switch (queryString) {
        case "all": {
          break;
        }
        case "mobile-patrol": {
          if (
            ["Motorcycle", "ATV", "Bike", "Bus", "Boat", "Truck"].some((type) =>
              vehicle.vehicle_type?.includes(type),
            )
          ) {
            return false;
          }

          break;
        }

        case "motorcycle": {
          if (!vehicle.vehicle_type?.includes("Motorcycle")) {
            return false;
          }

          break;
        }

        case "bike": {
          if (!vehicle.vehicle_type?.includes("Bike")) {
            return false;
          }

          break;
        }

        case "atv": {
          if (!vehicle.vehicle_type?.includes("ATV")) {
            return false;
          }

          break;
        }

        case "rescue-boat": {
          if (!vehicle.vehicle_type?.includes("Rescue Boat")) {
            return false;
          }

          break;
        }

        case "truck": {
          if (!vehicle.vehicle_type?.includes("Truck")) {
            return false;
          }

          break;
        }

        default:
          if (
            queryString &&
            queryString !== "All" &&
            vehicle.vehicle_type !== queryString
          ) {
            return false;
          }
      }

      // -----------------------------
      // Search Filter
      // -----------------------------
      if (!q) {
        return true;
      }

      return (
        vehicle.plate_number?.toLowerCase().includes(q) ||
        vehicle.vehicle_type?.toLowerCase().includes(q) ||
        vehicle.description?.toLowerCase().includes(q) ||
        vehicle.status?.toLowerCase().includes(q) ||
        vehicle.year_model?.toLowerCase().includes(q) ||
        vehicle.engine_number?.toLowerCase().includes(q) ||
        vehicle.chassis_number?.toLowerCase().includes(q) ||
        vehicle.or_number?.toLowerCase().includes(q) ||
        vehicle.cr_number?.toLowerCase().includes(q) ||
        vehicle.insurance_provider?.toLowerCase().includes(q) ||
        vehicle.unit?.unit_name?.toLowerCase().includes(q) ||
        vehicle.driver?.fullname?.toLowerCase().includes(q)
      );
    });
  }, [vehicles, queryString, searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredMobilities.length / PAGE_SIZE),
  );

  const paginatedMobilities = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;

    return filteredMobilities.slice(start, start + PAGE_SIZE);
  }, [filteredMobilities, currentPage]);

  return (
    <div className="flex flex-col gap-6 px-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
              <Car className="w-7 h-7" />
            </div>

            <div className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950">
              <Check className="w-3 h-3 text-white" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Mobility Assets
            </h1>

            <p className="mt-0.5 text-slate-500 dark:text-slate-400">
              Manage all mobility assets in your unit/station
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-72 rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {isAdmin && (
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            >
              <option value="">All Units</option>

              {unitList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unit_name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Table */}

      {loading ? (
        <div className="flex h-[70vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCcw className="h-10 w-10 animate-spin text-blue-600" />

            <p className="text-slate-500">Loading mobility assets...</p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="p-4 text-center">Plate Number</th>
                  <th className="p-4 text-center">Mobility</th>
                  <th className="p-4 text-center">Unit/Station</th>
                  <th className="p-4 text-center">Official Driver</th>
                  <th className="p-4 text-center">Odometer Reading</th>
                  <th className="p-4 text-center">Registration Expires</th>
                  <th className="p-4 text-center">Insurance</th>
                  <th className="p-4 text-center">Status</th>
                </tr>
              </thead>

              <MobilityTable
                vehicles={paginatedMobilities}
                handleView={handleView}
                handleViewDriverLicense={handleViewDriverLicense}
                currentPage={currentPage}
                pageSize={PAGE_SIZE}
              />
            </table>

            <div className="mt-6 flex items-center justify-between p-2 px-4">
              <div className="text-black dark:text-slate-300">
                Showing{" "}
                <strong>
                  {filteredMobilities.length === 0
                    ? 0
                    : (currentPage - 1) * PAGE_SIZE + 1}
                </strong>{" "}
                to{" "}
                <strong>
                  {Math.min(currentPage * PAGE_SIZE, filteredMobilities.length)}
                </strong>{" "}
                of <strong>{filteredMobilities.length}</strong> vehicles
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
      )}

      {success && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm p-4 bg-green-50 dark:bg-green-900 border border-green-500 dark:border-green-900/30 text-green-600 dark:text-green-400 rounded-xl flex items-start gap-3 shadow-2xl transition-all pointer-events-auto">
          {/* Alert Icon */}
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />

          {/* Error Text Message */}
          <div className="flex-1">
            <p className="font-medium">Mobility Assets</p>
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
            <p className="font-medium">Mobility Assets</p>
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

      <MobilityAssetViewModal
        asset={viewAsset}
        isOpen={isViewModalOpen}
        onClose={handleCloseView}
      />

      {showDriverLicenseModal && selectedDriverForLicense && (
        <DriverLicenseModal
          personnel={selectedDriverForLicense}
          onClose={() => {
            setShowDriverLicenseModal(false);
            setSelectedDriverForLicense(null);
          }}
        />
      )}
    </div>
  );
}
