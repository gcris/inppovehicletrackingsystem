import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Eye,
  FileBadge2,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Personnel, supabase } from "../../lib/supabase";
import DriverLicenseModal, {
  DriverLicensePersonnel,
} from "../mobility/DriverLicenseModal";
import { resolve } from "path";

interface Rank {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  name: string;
}

type LicenseStatus = "VALID" | "EXPIRING_SOON" | "EXPIRED";

interface PersonnelWithStatus extends Personnel {
  licenseStatus: LicenseStatus;
  daysRemaining: number;
}

function getSingleRelation<T>(relation: T | T[] | null | undefined): T | null {
  if (!relation) return null;

  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getDaysRemaining(expirationDate: string) {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const expiration = new Date(expirationDate);
  expiration.setHours(0, 0, 0, 0);

  const difference = expiration.getTime() - today.getTime();

  return Math.ceil(difference / (1000 * 60 * 60 * 24));
}

function getLicenseStatus(expirationDate: string): LicenseStatus {
  const daysRemaining = getDaysRemaining(expirationDate);

  if (daysRemaining < 0) {
    return "EXPIRED";
  }

  if (daysRemaining <= 30) {
    return "EXPIRING_SOON";
  }

  return "VALID";
}

function getStatusLabel(status: LicenseStatus) {
  switch (status) {
    case "VALID":
      return "Valid";

    case "EXPIRING_SOON":
      return "Expiring Soon";

    case "EXPIRED":
      return "Expired";
  }
}

function getStatusDescription(status: LicenseStatus, daysRemaining: number) {
  if (status === "EXPIRED") {
    const days = Math.abs(daysRemaining);

    return `${days} ${days === 1 ? "day" : "days"} expired`;
  }

  if (status === "EXPIRING_SOON") {
    return `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} remaining`;
  }

  return `${daysRemaining} days remaining`;
}

function StatusBadge({
  status,
  daysRemaining,
}: {
  status: LicenseStatus;
  daysRemaining: number;
}) {
  if (status === "VALID") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />

        <div>
          <div>{getStatusLabel(status)}</div>
          <div className="text-[10px] font-medium opacity-80">
            {getStatusDescription(status, daysRemaining)}
          </div>
        </div>
      </div>
    );
  }

  if (status === "EXPIRING_SOON") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
        <Clock3 className="h-3.5 w-3.5" />

        <div>
          <div>{getStatusLabel(status)}</div>
          <div className="text-[10px] font-medium opacity-80">
            {getStatusDescription(status, daysRemaining)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-400">
      <XCircle className="h-3.5 w-3.5" />

      <div>
        <div>{getStatusLabel(status)}</div>
        <div className="text-[10px] font-medium opacity-80">
          {getStatusDescription(status, daysRemaining)}
        </div>
      </div>
    </div>
  );
}

