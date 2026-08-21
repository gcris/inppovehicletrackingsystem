import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Filter,
  Loader2,
  Printer,
  RefreshCw,
  XCircle,
} from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "../../lib/supabase";
import { useReactToPrint } from "react-to-print";

interface Unit {
  id: string;
  unit_name: string;
  level: number;
}

interface InspectionItem {
  id: string;
  name: string;
  category?: {
    id: string;
    name: string;
  } | null;
}

interface InspectionResult {
  id: string;
  status: string;
  inspection_item?: InspectionItem | null;
}

interface Mobility {
  id: string;
  plate_number: string;
  unit?: Unit | null;
}

interface Inspection {
  id: string;
  inspected_at: string;
  overall_status: string;
  mobility_asset?: Mobility | null;
  results?: InspectionResult[];
}

interface InspectionComplianceRow {
  unit_id: string;
  unit_name: string;
  level: number;
  total_inspections: number;
  passed: number;
  with_defects: number;
  failed: number;
  compliance_rate: number;
}

interface CategoryComplianceRow {
  unit_id: string;
  unit_name: string;
  category_name: string;
  total_items: number;
  complied: number;
  uncomplied: number;
  not_applicable: number;
  compliance_rate: number;
}

type StatusFilter = "ALL" | "PASSED" | "WITH_DEFECTS" | "FAILED";

/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

