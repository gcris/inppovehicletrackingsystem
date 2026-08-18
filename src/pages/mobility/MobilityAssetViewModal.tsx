import React from "react";
import { X, Car, Gauge, AlertTriangle, Clock } from "lucide-react";
import { MobilityAsset } from "../../lib/supabase";
import { createPortal } from "react-dom";

type MaintenanceStatus = "GOOD" | "DUE_SOON" | "OVERDUE";

interface MaintenanceReminder {
  id: string;
  maintenance_type_id: string;
  maintenance_type_name: string;
  changed_at: string;
  next_service_date: string | null;
  next_service_odometer: number | null;
  days_remaining?: number | null;
  km_remaining?: number | null;
  status: MaintenanceStatus;
}

interface MobilityAssetViewModalProps {
  asset: MobilityAsset | null;
  isOpen: boolean;
  onClose: () => void;
}

const formatDate = (date?: string | null) => {
  if (!date) return "—";

  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatNumber = (value?: number | null) => {
  if (value === null || value === undefined) return "—";

  return new Intl.NumberFormat("en-US").format(value);
};

const getPersonnelName = (personnel?: MobilityAsset["driver"]) => {
  if (!personnel) return "Unassigned";

  const name = [personnel.rank?.rank_name, personnel.fullname]
    .filter(Boolean)
    .join(" ");

  return name || "Unassigned";
};

const getStatusClass = (status?: string | null) => {
  switch (status?.toLowerCase()) {
    case "serviceable":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";

    case "unserviceable":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";

    case "ber":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";

    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
  }
};

const getSourceClass = (source?: string | null) => {
  switch (source) {
    case "Organic":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";

    case "Loaned":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";

    case "Donated":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";

    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
  }
};

function getLatestMaintenanceByType(
  histories: MaintenanceReminder[],
): MaintenanceReminder[] {
  const grouped = new Map<string, MaintenanceReminder>();

  histories.forEach((history) => {
    const existing = grouped.get(history.maintenance_type_id);

    if (
      !existing ||
      new Date(history.changed_at).getTime() >
        new Date(existing.changed_at).getTime()
    ) {
      grouped.set(history.maintenance_type_id, history);
    }
  });

  return Array.from(grouped.values());
}

function maintenanceList(maintenance_type_name: string) {
  const items = maintenance_type_name.split(", ");

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <span
            key={index}
            className="
              inline-block
              rounded-full
              bg-blue-100
              px-3
              py-1
              text-sm
              font-semibold
              text-blue-700
              dark:bg-blue-900/40
              dark:text-blue-300
            "
          >
            {index + 1}. {item}
          </span>
        ))}
      </div>
    </>
  );
}

const InfoItem = ({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) => {
  return (
    <div>
      <p className="font-medium tracking-wide text-slate-600 dark:text-slate-300">
        {label}
      </p>

      <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200 break-words pl-1">
        {value || "—"}
      </p>
    </div>
  );
};

const Section = ({
  title,
  children,
  colspan,
}: {
  title: string;
  children: React.ReactNode;
  colspan: number;
}) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </h3>
      </div>

      <div
        className={`grid grid-cols-1 p-4 ${colspan > 1 ? `gap-5 sm:grid-cols-${colspan} lg:grid-cols-${colspan}` : ""}`}
      >
        {children}
      </div>
    </div>
  );
};