export default function DriverLicensePersonnelPage() {
  const [personnel, setPersonnel] = useState<PersonnelWithStatus[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState<"ALL" | LicenseStatus>(
    "ALL",
  );

  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(
    null,
  );

  const loadPersonnel = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const { data, error: queryError } = await supabase
        .from("personnel")
        .select(
          ` 
            *,
            rank:rank_id (
              id,
              name
            ),

            unit:unit_id (
              id,
              name
            )
          `,
        )
        .not("drivers_license_no", "is", null)
        .neq("drivers_license_no", "")
        .order("fullname", {
          ascending: true,
        });

      if (queryError) {
        throw queryError;
      }

      const processed: PersonnelWithStatus[] = (data ?? [])
        .filter(
          (person: Personnel) =>
            person.drivers_license_no &&
            person.drivers_license_no.trim() !== "",
        )
        .map((person: Personnel) => {
          const expirationDate = person.drivers_license_expiration;

          let licenseStatus: LicenseStatus = "VALID";

          let daysRemaining = 0;

          if (expirationDate) {
            daysRemaining = getDaysRemaining(expirationDate);

            licenseStatus = getLicenseStatus(expirationDate);
          }

          return {
            ...person,
            licenseStatus,
            daysRemaining,
          };
        });

      setPersonnel(processed);
    } catch (err) {
      console.error("Error loading driver's license personnel:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load driver's license personnel.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPersonnel();
  }, []);

  const statistics = useMemo(() => {
    const total = personnel.length;

    const valid = personnel.filter(
      (person) => person.licenseStatus === "VALID",
    ).length;

    const expiringSoon = personnel.filter(
      (person) => person.licenseStatus === "EXPIRING_SOON",
    ).length;

    const expired = personnel.filter(
      (person) => person.licenseStatus === "EXPIRED",
    ).length;

    return {
      total,
      valid,
      expiringSoon,
      expired,
    };
  }, [personnel]);

  const filteredPersonnel = useMemo(() => {
    const query = search.trim().toLowerCase();

    return personnel.filter((person) => {
      const rank = getSingleRelation(person.rank);

      const unit = getSingleRelation(person.unit);

      const fullName = person.fullname;

      const licenseNumber = person.drivers_license_no?.toLowerCase() ?? "";

      const rankName = rank?.rank_name?.toLowerCase() ?? "";

      const unitName = unit?.unit_name?.toLowerCase() ?? "";

      const matchesSearch =
        !query ||
        fullName.includes(query) ||
        licenseNumber.includes(query) ||
        rankName.includes(query) ||
        unitName.includes(query);

      const matchesStatus =
        statusFilter === "ALL" || person.licenseStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [personnel, search, statusFilter]);

  const handleViewLicense = (person: PersonnelWithStatus) => {
    setSelectedPersonnel(person);
  };

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px]">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
                <FileBadge2 className="h-5 w-5" />
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Driver’s License Personnel
                </h1>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Personnel with registered driver’s license information
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadPersonnel(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        {/* Statistics */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* Total */}
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900 ${
              statusFilter === "ALL"
                ? "border-blue-500 ring-2 ring-blue-500/20 dark:border-blue-500"
                : "border-slate-200 dark:border-slate-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Total Licensed
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                  {statistics.total}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
          </button>

          {/* Valid */}
          <button
            type="button"
            onClick={() => setStatusFilter("VALID")}
            className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900 ${
              statusFilter === "VALID"
                ? "border-emerald-500 ring-2 ring-emerald-500/20 dark:border-emerald-500"
                : "border-slate-200 dark:border-slate-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Valid
                </p>

                <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {statistics.valid}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
          </button>

          {/* Expiring */}
          <button
            type="button"
            onClick={() => setStatusFilter("EXPIRING_SOON")}
            className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900 ${
              statusFilter === "EXPIRING_SOON"
                ? "border-amber-500 ring-2 ring-amber-500/20 dark:border-amber-500"
                : "border-slate-200 dark:border-slate-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Expiring Soon
                </p>

                <p className="mt-2 text-3xl font-bold text-amber-600 dark:text-amber-400">
                  {statistics.expiringSoon}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                <Clock3 className="h-5 w-5" />
              </div>
            </div>
          </button>

          {/* Expired */}
          <button
            type="button"
            onClick={() => setStatusFilter("EXPIRED")}
            className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900 ${
              statusFilter === "EXPIRED"
                ? "border-red-500 ring-2 ring-red-500/20 dark:border-red-500"
                : "border-slate-200 dark:border-slate-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Expired
                </p>

                <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">
                  {statistics.expired}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
                <XCircle className="h-5 w-5" />
              </div>
            </div>
          </button>
        </div>

        {/* Main Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {/* Toolbar */}
          <div className="border-b border-slate-200 p-4 dark:border-slate-800">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              {/* Search */}
              <div className="relative w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, license no., rank or unit..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                />
              </div>

              {/* Filter */}
              <div className="flex items-center gap-2">
                <span className="hidden text-sm font-medium text-slate-500 sm:block dark:text-slate-400">
                  Status:
                </span>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as "ALL" | LicenseStatus)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:w-auto"
                >
                  <option value="ALL">All</option>

                  <option value="VALID">Valid</option>

                  <option value="EXPIRING_SOON">Expiring Soon</option>

                  <option value="EXPIRED">Expired</option>
                </select>
              </div>
            </div>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="flex min-h-[400px] items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />

                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Loading licensed personnel...
                </p>
              </div>
            </div>
          ) : error ? (
            /* Error */
            <div className="flex min-h-[400px] items-center justify-center p-6">
              <div className="max-w-md text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
                  <AlertCircle className="h-6 w-6" />
                </div>

                <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
                  Unable to load personnel
                </h3>

                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {error}
                </p>

                <button
                  type="button"
                  onClick={() => loadPersonnel()}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </button>
              </div>
            </div>
          ) : filteredPersonnel.length === 0 ? (
            /* Empty */
            <div className="flex min-h-[400px] items-center justify-center p-6">
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                  <FileBadge2 className="h-7 w-7" />
                </div>

                <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
                  No licensed personnel found
                </h3>

                <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                  {search || statusFilter !== "ALL"
                    ? "No personnel match your current search or filter."
                    : "There are currently no personnel with registered driver's license information."}
                </p>

                {(search || statusFilter !== "ALL") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("ALL");
                    }}
                    className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[1050px] text-left">
                  <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Personnel
                      </th>

                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Rank
                      </th>

                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Unit
                      </th>

                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        License No.
                      </th>

                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Date Issued
                      </th>

                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Expiration
                      </th>

                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Status
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredPersonnel.map((person) => {
                      const rank = getSingleRelation(person.rank);

                      const unit = getSingleRelation(person.unit);

                      return (
                        <tr
                          key={person.id}
                          className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        >
                          {/* Personnel */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                                {person.fullname?.charAt(0)}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900 dark:text-white">
                                  {person.fullname}
                                </p>

                                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                  Personnel ID: {person.id}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Rank */}
                          <td className="px-5 py-4">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {rank?.rank_name ?? "—"}
                            </span>
                          </td>

                          {/* Unit */}
                          <td className="px-5 py-4">
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {unit?.unit_name ?? "—"}
                            </span>
                          </td>

                          {/* License */}
                          <td className="px-5 py-4">
                            <span className="font-mono text-sm font-medium text-slate-700 dark:text-slate-300">
                              {person.drivers_license_no ?? "—"}
                            </span>
                          </td>

                          {/* Issued */}
                          <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-400">
                            {formatDate(person.drivers_license_expiration)}
                          </td>

                          {/* Expiration */}
                          <td className="px-5 py-4">
                            <div>
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {formatDate(person.drivers_license_expiration)}
                              </p>

                              {person.drivers_license_expiration && (
                                <p
                                  className={`mt-0.5 text-xs ${
                                    person.licenseStatus === "EXPIRED"
                                      ? "text-red-500"
                                      : person.licenseStatus === "EXPIRING_SOON"
                                        ? "text-amber-500"
                                        : "text-slate-400"
                                  }`}
                                >
                                  {getStatusDescription(
                                    person.licenseStatus,
                                    person.daysRemaining,
                                  )}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4">
                            <StatusBadge
                              status={person.licenseStatus}
                              daysRemaining={person.daysRemaining}
                            />
                          </td>

                          {/* Action */}
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleViewLicense(person)}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-400"
                            >
                              <Eye className="h-4 w-4" />
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="space-y-3 p-4 md:hidden">
                {filteredPersonnel.map((person) => {
                  const rank = getSingleRelation(person.rank);

                  const unit = getSingleRelation(person.unit);

                  return (
                    <div
                      key={person.id}
                      className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900 dark:text-white">
                              {person.fullname}
                            </p>

                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {rank?.rank_name ?? "No Rank"}
                              {" • "}
                              {unit?.unit_name ?? "No Unit"}
                            </p>
                          </div>
                        </div>

                        <StatusBadge
                          status={person.licenseStatus}
                          daysRemaining={person.daysRemaining}
                        />
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            License No.
                          </p>

                          <p className="mt-1 break-all font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {person.drivers_license_no ?? "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            Expiration
                          </p>

                          <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {person.rank?.rank_name} {person.fullname}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            Date Expires
                          </p>

                          <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {formatDate(person.drivers_license_expiration)}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            Remaining
                          </p>

                          <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {getStatusDescription(
                              person.licenseStatus,
                              person.daysRemaining,
                            )}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleViewLicense(person)}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                      >
                        <Eye className="h-4 w-4" />
                        View Driver’s License
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="border-t border-slate-200 px-5 py-3 dark:border-slate-800">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Showing{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {filteredPersonnel.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {personnel.length}
                  </span>{" "}
                  licensed personnel
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Driver License Modal */}
      {/* {selectedPersonnel && (
        <DriverLicenseModal
          personnel={{
            id: selectedPersonnel.id,
            rank: selectedPersonnel.rank?.rank_name!,
            fullname: selectedPersonnel.fullname,
          }}
          onClose={() => setSelectedPersonnel(null)}

        />
      )} */}
    </div>
  );
}
