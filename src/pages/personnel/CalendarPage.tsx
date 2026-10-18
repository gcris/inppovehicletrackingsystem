import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../components/AuthProvider";
import {
  CalendarDays,
  Calendar as CalendarIcon,
  Search,
  Trash2,
  Edit2,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  MapPin,
  Clock3,
  FileText,
  Users,
  Shield,
  List,
  LayoutGrid,
  CalendarRange,
  CheckCircle2,
  CircleDot,
  RefreshCcw,
  Check,
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
  addHours,
  setHours,
  setMinutes,
  isSameWeek,
  addDays,
} from "date-fns";

type CalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  start_date: string;
  end_date?: string | null;
  venue?: string | null;
  file_link?: string | null;
  category?: string | null;
  distributions?: string[] | null;
  unit_id?: string | null;
  user_id?: string | null;
  unit?: {
    unit_name?: string | null;
  } | null;
};

type Unit = {
  id: string;
  unit_name: string;
};

type ViewMode = "month" | "week" | "day" | "list";

type FormData = {
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  venue: string;
  file_link: string;
  category: string;
  distributions: string[];
  unit_id: string;
};

const EMPTY_FORM: FormData = {
  title: "",
  description: "",
  start_date: "",
  end_date: "",
  venue: "",
  file_link: "",
  category: "",
  distributions: [],
  unit_id: "",
};