export default function MobilityAssetViewModal({
  asset,
  isOpen,
  onClose,
}: MobilityAssetViewModalProps) {
  if (!isOpen || !asset) return null;

  const priority: Record<MaintenanceStatus, number> = {
    OVERDUE: 0,
    DUE_SOON: 1,
    GOOD: 2,
  };

  const reminders = getLatestMaintenanceByType(
    asset.maintenance_reminders ?? [],
  ).sort((a, b) => priority[a.status] - priority[b.status]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <Car size={24} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                Mobility Asset Details
              </h2>

              <p className="text-slate-600 dark:text-slate-300">
                {asset.plate_number}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <X size={22} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-4 sm:p-5">
          <div className="space-y-4">
            {/* PMS Reminders */}
            <Section title="PMS Reminders" colspan={1}>
              <div className="flex items-center gap-3 rounded-xl bg-slate-100 p-4 dark:bg-slate-700/50 sm:col-span-2 lg:col-span-3 mb-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <Gauge size={20} />
                </div>

                <div>
                  <p className="font-medium tracking-wide text-slate-600 dark:text-slate-200">
                    Current Odometer Reading
                  </p>

                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {formatNumber(asset.current_odometer)} km
                  </p>
                </div>
              </div>

              <div>
                {reminders.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 py-8 text-center dark:border-slate-700 dark:bg-slate-800/50">
                    <Clock size={32} className="mx-auto mb-2 text-slate-400" />

                    <p className="font-medium text-slate-600 dark:text-slate-300">
                      No Periodic Maintenance Service reminder.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reminders.map((item) => (
                      <div
                        key={`${item.maintenance_type_id}-${item.changed_at}`}
                        className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                      >
                        {/* Maintenance type + status icon */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-semibold text-slate-800 dark:text-slate-100">
                            {maintenanceList(item.maintenance_type_name)}
                          </div>

                          {item.status === "OVERDUE" ? (
                            <AlertTriangle
                              size={20}
                              className="shrink-0 text-red-600"
                            />
                          ) : item.status === "DUE_SOON" ? (
                            <Clock
                              size={20}
                              className="shrink-0 text-yellow-600"
                            />
                          ) : (
                            <Clock
                              size={20}
                              className="shrink-0 text-green-600"
                            />
                          )}
                        </div>

                        {/* Details */}
                        <div className="mx-3 mt-3 space-y-1.5 text-slate-700 dark:text-slate-300">
                          <p>
                            <span className="font-medium">Due Date:</span>{" "}
                            {item.next_service_date
                              ? formatDate(item.next_service_date)
                              : "—"}
                          </p>

                          <p>
                            <span className="font-medium">
                              Due Odometer Reading:
                            </span>{" "}
                            {item.next_service_odometer != null
                              ? `${item.next_service_odometer.toLocaleString()} km`
                              : "—"}
                          </p>

                          <p>
                            <span className="font-medium">Remaining km:</span>{" "}
                            {item.km_remaining != null
                              ? `${item.km_remaining.toLocaleString()} km`
                              : "—"}
                          </p>

                          <p>
                            <span className="font-medium">
                              Remaining day/s:
                            </span>{" "}
                            {item.days_remaining != null
                              ? item.days_remaining
                              : "—"}
                          </p>

                          <p>
                            <span className="font-medium">Status:</span>{" "}
                            <span
                              className={`font-bold ${
                                item.status === "GOOD"
                                  ? "text-green-600"
                                  : item.status === "OVERDUE"
                                    ? "text-red-600"
                                    : "text-yellow-600"
                              }`}
                            >
                              {item.status?.replace("_", " ")}
                            </span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Section>

            {/* Basic Information */}
            <Section title="Mobility Information" colspan={3}>
              <InfoItem label="Plate Number" value={asset.plate_number} />

              <InfoItem label="Mobility Type" value={asset.vehicle_type} />

              <InfoItem label="Year Model" value={asset.year_model} />

              <InfoItem
                label="Source"
                value={
                  asset.source ? (
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 font-semibold ${getSourceClass(
                        asset.source,
                      )}`}
                    >
                      {asset.source}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />

              <InfoItem
                label="Status"
                value={
                  asset.status ? (
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 font-semibold ${getStatusClass(
                        asset.status,
                      )}`}
                    >
                      {asset.status}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />

              <div className="sm:col-span-2 lg:col-span-3">
                <InfoItem label="Description" value={asset.description} />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <InfoItem
                  label={`Remarks/Reason why it is ${asset.status}`}
                  value={asset.remarks}
                />
              </div>
            </Section>

            {/* Assignment / Driver */}
            <Section title="Assignment" colspan={2}>
              <InfoItem label="Unit/Station" value={asset.unit?.unit_name} />

              <InfoItem
                label="Official Driver"
                value={getPersonnelName(asset.driver)}
              />
            </Section>

            {/* Vehicle Identification */}
            <Section title="Mobility Identification" colspan={2}>
              <InfoItem label="Engine Number" value={asset.engine_number} />

              <InfoItem label="Chassis Number" value={asset.chassis_number} />

              <InfoItem label="O.R. Number" value={asset.or_number} />

              <InfoItem label="C.R. Number" value={asset.cr_number} />
            </Section>

            {/* Registration */}
            <Section title="Registration Information" colspan={2}>
              <InfoItem
                label="Last Registration"
                value={formatDate(asset.date_of_last_registration)}
              />

              <InfoItem
                label="Registration Expires"
                value={formatDate(asset.date_registration_expires)}
              />
            </Section>

            {/* Insurance & PMS */}
            <Section title="Insurance" colspan={2}>
              <InfoItem
                label="Insurance Provider"
                value={asset.insurance_provider}
              />

              <InfoItem
                label="Insurance Coverage Until"
                value={formatDate(asset.insurance_coverage_date)}
              />
            </Section>

            {/* System Information */}
            <Section title="System Information" colspan={3}>
              <InfoItem
                label="Date Entry"
                value={formatDate(asset.created_at)}
              />

              <InfoItem
                label="Last Updated"
                value={formatDate(asset.updated_at)}
              />

              <InfoItem
                label="Updated by"
                value={
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {getPersonnelName(asset.updated_by_personnel!)}
                    </span>

                    <span className="text-slate-600 dark:text-slate-300">
                      {asset.updated_by_personnel?.designation ?? "—"}
                    </span>
                  </div>
                }
              />
            </Section>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-700 dark:bg-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-700 px-5 py-2.5 font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