const formatDate = (date: string) => {
  if (!date) return "—";

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatDateTime = (date: Date) => {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const normalizeResultStatus = (status: string) => {
  const value = status?.toUpperCase().trim();

  if (
    value === "COMPLIED" ||
    value === "PASS" ||
    value === "PASSED" ||
    value === "OK"
  ) {
    return "COMPLIED";
  }

  if (
    value === "NOT_COMPLIED" ||
    value === "UNCOMPLIED" ||
    value === "FAIL" ||
    value === "FAILED" ||
    value === "DEFECT"
  ) {
    return "UNCOMPLIED";
  }

  if (value === "N/A" || value === "NA" || value === "NOT_APPLICABLE") {
    return "NOT_APPLICABLE";
  }

  return value;
};

/*
 * =========================================================
 * COMPONENT
 * =========================================================
 */

export default function InspectionComplianceReport() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(false);

  const now = new Date();

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  };

  const [fromDate, setFromDate] = useState(
    formatDate(new Date(now.getFullYear(), now.getMonth(), 1)),
  );

  const [toDate, setToDate] = useState(
    formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  );

  const [selectedUnit, setSelectedUnit] = useState("ALL");

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  /*
   * =========================================================
   * PRINT REF
   * =========================================================
   */

  const reportRef = useRef<HTMLDivElement>(null);

  /*
   * =========================================================
   * FETCH INSPECTIONS
   * =========================================================
   */

  const fetchInspections = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("vehicle_inspections")
        .select(
          `
            id,
            inspected_at,
            overall_status,

            mobility_asset:mobility_asset_id(
              id,
              plate_number,

              unit:unit_id(
                id,
                unit_name,
                level
              )
            ),

            results:vehicle_inspection_results(
              id,
              status,

              inspection_item:inspection_item_id(
                id,
                name,

                category:category_id(
                  id,
                  name
                )
              )
            )
          `,
        )
        .order("inspected_at", {
          ascending: false,
        });

      if (error) throw error;

      setInspections((data ?? []) as unknown as Inspection[]);

      setGeneratedAt(new Date());
    } catch (error) {
      console.error("Error fetching inspection report:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInspections();
  }, []);

  /*
   * =========================================================
   * UNIT LIST
   * =========================================================
   */

  const units = useMemo(() => {
    const map = new Map<string, Unit>();

    inspections.forEach((inspection) => {
      const unit = inspection.mobility_asset?.unit;

      if (!unit) return;

      map.set(unit.id, unit);
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.level !== b.level) {
        return b.level - a.level;
      }

      return a.unit_name.localeCompare(b.unit_name);
    });
  }, [inspections]);

  /*
   * =========================================================
   * SELECTED UNIT LABEL
   * =========================================================
   */

  const selectedUnitLabel = useMemo(() => {
    if (selectedUnit === "ALL") {
      return "All Units / Stations";
    }

    return (
      units.find((unit) => unit.id === selectedUnit)?.unit_name ??
      "Selected Unit / Station"
    );
  }, [selectedUnit, units]);

  /*
   * =========================================================
   * FILTER INSPECTIONS
   * =========================================================
   */

  const filteredInspections = useMemo(() => {
    return inspections.filter((inspection) => {
      const inspectionDate = inspection.inspected_at
        ? new Date(inspection.inspected_at)
        : null;

      /*
       * Date filter
       */

      if (fromDate && inspectionDate) {
        const from = new Date(`${fromDate}T00:00:00`);

        if (inspectionDate < from) {
          return false;
        }
      }

      if (toDate && inspectionDate) {
        const to = new Date(`${toDate}T23:59:59`);

        if (inspectionDate > to) {
          return false;
        }
      }

      /*
       * Unit filter
       */

      if (selectedUnit !== "ALL") {
        if (inspection.mobility_asset?.unit?.id !== selectedUnit) {
          return false;
        }
      }

      /*
       * Status filter
       */

      if (statusFilter !== "ALL") {
        if (inspection.overall_status?.toUpperCase() !== statusFilter) {
          return false;
        }
      }

      return true;
    });
  }, [inspections, fromDate, toDate, selectedUnit, statusFilter]);

  /*
   * =========================================================
   * OVERALL STATISTICS
   * =========================================================
   */

  const statistics = useMemo(() => {
    let passed = 0;
    let withDefects = 0;
    let failed = 0;

    filteredInspections.forEach((inspection) => {
      switch (inspection.overall_status?.toUpperCase()) {
        case "PASSED":
          passed++;
          break;

        case "WITH_DEFECTS":
          withDefects++;
          break;

        case "FAILED":
          failed++;
          break;
      }
    });

    const total = filteredInspections.length;

    return {
      total,
      passed,
      withDefects,
      failed,
      complianceRate: total > 0 ? (passed / total) * 100 : 0,
    };
  }, [filteredInspections]);

  /*
   * =========================================================
   * COMPLIANCE BY UNIT
   * =========================================================
   */

  const unitRows = useMemo<InspectionComplianceRow[]>(() => {
    const grouped: Record<string, InspectionComplianceRow> = {};

    filteredInspections.forEach((inspection) => {
      const unit = inspection.mobility_asset?.unit;

      const unitId = unit?.id ?? "unassigned";
      const unitName = unit?.unit_name ?? "Unassigned";
      const level = unit?.level ?? -1;

      if (!grouped[unitId]) {
        grouped[unitId] = {
          unit_id: unitId,
          unit_name: unitName,
          level,
          total_inspections: 0,
          passed: 0,
          with_defects: 0,
          failed: 0,
          compliance_rate: 0,
        };
      }

      const row = grouped[unitId];

      row.total_inspections++;

      switch (inspection.overall_status?.toUpperCase()) {
        case "PASSED":
          row.passed++;
          break;

        case "WITH_DEFECTS":
          row.with_defects++;
          break;

        case "FAILED":
          row.failed++;
          break;
      }
    });

    return Object.values(grouped)
      .map((row) => ({
        ...row,
        compliance_rate:
          row.total_inspections > 0
            ? (row.passed / row.total_inspections) * 100
            : 0,
      }))
      .sort((a, b) => {
        if (a.level !== b.level) {
          return b.level - a.level;
        }

        return a.unit_name.localeCompare(b.unit_name);
      });
  }, [filteredInspections]);

  /*
   * =========================================================
   * CATEGORY COMPLIANCE
   * =========================================================
   */

  const categoryRows = useMemo<CategoryComplianceRow[]>(() => {
    const grouped: Record<string, CategoryComplianceRow> = {};

    filteredInspections.forEach((inspection) => {
      const unit = inspection.mobility_asset?.unit;

      const unitId = unit?.id ?? "unassigned";
      const unitName = unit?.unit_name ?? "Unassigned";

      inspection.results?.forEach((result) => {
        const categoryName =
          result.inspection_item?.category?.name ?? "Uncategorized";

        const key = `${unitId}-${categoryName}`;

        if (!grouped[key]) {
          grouped[key] = {
            unit_id: unitId,
            unit_name: unitName,
            category_name: categoryName,
            total_items: 0,
            complied: 0,
            uncomplied: 0,
            not_applicable: 0,
            compliance_rate: 0,
          };
        }

        const row = grouped[key];

        const status = normalizeResultStatus(result.status);

        if (status === "COMPLIED") {
          row.complied++;
        } else if (status === "UNCOMPLIED") {
          row.uncomplied++;
        } else if (status === "NOT_APPLICABLE") {
          row.not_applicable++;
        }

        row.total_items++;
      });
    });

    return Object.values(grouped)
      .map((row) => {
        const applicable = row.complied + row.uncomplied;

        return {
          ...row,
          compliance_rate:
            applicable > 0 ? (row.complied / applicable) * 100 : 0,
        };
      })
      .sort((a, b) => {
        if (a.unit_name !== b.unit_name) {
          return a.unit_name.localeCompare(b.unit_name);
        }

        return a.category_name.localeCompare(b.category_name);
      });
  }, [filteredInspections]);

  /*
   * =========================================================
   * GROUP CATEGORY ROWS BY UNIT
   * =========================================================
   */

  const groupedUnits = useMemo(() => {
    const groups: Record<
      string,
      {
        unit_id: string;
        unit_name: string;
        rows: CategoryComplianceRow[];
      }
    > = {};

    categoryRows.forEach((row) => {
      if (!groups[row.unit_id]) {
        groups[row.unit_id] = {
          unit_id: row.unit_id,
          unit_name: row.unit_name,
          rows: [],
        };
      }

      groups[row.unit_id].rows.push(row);
    });

    return Object.values(groups);
  }, [categoryRows]);

  /*
   * =========================================================
   * RESET FILTERS
   * =========================================================
   */

  const resetFilters = () => {
    setFromDate("");
    setToDate("");
    setSelectedUnit("ALL");
    setStatusFilter("ALL");
  };

  /*
   * =========================================================
   * PRINT
   * =========================================================
   */

  const handlePrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: "Inspection Compliance Report",
  });

  /*
   * =========================================================
   * EXCEL EXPORT
   * =========================================================
   */

  const handleExportExcel = () => {
    /*
     * Summary
     */

    const summarySheetData = [
      {
        Report: "Inspection Compliance Report",
        "Unit / Station": selectedUnitLabel,
        "From Date": fromDate ? fromDate : "Beginning",
        "To Date": toDate ? toDate : "Present",
        "Total Inspections": statistics.total,
        Passed: statistics.passed,
        "With Defects": statistics.withDefects,
        Failed: statistics.failed,
        "Compliance Rate": `${statistics.complianceRate.toFixed(2)}%`,
      },
    ];

    /*
     * Unit compliance
     */

    const unitSheetData = unitRows.map((row) => ({
      "Unit / Station": row.unit_name,
      "Total Inspections": row.total_inspections,
      Passed: row.passed,
      "With Defects": row.with_defects,
      Failed: row.failed,
      "Compliance Rate": `${row.compliance_rate.toFixed(2)}%`,
    }));

    /*
     * Category compliance
     */

    const categorySheetData = categoryRows.map((row) => ({
      "Unit / Station": row.unit_name,
      Category: row.category_name,
      "Total Items": row.total_items,
      Complied: row.complied,
      Uncomplied: row.uncomplied,
      "Not Applicable": row.not_applicable,
      "Compliance Rate": `${row.compliance_rate.toFixed(2)}%`,
    }));

    /*
     * Create workbook
     */

    const workbook = XLSX.utils.book_new();

    const summarySheet = XLSX.utils.json_to_sheet(summarySheetData);

    const unitSheet = XLSX.utils.json_to_sheet(unitSheetData);

    const categorySheet = XLSX.utils.json_to_sheet(categorySheetData);

    /*
     * Column widths
     */

    summarySheet["!cols"] = [
      { wch: 30 },
      { wch: 25 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 15 },
      { wch: 12 },
      { wch: 18 },
    ];

    unitSheet["!cols"] = [
      { wch: 30 },
      { wch: 20 },
      { wch: 12 },
      { wch: 15 },
      { wch: 12 },
      { wch: 18 },
    ];

    categorySheet["!cols"] = [
      { wch: 30 },
      { wch: 30 },
      { wch: 15 },
      { wch: 12 },
      { wch: 15 },
      { wch: 18 },
      { wch: 18 },
    ];

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    XLSX.utils.book_append_sheet(workbook, unitSheet, "Unit Compliance");

    XLSX.utils.book_append_sheet(
      workbook,
      categorySheet,
      "Category Compliance",
    );

    const filename = `Inspection_Compliance_Report_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;

    XLSX.writeFile(workbook, filename);
  };

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <div className="min-h-full bg-slate-50 p-6 dark:bg-slate-950">
      <div className="mx-auto space-y-6">
        {/* =====================================================
            SCREEN HEADER
        ====================================================== */}

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Inspection Compliance by Unit/Station
            </h1>

            <p className="mt-1 text-slate-500 dark:text-slate-800 dark:text-slate-200">
              Monitor vehicle inspection compliance across units and stations.
            </p>

            {generatedAt && (
              <p className="mt-1 text-slate-800 dark:text-slate-200">
                Generated: {formatDateTime(generatedAt)}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={fetchInspections}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 font-medium text-white transition hover:bg-green-700"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        {/* =====================================================
            FILTERS
        ====================================================== */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-5 w-5 text-blue-600" />

            <h2 className="font-semibold text-slate-900 dark:text-white">
              Report Filters
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* From Date */}

            <div>
              <label className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
                From Date
              </label>

              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* To Date */}

            <div>
              <label className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
                To Date
              </label>

              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Unit */}

            <div>
              <label className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
                Unit / Station
              </label>

              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="ALL">All Units / Stations</option>

                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unit_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}

            <div>
              <label className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
                Inspection Status
              </label>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="ALL">All Statuses</option>

                <option value="PASSED">Passed</option>

                <option value="WITH_DEFECTS">With Defects</option>

                <option value="FAILED">Failed</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <XCircle className="h-4 w-4" />
              Clear Filters
            </button>
          </div>
        </div>

        {/* =====================================================
            PRINTABLE REPORT
        ====================================================== */}

        <div ref={reportRef} className="space-y-6">
          {/* =====================================================
              PRINT HEADER
          ====================================================== */}

          <div className="hidden p-6 text-center print:block">
            <div className="mt-6">
              <h1 className="text-2xl font-bold uppercase">
                Inspection Compliance Report
              </h1>

              <p className="mt-1">
                Reporting Period: {fromDate ? fromDate : "Beginning"} –{" "}
                {toDate ? toDate : "Present"}
              </p>

              <p className="mt-1">
                Generated on:{" "}
                {generatedAt
                  ? formatDateTime(generatedAt)
                  : formatDateTime(new Date())}
              </p>
            </div>
          </div>

          {/* =====================================================
              STATISTICS
          ====================================================== */}

          <div className="grid grid-cols-1 gap-4 grid-cols-5">
            {/* Total */}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-500">
                    Total Inspections
                  </p>

                  <p className="mt-1 text-4xl font-bold text-slate-900 dark:text-white">
                    {statistics.total}
                  </p>
                </div>
              </div>
            </div>

            {/* Passed */}

            <div className="rounded-2xl border border-green-200 bg-white p-5 shadow-sm dark:border-green-900/50 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-500">Passed</p>

                  <p className="mt-1 text-4xl font-bold text-green-600">
                    {statistics.passed}
                  </p>
                </div>
              </div>
            </div>

            {/* Defects */}

            <div className="rounded-2xl border border-yellow-200 bg-white p-5 shadow-sm dark:border-yellow-900/50 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-500">With Defects</p>

                  <p className="mt-1 text-4xl font-bold text-yellow-600">
                    {statistics.withDefects}
                  </p>
                </div>
              </div>
            </div>

            {/* Failed */}

            <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm dark:border-red-900/50 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-500">Failed</p>

                  <p className="mt-1 text-4xl font-bold text-red-600">
                    {statistics.failed}
                  </p>
                </div>
              </div>
            </div>

            {/* Compliance */}

            <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm dark:border-blue-900/50 dark:bg-slate-900">
              <p className="font-medium text-slate-500">Compliance Rate</p>

              <p className="mt-1 text-4xl font-bold text-blue-600">
                {statistics.complianceRate.toFixed(1)}%
              </p>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{
                    width: `${Math.min(statistics.complianceRate, 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* =====================================================
              UNIT COMPLIANCE
          ====================================================== */}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Inspection Compliance by Unit/Station
              </h2>

              <p className="mt-1 text-slate-500 dark:text-slate-800 dark:text-slate-200">
                Overall inspection performance per unit.
              </p>
            </div>

            {/* RESPONSIVE TABLE */}

            <div className="w-full overflow-x-auto">
              <table className="min-w-[850px] w-full border-collapse text-left">
                <thead className="bg-slate-100 dark:bg-slate-800">
                  <tr>
                    <th className="whitespace-nowrap px-5 py-3 font-semibold">
                      Unit / Station
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-center font-semibold">
                      Inspections
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-center font-semibold text-green-600">
                      Passed
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-center font-semibold text-yellow-600">
                      With Defects
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-center font-semibold text-red-600">
                      Failed
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-center font-semibold">
                      Compliance
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center">
                        <Loader2 className="mx-auto h-7 w-7 animate-spin text-blue-600" />
                      </td>
                    </tr>
                  ) : unitRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-12 text-center text-slate-500"
                      >
                        No inspection records found.
                      </td>
                    </tr>
                  ) : (
                    unitRows.map((row) => (
                      <tr
                        key={row.unit_id}
                        className="border-t border-slate-100 dark:border-slate-800"
                      >
                        <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900 dark:text-white">
                          {row.unit_name}
                        </td>

                        <td className="px-5 py-4 text-center">
                          {row.total_inspections}
                        </td>

                        <td className="px-5 py-4 text-center font-semibold text-green-600">
                          {row.passed}
                        </td>

                        <td className="px-5 py-4 text-center font-semibold text-yellow-600">
                          {row.with_defects}
                        </td>

                        <td className="px-5 py-4 text-center font-semibold text-red-600">
                          {row.failed}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex min-w-[140px] items-center gap-3">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                              <div
                                className="h-full rounded-full bg-blue-600"
                                style={{
                                  width: `${Math.min(
                                    row.compliance_rate,
                                    100,
                                  )}%`,
                                }}
                              />
                            </div>

                            <span className="w-14 text-right font-semibold">
                              {row.compliance_rate.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* =====================================================
              CATEGORY COMPLIANCE
          ====================================================== */}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Checklist Compliance by Category
              </h2>

              <p className="mt-1 text-slate-500 dark:text-slate-800 dark:text-slate-200">
                Shows which inspection categories have the most deficiencies.
              </p>
            </div>

            {/* RESPONSIVE TABLE */}

            <div className="w-full overflow-x-auto">
              <table className="min-w-[950px] w-full border-collapse text-left">
                <thead className="bg-slate-100 dark:bg-slate-800">
                  <tr>
                    <th className="whitespace-nowrap px-5 py-3 font-semibold">
                      Unit / Station
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 font-semibold">
                      Category
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-center font-semibold">
                      Total
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-center font-semibold text-green-600">
                      Complied
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-center font-semibold text-red-600">
                      Uncomplied
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-center font-semibold">
                      N/A
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-center font-semibold">
                      Compliance
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {groupedUnits.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-12 text-center text-slate-500"
                      >
                        No checklist results found.
                      </td>
                    </tr>
                  ) : (
                    groupedUnits.map((unit) => {
                      const totalItems = unit.rows.reduce(
                        (sum, row) => sum + row.total_items,
                        0,
                      );

                      const complied = unit.rows.reduce(
                        (sum, row) => sum + row.complied,
                        0,
                      );

                      const uncomplied = unit.rows.reduce(
                        (sum, row) => sum + row.uncomplied,
                        0,
                      );

                      const notApplicable = unit.rows.reduce(
                        (sum, row) => sum + row.not_applicable,
                        0,
                      );

                      const applicable = totalItems - notApplicable;

                      const complianceRate =
                        applicable > 0 ? (complied / applicable) * 100 : 0;

                      return (
                        <React.Fragment key={unit.unit_id}>
                          {/* UNIT SUMMARY */}

                          <tr className="bg-slate-50 dark:bg-slate-800/70">
                            <td colSpan={2} className="px-5 py-3 font-bold">
                              {unit.unit_name}
                            </td>

                            <td className="px-5 py-3 text-center font-bold">
                              {totalItems}
                            </td>

                            <td className="px-5 py-3 text-center font-bold text-green-600">
                              {complied}
                            </td>

                            <td className="px-5 py-3 text-center font-bold text-red-600">
                              {uncomplied}
                            </td>

                            <td className="px-5 py-3 text-center font-bold text-slate-500">
                              {notApplicable}
                            </td>

                            <td className="px-5 py-3 text-center">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 font-bold ${
                                  complianceRate >= 90
                                    ? "bg-green-100 text-green-700"
                                    : complianceRate >= 75
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-red-100 text-red-700"
                                }`}
                              >
                                {complianceRate.toFixed(1)}%
                              </span>
                            </td>
                          </tr>

                          {/* CATEGORY ROWS */}

                          {unit.rows.map((row) => (
                            <tr
                              key={`${row.unit_id}-${row.category_name}`}
                              className="border-t border-slate-100 dark:border-slate-800"
                            >
                              <td className="px-5 py-3 pl-10 text-slate-500 dark:text-slate-800 dark:text-slate-200">
                                └─
                              </td>

                              <td className="px-5 py-3">{row.category_name}</td>

                              <td className="px-5 py-3 text-center">
                                {row.total_items}
                              </td>

                              <td className="px-5 py-3 text-center font-semibold text-green-600">
                                {row.complied}
                              </td>

                              <td className="px-5 py-3 text-center font-semibold text-red-600">
                                {row.uncomplied}
                              </td>

                              <td className="px-5 py-3 text-center text-slate-500">
                                {row.not_applicable}
                              </td>

                              <td className="px-5 py-3 text-center">
                                <span
                                  className={`inline-flex rounded-full px-3 py-1 font-bold ${
                                    row.compliance_rate >= 90
                                      ? "bg-green-100 text-green-700"
                                      : row.compliance_rate >= 75
                                        ? "bg-yellow-100 text-yellow-700"
                                        : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {row.compliance_rate.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* =====================================================
              FOOTER
          ====================================================== */}

          <div className="border-t border-slate-200 pt-3 text-center text-slate-800 dark:text-slate-200 dark:border-slate-800">
            Inspection Compliance Report
            {generatedAt && ` • Generated ${formatDateTime(generatedAt)}`}
          </div>
        </div>
      </div>
    </div>
  );
}
