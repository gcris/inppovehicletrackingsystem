import React, { memo, useCallback, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Edit2, Eye, Trash2 } from "lucide-react";
import { MobilityAsset, Personnel } from "../../lib/supabase";
import { useAuth } from "../../components/AuthProvider";

interface MobilityRowProps {
  vehicle: any;
  index: number;
  onEdit: (vehicle: any) => void;
  onDelete: (id: string) => void;
  getStatusColor: (status: string) => string;
  isExpired: (date: string) => boolean;
  isExpiringSoon: (date: string) => boolean;
  handleView: (asset: MobilityAsset) => void;
  handleViewDriverLicense: (driver: Personnel) => void;
}

function MobilityRow({
  vehicle,
  index,
  onEdit,
  onDelete,
  getStatusColor,
  isExpired,
  isExpiringSoon,
  handleView,
  handleViewDriverLicense,
}: MobilityRowProps) {
  const registrationDate = useMemo(() => {
    if (!vehicle.date_registration_expires) return "";

    return format(parseISO(vehicle.date_registration_expires), "MMM dd, yyyy");
  }, [vehicle.date_registration_expires]);

  const insuranceDate = useMemo(() => {
    if (!vehicle.insurance_coverage_date) return "";

    return format(parseISO(vehicle.insurance_coverage_date), "MMM dd, yyyy");
  }, [vehicle.insurance_coverage_date]);

  const odometer = useMemo(() => {
    return vehicle.current_odometer
      ? `${vehicle.current_odometer.toLocaleString()} km`
      : "-";
  }, [vehicle.current_odometer]);

  const handleEdit = useCallback(() => {
    onEdit(vehicle);
  }, [vehicle, onEdit]);

  const { isAdmin } = useAuth();

  return (
    <>
      <tr
        key={index}
        className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/30"
      >
        <td className="p-4 font-semibold">{vehicle.plate_number}</td>

        <td className="p-4">
          <div className="flex flex-col">
            <span>{vehicle.vehicle_type}</span>

            <span className="text-slate-600 dark:text-slate-300">
              {vehicle.description} {vehicle.year_model}
            </span>
          </div>
        </td>

        <td className="p-4">{vehicle.unit?.unit_name}</td>

        <td className="p-4">
          {vehicle.driver ? (
            <button
              type="button"
              onClick={() => handleViewDriverLicense(vehicle.driver)}
              className="mt-1 text-left font-semibold text-blue-600 transition hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
            >
              {vehicle.driver.rank?.rank_name} {vehicle.driver.fullname}
            </button>
          ) : (
            <div className="mt-1 font-semibold text-slate-400">-</div>
          )}
        </td>

        <td className="p-4">{odometer}</td>

        {/* Registration */}
        <td className="p-4">
          <div className="flex flex-col">
            <span>{registrationDate}</span>

            {vehicle.date_registration_expires &&
              isExpired(vehicle.date_registration_expires) && (
                <span className="text-red-600">Expired</span>
              )}

            {vehicle.date_registration_expires &&
              isExpiringSoon(vehicle.date_registration_expires) && (
                <span className="text-yellow-600">Expiring Soon</span>
              )}
          </div>
        </td>

        {/* Insurance */}
        <td className="p-4">
          <div className="flex flex-col">
            <span>{vehicle.insurance_provider!}</span>

            <span className="text-slate-600 dark:text-slate-300">
              {insuranceDate}
            </span>

            {vehicle.insurance_coverage_date &&
              isExpired(vehicle.insurance_coverage_date) && (
                <span className="text-red-600">Expired</span>
              )}

            {vehicle.insurance_coverage_date &&
              isExpiringSoon(vehicle.insurance_coverage_date) && (
                <span className="text-yellow-600">Expiring Soon</span>
              )}
          </div>
        </td>

        {/* Status */}
        <td className="p-4 text-center">
          <p
            className={`rounded-full px-3 py-1 font-semibold ${getStatusColor(
              vehicle.status,
            )}`}
          >
            {vehicle.status === "Beyond Economic Repair"
              ? "BER"
              : vehicle.status}
          </p>
          <p className="px-3 py-1 font-semibold">{vehicle.source}</p>
        </td>

        {/* Actions */}
        <td className="p-4">
          <div className="flex justify-center gap-2">
            <div className="group relative inline-block">
              <button
                onClick={() => handleView(vehicle)}
                className="rounded-lg border p-2 transition hover:bg-slate-100 border-slate-200 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <Eye className="h-5 w-5" />
                {vehicle.maintenance_reminders.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[14px] font-bold text-white">
                    {vehicle.maintenance_reminders.length}
                  </span>
                )}
              </button>

              <div className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 hidden flex-col items-end group-hover:flex">
                <div className="rounded-md bg-slate-900 px-2.5 py-1 text-white whitespace-nowrap shadow-lg">
                  View Mobility Asset.
                  {vehicle.maintenance_reminders.length > 0 && (
                    <span>
                      {" "}
                      You have {vehicle.maintenance_reminders.length} PMS
                      reminder/s.
                    </span>
                  )}
                </div>

                <div className="mr-3 h-2 w-2 -mt-1 rotate-45 bg-slate-900" />
              </div>
            </div>
            <div className="group relative inline-block">
              <button
                onClick={handleEdit}
                className="rounded-lg border border-slate-300 p-2 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <Edit2 className="h-5 w-5" />
              </button>

              <div className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 hidden flex-col items-end group-hover:flex">
                <div className="rounded-md bg-slate-900 px-2.5 py-1 text-white whitespace-nowrap shadow-lg">
                  Update Mobility Asset
                </div>

                <div className="mr-3 h-2 w-2 -mt-1 rotate-45 bg-slate-900" />
              </div>
            </div>

            {isAdmin && (
              <div className="group relative inline-block">
                <button
                  onClick={() => onDelete(vehicle.id)}
                  className="rounded-lg border border-red-300 p-2 text-red-600 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-5 w-5" />
                </button>

                <div className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 hidden flex-col items-end group-hover:flex">
                  <div className="rounded-md bg-slate-900 px-2.5 py-1 text-white whitespace-nowrap shadow-lg">
                    Delete Mobility Asset
                  </div>

                  <div className="mr-3 h-2 w-2 -mt-1 rotate-45 bg-slate-900" />
                </div>
              </div>
            )}
          </div>
        </td>
      </tr>
    </>
  );
}

export default React.memo(MobilityRow, (prev, next) => {
  return prev.vehicle === next.vehicle && prev.index === next.index;
});
