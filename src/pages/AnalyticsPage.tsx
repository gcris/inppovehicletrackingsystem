import React, { useState, useEffect } from "react";
import { supabase, Unit } from "../lib/supabase";
import { useAuth } from "../components/AuthProvider";
import { BarChart3, FileText, Phone, MessageCircle } from "lucide-react";

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [personnelData, setPersonnelData] = useState<any[]>([]);

  const [summary, setSummary] = useState({
    total_personnel: 0,
    total_patrol_hours: "00:00:00",
    total_man_hours: 0,
    total_kilometers: 0,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [selectedPatrolType, setSelectedPatrolType] = useState<string>("");
  const patrolTypes = [
    "Mobile Patrol",
    "Foot Patrol",
    "TMRU Patrol",
    "Bike Patrol",
    "Seaborne Patrol",
    "Checkpoint",
    "Simulation Exercise",
    "Special Event",
  ];
  const filteredPersonnel = personnelData.filter((person) => {
    const term = searchTerm.toLowerCase();
    return (
      person.badge_number?.toLowerCase().includes(term) ||
      person.fullname.toLowerCase().includes(term) ||
      person.rank?.rank_name?.toLowerCase().includes(term) ||
      person.phone_number?.toLowerCase().includes(term) ||
      person.viber_number?.toLowerCase().includes(term)
    );
  });
  const { unitId, isAdmin } = useAuth();

  const isAdminSafe = isAdmin ?? false;
  const unitIdSafe = unitId !== null && unitId !== undefined ? unitId : null;

  useEffect(() => {
    loadUnits();
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [selectedDate, selectedUnit, selectedPatrolType]);

  const loadUnits = async () => {
    try {
      const { data: unitsData, error } = await supabase
        .from("unit")
        .select("*")
        .order("unit_name", { ascending: true });
      if (error) throw error;
      setUnits(unitsData);
    } catch (error) {
      console.error("Error loading units:", error);
    }
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      // ===========================
      // Dashboard Summary
      // ===========================
      const { data: dashboardData, error: dashboardError } = await supabase.rpc(
        "get_dashboard_statistics",
        {
          p_date: new Date(selectedDate).toISOString().split("T")[0],
          p_unit_id: selectedUnit ?? null,
          p_duty_type: selectedPatrolType || null,
        },
      );

      if (dashboardError) throw dashboardError;

      if (dashboardData?.length > 0) {
        setSummary(dashboardData[0]);
      }

      // ===========================
      // Personnel Report
      // ===========================
      const { data: personnelReport, error: personnelError } =
        await supabase.rpc("get_personnel_patrol_report", {
          p_date: new Date(selectedDate).toISOString().split("T")[0],
          p_unit_id: selectedUnit ?? null,
          p_duty_type: selectedPatrolType || null,
        });

      if (personnelError) throw personnelError;

      setPersonnelData(personnelReport ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-2 gap-6">
        <div>
          <h1 className="text-2xl font-black text-[var(--text)] flex items-center gap-4">
            <BarChart3 className="w-7 h-7" />
            Performance Analytics
          </h1>
          <p className="text-[var(--text)]/[0.9] mt-2">
            Deep dive into unit efficiency and fleet health
          </p>
        </div>
        <div className="flex flex-wrap items-center bg-white dark:bg-slate-900 rounded-xl border-slate-200 dark:border-slate-800 shadow-sm p-1.5 gap-2 lg:ml-auto transition-colors">
          <div className="flex items-center gap-2 rounded-lg shadow-sm p-1 transition-colors">
            <select
              value={selectedPatrolType || ""}
              onChange={(e) => setSelectedPatrolType(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none"
            >
              <option value="">All Patrol Types</option>
              {patrolTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 rounded-lg shadow-sm p-1 transition-colors">
            <select
              value={selectedUnit || ""}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none"
            >
              <option value="">All Units/Station</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.unit_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-1 transition-colors">
            <div className="relative">
              <input
                type="date"
                defaultValue={new Date().toISOString().split("T")[0]}
                className="w-full py-2 pl-2 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none cursor-pointer"
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent)]/[0.5]"></div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2 space-y-8 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="dark:text-white p-8 rounded-2xl border border-slate-400 dark:border-slate-600 shadow-slate-800 dark:shadow-border-slate-200 transition-colors duration-300 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--text)]/[0.9] mb-2">
                    Total no. of Personnel
                  </p>
                  <p className="text-5xl font-bold text-[var(--text)]">
                    {summary.total_personnel}
                  </p>
                </div>
              </div>
            </div>
            <div className="dark:text-white p-8 rounded-2xl border border-slate-400 dark:border-slate-600 shadow-slate-800 dark:shadow-border-slate-200 transition-colors duration-300 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--text)]/[0.9] mb-2">
                    Total Hour Patrolled
                  </p>
                  <p className="text-5xl font-bold text-[var(--text)]">
                    {summary.total_patrol_hours}
                  </p>
                </div>
              </div>
            </div>
            <div className="dark:text-white p-8 rounded-2xl border border-slate-400 dark:border-slate-600 shadow-slate-800 shadow-[var(--accent)]/[0.15] dark:shadow-[var(--accent)]/[0.08] transition-colors duration-300 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--text)]/[0.9] mb-2">
                    Total Man-Hour
                  </p>
                  <p className="text-5xl font-bold text-[var(--text)]">
                    {summary.total_man_hours}
                  </p>
                </div>
              </div>
            </div>
            <div className="dark:text-white p-8 rounded-2xl border border-slate-400 dark:border-slate-600 shadow-slate-800 shadow-[var(--accent)]/[0.15] dark:shadow-[var(--accent)]/[0.08] transition-colors duration-300 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--text)]/[0.9] mb-2">
                    Total Kilometer Patrolled
                  </p>
                  <p className="text-5xl font-bold text-[var(--text)]">
                    {summary.total_kilometers}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-1 gap-8">
            <div className="dark:text-white p-4 rounded-2xl border border-[var(--secondary)]/[0.35] dark:border-[var(--secondary)]/[0.25] shadow-[var(--accent)]/[0.15] dark:shadow-[var(--accent)]/[0.08] transition-colors duration-300 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-black text-[var(--text)]/[0.9] text-[16px] flex items-center gap-4">
                  <FileText className="w-5 h-5" />
                  Personnel Patrol Report
                </h3>
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    placeholder="Search personnel..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="min-w-[350px] px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col transition-colors overflow-x-auto">
                <table>
                  <thead>
                    <tr className="border-b border-[var(--secondary)]/[0.2] dark:border-[var(--secondary)]/[0.1] bg-[var(--primary)]/[0.05] dark:bg-[var(--primary)]/[0.02]">
                      <th className="px-6 py-3 text-black dark:text-white">
                        #
                      </th>
                      <th className="px-6 py-3 text-black dark:text-white">
                        Badge Number
                      </th>
                      <th className="px-6 py-3 text-black dark:text-white">
                        Rank/Name
                      </th>
                      {/* <th className="px-6 py-3 text-black dark:text-white">
                        Contact Info
                      </th> */}
                      <th className="px-6 py-3 text-black dark:text-white">
                        Hour Patrolled
                      </th>
                      <th className="px-6 py-3 text-black dark:text-white">
                        Kilometer Patrolled
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--secondary)]/[0.2]">
                    {filteredPersonnel.length > 0 ? (
                      filteredPersonnel.map((person, index) => (
                        <tr
                          key={index}
                          className="bg-[var(--primary)]/[0.02] hover:bg-[var(--secondary)]/[0.03]"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            {index + 1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {person.badge_number || "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {person.rank_name || "N/A"}{" "}
                            {person.fullname || "N/A"}
                          </td>
                          {/* <td className="px-6 py-4 whitespace-nowrap">
                            {person.phone_number && (
                              <a
                                href={`tel:${person.phone_number}`}
                                className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                              >
                                <Phone className="w-5 h-5" />
                                <span>{person.phone_number}</span>
                              </a>
                            )}
                            {person.viber_number && (
                              <a
                                href={`viber://chat?number=${person.viber_number}`}
                                className="flex items-center gap-2 text-purple-600 hover:text-purple-800 mt-1"
                              >
                                <MessageCircle className="w-5 h-5" />
                                <span>{person.viber_number}</span>
                              </a>
                            )}
                          </td> */}
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            {person.patrol_hours}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            {person.kilometer_patrolled}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-6 py-10 text-center text-[var(--text)]/[0.6]"
                        >
                          No personnel data available for the selected time
                          range
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
