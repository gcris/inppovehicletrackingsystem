import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ChevronRight, X } from "lucide-react";
import { useTheme } from "../../../components/ThemeProvider";

export interface DefectTrendData {
  categoryId: string;
  categoryName: string;
  defectCount: number;
}

export interface DefectItemData {
  itemId: string;
  itemName: string;
  defectCount: number;
  mobilities: [];
}

interface DefectTrendChartProps {
  data: DefectTrendData[];
  defectItems: Record<string, DefectItemData[]>;
  loading?: boolean;
}

export default function DefectTrendChart({
  data: chartData,
  defectItems,
  loading = false,
}: DefectTrendChartProps) {
  const [selectedCategory, setSelectedCategory] =
    useState<DefectTrendData | null>(null);
  const theme = useTheme();

  // ==========================================
  // LOADING
  // ==========================================

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5">
          <div className="h-5 w-56 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />

          <div className="mt-2 h-4 w-80 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        </div>

        <div className="h-[320px] animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  // ==========================================
  // NO DATA
  // ==========================================

  if (chartData.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex min-h-[320px] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-full bg-green-100 dark:bg-green-800">
              <span className="text-6xl">✓</span>
            </div>

            <p className="font-semibold text-slate-700 dark:text-slate-200">
              No inspection defects found
            </p>

            <p className="mt-1 text-slate-400">
              Defect trends will appear here once inspections are recorded.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // SELECTED CATEGORY ITEMS
  // ==========================================

  const selectedItems = selectedCategory
    ? (defectItems[selectedCategory.categoryId] ?? [])
    : [];

  // ==========================================
  // BAR CLICK
  // ==========================================

  const handleBarClick = (_data: unknown, index: number) => {
    const selected = chartData[index];

    console.log("Clicked:", selected);

    if (!selected) return;

    setSelectedCategory(selected);
  };

  return (
    <>
      {/* ========================================
          CHART
      ======================================== */}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}

        <div className="mb-5">
          <p className="text-lg font-bold text-slate-900 dark:text-white">
            Inspection Results | Common Defects
          </p>

          <p className="mt-1 text-slate-500 dark:text-slate-300">
            Click a category to view recurring inspection defects
          </p>
        </div>

        {/* Chart */}

        <div
          className="w-full"
          style={{
            height: Math.max(320, chartData.length * 55),
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                className="stroke-slate-200 dark:stroke-slate-700"
              />

              <XAxis
                type="number"
                allowDecimals={false}
                tick={{
                  fontSize: 18,
                  fill: theme === "dark" ? "#e2e8f0" : "#475569",
                }}
              />

              <YAxis
                type="category"
                dataKey="categoryName"
                width={190}
                tick={{
                  fontSize: 18,
                  fill: theme === "dark" ? "#e2e8f0" : "#475569",
                }}
              />

              <Tooltip
                cursor={{
                  fill: "rgba(148, 163, 184, 0.10)",
                }}
                formatter={(value) => [
                  `${value} defect${Number(value) !== 1 ? "s" : ""}`,
                  "Defects",
                ]}
              />

              <Bar
                dataKey="defectCount"
                name="Defects"
                radius={[0, 6, 6, 0]}
                barSize={28}
                onClick={handleBarClick}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={entry.categoryId}
                    cursor="pointer"
                    fill={
                      index === 0
                        ? "#ef4444"
                        : index === 1
                          ? "#f97316"
                          : index === 2
                            ? "#f59e0b"
                            : "#3b82f6"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ========================================
          DEFECT DETAILS MODAL
      ======================================== */}

      {selectedCategory && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setSelectedCategory(null)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ==================================
                MODAL HEADER
            ================================== */}

            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div>
                <p className="font-semibold tracking-wider text-slate-500 dark:text-slate-300">
                  Inspection Category
                </p>

                <h3 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {selectedCategory.categoryName}
                </h3>

                <p className="mt-1 text-slate-500 dark:text-slate-300">
                  {selectedCategory.defectCount} total defect
                  {selectedCategory.defectCount !== 1 ? "s" : ""}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* ==================================
                MODAL BODY
            ================================== */}

            <div className="max-h-[60vh] overflow-y-auto p-5">
              {selectedItems.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-slate-500 dark:text-slate-400">
                    No defect details available.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedItems.map((item, index) => (
                    <div
                      key={item.itemId}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"
                    >
                      {/* Number */}

                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100 font-bold text-red-600 dark:bg-red-900/30 dark:text-red-400">
                        {index + 1}
                      </div>

                      {/* Item */}

                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-700 dark:text-slate-200">
                          {item.itemName}
                        </p>

                        <p className="text-slate-500 dark:text-slate-400">
                          {item.defectCount} occurrence
                          {item.defectCount !== 1 ? "s" : ""}
                        </p>
                      </div>

                      <ChevronRight size={16} className="text-slate-400" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
