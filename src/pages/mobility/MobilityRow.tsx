import React, { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { MobilityAsset, Personnel } from "../../lib/supabase";

interface MobilityRowProps {
  vehicle: any;
  index: number;
  handleView: (asset: MobilityAsset) => void;
  handleViewDriverLicense: (driver: Personnel) => void;
}

function MobilityRow({
  vehicle,
  index,
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

  return (
    <>
      <tr
        key={index}
        onClick={() => handleView(vehicle)}
        className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/30"
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
              onClick={(e) => {
                e.stopPropagation();
                handleViewDriverLicense(vehicle.driver);
              }}
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
          </div>
        </td>

        {/* Insurance */}
        <td className="p-4">
          <div className="flex flex-col">
            <span>{vehicle.insurance_provider!}</span>

            <span className="text-slate-600 dark:text-slate-300">
              {insuranceDate}
            </span>
          </div>
        </td>

        {/* Status */}
        <td className="p-4 text-center">
          <p className="px-3 py-1 font-semibold">{vehicle.status}</p>
          <p className="px-3 py-1 font-semibold">{vehicle.source}</p>
        </td>
      </tr>
    </>
  );
}

export default React.memo(MobilityRow, (prev, next) => {
  return prev.vehicle === next.vehicle && prev.index === next.index;
});
