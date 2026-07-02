import React, { useState, useEffect } from "react";
import { supabase, Calendar } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../components/AuthProvider";
import {
  Car,
  Search,
  RefreshCcw,
  Trash2,
  Edit2,
  Calendar as CalendarIcon,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function CalendarPage() {
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCalendar, setEditingCalendar] = useState<Calendar | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [unitFilter, setUnitFilter] = useState<string>("");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    venue: "",
    file_link: "",
    category: "",
    distributions: "",
    unit_id: "",
    user_id: "",
  });

  const [unitList, setUnitList] = useState<{ id: string; unit_name: string }[]>(
    [],
  );
  const navigate = useNavigate();
  const { unitId, isAdmin, user } = useAuth();

  // Auto-fill unit_id for non-admin users and disable unit dropdown
  useEffect(() => {
    if (!isAdmin && unitId) {
      setFormData((prev) => ({ ...prev, unit_id: unitId }));
    }
  }, [isAdmin, unitId]);

  useEffect(() => {
    fetchCalendars();
    fetchUnits();
  }, [isAdmin, unitId, unitFilter]);

  const fetchUnits = async () => {
    try {
      // Apply unit filtering for non-admin users
      let unitQuery = supabase.from("unit").select("id, unit_name");

      if (!isAdmin && unitId) {
        unitQuery = unitQuery.eq("id", unitId);
      }

      const { data, error } = await unitQuery;
      if (error) throw error;
      if (data) setUnitList(data);
    } catch (err: any) {
      console.error("Error fetching units:", err);
    }
  };

  const fetchCalendars = async () => {
    setLoading(true);
    try {
      // Build query with unit filtering for non-admin users
      let calendarsQuery = supabase
        .from("calendar")
        .select(
          `
        *,
        unit:unit_id(unit_name)
      `,
        )
        .order("start_date", { ascending: true });

      // Apply unit filtering
      if (!isAdmin && unitId) {
        calendarsQuery = calendarsQuery.eq("unit_id", unitId);
      } else if (isAdmin && unitFilter) {
        calendarsQuery = calendarsQuery.eq("unit_id", unitFilter);
      }

      const { data, error } = await calendarsQuery;

      if (error) throw error;
      if (data) setCalendars(data);
    } catch (err: any) {
      console.error("Error fetching calendars:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this calendar event?"))
      return;
    try {
      const { error } = await supabase.from("calendar").delete().eq("id", id);
      if (error) throw error;
      fetchCalendars();
    } catch (err: any) {
      alert("Error deleting calendar event: " + err.message);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCalendar) return;

    try {
      const { error } = await supabase
        .from("calendar")
        .update({
          title: formData.title,
          description: formData.description,
          start_date: formData.start_date,
          end_date: formData.end_date,
          venue: formData.venue,
          file_link: formData.file_link,
          category: formData.category,
          distributions: formData.distributions,
          unit_id: unitId,
          user_id: user?.id,
        })
        .eq("id", editingCalendar.id);

      if (error) throw error;
      setEditingCalendar(null);
      setFormData({
        title: "",
        description: "",
        start_date: "",
        end_date: "",
        venue: "",
        file_link: "",
        category: "",
        distributions: "",
        unit_id: unitId || "",
        user_id: user?.id || "",
      });
      fetchCalendars();
    } catch (err: any) {
      alert("Error updating calendar event: " + err.message);
    }
  };

  const handleAddCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from("calendar").insert({
        title: formData.title,
        description: formData.description,
        start_date: formData.start_date,
        end_date: formData.end_date,
        venue: formData.venue,
        file_link: formData.file_link,
        category: formData.category,
        distributions: formData.distributions,
        unit_id: formData.unit_id,
        user_id: user?.id,
      });

      if (error) throw error;
      setShowAddModal(false);
      setFormData({
        title: "",
        description: "",
        start_date: "",
        end_date: "",
        venue: "",
        file_link: "",
        category: "",
        distributions: "",
        unit_id: unitId || "",
        user_id: user?.id || "",
      });
      fetchCalendars();
    } catch (err: any) {
      alert("Error adding calendar event: " + err.message);
    }
  };

  const filteredCalendars = calendars.filter((calendar) => {
    const matchesSearch =
      calendar.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      calendar.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      false;
    return matchesSearch;
  });

  return (
    <div className="flex flex-col gap-6 px-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-blue-600" />
            Calendar
          </h1>
          <p className="text-slate-800 dark:text-slate-200 mt-1">
            Manage calendar events
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Unit Filter */}
          {isAdmin ? (
            <div className="flex items-center gap-2 border rounded-lg shadow-sm p-1 transition-colors">
              <select
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-2 px-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none"
              >
                <option value="">All Units</option>
                {unitList.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unit_name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 border rounded-lg shadow-sm p-1 transition-colors">
              <label className="text-slate-800 dark:text-slate-200">
                Unit:
              </label>
              <select
                disabled
                className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-2 px-3 font-bold text-slate-900 dark:text-white"
              >
                <option value={unitId ?? ""}>
                  {unitList.find((u) => u.id === unitId)?.unit_name ?? unitId}
                </option>
              </select>
            </div>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-sm transition-all focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            <Plus className="w-4 h-4" />
            New Event
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-10 pr-4 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 w-64 shadow-sm"
            />
          </div>

          <button
            onClick={fetchCalendars}
            className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-sm"
          >
            <RefreshCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                  <th className="p-4 text-slate-800 dark:text-slate-200">
                    Title
                  </th>
                  <th className="p-4 text-slate-800 dark:text-slate-200">
                    Date & Time
                  </th>
                  <th className="p-4 text-slate-800 dark:text-slate-200">
                    Venue
                  </th>
                  <th className="p-4 text-slate-800 dark:text-slate-200">
                    Assigned Unit
                  </th>
                  <th className="p-4 text-slate-800 dark:text-slate-200">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {filteredCalendars.map((calendar) => {
                  const startDate = calendar.start_date
                    ? new Date(calendar.start_date)
                    : null;
                  const endDate = calendar.end_date
                    ? new Date(calendar.end_date)
                    : null;
                  const formattedDate =
                    startDate && endDate
                      ? `${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : startDate
                        ? `${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : "No date specified";

                  return (
                    <tr
                      key={calendar.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <span className="text-slate-900 dark:text-white tracking-tight">
                            {calendar.title || "No Title"}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-slate-800 dark:text-slate-200">
                          {formattedDate}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-slate-800 dark:text-slate-200">
                          {calendar.venue || "Not specified"}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-slate-800 dark:text-slate-200">
                          {calendar.unit?.unit_name || "Not Assigned"}
                        </span>
                      </td>
                      <td className="p-4 flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setEditingCalendar(calendar);
                            setFormData({
                              title: calendar.title || "",
                              description: calendar.description || "",
                              start_date: calendar.start_date || "",
                              end_date: calendar.end_date || "",
                              venue: calendar.venue || "",
                              file_link: calendar.file_link || "",
                              category: calendar.category || "",
                              distributions: calendar.distributions || "",
                              unit_id: calendar.unit_id || "",
                              user_id: calendar.user_id || "",
                            });
                          }}
                          title="Edit Event"
                          className="p-2 text-slate-800 dark:text-slate-200 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:bg-amber-900/20 rounded-lg transition-all"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(calendar.id)}
                          title="Delete Event"
                          className="p-2 text-slate-800 dark:text-slate-200 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:bg-red-900/20 rounded-lg transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredCalendars.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center py-20">
              <CalendarIcon className="w-12 h-12 text-slate-100 dark:text-slate-800 mb-4" />
              <p className="text-slate-400 dark:text-slate-800 font-bold text-sm">
                No calendar events found
              </p>
            </div>
          )}
        </div>
      )}

      {/* Edit Calendar Modal */}
      {editingCalendar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-xl text-slate-900 dark:text-white">
                Edit Calendar Event
              </h2>
              <p className="text-slate-400 font-bold tmt-1">
                Modify calendar event details
              </p>
            </div>

            <form onSubmit={handleUpdate} className="p-8 space-y-5">
              <div>
                <label className="text-slate-800 dark:text-slate-200 tml-1">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-800 dark:text-slate-200 tml-1">
                    Unit/Station
                  </label>
                  <select
                    value={formData.unit_id}
                    onChange={(e) =>
                      setFormData({ ...formData, unit_id: e.target.value })
                    }
                    disabled={!isAdmin && !!unitId}
                    className={`w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${!isAdmin && unitId ? "bg-slate-200 dark:bg-slate-700/50 cursor-not-allowed" : ""}`}
                  >
                    <option value="">Select Unit</option>
                    {unitList.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.unit_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-800 dark:text-slate-200 tml-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="Event description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-800 dark:text-slate-200 tml-1">
                    Start Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={(e) =>
                      setFormData({ ...formData, start_date: e.target.value })
                    }
                    className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-800 dark:text-slate-200 tml-1">
                    End Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.end_date}
                    onChange={(e) =>
                      setFormData({ ...formData, end_date: e.target.value })
                    }
                    className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-800 dark:text-slate-200 tml-1">
                    Venue
                  </label>
                  <input
                    type="text"
                    value={formData.venue}
                    onChange={(e) =>
                      setFormData({ ...formData, venue: e.target.value })
                    }
                    className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="Location"
                  />
                </div>
                <div>
                  <label className="text-slate-800 dark:text-slate-200 tml-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="Event category"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-800 dark:text-slate-200 tml-1">
                  File Link
                </label>
                <input
                  type="text"
                  value={formData.file_link}
                  onChange={(e) =>
                    setFormData({ ...formData, file_link: e.target.value })
                  }
                  className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="URL to document or media"
                />
              </div>

              <div>
                <label className="text-slate-800 dark:text-slate-200 tml-1">
                  Distributions
                </label>
                <textarea
                  value={formData.distributions}
                  onChange={(e) =>
                    setFormData({ ...formData, distributions: e.target.value })
                  }
                  rows={2}
                  className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="Distribution lists or notes"
                />
              </div>

              <div className="flex items-center gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setEditingCalendar(null)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none transition-all"
                >
                  Update Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 transition-colors">
              <h3 className="text-slate-900 dark:text-white">
                Add New Calendar Event
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 bg-white dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                <span className="text-slate-400 font-bold text-lg leading-none cursor-pointer">
                  ×
                </span>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              <form onSubmit={handleAddCalendar} className="p-6 space-y-5">
                <div>
                  <label className="text-slate-800 dark:text-slate-200 tml-1">
                    Unit/Station
                  </label>
                  <select
                    required
                    value={formData.unit_id}
                    onChange={(e) =>
                      setFormData({ ...formData, unit_id: e.target.value })
                    }
                    disabled={!isAdmin && !!unitId}
                    className={`w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${!isAdmin && unitId ? "bg-slate-200 dark:bg-slate-700/50 cursor-not-allowed" : ""}`}
                  >
                    <option value="" disabled>
                      Select Unit Headquarters
                    </option>
                    {unitList.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.unit_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-800 dark:text-slate-200 tml-1">
                    Title
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
                    placeholder="Event Title"
                  />
                </div>

                <div>
                  <label className="text-slate-800 dark:text-slate-200 tml-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="Additional details about the event"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-800 dark:text-slate-200 tml-1">
                      Start Date & Time
                    </label>
                    <input
                      required
                      type="datetime-local"
                      value={formData.start_date}
                      onChange={(e) =>
                        setFormData({ ...formData, start_date: e.target.value })
                      }
                      className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-slate-800 dark:text-slate-200 tml-1">
                      End Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.end_date}
                      onChange={(e) =>
                        setFormData({ ...formData, end_date: e.target.value })
                      }
                      className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-800 dark:text-slate-200 tml-1">
                    Venue
                  </label>
                  <input
                    type="text"
                    value={formData.venue}
                    onChange={(e) =>
                      setFormData({ ...formData, venue: e.target.value })
                    }
                    className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="Location"
                  />
                </div>

                <div>
                  <label className="text-slate-800 dark:text-slate-200 tml-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="Event category"
                  />
                </div>

                <div>
                  <label className="text-slate-800 dark:text-slate-200 tml-1">
                    File Link
                  </label>
                  <input
                    type="text"
                    value={formData.file_link}
                    onChange={(e) =>
                      setFormData({ ...formData, file_link: e.target.value })
                    }
                    className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="URL to document or media"
                  />
                </div>

                <div>
                  <label className="text-slate-800 dark:text-slate-200 tml-1">
                    Distributions
                  </label>
                  <textarea
                    value={formData.distributions}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        distributions: e.target.value,
                      })
                    }
                    className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="Distribution lists or notes"
                  />
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none transition-all"
                  >
                    Add Event
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