export default function CalendarPage() {
  const [calendars, setCalendars] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [editingCalendar, setEditingCalendar] = useState<CalendarEvent | null>(
    null,
  );

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEventsList, setShowEventsList] = useState(false);

  const [unitFilter, setUnitFilter] = useState<string>("");

  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);

  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  const [viewMode, setViewMode] = useState<ViewMode>("month");

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [eventsByDate, setEventsByDate] = useState<
    Map<string, CalendarEvent[]>
  >(new Map());

  const [unitList, setUnitList] = useState<Unit[]>([]);

  const [distributionList, setDistributionList] = useState<Unit[]>([]);

  const [saving, setSaving] = useState(false);

  const { unitId, isAdmin, user } = useAuth();

  /*
  |--------------------------------------------------------------------------
  | FORM HELPERS
  |--------------------------------------------------------------------------
  */

  const resetForm = () => {
    setFormData({
      ...EMPTY_FORM,
      unit_id: unitId || "",
    });
  };

  const openNewEvent = () => {
    setEditingCalendar(null);

    setFormData({
      ...EMPTY_FORM,
      unit_id: unitId || "",
    });

    setShowAddModal(true);
  };

  const closeEventModal = () => {
    setShowAddModal(false);
    setEditingCalendar(null);
    resetForm();
  };

  const formatDateTimeLocal = (dateString?: string | null) => {
    if (!dateString) return "";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return format(date, "yyyy-MM-dd'T'HH:mm");
  };

  const openEditEvent = (event: CalendarEvent) => {
    setEditingCalendar(event);

    setFormData({
      title: event.title || "",
      description: event.description || "",
      start_date: formatDateTimeLocal(event.start_date),
      end_date: formatDateTimeLocal(event.end_date),
      venue: event.venue || "",
      file_link: event.file_link || "",
      category: event.category || "",
      distributions: Array.isArray(event.distributions)
        ? event.distributions
        : [],
      unit_id: event.unit_id || "",
    });

    setShowEventsList(false);
    setShowAddModal(true);
  };

  /*
  |--------------------------------------------------------------------------
  | AUTH / UNIT AUTO-FILL
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (!isAdmin && unitId) {
      setFormData((prev) => ({
        ...prev,
        unit_id: unitId,
      }));
    }
  }, [isAdmin, unitId]);

  /*
  |--------------------------------------------------------------------------
  | FETCH CALENDAR EVENTS
  |--------------------------------------------------------------------------
  */

  const fetchCalendars = async () => {
    setLoading(true);

    try {
      let calendarsQuery = supabase
        .from("calendar")
        .select(
          `
            *,
            unit:unit_id(
              unit_name
            )
          `,
        )
        .order("start_date", {
          ascending: true,
        });

      if (!isAdmin && unitId) {
        calendarsQuery = calendarsQuery.contains("distributions", [unitId]);
      } else if (isAdmin && unitFilter) {
        calendarsQuery = calendarsQuery.contains("distributions", [unitFilter]);
      }

      const { data, error } = await calendarsQuery;

      if (error) {
        throw error;
      }

      const events = (data || []) as CalendarEvent[];

      setCalendars(events);

      /*
      |--------------------------------------------------------------------------
      | ORGANIZE EVENTS BY EVERY DATE THEY SPAN
      |--------------------------------------------------------------------------
      */

      const eventsMap = new Map<string, CalendarEvent[]>();

      events.forEach((event) => {
        if (!event.start_date) return;

        const startDate = new Date(event.start_date);

        const endDate = event.end_date ? new Date(event.end_date) : startDate;

        if (
          Number.isNaN(startDate.getTime()) ||
          Number.isNaN(endDate.getTime())
        ) {
          return;
        }

        const current = startOfDay(startDate);
        const last = startOfDay(endDate);

        while (current <= last) {
          const dateKey = format(current, "yyyy-MM-dd");

          if (!eventsMap.has(dateKey)) {
            eventsMap.set(dateKey, []);
          }

          eventsMap.get(dateKey)!.push(event);

          current.setDate(current.getDate() + 1);
        }
      });

      setEventsByDate(eventsMap);
    } catch (error: any) {
      console.error("Error fetching calendars:", error);

      alert(
        `Unable to load calendar events.\n\n${
          error?.message || "Unknown error"
        }`,
      );
    } finally {
      setLoading(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | FETCH UNITS
  |--------------------------------------------------------------------------
  */

  const fetchUnits = async () => {
    try {
      const { data: allUnits, error: distributionError } = await supabase
        .from("unit")
        .select("id, unit_name")
        .order("unit_name");

      if (distributionError) {
        throw distributionError;
      }

      setDistributionList(allUnits || []);

      let unitQuery = supabase
        .from("unit")
        .select("id, unit_name")
        .order("unit_name");

      if (!isAdmin && unitId) {
        unitQuery = unitQuery.eq("id", unitId);
      }

      const { data, error } = await unitQuery;

      if (error) {
        throw error;
      }

      setUnitList(data || []);
    } catch (error: any) {
      console.error("Error fetching units:", error);
    }
  };

  useEffect(() => {
    fetchCalendars();
    fetchUnits();
  }, [isAdmin, unitId, unitFilter]);

  /*
  |--------------------------------------------------------------------------
  | FILTERED EVENTS
  |--------------------------------------------------------------------------
  */

  const filteredCalendars = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return calendars;
    }

    return calendars.filter((calendar) => {
      return (
        calendar.title?.toLowerCase().includes(query) ||
        calendar.description?.toLowerCase().includes(query) ||
        calendar.venue?.toLowerCase().includes(query) ||
        calendar.category?.toLowerCase().includes(query)
      );
    });
  }, [calendars, searchQuery]);

  const monthlyCalendars = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);

    return filteredCalendars
      .filter((event) => {
        if (!event.start_date) return false;

        const eventStart = new Date(event.start_date);
        const eventEnd = event.end_date ? new Date(event.end_date) : eventStart;

        if (
          Number.isNaN(eventStart.getTime()) ||
          Number.isNaN(eventEnd.getTime())
        ) {
          return false;
        }

        // Event belongs to the selected month if
        // any portion of the event overlaps that month.
        return eventStart <= monthEnd && eventEnd >= monthStart;
      })
      .sort(
        (a, b) =>
          new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
      );
  }, [filteredCalendars, currentDate]);

  /*
  |--------------------------------------------------------------------------
  | EVENT HELPERS
  |--------------------------------------------------------------------------
  */

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateKey = format(date, "yyyy-MM-dd");

    const events = eventsByDate.get(dateKey) || [];

    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return events;
    }

    return events.filter((event) => {
      return (
        event.title?.toLowerCase().includes(query) ||
        event.description?.toLowerCase().includes(query) ||
        event.venue?.toLowerCase().includes(query) ||
        event.category?.toLowerCase().includes(query)
      );
    });
  };

  /*
  |--------------------------------------------------------------------------
  | DATE NAVIGATION
  |--------------------------------------------------------------------------
  */

  const previousMonth = () => {
    setCurrentDate((prev) => subMonths(prev, 1));
  };

  const nextMonth = () => {
    setCurrentDate((prev) => addMonths(prev, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  /*
  |--------------------------------------------------------------------------
  | DATE SELECTION
  |--------------------------------------------------------------------------
  */

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);

    if (viewMode === "month") {
      setShowEventsList(true);
    } else {
      setViewMode("day");
    }
  };

  /*
  |--------------------------------------------------------------------------
  | MONTH DAYS
  |--------------------------------------------------------------------------
  */

  const getDaysForMonth = (date: Date): Date[] => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    const startDate = startOfWeek(start, {
      weekStartsOn: 0,
    });

    const endDate = endOfWeek(end, {
      weekStartsOn: 0,
    });

    return eachDayOfInterval({
      start: startDate,
      end: endDate,
    });
  };

  /*
  |--------------------------------------------------------------------------
  | WEEK DAYS
  |--------------------------------------------------------------------------
  */

  const getDaysForWeek = (date: Date): Date[] => {
    const start = startOfWeek(date, {
      weekStartsOn: 0,
    });

    return Array.from(
      {
        length: 7,
      },
      (_, index) => addDays(start, index),
    );
  };

  /*
  |--------------------------------------------------------------------------
  | TIME SLOTS
  |--------------------------------------------------------------------------
  */

  const getTimeSlots = (date: Date) => {
    const slots: Date[] = [];

    for (let hour = 6; hour < 22; hour++) {
      slots.push(setHours(setMinutes(startOfDay(date), 0), hour));
    }

    return slots;
  };

  /*
  |--------------------------------------------------------------------------
  | EVENTS FOR TIME SLOT
  |--------------------------------------------------------------------------
  */

  const getEventsForTimeSlot = (
    date: Date,
    slotStart: Date,
  ): CalendarEvent[] => {
    const events = getEventsForDate(date);

    const slotEnd = addHours(slotStart, 1);

    return events.filter((event) => {
      if (!event.start_date) return false;

      const eventStart = new Date(event.start_date);

      const eventEnd = event.end_date ? new Date(event.end_date) : eventStart;

      return (
        (eventStart >= slotStart && eventStart < slotEnd) ||
        (eventEnd > slotStart && eventEnd <= slotEnd) ||
        (eventStart <= slotStart && eventEnd >= slotEnd)
      );
    });
  };

  /*
  |--------------------------------------------------------------------------
  | DELETE EVENT
  |--------------------------------------------------------------------------
  */

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this calendar event?\n\nThis action cannot be undone.",
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase.from("calendar").delete().eq("id", id);

      if (error) {
        throw error;
      }

      setShowEventsList(false);
      setEditingCalendar(null);

      await fetchCalendars();
    } catch (error: any) {
      alert(
        `Error deleting calendar event:\n\n${
          error?.message || "Unknown error"
        }`,
      );
    }
  };

  /*
  |--------------------------------------------------------------------------
  | SAVE EVENT
  |--------------------------------------------------------------------------
  */

  const handleAddEditCalendar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (saving) return;

    if (!formData.title.trim()) {
      alert("Please enter an event title.");
      return;
    }

    if (!formData.unit_id) {
      alert("Please select a Unit/Station.");
      return;
    }

    if (!formData.start_date) {
      alert("Please select a start date and time.");
      return;
    }

    if (
      formData.end_date &&
      new Date(formData.end_date) < new Date(formData.start_date)
    ) {
      alert("End date/time cannot be earlier than the start date/time.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        venue: formData.venue.trim(),
        file_link: formData.file_link.trim(),
        category: formData.category,
        distributions: Array.isArray(formData.distributions)
          ? formData.distributions
          : [],
        unit_id: formData.unit_id,
      };

      if (editingCalendar) {
        const { error } = await supabase
          .from("calendar")
          .update(payload)
          .eq("id", editingCalendar.id);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase.from("calendar").insert({
          ...payload,
          user_id: user?.id,
        });

        if (error) {
          throw error;
        }
      }

      closeEventModal();

      await fetchCalendars();
    } catch (error: any) {
      console.error("Error saving calendar event:", error);

      alert(
        `Error ${editingCalendar ? "updating" : "adding"} calendar event:\n\n${
          error?.message || "Unknown error"
        }`,
      );
    } finally {
      setSaving(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | STYLES
  |--------------------------------------------------------------------------
  */

  const inputClass =
    "w-full mt-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all";

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <div className="flex flex-col gap-6 px-1 pb-8">
      {/* ============================================================
          PAGE HEADER
      ============================================================ */}

      <div className="space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
          {/* TITLE */}
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative shrink-0">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
                <CalendarDays className="w-7 h-7" />
              </div>

              <div className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950">
                <Check className="w-3 h-3 text-white" />
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl tracking-tight text-slate-900 dark:text-white">
                  Calendar
                </h1>
              </div>

              <p className="mt-1 text-slate-500 dark:text-slate-400">
                Manage calendar events, activities and unit distributions.
              </p>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* SEARCH */}
            <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />

              <input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 xl:w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-10 pr-10 font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all shadow-sm"
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}
            </div>

            {/* UNIT FILTER */}
            {isAdmin ? (
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />

                <select
                  value={unitFilter}
                  onChange={(e) => setUnitFilter(e.target.value)}
                  className="appearance-none w-full sm:w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-10 pr-9 font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 shadow-sm cursor-pointer"
                >
                  <option value="">All Units / Stations</option>

                  {unitList.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.unit_name}
                    </option>
                  ))}
                </select>

                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <Shield className="w-4 h-4 text-blue-500" />

                <span className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[180px]">
                  {unitList.find((u) => u.id === unitId)?.unit_name ||
                    "My Unit"}
                </span>
              </div>
            )}

            {/* NEW EVENT */}
            <button
              type="button"
              onClick={openNewEvent}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold shadow-lg shadow-blue-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              New Event
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================
          LOADING
      ============================================================ */}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 shadow-sm">
          <div className="flex flex-col items-center justify-center">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-4 border-slate-200 dark:border-slate-700" />

              <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-transparent border-t-blue-600 animate-spin" />
            </div>

            <p className="mt-4 font-bold text-slate-700 dark:text-slate-300">
              Loading calendar...
            </p>

            <p className="mt-1 text-slate-400">Fetching scheduled events</p>
          </div>
        </div>
      ) : (
        <div className="flex-1">
          {/* ========================================================
              CALENDAR TOOLBAR
          ======================================================== */}

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
            {/* MONTH TITLE */}
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl tracking-tight text-slate-900 dark:text-white">
                  {format(currentDate, "MMMM yyyy")}
                </h2>

                {isSameMonth(currentDate, new Date()) && (
                  <span className="px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 font-bold">
                    Current
                  </span>
                )}
              </div>

              <p className="mt-1 text-slate-500 dark:text-slate-400">
                {filteredCalendars.length} scheduled event
                {filteredCalendars.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* CONTROLS */}
            <div className="flex flex-wrap items-center gap-2">
              {/* VIEW SWITCHER */}
              <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-sm">
                {[
                  {
                    id: "month" as ViewMode,
                    label: "Month",
                    icon: LayoutGrid,
                  },
                  {
                    id: "week" as ViewMode,
                    label: "Week",
                    icon: CalendarRange,
                  },
                  {
                    id: "day" as ViewMode,
                    label: "Day",
                    icon: CalendarIcon,
                  },
                  {
                    id: "list" as ViewMode,
                    label: "List",
                    icon: List,
                  },
                ].map((view) => {
                  const Icon = view.icon;

                  const active = viewMode === view.id;

                  return (
                    <button
                      key={view.id}
                      type="button"
                      onClick={() => setViewMode(view.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold transition-all ${
                        active
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />

                      <span className="hidden sm:inline">{view.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* NAVIGATION */}
              <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-sm">
                <button
                  type="button"
                  onClick={previousMonth}
                  className="p-2 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 transition-colors"
                  title="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={goToToday}
                  className="px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Today
                </button>

                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-2 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 transition-colors"
                  title="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* REFRESH */}
              <button
                type="button"
                onClick={fetchCalendars}
                className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-300 hover:text-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
                title="Refresh calendar"
              >
                <RefreshCcw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </div>

          {/* ========================================================
              MONTH VIEW
          ======================================================== */}

          {viewMode === "month" && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              {/* WEEK DAYS */}
              <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day, index) => (
                    <div
                      key={day}
                      className={`py-3 text-center ${
                        index === 0 || index === 6
                          ? "text-slate-400"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      <span className="hidden sm:inline">{day}</span>
                      <span className="sm:hidden">{day.charAt(0)}</span>
                    </div>
                  ),
                )}
              </div>

              {/* DAYS */}
              <div className="grid grid-cols-7">
                {getDaysForMonth(currentDate).map((day) => {
                  const isToday = isSameDay(day, new Date());

                  const isCurrentMonth = isSameMonth(day, currentDate);

                  const events = getEventsForDate(day);

                  const hasEvents = events.length > 0;

                  const isSelected =
                    selectedDate && isSameDay(day, selectedDate);

                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => handleDateSelect(day)}
                      className={`
                        group relative
                        min-h-[110px] sm:min-h-[140px] lg:min-h-[155px]
                        p-2 sm:p-2.5
                        border-r border-b border-slate-200 dark:border-slate-800
                        cursor-pointer transition-all
                        hover:bg-slate-50 dark:hover:bg-slate-800/40
                        ${!isCurrentMonth ? "bg-slate-50/50 dark:bg-slate-950/30" : ""}
                        ${isSelected ? "bg-blue-50/70 dark:bg-blue-950/20" : ""}
                      `}
                    >
                      {/* DATE */}
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className={`
                            flex items-center justify-center
                            w-7 h-7 rounded-full sm:font-black
                            ${
                              isToday
                                ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                                : isCurrentMonth
                                  ? "text-slate-800 dark:text-slate-200"
                                  : "text-slate-400 dark:text-slate-600"
                            }
                          `}
                        >
                          {format(day, "d")}
                        </div>

                        {hasEvents && (
                          <span className="text-slate-400 dark:text-slate-500">
                            {events.length}
                          </span>
                        )}
                      </div>

                      {/* EVENTS */}
                      <div className="space-y-1.5">
                        {events.slice(0, 4).map((event) => (
                          <div
                            key={event.id}
                            className="relative overflow-hidden rounded-lg bg-slate-100/80 dark:bg-slate-800/70 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            title={event.title}
                          >
                            <div className="absolute inset-y-0 left-0 w-1">
                              <LegendItem category={event.category || ""} />
                            </div>

                            <div className="pl-3 pr-2 py-1.5">
                              <p className="sm:font-bold text-slate-700 dark:text-slate-200 truncate">
                                {event.title}
                              </p>

                              <p className="hidden sm:block mt-0.5 text-slate-400 dark:text-slate-500">
                                {format(new Date(event.start_date), "h:mm a")}
                              </p>
                            </div>
                          </div>
                        ))}

                        {events.length > 4 && (
                          <div className="px-2 text-blue-600 dark:text-blue-400">
                            +{events.length - 4} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================
              WEEK VIEW
          ======================================================== */}

          {viewMode === "week" && (
            <div className="overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <div className="min-w-[900px]">
                {/* WEEK HEADER */}
                <div className="grid grid-cols-[80px_repeat(7,minmax(110px,1fr))] border-b border-slate-200 dark:border-slate-800">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50" />

                  {getDaysForWeek(currentDate).map((day) => {
                    const today = isSameDay(day, new Date());

                    return (
                      <div
                        key={day.toISOString()}
                        className={`p-3 text-center border-l border-slate-200 dark:border-slate-800 ${
                          today
                            ? "bg-blue-50 dark:bg-blue-500/10"
                            : "bg-slate-50 dark:bg-slate-800/50"
                        }`}
                      >
                        <p className="uppercase tracking-wider text-slate-400">
                          {format(day, "EEE")}
                        </p>

                        <p
                          className={`mt-1 text-lg ${
                            today
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          {format(day, "d")}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* TIME GRID */}
                {getTimeSlots(currentDate).map((slot) => (
                  <div
                    key={slot.toISOString()}
                    className="grid grid-cols-[80px_repeat(7,minmax(110px,1fr))] min-h-[70px]"
                  >
                    {/* TIME */}
                    <div className="p-2 text-right font-bold text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      {format(slot, "h a")}
                    </div>

                    {/* DAYS */}
                    {getDaysForWeek(currentDate).map((day) => {
                      const slotEvents = getEventsForTimeSlot(day, slot);

                      return (
                        <div
                          key={`${day.toISOString()}-${slot.toISOString()}`}
                          className="relative border-l border-b border-slate-200 dark:border-slate-800 p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                          onClick={() => handleDateSelect(day)}
                        >
                          {slotEvents.map((event) => (
                            <button
                              type="button"
                              key={event.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditEvent(event);
                              }}
                              className="relative w-full overflow-hidden rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 p-2 text-left hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                            >
                              <div className="absolute inset-y-0 left-0 w-1">
                                <LegendItem category={event.category || ""} />
                              </div>

                              <p className="pl-2 text-slate-800 dark:text-slate-200 truncate">
                                {event.title}
                              </p>

                              <p className="pl-2 mt-0.5 text-[9px] text-slate-500 dark:text-slate-400">
                                {format(new Date(event.start_date), "h:mm a")}
                              </p>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================
              DAY VIEW
          ======================================================== */}

          {viewMode === "day" && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              {/* DAY HEADER */}
              <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className=" text-blue-600 dark:text-blue-400">
                      Selected Day
                    </p>

                    <h3 className="mt-1 text-xl text-slate-900 dark:text-white">
                      {format(
                        selectedDate || currentDate,
                        "EEEE, MMMM d, yyyy",
                      )}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleDateSelect(selectedDate || currentDate)
                    }
                    className="px-3 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700"
                  >
                    View Events
                  </button>
                </div>
              </div>

              {/* DAY EVENTS */}
              <div className="p-6">
                {getEventsForDate(selectedDate || currentDate).length > 0 ? (
                  <div className="space-y-4">
                    {getEventsForDate(selectedDate || currentDate).map(
                      (event) => (
                        <EventCard
                          key={event.id}
                          event={event}
                          unitList={distributionList}
                          onEdit={() => openEditEvent(event)}
                          onDelete={() => handleDelete(event.id)}
                          canEdit={isAdmin || unitId === event.unit_id}
                        />
                      ),
                    )}
                  </div>
                ) : (
                  <EmptyEventsState />
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              LIST VIEW
          ======================================================== */}

          {viewMode === "list" && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              {/* LIST HEADER */}
              <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg text-slate-900 dark:text-white">
                        Scheduled Events
                      </h3>

                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 font-black">
                        {format(currentDate, "MMMM yyyy")}
                      </span>
                    </div>

                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                      {monthlyCalendars.length} scheduled event
                      {monthlyCalendars.length !== 1 ? "s" : ""} this month
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={previousMonth}
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                      title="Previous month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={goToToday}
                      className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                    >
                      Today
                    </button>

                    <button
                      type="button"
                      onClick={nextMonth}
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                      title="Next month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* EVENTS */}
              <div className="p-6">
                {monthlyCalendars.length > 0 ? (
                  <div className="space-y-4">
                    {monthlyCalendars.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        unitList={distributionList}
                        onEdit={() => openEditEvent(event)}
                        onDelete={() => handleDelete(event.id)}
                        canEdit={isAdmin || unitId === event.unit_id}
                        showDate
                      />
                    ))}
                  </div>
                ) : (
                  <div className="py-16 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                      <CalendarDays className="w-7 h-7 text-slate-400" />
                    </div>

                    <h3 className="mt-4 text-base text-slate-800 dark:text-slate-200">
                      No scheduled events
                    </h3>

                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                      There are no events scheduled for{" "}
                      {format(currentDate, "MMMM yyyy")}.
                    </p>

                    {searchQuery && (
                      <p className="mt-2 text-slate-400">
                        Try clearing your search filter.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          ADD / EDIT MODAL
      ============================================================ */}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl shadow-slate-950/20 overflow-hidden border border-white/10 animate-in fade-in zoom-in duration-200">
            {/* MODAL HEADER */}
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    {editingCalendar ? (
                      <Edit2 className="w-5 h-5" />
                    ) : (
                      <Plus className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg text-slate-900 dark:text-white">
                      {editingCalendar
                        ? "Edit Calendar Event"
                        : "New Calendar Event"}
                    </h3>

                    <p className="text-slate-500 dark:text-slate-400">
                      {editingCalendar
                        ? "Update the event details below."
                        : "Create a new event or activity."}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeEventModal}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* FORM */}
            <form
              onSubmit={handleAddEditCalendar}
              className="p-6 space-y-5 max-h-[78vh] overflow-y-auto"
            >
              {/* UNIT */}
              <div>
                <label className="text-slate-500 dark:text-slate-400">
                  Unit / Station
                </label>

                <div className="relative">
                  <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />

                  <select
                    required
                    value={formData.unit_id}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        unit_id: e.target.value,
                      })
                    }
                    disabled={!isAdmin && !!unitId}
                    className={`${inputClass} pl-10 appearance-none ${
                      !isAdmin && unitId ? "opacity-70 cursor-not-allowed" : ""
                    }`}
                  >
                    <option value="" disabled>
                      Select Unit / Station
                    </option>

                    {unitList.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.unit_name}
                      </option>
                    ))}
                  </select>

                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* TITLE */}
              <div>
                <label className="text-slate-500 dark:text-slate-400">
                  Event Title
                </label>

                <input
                  required
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      title: e.target.value,
                    })
                  }
                  className={inputClass}
                  placeholder="Enter event title"
                />
              </div>

              {/* DESCRIPTION */}
              <div>
                <label className="text-slate-500 dark:text-slate-400">
                  Description
                </label>

                <textarea
                  rows={4}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      description: e.target.value,
                    })
                  }
                  className={`${inputClass} resize-none`}
                  placeholder="Additional details about the event"
                />
              </div>

              {/* DATE / TIME */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-500 dark:text-slate-400">
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
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-500 dark:text-slate-400">
                    End Date & Time
                  </label>

                  <input
                    type="datetime-local"
                    value={formData.end_date}
                    min={formData.start_date || undefined}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        end_date: e.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              {/* VENUE */}
              <div>
                <label className="text-slate-500 dark:text-slate-400">
                  Venue
                </label>

                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

                  <input
                    type="text"
                    value={formData.venue}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        venue: e.target.value,
                      })
                    }
                    className={`${inputClass} pl-10`}
                    placeholder="Location / venue"
                  />
                </div>
              </div>

              {/* CATEGORY */}
              <div>
                <label className="text-slate-500 dark:text-slate-400">
                  Category
                </label>

                <div className="relative">
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        category: e.target.value,
                      })
                    }
                    className={`${inputClass} appearance-none`}
                  >
                    <option value="">Select Category</option>
                    <option value="Rush/Urgent">Rush / Urgent</option>
                    <option value="Priority">Priority</option>
                    <option value="Daily Routine">Daily Routine</option>
                  </select>

                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {formData.category && (
                  <div className="mt-2">
                    <CategoryBadge category={formData.category} />
                  </div>
                )}
              </div>

              {/* FILE LINK */}
              <div>
                <label className="text-slate-500 dark:text-slate-400">
                  File Link
                </label>

                <div className="relative">
                  <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

                  <input
                    type="url"
                    value={formData.file_link}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        file_link: e.target.value,
                      })
                    }
                    className={`${inputClass} pl-10`}
                    placeholder="https://..."
                  />
                </div>
              </div>

              {/* DISTRIBUTIONS */}
              <div>
                <label className="text-slate-500 dark:text-slate-400">
                  Tag Units / Stations
                </label>

                <select
                  multiple
                  value={formData.distributions}
                  onChange={(e) => {
                    const selectedUnits = Array.from(
                      e.target.selectedOptions,
                    ).map((option) => option.value);

                    setFormData({
                      ...formData,
                      distributions: selectedUnits,
                    });
                  }}
                  className={`${inputClass} min-h-[140px]`}
                >
                  {distributionList.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.unit_name}
                    </option>
                  ))}
                </select>

                <div className="mt-2 flex items-center justify-between">
                  <p className="text-slate-400">
                    Hold Ctrl / Cmd to select multiple units.
                  </p>

                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {formData.distributions.length} selected
                  </span>
                </div>
              </div>

              {/* BUTTONS */}
              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeEventModal}
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <RefreshCcw className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : editingCalendar ? (
                    <>
                      <Edit2 className="w-4 h-4" />
                      Update Event
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Add Event
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          EVENTS LIST MODAL
      ============================================================ */}

      {showEventsList && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-white/10">
            {/* HEADER */}
            <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <CalendarDays className="w-5 h-5" />
                </div>

                <div className="min-w-0">
                  <h2 className="text-lg text-slate-900 dark:text-white truncate">
                    {format(selectedDate, "MMMM d, yyyy")}
                  </h2>

                  <p className="text-slate-500 dark:text-slate-400">
                    {getEventsForDate(selectedDate).length} event
                    {getEventsForDate(selectedDate).length !== 1
                      ? "s"
                      : ""}{" "}
                    scheduled
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowEventsList(false)}
                className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* LEGEND */}
            <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-slate-100 dark:border-slate-800">
              <CategoryBadge category="Rush/Urgent" />
              <CategoryBadge category="Priority" />
              <CategoryBadge category="Daily Routine" />
            </div>

            {/* EVENTS */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {getEventsForDate(selectedDate).length > 0 ? (
                getEventsForDate(selectedDate).map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    unitList={distributionList}
                    onEdit={() => openEditEvent(event)}
                    onDelete={() => handleDelete(event.id)}
                    canEdit={isAdmin || unitId === event.unit_id}
                  />
                ))
              ) : (
                <EmptyEventsState />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| EVENT CARD
|--------------------------------------------------------------------------
*/

function EventCard({
  event,
  unitList,
  onEdit,
  onDelete,
  canEdit,
  showDate = false,
}: {
  event: CalendarEvent;
  unitList: Unit[];
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
  showDate?: boolean;
}) {
  const distributionNames =
    event.distributions
      ?.map((id) => {
        const unit = unitList.find((u) => u.id === id);

        return unit?.unit_name;
      })
      .filter(Boolean)
      .join(", ") || "No units tagged";

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all">
      {/* CATEGORY STRIPE */}
      <div className="absolute inset-y-0 left-0 w-1.5">
        <LegendItem category={event.category || ""} />
      </div>

      <div className="p-5 pl-6">
        {/* TOP */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <CategoryBadge category={event.category || ""} />

              {showDate && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                  <CalendarIcon className="w-3 h-3" />

                  {format(new Date(event.start_date), "MMM d, yyyy")}
                </span>
              )}
            </div>

            <h3 className="text-base text-slate-900 dark:text-white">
              {event.title}
            </h3>
          </div>

          {canEdit && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onEdit}
                className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                title="Edit event"
              >
                <Edit2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onDelete}
                className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                title="Delete event"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* DETAILS */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DetailItem
            icon={<Clock3 className="w-4 h-4" />}
            color="text-blue-500"
            label="Time"
          >
            {format(new Date(event.start_date), "h:mm a")} -{" "}
            {event.end_date
              ? format(new Date(event.end_date), "h:mm a")
              : "No end time"}
          </DetailItem>

          <DetailItem
            icon={<MapPin className="w-4 h-4" />}
            color="text-emerald-500"
            label="Venue"
          >
            {event.venue || "Not specified"}
          </DetailItem>

          <DetailItem
            icon={<Users className="w-4 h-4" />}
            color="text-indigo-500"
            label="Distribution"
          >
            {distributionNames}
          </DetailItem>

          {event.file_link && (
            <DetailItem
              icon={<FileText className="w-4 h-4" />}
              color="text-orange-500"
              label="Attachment"
            >
              <a
                href={event.file_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                View document
              </a>
            </DetailItem>
          )}
        </div>

        {/* DESCRIPTION */}
        {event.description && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-slate-400 mb-1">Description</p>

            <p className="leading-relaxed text-slate-600 dark:text-slate-400 whitespace-pre-line">
              {event.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| DETAIL ITEM
|--------------------------------------------------------------------------
*/

function DetailItem({
  icon,
  color,
  label,
  children,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <div className={`${color} shrink-0 mt-0.5`}>{icon}</div>

      <div className="min-w-0">
        <p className="text-slate-400">{label}</p>

        <div className="font-bold text-slate-700 dark:text-slate-200 break-words">
          {children}
        </div>
      </div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| CATEGORY BADGE
|--------------------------------------------------------------------------
*/

function CategoryBadge({ category }: { category?: string }) {
  const styles =
    category === "Rush/Urgent"
      ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
      : category === "Priority"
        ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20"
        : category === "Daily Routine"
          ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"
          : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${styles}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />

      {category || "Other"}
    </span>
  );
}

/*
|--------------------------------------------------------------------------
| LEGEND ITEM
|--------------------------------------------------------------------------
*/

function LegendItem({ category }: { category?: string }) {
  const colorClass =
    category === "Rush/Urgent"
      ? "bg-red-500"
      : category === "Priority"
        ? "bg-orange-500"
        : category === "Daily Routine"
          ? "bg-blue-500"
          : "bg-slate-400";

  return (
    <div
      className={`w-full h-full ${colorClass}`}
      aria-label={category || "Other"}
    />
  );
}

/*
|--------------------------------------------------------------------------
| EMPTY STATE
|--------------------------------------------------------------------------
*/

function EmptyEventsState() {
  return (
    <div className="py-14 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
        <CalendarDays className="w-6 h-6 text-slate-400" />
      </div>

      <h3 className="mt-4 text-slate-800 dark:text-slate-200">No events</h3>

      <p className="mt-1 text-slate-500 dark:text-slate-400">
        There are no scheduled events for this date.
      </p>
    </div>
  );
}
