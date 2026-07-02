import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
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
  ArrowLeft,
  ArrowRight,
  X,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  startOfDay,
  endOfDay,
  subHours,
  addHours,
  setHours,
  setMinutes,
  isSameWeek,
} from "date-fns";

export default function CalendarPage() {
  const [calendars, setCalendars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCalendar, setEditingCalendar] = useState<any | null>(null);
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
  });

  // Calendar-specific state
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week" | "day" | "list">(
    "month",
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [eventsByDate, setEventsByDate] = useState<Map<string, any[]>>(
    new Map(),
  );

  const [unitList, setUnitList] = useState<{ id: string; unit_name: string }[]>(
    [],
  );
  const [showEventsList, setShowEventsList] = useState(false);
  const navigate = useNavigate();
  const { unitId, isAdmin } = useAuth();

  // Auto-fill unit_id for non-admin users and disable unit dropdown
  useEffect(() => {
    if (!isAdmin && unitId) {
      setFormData((prev) => ({ ...prev, unit_id: unitId }));
    }
  }, [isAdmin, unitId]);

  // Fetch calendars and organize by date
  const fetchCalendars = async () => {
    setLoading(true);
    try {
      // Build query with unit filtering for non-admin users
      let calendarsQuery = supabase
        .from("calendar")
        .select("*,unit:unit_id(unit_name)")
        // Crucial: Global order ensures events insert into the map in identical tracking rows
        .order("start_date", { ascending: true });

      // Apply unit filtering
      if (!isAdmin && unitId) {
        calendarsQuery = calendarsQuery.eq("unit_id", unitId);
      } else if (isAdmin && unitFilter) {
        calendarsQuery = calendarsQuery.eq("unit_id", unitFilter);
      }

      const { data, error } = await calendarsQuery;

      if (error) throw error;
      if (data) {
        setCalendars(data);

        // Organize events by ALL dates they span for quick lookup
        const eventsMap = new Map<string, any[]>();

        data.forEach((event: any) => {
          const startDate = new Date(event.start_date);
          // Fallback to start_date if end_date is missing or null
          const endDate = event.end_date ? new Date(event.end_date) : startDate;

          // Normalize times to midnight to ensure accurate day-by-day comparisons
          const current = new Date(
            startDate.getFullYear(),
            startDate.getMonth(),
            startDate.getDate(),
          );
          const last = new Date(
            endDate.getFullYear(),
            endDate.getMonth(),
            endDate.getDate(),
          );

          // Loop through every single day the event covers
          while (current <= last) {
            const dateKey = format(current, "yyyy-MM-dd");

            if (!eventsMap.has(dateKey)) {
              eventsMap.set(dateKey, []);
            }

            eventsMap.get(dateKey)!.push(event);

            // Advance the pointer by exactly 1 calendar day
            current.setDate(current.getDate() + 1);
          }
        });

        setEventsByDate(eventsMap);
      }
    } catch (err: any) {
      console.error("Error fetching calendars:", err);
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    fetchCalendars();
    fetchUnits();
  }, [isAdmin, unitId, unitFilter]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this calendar event?"))
      return;
    try {
      const { error } = await supabase.from("calendar").delete().eq("id", id);
      if (error) throw error;
      setEditingCalendar(null);
      fetchCalendars();
    } catch (err: any) {
      alert("Error deleting calendar event: " + err.message);
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
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
          unit_id: formData.unit_id,
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
      });
      fetchCalendars();
    } catch (err: any) {
      alert("Error updating calendar event: " + err.message);
    }
  };

  const handleAddEditCalendar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      if (editingCalendar) {
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
            unit_id: formData.unit_id,
          })
          .eq("id", editingCalendar.id);

        if (error) throw error;
        setEditingCalendar(null);
      } else {
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
        });

        if (error) throw error;
      }

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
      });
      fetchCalendars();
    } catch (err: any) {
      alert("Error adding calendar event: " + err.message);
    }
  };

  // Date navigation functions
  const previousMonth = () => {
    setCurrentDate((prev) => subMonths(prev, 1));
  };

  const nextMonth = () => {
    setCurrentDate((prev) => addMonths(prev, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Handle date selection
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    // Show events list modal instead of add modal
    setShowEventsList(true);
  };

  // Get events for a specific date
  const getEventsForDate = (date: Date): any[] => {
    const dateKey = format(date, "yyyy-MM-dd");
    return eventsByDate.get(dateKey) || [];
  };

  // Filter events by search query
  const getFilteredEventsForDate = (date: Date): any[] => {
    const events = getEventsForDate(date);
    if (!searchQuery.trim()) return events;

    const searchLower = searchQuery.toLowerCase();
    return events.filter(
      (event: any) =>
        event.title?.toLowerCase().includes(searchLower) ||
        event.description?.toLowerCase().includes(searchLower),
    );
  };

  // Generate days for month view
  const getDaysForMonth = (date: Date): Date[] => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    // Get first day of week for the start date (0 = Sunday)
    const startOfWeekDate = startOfWeek(start, { weekStartsOn: 0 });
    // Get end of week for the end date
    const endOfWeekDate = endOfWeek(end, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: startOfWeekDate, end: endOfWeekDate });
  };

  // Get time slots for day/week view (8AM to 6PM)
  const getTimeSlots = (date: Date) => {
    const slots = [];
    for (let hour = 8; hour < 18; hour++) {
      slots.push(setHours(setMinutes(startOfDay(date), 0), hour));
    }
    return slots;
  };

  // Get events for a specific time slot
  const getEventsForTimeSlot = (date: Date, slotStart: Date): any[] => {
    const events = getEventsForDate(date);
    return events.filter((event) => {
      const eventStart = new Date(event.start_date);
      const eventEnd = new Date(event.end_date);
      return (
        (eventStart >= slotStart && eventStart < addHours(slotStart, 1)) ||
        (eventEnd > slotStart && eventEnd <= addHours(slotStart, 1)) ||
        (eventStart <= slotStart && eventEnd >= addHours(slotStart, 1))
      );
    });
  };

  // Filtered calendars for list view (keeping for potential fallback/search)
  const filteredCalendars = calendars.filter((calendar) => {
    const matchesSearch =
      calendar.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      calendar.description?.toLowerCase().includes(searchQuery.toLowerCase());
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
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-sm transition-all focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            <Plus className="w-4 h-4" />
            New
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
          {/* Unit Filter */}
          {isAdmin ? (
            <div className="flex items-center gap-2 rounded-lg shadow-sm p-1 transition-colors">
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
            <div className="flex items-center gap-2 rounded-lg shadow-sm p-1 transition-colors">
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
          <div className="flex items-center gap-2">
            <button
              onClick={previousMonth}
              className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-sm"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goToToday}
              className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-sm"
            >
              <CalendarIcon className="w-5 h-5" />
            </button>
            <button
              onClick={nextMonth}
              className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-sm"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="flex-1">
          {/* Calendar Header */}
          <div className="mb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              {format(currentDate, "MMMM yyyy")}
            </h2>
          </div>

          {/* Calendar Grid */}
          {viewMode === "month" && (
            <div className="space-y-4">
              <div className="grid grid-cols-7 gap-1 text-center font-medium text-slate-800 dark:text-slate-200">
                <div>Sun</div>
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {getDaysForMonth(currentDate).map((day) => {
                  const isToday = isSameDay(day, new Date());
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const events = getFilteredEventsForDate(day);
                  const hasEvents = events.length > 0;
                  const isSelected =
                    selectedDate && isSameDay(day, selectedDate);

                  return (
                    <div
                      key={day.toISOString()}
                      className={`cursor-pointer min-h-[80px] border border-slate-200 dark:border-slate-800 rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${isSelected ? "bg-blue-50 dark:bg-blue-900/30 border-blue-500" : ""} ${!isCurrentMonth ? "opacity-50" : ""} ${isToday ? "border-blue-500 dark:border-blue-400" : ""}`}
                      onClick={() => handleDateSelect(day)}
                    >
                      <div className="flex flex-col h-full p-2">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-lg font-bold text-slate-900 dark:text-white">
                            {format(day, "d")}
                          </span>
                          {hasEvents && (
                            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 px-2 py-0.5 rounded">
                              {events.length}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 space-y-1">
                          {events.map((event) => (
                            <div
                              key={event.id}
                              className="relative pl-3 pr-2 py-1 rounded text-md font-medium overflow-hidden bg-slate-100/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/50 transition-colors duration-150 mb-1 last:mb-0"
                              title={event.title}
                            >
                              {/* Left-edge Ribbon */}
                              <div className="absolute left-0 top-0 bottom-0 w-1 overflow-hidden">
                                <LegendItem category={event.category} />
                              </div>

                              {/* Text Layer wrapped to preserve text-ellipsis truncation perfectly */}
                              <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                                {event.title?.length > 15
                                  ? event.title.substring(0, 15) + "..."
                                  : event.title}
                              </span>
                            </div>
                          ))}

                          {!hasEvents && (
                            <span className="text-slate-500 dark:text-slate-400 italic text-sm">
                              No events
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Day View (expand for details) */}
          {selectedDate && viewMode === "day" && (
            <div className="mt-4 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white mb-2">
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </h3>
              <div className="space-y-2">
                {getFilteredEventsForDate(selectedDate).length > 0 ? (
                  getFilteredEventsForDate(selectedDate).map((event) => (
                    <>
                      <div
                        key={event.id}
                        className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-slate-900 dark:text-white">
                            {event.title}
                          </h4>
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                            {event.unit?.unit_name}
                          </span>
                        </div>
                        {event.description && (
                          <p className="text-slate-600 dark:text-slate-400 mb-2">
                            {event.description}
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span>Time: </span>
                        <span className="font-medium">
                          {format(new Date(event.start_date), "hh:mm a")} -{" "}
                          {format(new Date(event.end_date), "hh:mm a")}
                        </span>
                        <span>Venue: </span>
                        <span className="font-medium">
                          {event.venue || "Not specified"}
                        </span>
                        <span>Category: </span>
                        <span className="font-medium">
                          {event.category || "Not specified"}
                        </span>
                      </div>
                      <div className="mt-2 flex justify-end space-x-2">
                        <button
                          onClick={() => {
                            setFormData({
                              title: event.title || "",
                              description: event.description || "",
                              start_date: event.start_date,
                              end_date: event.end_date,
                              venue: event.venue || "",
                              file_link: event.file_link || "",
                              category: event.category || "",
                              distributions: event.distributions || "",
                              unit_id: event.unit_id || "",
                            });
                            setEditingCalendar(event);
                          }}
                          className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(event.id!)}
                          className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded hover:bg-red-200 dark:hover:red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  ))
                ) : (
                  <p className="text-slate-500 dark:text-slate-400 text-center">
                    No events for this day
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Week View */}
          {viewMode === "week" && (
            <div className="mt-4">
              <div className="space-y-4">
                {/* Time slots header */}
                <div className="grid grid-cols-[60px] gap-x-4 items-start">
                  {/* Time labels */}
                  <div className="space-y-4 text-xs text-slate-500 dark:text-slate-400">
                    {getTimeSlots(currentDate).map((slot, index) => (
                      <div key={index}>{format(slot, "ha")}</div>
                    ))}
                  </div>
                  {/* Days columns */}
                  {getDaysForMonth(currentDate)
                    .filter((day) =>
                      isSameWeek(day, currentDate, { weekStartsOn: 0 }),
                    )
                    .map((day) => {
                      const isToday = isSameDay(day, new Date());
                      const isSelected =
                        selectedDate && isSameDay(day, selectedDate);
                      const events = getEventsForDate(day);
                      return (
                        <div
                          key={day.toISOString()}
                          className={`border border-slate-200 dark:border-slate-800 rounded-lg ${isSelected ? "bg-blue-50 dark:bg-blue-900/30" : ""} ${isToday ? "border-blue-500 dark:border-blue-400" : ""} p-2`}
                          onClick={() => handleDateSelect(day)}
                        >
                          <div className="flex flex-col h-full">
                            <div className="mb-2 font-medium text-slate-900 dark:text-white">
                              {format(day, "EEE, MMM d")}
                            </div>
                            <div className="flex-1 space-y-1 overflow-y-auto">
                              {getTimeSlots(currentDate).map(
                                (slotStart, slotIndex) => {
                                  const slotEvents = getEventsForTimeSlot(
                                    day,
                                    slotStart,
                                  );
                                  return (
                                    <div
                                      key={slotIndex}
                                      className={`min-h-[30px] border-t border-slate-200 dark:border-slate-800 pt-1 ${slotEvents.length > 0 ? "bg-blue-50 dark:bg-blue-900/30" : ""}`}
                                    >
                                      {slotEvents.map((event) => (
                                        <div
                                          key={event.id}
                                          className="px-2 py-0.5 rounded text-xs font-medium overflow-hidden text-ellipsis whitespace-nowrap bg-blue-100 dark:bg-blue-900/30"
                                          title={event.title}
                                        >
                                          {event.title?.length > 12
                                            ? event.title.substring(0, 12) +
                                              "..."
                                            : event.title}
                                        </div>
                                      ))}
                                      {!slotEvents.length && (
                                        <span className="text-slate-400 dark:text-slate-600 italic text-xs">
                                          Free
                                        </span>
                                      )}
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* Event List View (alternative view) */}
          {viewMode === "list" && (
            <div className="mt-4">
              <h3 className="font-bold text-slate-900 dark:text-white mb-2">
                Event List
              </h3>
              <div className="space-y-4">
                {filteredCalendars.length > 0 ? (
                  filteredCalendars.map((event) => (
                    <div
                      key={event.id}
                      className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-slate-900 dark:text-white">
                          {event.title}
                        </h4>
                        <span className="px-2 py-0.5 rounded t-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                          {event.unit?.unit_name}
                        </span>
                      </div>
                      {event.description && (
                        <p className="text-slate-600 dark:text-slate-400 mb-2">
                          {event.description}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span>Date: </span>
                        <span className="font-medium">
                          {format(new Date(event.start_date), "MMM d, yyyy")}{" "}
                          {format(new Date(event.start_date), "hh:mm a")} -{" "}
                          {format(new Date(event.end_date), "hh:mm a")}
                        </span>
                        <span>Venue: </span>
                        <span className="font-medium\">
                          {event.venue || "Not specified"}
                        </span>
                        <span>Category: </span>
                        <span className="font-medium\">
                          {event.category || "Not specified"}
                        </span>
                      </div>
                      <div className="mt-3 flex justify-end space-x-2">
                        <button
                          onClick={() => {
                            setFormData({
                              title: event.title || "",
                              description: event.description || "",
                              start_date: event.start_date,
                              end_date: event.end_date,
                              venue: event.venue || "",
                              file_link: event.file_link || "",
                              category: event.category || "",
                              distributions: event.distributions || "",
                              unit_id: event.unit_id || "",
                            });
                            setEditingCalendar(event);
                          }}
                          className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(event.id!)}
                          className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded hover:bg-red-200 dark:hover:red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate-500 dark:text-slate-400">
                      No events found
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Edit Calendar Modal */}
          {/* {editingCalendar && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="p-8 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-xl text-slate-900 dark:text-white">
                    Edit Calendar Event
                  </h2>
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
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
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
                          setFormData({
                            ...formData,
                            start_date: e.target.value,
                          })
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
                        setFormData({
                          ...formData,
                          distributions: e.target.value,
                        })
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
          )} */}

          {/* Add/Edit Modal */}
          {showAddModal && (
            <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 transition-colors">
                  <h3 className="text-slate-900 dark:text-white">
                    {editingCalendar ? "Edit" : "Add"} Calendar Event
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
                  <form
                    onSubmit={handleAddEditCalendar}
                    className="p-6 space-y-5"
                  >
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
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
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
                          type="datetime-local"
                          value={formData.start_date}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              start_date: e.target.value,
                            })
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
                            setFormData({
                              ...formData,
                              end_date: e.target.value,
                            })
                          }
                          className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
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
                      <label className="  text-slate-800 dark:text-slate-200 tml-1">
                        Category
                      </label>
                      <select
                        value={formData.category!}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            category: e.target.value,
                          })
                        }
                        className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                      >
                        <option value="">Select Category</option>
                        <option value="Rush/Urgent">Rush/Urgent</option>
                        <option value="Priority">Priority</option>
                        <option value="Daily Routine">Daily Routine</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-800 dark:text-slate-200 tml-1">
                        File Link
                      </label>
                      <input
                        type="text"
                        value={formData.file_link}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            file_link: e.target.value,
                          })
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
                        {editingCalendar ? "Edit" : "Add"} Event
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Events List Modal */}
      {showEventsList && selectedDate && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Events for {format(selectedDate, "MMMM d, yyyy")}
              </h2>
              <button
                onClick={() => setShowEventsList(false)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-800 dark:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <LegendItem category={"Rush/Urgent"} />
              <LegendItem category={"Priority"} />
              <LegendItem category={"Daily Routine"} />
            </div>
            <div className="p-6 space-y-4 overflow-y-auto max-h-[80vh]">
              {getFilteredEventsForDate(selectedDate).length > 0 ? (
                getFilteredEventsForDate(selectedDate).map((event) => (
                  <div
                    key={event.id}
                    className="border rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3 relative pl-5 overflow-hidden py-3">
                      {/* First Column: Absolute Left-Edge Ribbon */}
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 flex-shrink-0">
                        <LegendItem category={event.category} />
                      </div>

                      {/* Second Column: Heading takes remaining space */}
                      <h3 className="font-semibold text-slate-900 dark:text-white flex-1 min-w-0">
                        {event.title}
                        {" ("}
                        {format(new Date(event.start_date), "hh:mm a")}
                        {" - "}
                        {format(new Date(event.end_date), "hh:mm a")}
                        {")"}
                      </h3>

                      {/* Third Column: Actions row */}
                      <div className="flex justify-end space-x-2 flex-shrink-0">
                        <button
                          onClick={() => {
                            console.log("Editing event:", event);
                            const formatForInput = (dateString: string) => {
                              if (!dateString) return "";
                              return format(
                                new Date(dateString),
                                "yyyy-MM-dd'T'HH:00",
                              );
                            };
                            setFormData({
                              title: event.title || "",
                              description: event.description || "",
                              start_date: formatForInput(event.start_date),
                              end_date: formatForInput(event.end_date),
                              venue: event.venue || "",
                              file_link: event.file_link || "",
                              category: event.category || "",
                              distributions: event.distributions || "",
                              unit_id: event.unit_id || "",
                            });
                            setEditingCalendar(event);
                            setShowEventsList(false);
                            setTimeout(() => {
                              setShowAddModal(true);
                            }, 100);
                          }}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                          title="Edit event"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                "Are you sure you want to delete this event?",
                              )
                            ) {
                              setShowEventsList(false);
                              setTimeout(() => {
                                handleDelete(event.id!);
                              }, 100);
                            }
                          }}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg text-red-500 dark:text-red-400"
                          title="Delete event"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">
                      Description: {event.description}
                    </p>
                    <p className="text-slate-600 dark:text-slate-400">
                      Venue: {event.venue}
                    </p>
                    {event.file_link && (
                      <p className="text-slate-600 dark:text-slate-400">
                        Attached Document (Implan/Tasks/Memo):{" "}
                        <a
                          href={event.file_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline break-all"
                        >
                          Click here to view
                        </a>
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-slate-800 dark:text-slate-200 italic text-center">
                  No events for this date
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendItem({ category }: { category: string }) {
  const colorClass =
    category === "Rush/Urgent"
      ? "bg-red-500"
      : category === "Priority"
        ? "bg-orange-500"
        : category === "Daily Routine"
          ? "bg-blue-500"
          : "bg-gray-400";

  // Use w-full h-full so it conforms to whichever container size you pick above!
  return <div className={`w-full h-full ${colorClass}`} />;
}
