import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../../lib/supabase";
import { mobilityType } from "../../types/mobilityType";

type VehicleStatus = "Serviceable" | "Unserviceable" | "BER";

interface MobilityStatusCount {
  Serviceable: number;
  Unserviceable: number;
  BER: number;
}

interface MobilityRow {
  unit: string;
  Total: number;
  vehicles: Record<string, MobilityStatusCount>;
}

interface MobilityAssetDistribution {
  vehicle_type: string;
  status: string;
  source: string;
  unit: {
    id: string;
    unit_name: string;
  } | null;
}

interface MobilityTypeTableProps {
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export default function MobilityTypeTable({
  loading,
  setLoading,
}: MobilityTypeTableProps) {
  const [rows, setRows] = useState<MobilityRow[]>([]);
  const [sortedMobilityTypes, setSortedMobilityTypes] = useState<string[]>([]);

  useEffect(() => {
    fetchMobilityDistribution();
  }, []);

  const fetchMobilityDistribution = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("mobility_assets")
        .select(
          `
          *,
          unit:unit_id(
            id,
            unit_name
          )
        `,
        )
        .order("level", {
          referencedTable: "unit",
          ascending: false,
        })
        .order("unit_name", {
          referencedTable: "unit",
          ascending: true,
        });

      if (error) throw error;

      const grouped: Record<string, MobilityRow> = {};

      // Store total count for each vehicle type
      const typeTotals: Record<string, number> = {};

      mobilityType.forEach((type) => {
        typeTotals[type] = 0;
      });

      const assets = (data ?? []) as MobilityAssetDistribution[];

      assets.forEach((asset) => {
        const unitName = asset.unit?.unit_name ?? "Unassigned";

        if (!grouped[unitName]) {
          grouped[unitName] = {
            unit: unitName,
            Total: 0,
            vehicles: {},
          };

          mobilityType.forEach((type) => {
            grouped[unitName].vehicles[type] = {
              Serviceable: 0,
              Unserviceable: 0,
              BER: 0,
            };
          });
        }

        const type = asset.vehicle_type;

        let status: VehicleStatus;

        switch ((asset.status ?? "").toUpperCase()) {
          case "SERVICEABLE":
            status = "Serviceable";
            break;

          case "UNSERVICEABLE":
            status = "Unserviceable";
            break;

          case "BEYOND ECONOMIC REPAIR":
            status = "BER";
            break;

          default:
            status = "Serviceable";
        }

        if (mobilityType.includes(type) && grouped[unitName].vehicles[type]) {
          grouped[unitName].vehicles[type][status]++;

          grouped[unitName].Total++;

          // Count totals per vehicle type
          typeTotals[type]++;
        }
      });

      // Sort vehicle types by highest total
      const sortedMobilityTypes = [...mobilityType].sort((a, b) => {
        return typeTotals[b] - typeTotals[a];
      });

      // Rebuild each row using the sorted order
      const result = Object.values(grouped).map((row) => {
        const sortedVehicles: typeof row.vehicles = {};

        sortedMobilityTypes.forEach((type) => {
          sortedVehicles[type] = row.vehicles[type];
        });

        return {
          ...row,
          vehicles: sortedVehicles,
        };
      });

      setSortedMobilityTypes(sortedMobilityTypes); // <-- new state
      setRows(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const grandTotals = mobilityType.reduce(
    (acc, type) => {
      acc[type] = {
        Serviceable: 0,
        Unserviceable: 0,
        BER: 0,
      };

      rows.forEach((row) => {
        const counts = row.vehicles[type];

        if (!counts) return;

        acc[type].Serviceable += counts.Serviceable;
        acc[type].Unserviceable += counts.Unserviceable;
        acc[type].BER += counts.BER;
      });

      return acc;
    },
    {} as Record<string, MobilityStatusCount>,
  );

  const overallTotal = rows.reduce((sum, row) => sum + row.Total, 0);

  const exportToExcel = () => {
    const worksheetData: (string | number)[][] = [];

    // Title
    worksheetData.push(["Mobility Distribution Report: by Status"]);
    worksheetData.push([`Generated: ${new Date().toLocaleString()}`]);
    worksheetData.push([]);

    // =========================
    // Header Row 1
    // =========================
    const header1: (string | number)[] = ["No.", "Unit / Station"];

    mobilityType.forEach((type) => {
      header1.push(type, "", "");
    });

    header1.push("Total");

    worksheetData.push(header1);

    // =========================
    // Header Row 2
    // =========================
    const header2: (string | number)[] = ["", ""];

    mobilityType.forEach(() => {
      header2.push("Serviceable", "Unserviceable", "BER");
    });

    header2.push("");

    worksheetData.push(header2);

    // =========================
    // Data
    // =========================
    rows.forEach((row, index) => {
      const rowData: (string | number)[] = [index + 1, row.unit];

      mobilityType.forEach((type) => {
        const counts = row.vehicles[type];

        rowData.push(
          counts.Serviceable || "-",
          counts.Unserviceable || "-",
          counts.BER || "-",
        );
      });

      rowData.push(row.Total);

      worksheetData.push(rowData);
    });

    // =========================
    // Grand Total
    // =========================
    const totalRow: (string | number)[] = ["", "GRAND TOTAL"];

    mobilityType.forEach((type) => {
      totalRow.push(
        grandTotals[type].Serviceable || "-",
        grandTotals[type].Unserviceable || "-",
        grandTotals[type].BER || "-",
      );
    });

    totalRow.push(overallTotal);

    worksheetData.push(totalRow);

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Merge vehicle type headers
    const merges: XLSX.Range[] = [];

    // No.
    merges.push({
      s: { r: 3, c: 0 },
      e: { r: 4, c: 0 },
    });

    // Unit
    merges.push({
      s: { r: 3, c: 1 },
      e: { r: 4, c: 1 },
    });

    let column = 2;

    mobilityType.forEach(() => {
      merges.push({
        s: { r: 3, c: column },
        e: { r: 3, c: column + 2 },
      });

      column += 3;
    });

    // Total
    merges.push({
      s: { r: 3, c: column },
      e: { r: 4, c: column },
    });

    worksheet["!merges"] = merges;

    // Column widths
    worksheet["!cols"] = [
      { wch: 8 }, // No.
      { wch: 30 }, // Unit
      ...mobilityType.flatMap(() => [{ wch: 14 }, { wch: 16 }, { wch: 10 }]),
      { wch: 10 }, // Total
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Mobility Distribution");

    XLSX.writeFile(workbook, "Mobility_Distribution_Report.xlsx");
  };

  return (
    <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between p-4">
        <div>
          <h1 className="text-3xl font-bold">Mobility Source Report</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportToExcel}
            className="rounded-xl bg-emerald-600 px-5 py-2 text-white font-medium transition hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
          >
            Export Excel
          </button>
        </div>
      </div>
      {loading ? (
        <div className="text-center py-20">Loading...</div>
      ) : (
        <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 max-h-[700px]">
          <table className="min-w-[1200px] w-full border-collapse">
            <thead className="sticky top-0 z-30">
              {/* First Header Row */}
              <tr className="bg-slate-100 dark:bg-slate-800">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-40 bg-slate-100 dark:bg-slate-800 border border-slate-200 px-4 py-3"
                >
                  No.
                </th>
                <th
                  rowSpan={2}
                  className="sticky left-0 z-40 bg-slate-100 dark:bg-slate-800 border border-slate-200 px-4 py-3"
                >
                  Unit / Station
                </th>

                {sortedMobilityTypes.map((type) => (
                  <th
                    key={type}
                    colSpan={3}
                    className="border border-slate-200 px-4 py-3 text-center font-semibold"
                  >
                    {type}
                  </th>
                ))}

                <th
                  rowSpan={2}
                  className="border border-slate-200 px-4 py-3 text-center font-semibold"
                >
                  Total
                </th>
              </tr>

              {/* Second Header Row */}
              <tr className="bg-slate-50 dark:bg-slate-900">
                {sortedMobilityTypes.map((type) => (
                  <React.Fragment key={type}>
                    <th className="border border-slate-200 px-2 py-2 text-center text-xs">
                      SER
                    </th>

                    <th className="border border-slate-200 px-2 py-2 text-center text-xs">
                      UNSER
                    </th>

                    <th className="border border-slate-200 px-2 py-2 text-center text-xs">
                      BER
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.unit}
                  className="
                    hover:bg-slate-50
                    dark:hover:bg-slate-800/50
                    transition-colors
                "
                >
                  <td
                    className="
                    sticky
                    left-0
                    bg-white
                    dark:bg-slate-900
                    border-r
                    border-b
                    border-slate-200
                    dark:border-slate-700
                    px-4
                    py-3
                    font-medium
                    whitespace-nowrap
                "
                  >
                    {index + 1}
                  </td>
                  {/* Sticky Unit Name */}
                  <td
                    className="
                    sticky
                    left-0
                    bg-white
                    dark:bg-slate-900
                    border-r
                    border-b
                    border-slate-200
                    dark:border-slate-700
                    px-4
                    py-3
                    font-medium
                    whitespace-nowrap
                "
                  >
                    {row.unit}
                  </td>

                  {sortedMobilityTypes.map((type) => {
                    const counts = row.vehicles[type];

                    return (
                      <React.Fragment key={type}>
                        <td className="text-center border-b border-slate-200 px-3 py-2">
                          {counts.Serviceable || "-"}
                        </td>

                        <td className="text-center border-b border-slate-200 px-3 py-2">
                          {counts.Unserviceable || "-"}
                        </td>

                        <td className="text-center border-b border-slate-200 px-3 py-2">
                          {counts.BER || "-"}
                        </td>
                      </React.Fragment>
                    );
                  })}

                  <td
                    className="
                    border-b
                    border-slate-200
                    dark:border-slate-700
                    text-center
                    font-bold
                    px-4
                    py-3
                    "
                  >
                    {row.Total as number}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-blue-100 dark:bg-slate-800 font-bold">
                <td
                  className="
                    border
                    border-blue-100
                    sticky left-0
                    bg-blue-100
                    dark:bg-slate-800
                    border
                    px-4
                    py-3
                "
                  colSpan={2}
                >
                  GRAND TOTAL
                </td>

                {sortedMobilityTypes.map((type) => (
                  <React.Fragment key={type}>
                    <td className="border border-blue-100 text-center px-2 py-3">
                      {grandTotals[type].Serviceable || "-"}
                    </td>

                    <td className="border border-blue-100 text-center px-2 py-3">
                      {grandTotals[type].Unserviceable || "-"}
                    </td>

                    <td className="border border-blue-100 text-center px-2 py-3">
                      {grandTotals[type].BER || "-"}
                    </td>
                  </React.Fragment>
                ))}

                <td className="border border-blue-100 text-center text-lg">
                  {overallTotal}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
