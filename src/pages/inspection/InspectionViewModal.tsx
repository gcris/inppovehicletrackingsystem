import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, CheckCircle2, XCircle, MinusCircle } from "lucide-react";

import {
  VehicleInspection,
  VehicleInspectionCategory,
  VehicleInspectionItem,
  supabase,
} from "../../lib/supabase";

import { useReactToPrint } from "react-to-print";

interface InspectionResult {
  id: string;
  inspection_id: string;
  inspection_item_id: string;

  status: "COMPLIED" | "UNCOMPLIED";

  remarks?: string | null;

  inspection_item?: VehicleInspectionItem;
}

interface Props {
  open: boolean;
  onClose: () => void;
  inspection: VehicleInspection | null;
}

export default function InspectionViewModal({
  open,
  onClose,
  inspection,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<VehicleInspectionCategory[]>([]);
  const [results, setResults] = useState<InspectionResult[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: "Mobility Inspection Result",
  });

  useEffect(() => {
    if (!open || !inspection) return;

    fetchInspection();
  }, [open, inspection]);

  const fetchInspection = async () => {
    setLoading(true);

    try {
      const [categoryResult, resultResult] = await Promise.all([
        supabase
          .from("vehicle_inspection_categories")
          .select("*")
          .order("display_order"),

        supabase
          .from("vehicle_inspection_results")
          .select(
            `
            *,
            inspection_item:
              vehicle_inspection_items(
                *
              )
          `,
          )
          .eq("inspection_id", inspection!.id),
      ]);

      if (categoryResult.error) throw categoryResult.error;

      if (resultResult.error) throw resultResult.error;

      setCategories(categoryResult.data ?? []);

      setResults(resultResult.data ?? []);
    } catch (error) {
      console.error(error);

      alert("Unable to load inspection.");
    } finally {
      setLoading(false);
    }
  };

  const groupedResults = useMemo(() => {
    return categories.map((category) => ({
      ...category,

      items: results.filter(
        (result) => result.inspection_item?.category_id === category.id,
      ),
    }));
  }, [categories, results]);

  if (!open || !inspection) return null;

  const getStatusBadge = (status: InspectionResult["status"]) => {
    switch (status) {
      case "COMPLIED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-base font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Complied
          </span>
        );

      case "UNCOMPLIED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-base font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <XCircle className="h-3.5 w-3.5" />
            Uncomplied
          </span>
        );

      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-base font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
            <MinusCircle className="h-3.5 w-3.5" />
            N/A
          </span>
        );
    }
  };

  const overallBadge = () => {
    switch (inspection.overall_status) {
      case "PASSED":
        return (
          <span className="rounded-full bg-green-100 px-3 py-1 text-base font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
            PASSED
          </span>
        );

      case "WITH_DEFECTS":
        return (
          <span className="rounded-full bg-yellow-100 px-3 py-1 text-base font-semibold text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            WITH DEFECTS
          </span>
        );

      default:
        return (
          <span className="rounded-full bg-red-100 px-3 py-1 text-base font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
            FAILED
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="rounded-2xl bg-white p-8 dark:bg-slate-900">
          Loading inspection...
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[95vh] w-full max-w-7xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-2xl font-bold">Mobility Inspection</h2>

            <p className="text-base text-slate-800 dark:text-slate-200">
              Read-only inspection report
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div ref={reportRef} className="p-6">
            {/* Summary */}

            <div className="mb-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="border-b bg-slate-100 px-6 py-4 border-slate-200 dark:border-slate-800 dark:bg-slate-800">
                <h3 className="text-lg font-semibold">Inspection Summary</h3>
              </div>

              <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 md:grid-cols-2">
                <div className="rounded-xl bg-green-50 p-5 dark:bg-green-900">
                  <div className="text-base text-green-700 dark:text-green-400">
                    Complied
                  </div>

                  <div className="mt-2 text-3xl font-bold text-green-700 dark:text-green-400">
                    {results.filter((r) => r.status === "COMPLIED").length}
                  </div>
                </div>

                <div className="rounded-xl bg-red-50 p-5 dark:bg-red-900">
                  <div className="text-base text-red-700 dark:text-red-400">
                    Uncomplied
                  </div>

                  <div className="mt-2 text-3xl font-bold text-red-700 dark:text-red-400">
                    {results.filter((r) => r.status === "UNCOMPLIED").length}
                  </div>
                </div>
              </div>
            </div>

            {/* Vehicle Information */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="border-b bg-slate-50 px-6 py-4 border-slate-200 dark:border-slate-800 dark:bg-slate-800">
                <h3 className="text-lg font-semibold">
                  Inspection Information
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3">
                <div>
                  <div className="text-base text-slate-800 dark:text-slate-200">
                    Plate Number
                  </div>

                  <div className="mt-1 font-semibold">
                    {inspection.mobility_asset?.plate_number ?? "-"}
                  </div>
                </div>

                <div>
                  <div className="text-base text-slate-800 dark:text-slate-200">
                    Vehicle
                  </div>

                  <div className="mt-1 font-semibold">
                    {inspection.mobility_asset?.description ?? "-"}
                  </div>
                </div>

                <div>
                  <div className="text-base text-slate-800 dark:text-slate-200">
                    Inspection Date
                  </div>

                  <div className="mt-1 font-semibold">
                    {new Date(inspection.inspected_at).toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="text-base text-slate-800 dark:text-slate-200">
                    Inspector
                  </div>

                  <div className="mt-1 font-semibold">
                    {inspection.inspected_by ?? "-"}
                  </div>
                </div>

                <div>
                  <div className="text-base text-slate-800 dark:text-slate-200">
                    Supervisor
                  </div>

                  <div className="mt-1 font-semibold">
                    {inspection.supervisor_name ?? "-"}
                  </div>
                </div>

                <div>
                  <div className="text-base text-slate-800 dark:text-slate-200">
                    Overall Status
                  </div>

                  <div className="mt-2">{overallBadge()}</div>
                </div>

                <div>
                  <div className="text-base text-slate-800 dark:text-slate-200">
                    Designated Driver
                  </div>

                  <div className="mt-1 font-semibold">
                    {inspection.designated_driver?.rank?.rank_name}{" "}
                    {inspection.designated_driver?.fullname ?? "-"}
                  </div>
                </div>

                <div>
                  <div className="text-base text-slate-800 dark:text-slate-200">
                    Alternate Driver
                  </div>

                  <div className="mt-1 font-semibold">
                    {inspection.alternate_driver?.rank?.rank_name}{" "}
                    {inspection.alternate_driver?.fullname ?? "-"}
                  </div>
                </div>
              </div>

              {inspection.remarks && (
                <div className="border-t px-6 py-4 border-slate-200 dark:border-slate-800">
                  <div className="text-base text-slate-800 dark:text-slate-200">
                    Remarks
                  </div>

                  <p className="mt-2 whitespace-pre-wrap">
                    {inspection.remarks}
                  </p>
                </div>
              )}
            </div>

            {/* Inspection Checklist */}

            <div className="mt-6 space-y-6">
              {groupedResults.map((category) => {
                if (category.items.length === 0) return null;

                return (
                  <div
                    key={category.id}
                    className="print-no-break overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800"
                  >
                    <div className="border-b bg-slate-100 px-6 py-4 border-slate-200 dark:border-slate-800 dark:bg-slate-800">
                      <h3 className="text-lg font-semibold">{category.name}</h3>

                      {category.description && (
                        <p className="mt-1 text-base text-slate-800 dark:text-slate-200">
                          {category.description}
                        </p>
                      )}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-slate-50 dark:bg-slate-900">
                          <tr>
                            <th className="w-20 px-5 py-3 text-left">Code</th>

                            <th className="px-5 py-3 text-left">
                              Inspection Item
                            </th>

                            <th className="w-44 px-5 py-3 text-center">
                              Status
                            </th>

                            <th className="px-5 py-3 text-left">Remarks</th>
                          </tr>
                        </thead>

                        <tbody>
                          {category.items.map((result) => (
                            <tr
                              key={result.id}
                              className="border-t border-slate-200 dark:border-slate-800"
                            >
                              <td className="px-5 py-4 font-semibold">
                                {result.inspection_item?.code}
                              </td>

                              <td className="px-5 py-4">
                                <div className="font-medium">
                                  {result.inspection_item?.name}
                                </div>

                                {result.inspection_item?.description && (
                                  <div className="mt-1 text-base text-slate-800 dark:text-slate-200">
                                    {result.inspection_item.description}
                                  </div>
                                )}
                              </td>

                              <td className="px-5 py-4 text-center">
                                {getStatusBadge(result.status)}
                              </td>

                              <td className="px-5 py-4">
                                {result.remarks ? (
                                  <div className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-base dark:bg-slate-800">
                                    {result.remarks}
                                  </div>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>

                        <tfoot className="border-t bg-slate-50 border-slate-200 dark:border-slate-800 dark:bg-slate-900">
                          <tr>
                            <td
                              colSpan={4}
                              className="px-5 py-3 text-base text-slate-800 dark:text-slate-200"
                            >
                              Total Items:{" "}
                              <strong>{category.items.length}</strong>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t bg-slate-50 px-6 py-4 border-slate-200 dark:border-slate-800 dark:bg-slate-900">
          {/* Left side: Item counter text */}
          <div className="text-base text-slate-800 dark:text-slate-200">
            {results.length} inspection item{results.length !== 1 ? "s" : ""}{" "}
            reviewed
          </div>

          {/* Right side: Grouped buttons */}
          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-white font-medium transition hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
            >
              Export PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border px-5 py-2 transition hover:bg-slate-100 border-slate-200 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
