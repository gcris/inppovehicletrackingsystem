import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Loader2,
  Printer,
  Search,
  X,
} from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { supabase, MobilityAsset } from "../../lib/supabase";
import { useAuth } from "../../components/AuthProvider";

type InsuranceStatus = "DUE_SOON" | "EXPIRED";

interface InsuranceAsset extends MobilityAsset {
  insuranceStatus: InsuranceStatus;
  daysRemaining: number;
}

/* =========================================================
   DATE HELPERS
========================================================= */

const getDateOnly = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const formatDate = (value: string | null | undefined): string => {
  if (!value) return "-";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

/* =========================================================
   INSURANCE STATUS
========================================================= */

const getInsuranceStatus = (
  expirationDate: string | null | undefined,
): {
  status: InsuranceStatus | null;
  daysRemaining: number;
} => {
  if (!expirationDate) {
    return {
      status: null,
      daysRemaining: 0,
    };
  }

  const today = getDateOnly(new Date());

  const expiration = new Date(`${expirationDate}T00:00:00`);

  if (Number.isNaN(expiration.getTime())) {
    return {
      status: null,
      daysRemaining: 0,
    };
  }

  const expirationOnly = getDateOnly(expiration);

  const difference = expirationOnly.getTime() - today.getTime();

  const daysRemaining = Math.ceil(difference / (1000 * 60 * 60 * 24));

  /*
   * EXPIRED
   *
   * Today or earlier.
   */
  if (daysRemaining <= 0) {
    return {
      status: "EXPIRED",
      daysRemaining,
    };
  }

  /*
   * DUE SOON
   *
   * Within the next 30 days.
   */
  if (daysRemaining <= 30) {
    return {
      status: "DUE_SOON",
      daysRemaining,
    };
  }

  /*
   * More than 30 days remaining.
   */
  return {
    status: null,
    daysRemaining,
  };
};

/* =========================================================
   DISPLAY HELPERS
========================================================= */

const formatDaysText = (daysRemaining: number) => {
  if (daysRemaining < 0) {
    const days = Math.abs(daysRemaining);

    return `${days} day${days === 1 ? "" : "s"} overdue`;
  }

  if (daysRemaining === 0) {
    return "Expires today";
  }

  if (daysRemaining === 1) {
    return "Expires tomorrow";
  }

  return `${daysRemaining} days remaining`;
};

const getStatusLabel = (status: InsuranceStatus) => {
  if (status === "EXPIRED") {
    return "Expired";
  }

  return "Due Soon";
};

const getStatusClasses = (status: InsuranceStatus) => {
  if (status === "EXPIRED") {
    return {
      badge: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
      icon: "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400",
    };
  }

  return {
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    icon: "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
  };
};

const getVehicleTypeLabel = (vehicleType: string | null | undefined) => {
  if (!vehicleType) return "-";

  return vehicleType;
};

/* =========================================================
   PAGE
========================================================= */

export default function InsuranceStatusPage() {
  const [vehicles, setVehicles] = useState<MobilityAsset[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  /* SEARCH */

  const [searchTerm, setSearchTerm] = useState("");

  /* STATUS */

  const [statusFilter, setStatusFilter] = useState<"ALL" | InsuranceStatus>(
    "ALL",
  );

  /* SELECTED VEHICLE */

  const [selectedVehicle, setSelectedVehicle] = useState<InsuranceAsset | null>(
    null,
  );

  /* PRINT */

  const printRef = useRef<HTMLDivElement>(null);

  const { isAdmin, unitId } = useAuth();

  const handlePrintReport = useReactToPrint({
    contentRef: printRef,
    documentTitle: "Mobility Insurance Status Report",
  });

  /* =======================================================
     LOAD MOBILITY ASSETS
  ======================================================= */

  useEffect(() => {
    const loadVehicles = async () => {
      try {
        setLoading(true);
        setError(null);

        let query = supabase
          .from("mobility_assets")
          .select(
            `
              *,
              unit:unit_id(*)
            `,
          )
          .order("plate_number", {
            ascending: true,
          });

        /*
         * Admin:
         *   Load all mobility assets.
         *
         * Non-admin:
         *   Only load assets belonging
         *   to the user's unit.
         */
        if (!isAdmin && unitId) {
          query = query.eq("unit_id", unitId);
        }

        const { data, error: queryError } = await query;

        if (queryError) {
          throw queryError;
        }

        setVehicles((data ?? []) as MobilityAsset[]);
      } catch (err) {
        console.error("Error loading mobility assets:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load mobility assets.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadVehicles();
  }, [isAdmin, unitId]);

  /* =======================================================
     ADD INSURANCE STATUS
  ======================================================= */

  const insuranceVehicles = useMemo<InsuranceAsset[]>(() => {
    return vehicles
      .map((vehicle) => {
        const { status, daysRemaining } = getInsuranceStatus(
          vehicle.insurance_coverage_date,
        );

        /*
         * Only include:
         *
         * - Due Soon
         * - Expired
         */
        if (!status) {
          return null;
        }

        return {
          ...vehicle,
          insuranceStatus: status,
          daysRemaining,
        };
      })
      .filter((vehicle): vehicle is InsuranceAsset => vehicle !== null);
  }, [vehicles]);

  /* =======================================================
     SUMMARY COUNTS
  ======================================================= */

  const dueSoonCount = useMemo(() => {
    return insuranceVehicles.filter(
      (vehicle) => vehicle.insuranceStatus === "DUE_SOON",
    ).length;
  }, [insuranceVehicles]);

  const expiredCount = useMemo(() => {
    return insuranceVehicles.filter(
      (vehicle) => vehicle.insuranceStatus === "EXPIRED",
    ).length;
  }, [insuranceVehicles]);

  const totalCount = dueSoonCount + expiredCount;

  /* =======================================================
     SEARCH + STATUS FILTER
  ======================================================= */

  const filteredVehicles = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return insuranceVehicles.filter((vehicle) => {
      /* STATUS */

      if (statusFilter !== "ALL" && vehicle.insuranceStatus !== statusFilter) {
        return false;
      }

      /* SEARCH */

      if (!search) {
        return true;
      }

      const searchableText = [
        vehicle.plate_number,
        vehicle.vehicle_type,
        vehicle.description,
        vehicle.or_number,
        vehicle.cr_number,
        vehicle.engine_number,
        vehicle.chassis_number,
        vehicle.source,
        vehicle.status,
        vehicle.insurance_provider,

        (vehicle as any)?.unit?.name,
        (vehicle as any)?.unit?.unit_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(search);
    });
  }, [insuranceVehicles, searchTerm, statusFilter]);

  /* =======================================================
     CLEAR
  ======================================================= */

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
  };

  const hasActiveFilters = searchTerm !== "" || statusFilter !== "ALL";

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 md:p-6">
      {/* ===================================================
          PAGE HEADER
      =================================================== */}

      <div className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Left Side: Header Text */}
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Mobility Insurance Status
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Mobility assets due for insurance renewal or with expired
              insurance.
            </p>
          </div>

          {/* Right Side: Button */}
          <button
            type="button"
            onClick={handlePrintReport}
            disabled={filteredVehicles.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Printer size={17} />
            Print
          </button>
        </div>
      </div>

      {/* ===================================================
          SUMMARY CARDS
      =================================================== */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* TOTAL */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-500 dark:text-slate-400">
                Total
              </p>

              <p className="mt-1 text-4xl font-bold text-slate-900 dark:text-white">
                {totalCount}
              </p>
            </div>
          </div>
        </div>

        {/* DUE SOON */}

        <button
          type="button"
          onClick={() => setStatusFilter("DUE_SOON")}
          className={`rounded-2xl border p-5 text-left shadow-sm transition hover:shadow-md ${
            statusFilter === "DUE_SOON"
              ? "border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20"
              : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-500 dark:text-slate-400">
                Due Soon
              </p>

              <p className="mt-1 text-4xl font-bold text-amber-600 dark:text-amber-400">
                {dueSoonCount}
              </p>
            </div>
          </div>
        </button>

        {/* EXPIRED */}

        <button
          type="button"
          onClick={() => setStatusFilter("EXPIRED")}
          className={`rounded-2xl border p-5 text-left shadow-sm transition hover:shadow-md ${
            statusFilter === "EXPIRED"
              ? "border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950/20"
              : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-500 dark:text-slate-400">
                Expired
              </p>

              <p className="mt-1 text-4xl font-bold text-red-600 dark:text-red-400">
                {expiredCount}
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* ===================================================
          SEARCH + STATUS
      =================================================== */}

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {/* SEARCH */}

          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search plate number, vehicle type, insurance provider..."
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
            />
          </div>

          {/* STATUS */}

          <div className="w-full lg:w-48">
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "ALL" | InsuranceStatus)
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="ALL">All Status</option>

              <option value="DUE_SOON">Due Soon</option>

              <option value="EXPIRED">Expired</option>
            </select>
          </div>

          {/* CLEAR */}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <X size={16} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ===================================================
          RESULTS
      =================================================== */}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {/* HEADER */}

        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Mobility Insurance
            </h2>

            <p className="text-slate-500 dark:text-slate-400">
              Showing {filteredVehicles.length} of {insuranceVehicles.length}{" "}
              assets
            </p>
          </div>
        </div>

        {/* =================================================
            LOADING
        ================================================= */}

        {loading && (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={30} className="animate-spin text-sky-600" />

              <p className="text-slate-500 dark:text-slate-400">
                Loading mobility assets...
              </p>
            </div>
          </div>
        )}

        {/* =================================================
            ERROR
        ================================================= */}

        {!loading && error && (
          <div className="flex min-h-[300px] items-center justify-center p-6">
            <div className="max-w-md text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                <AlertTriangle size={22} />
              </div>

              <h3 className="font-semibold text-slate-900 dark:text-white">
                Unable to load insurance data
              </h3>

              <p className="mt-1 text-slate-500 dark:text-slate-400">{error}</p>
            </div>
          </div>
        )}

        {/* =================================================
            EMPTY
        ================================================= */}

        {!loading && !error && filteredVehicles.length === 0 && (
          <div className="flex min-h-[350px] items-center justify-center p-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <CheckCircle2 size={28} />
              </div>

              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                No insurance records found
              </h3>

              <p className="mt-1 text-slate-500 dark:text-slate-400">
                There are no mobility assets matching the current filters.
              </p>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 rounded-xl bg-sky-600 px-4 py-2 font-medium text-white transition hover:bg-sky-700"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* =================================================
            TABLE
        ================================================= */}

        {!loading && !error && filteredVehicles.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/70">
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400">
                    Plate Number
                  </th>

                  <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400">
                    Mobility
                  </th>

                  <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400">
                    Unit/Station
                  </th>

                  <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400">
                    Insurance Provider
                  </th>

                  <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400">
                    Insurance Expires
                  </th>

                  <th className="px-5 py-3 font-semibold text-slate-500 dark:text-slate-400">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredVehicles.map((vehicle) => {
                  const classes = getStatusClasses(vehicle.insuranceStatus);

                  return (
                    <tr
                      key={vehicle.id}
                      className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      {/* PLATE */}

                      <td className="px-5 py-4">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {vehicle.plate_number || "-"}
                        </span>
                      </td>

                      {/* VEHICLE */}

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900 dark:text-white">
                              {getVehicleTypeLabel(vehicle.vehicle_type)}
                            </p>

                            <p className="truncate text-slate-500 dark:text-slate-400">
                              {vehicle.description || "No description"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* UNIT */}

                      <td className="px-5 py-4">
                        <span className="text-slate-600 dark:text-slate-300">
                          {(vehicle as any)?.unit?.name ||
                            (vehicle as any)?.unit?.unit_name ||
                            "-"}
                        </span>
                      </td>

                      {/* PROVIDER */}

                      <td className="px-5 py-4">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {vehicle.insurance_provider || "-"}
                        </span>
                      </td>

                      {/* EXPIRATION */}

                      <td className="px-5 py-4">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">
                            {formatDate(vehicle.insurance_coverage_date)}
                          </p>

                          <p
                            className={`mt-0.5 ${
                              vehicle.insuranceStatus === "EXPIRED"
                                ? "text-red-600 dark:text-red-400"
                                : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {formatDaysText(vehicle.daysRemaining)}
                          </p>
                        </div>
                      </td>

                      {/* STATUS */}

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold ${classes.badge}`}
                        >
                          {vehicle.insuranceStatus === "EXPIRED" ? (
                            <AlertTriangle size={13} />
                          ) : (
                            <Clock3 size={13} />
                          )}

                          {getStatusLabel(vehicle.insuranceStatus)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===================================================
          PRINTABLE REPORT
      =================================================== */}

      <div
        ref={printRef}
        id="insurance-print-report"
        className="fixed left-[-99999px] top-0 w-[210mm] bg-white text-black"
      >
        <div className="p-8 text-black">
          {/* REPORT HEADER */}

          <div className="mb-6 border-b-2 border-black pb-4">
            <h1 className="text-2xl font-bold">
              MOBILITY INSURANCE STATUS REPORT
            </h1>

            <p className="mt-1 text-sm">
              Mobility assets due for insurance renewal or with expired
              insurance.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-semibold">Generated:</span>{" "}
                {new Date().toLocaleString("en-PH", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </div>
            </div>
          </div>

          {/* SUMMARY */}

          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded border border-gray-300 p-3">
              <p className="font-semibold uppercase">Total</p>

              <p className="mt-1 text-xl font-bold">{totalCount}</p>
            </div>

            <div className="rounded border border-gray-300 p-3">
              <p className="font-semibold uppercase">Due Soon</p>

              <p className="mt-1 text-xl font-bold">{dueSoonCount}</p>
            </div>

            <div className="rounded border border-gray-300 p-3">
              <p className="font-semibold uppercase">Expired</p>

              <p className="mt-1 text-xl font-bold">{expiredCount}</p>
            </div>
          </div>

          {/* REPORT TABLE */}

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-black px-3 py-2 text-left">#</th>

                <th className="border border-black px-3 py-2 text-left">
                  Plate Number
                </th>

                <th className="border border-black px-3 py-2 text-left">
                  Mobility
                </th>

                <th className="border border-black px-3 py-2 text-left">
                  Unit/Station
                </th>

                <th className="border border-black px-3 py-2 text-left">
                  Insurance Provider
                </th>

                <th className="border border-black px-3 py-2 text-left">
                  Insurance Expires
                </th>

                <th className="border border-black px-3 py-2 text-left">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredVehicles.map((vehicle, index) => (
                <tr key={vehicle.id}>
                  <td className="border border-black px-3 py-2">{index + 1}</td>

                  <td className="border border-black px-3 py-2 font-semibold">
                    {vehicle.plate_number || "-"}
                  </td>

                  <td className="border border-black px-3 py-2">
                    <div className="font-semibold">
                      {vehicle.vehicle_type || "-"}
                    </div>

                    {vehicle.description && (
                      <div className="text-xs">{vehicle.description}</div>
                    )}
                  </td>

                  <td className="border border-black px-3 py-2">
                    {(vehicle as any)?.unit?.name ||
                      (vehicle as any)?.unit?.unit_name ||
                      "-"}
                  </td>

                  <td className="border border-black px-3 py-2">
                    {vehicle.insurance_provider || "-"}
                  </td>

                  <td className="border border-black px-3 py-2">
                    <div>{formatDate(vehicle.insurance_coverage_date)}</div>

                    <div className="text-xs">
                      {formatDaysText(vehicle.daysRemaining)}
                    </div>
                  </td>

                  <td className="border border-black px-3 py-2 font-semibold">
                    {getStatusLabel(vehicle.insuranceStatus)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* FOOTER */}

          <div className="mt-8 border-t border-black pt-4 text-xs">
            <p>
              This report was generated from the Mobility Asset Management
              System.
            </p>

            <p className="mt-1">
              Total records displayed: {filteredVehicles.length}
            </p>
          </div>
        </div>
      </div>
      <style>
        {`
            @media print {
            body {
                background: white !important;
            }

            body * {
                visibility: hidden;
            }

            #insurance-print-report,
            #insurance-print-report * {
                visibility: visible;
            }

            #insurance-print-report {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                background: white;
                color: black;
            }
            }
        `}
      </style>
    </div>
  );
}
