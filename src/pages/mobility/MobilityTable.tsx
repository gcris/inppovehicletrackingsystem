import React, { memo } from "react";
import MobilityRow from "./MobilityRow";
import { MobilityAsset, Personnel } from "../../lib/supabase";

interface MobilityTableProps {
  vehicles: MobilityAsset[];
  onEdit: (vehicle: MobilityAsset) => void;
  onDelete: (id: string) => void;
  getStatusColor: (status: string) => string;
  isExpired: (date: string) => boolean;
  isExpiringSoon: (date: string) => boolean;
  handleView: (asset: MobilityAsset) => void;
  handleViewDriverLicense: (driver: Personnel) => void;
  currentPage: number;
  pageSize: number;
}

function MobilityTable({
  vehicles,
  onEdit,
  onDelete,
  getStatusColor,
  isExpired,
  isExpiringSoon,
  handleView,
  handleViewDriverLicense,
  pageSize,
  currentPage,
}: MobilityTableProps) {
  return (
    <tbody>
      {vehicles.length === 0 ? (
        <tr>
          <td
            colSpan={11}
            className="px-6 py-16 text-center text-slate-500 dark:text-slate-400"
          >
            No mobility assets found.
          </td>
        </tr>
      ) : (
        vehicles.map((vehicle, index) => (
          <MobilityRow
            key={vehicle.id}
            index={(currentPage - 1) * pageSize + index}
            vehicle={vehicle}
            onEdit={onEdit}
            onDelete={onDelete}
            getStatusColor={getStatusColor}
            isExpired={isExpired}
            isExpiringSoon={isExpiringSoon}
            handleView={handleView}
            handleViewDriverLicense={handleViewDriverLicense}
          />
        ))
      )}
    </tbody>
  );
}

export default memo(MobilityTable, (prevProps, nextProps) => {
  return (
    prevProps.vehicles === nextProps.vehicles &&
    prevProps.onEdit === nextProps.onEdit &&
    prevProps.onDelete === nextProps.onDelete
  );
});
