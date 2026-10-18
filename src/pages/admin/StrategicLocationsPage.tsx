import { useCallback, useEffect, useMemo, useState } from "react";
import { Sector, supabase } from "../../lib/supabase";
import {
  ChevronDown,
  Edit,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  Navigation,
  Save,
  AlertCircle,
  Check,
} from "lucide-react";
import { useAuth } from "../../components/AuthProvider";

type StrategicLocation = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  address: string | null;
  unit_id: string | null;
  latitude: number;
  longitude: number;
  sector_id: string;
  sector: Sector | null;
};

type Unit = {
  id: string;
  unit_name: string;
};

type LocationForm = {
  name: string;
  category: string;
  description: string;
  address: string;
  unit_id: string;
  latitude: string;
  longitude: string;
  sector_id: string;
};

const CATEGORIES = [
  "Police Station/PMFC/Police Office",
  "FVP-P.R.O.T.E.C.T. Box",
  "FVP-Police Assistance Center (PAC)",
  "Tourist Assistance Center (TAC)",
  "Government and Administrative Buildings",
  "Health and Medical Facilities",
  "Transportation and Logistics Hubs",
  "Financial and Economic Key points",
  "Energy and Power Utilities",
  "Telecommunication and Broadcast Facilities",
  "Fuel and Petroleum Storage",
  "Water and Sanitation Systems",
  "Commercial and Economic Hubs",
  "Educational Institutions",
  "Religious and Cultural Institutions",
  "Entertainment, Recreation, and Tourism Hubs",
  "Public Markets, Commercial Hubs, and Memorial Parks",
  "Heritage and Institutional Assets",
  "Sports and Convention Complexes",
];

const EMPTY_FORM: LocationForm = {
  name: "",
  category: "Police Station/PMFC/Police Office",
  description: "",
  address: "",
  unit_id: "",
  latitude: "",
  longitude: "",
  sector_id: "",
};

export default function StrategicLocationsPage() {
  const { unitId, isAdmin } = useAuth();

  const [locations, setLocations] = useState<StrategicLocation[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LocationForm>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [unitFilter, setUnitFilter] = useState("All");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const PAGE_SIZE = 1000;

      const fetchAllLocations = async (): Promise<StrategicLocation[]> => {
        const allLocations: StrategicLocation[] = [];
        let from = 0;

        while (true) {
          let query = supabase
            .from("strategic_locations")
            .select("*, sector(id, sector)")
            .order("name", { ascending: true })
            .order("id", { ascending: true })
            .range(from, from + PAGE_SIZE - 1);

          if (!isAdmin && unitId) {
            query = query.eq("unit_id", unitId);
          } else if (!isAdmin && !unitId) {
            // Fail closed: don't fetch all units for an unassigned user.
            return [];
          }

          const { data, error } = await query;

          if (error) throw error;

          const page = data ?? [];
          allLocations.push(...(page as StrategicLocation[]));

          if (page.length < PAGE_SIZE) break;

          from += PAGE_SIZE;
        }

        return allLocations;
      };

      let unitsQuery = supabase
        .from("unit")
        .select("id, unit_name")
        .lte("classification", 3)
        .order("unit_name", { ascending: true });

      let sectorsQuery = supabase
        .from("sector")
        .select("id, sector, deployment, unit_id")
        .order("sector", { ascending: true });

      if (!isAdmin) {
        if (!unitId) {
          setLocations([]);
          setUnits([]);
          setSectors([]);
          setError("Your account is not assigned to a unit.");
          return;
        }

        unitsQuery = unitsQuery.eq("id", unitId);
        sectorsQuery = sectorsQuery.eq("unit_id", unitId);
      }

      const [locations, unitsResult, sectorsResult] = await Promise.all([
        fetchAllLocations(),
        unitsQuery,
        sectorsQuery,
      ]);

      if (unitsResult.error) throw unitsResult.error;
      if (sectorsResult.error) throw sectorsResult.error;

      setLocations(locations);
      setUnits((unitsResult.data ?? []) as Unit[]);
      setSectors((sectorsResult.data ?? []) as Sector[]);
    } catch (err) {
      console.error("Failed to load Critical Infrastructure:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load Critical Infrastructure.",
      );
    } finally {
      setLoading(false);
    }
  }, [isAdmin, unitId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const unitNames = useMemo(
    () => new Map(units.map((unit) => [unit.id, unit.unit_name])),
    [units],
  );

  const filteredLocations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return locations.filter((location) => {
      const matchesSearch =
        !query ||
        location.name.toLowerCase().includes(query) ||
        (location.address ?? "").toLowerCase().includes(query) ||
        (location.description ?? "").toLowerCase().includes(query) ||
        location.category.toLowerCase().includes(query) ||
        (unitNames.get(location.unit_id ?? "") ?? "")
          .toLowerCase()
          .includes(query);

      const matchesCategory =
        categoryFilter === "All" || location.category === categoryFilter;

      const matchesUnit =
        unitFilter === "All"
          ? !location.unit_id
          : location.unit_id === unitFilter;

      return matchesSearch && matchesCategory && matchesUnit;
    });
  }, [locations, search, categoryFilter, unitFilter, unitNames]);

  const filteredSectors = sectors.filter(
    (sector) => sector.unit_id === form.unit_id,
  );

  const openAddForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setNotice("");
    setFormOpen(true);
  };

  const openEditForm = (location: StrategicLocation) => {
    setEditingId(location.id);
    setForm({
      name: location.name,
      category: location.category,
      description: location.description ?? "",
      address: location.address ?? "",
      unit_id: location.unit_id ?? "",
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      sector_id: location.sector_id ?? "",
    });
    setError("");
    setNotice("");
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const updateField = <K extends keyof LocationForm>(
    field: K,
    value: LocationForm[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");

    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);

    if (!form.name.trim()) {
      setError("Please enter the location name.");
      return;
    }

    if (!form.category) {
      setError("Please select a category.");
      return;
    }

    if (
      form.latitude.trim() === "" ||
      form.longitude.trim() === "" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      setError("Enter valid latitude and longitude coordinates.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim() || null,
      address: form.address.trim() || null,
      unit_id: form.unit_id || null,
      latitude,
      longitude,
      sector_id: form.sector_id,
    };

    setSaving(true);

    try {
      if (editingId) {
        const { error: updateError } = await supabase
          .from("strategic_locations")
          .update(payload)
          .eq("id", editingId);

        if (updateError) throw updateError;

        setNotice("Critical Infrastructure updated successfully.");
      } else {
        const { error: insertError } = await supabase
          .from("strategic_locations")
          .insert(payload);

        if (insertError) throw insertError;

        setNotice("Critical Infrastructure added successfully.");
      }

      setFormOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save Critical Infrastructure.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (location: StrategicLocation) => {
    const confirmed = window.confirm(
      `Delete "${location.name}"? This action cannot be undone.`,
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    const { error: deleteError } = await supabase
      .from("strategic_locations")
      .delete()
      .eq("id", location.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setLocations((current) =>
      current.filter((item) => item.id !== location.id),
    );
    setNotice(`"${location.name}" was deleted.`);
  };

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

  const labelClass =
    "mb-1.5 block font-medium text-slate-700 dark:text-slate-300";

  return (
    <div className="min-h-screen space-y-6 bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:p-6 lg:p-8">
      {/* Header */}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative shrink-0">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
                <MapPin className="w-7 h-7" />
              </div>

              <div className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950">
                <Check className="w-3 h-3 text-white" />
              </div>
            </div>

            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Critical Infrastructure
              </h1>
              <p className="mt-1 text-slate-500 dark:text-slate-400">
                Manage important facilities and operational locations.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            onClick={openAddForm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700"
          >
            <Plus size={18} />
            Add Location
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            className="ml-auto"
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Search and filter */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_220px_220px]">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, address, or category..."
              className={`${inputClass} pl-10`}
            />
          </div>

          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className={`${inputClass} appearance-none pr-10`}
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </div>

          <div className="relative">
            <select
              value={unitFilter}
              onChange={(event) => setUnitFilter(event.target.value)}
              className={`${inputClass} appearance-none pr-10`}
            >
              <option value="All">All Units/Stations</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.unit_name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </div>
        </div>
        <p className="mt-3 text-slate-500 dark:text-slate-400">
          Showing {filteredLocations.length} of {locations.length} locations
        </p>
      </div>

      {/* Locations table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="font-semibold">Location Directory</h2>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Strategic facilities registered in the system.
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-slate-500">
            <RefreshCw size={26} className="animate-spin text-blue-600" />
            <p>Loading Critical Infrastructure...</p>
          </div>
        ) : filteredLocations.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <div className="rounded-full bg-slate-100 p-4 dark:bg-slate-800">
              <MapPin size={28} className="text-slate-400" />
            </div>
            <h3 className="mt-4 font-semibold">No locations found</h3>
            <p className="mt-1 max-w-sm text-slate-500 dark:text-slate-400">
              Add a Critical Infrastructure or change your search filters.
            </p>
            <button
              type="button"
              onClick={openAddForm}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700"
            >
              <Plus size={16} />
              Add First Location
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3.5 text-right font-semibold">
                    Actions
                  </th>
                  <th className="px-5 py-3.5 font-semibold">Location</th>
                  <th className="px-5 py-3.5 font-semibold">Address</th>
                  <th className="px-5 py-3.5 font-semibold">Category</th>
                  <th className="px-5 py-3.5 font-semibold">Sector</th>
                  <th className="px-5 py-3.5 font-semibold">Unit/Station</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLocations.map((location) => {
                  return (
                    <tr
                      key={location.id}
                      className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(location)}
                            title="Edit location"
                            aria-label={`Edit ${location.name}`}
                            className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(location)}
                            title="Delete location"
                            aria-label={`Delete ${location.name}`}
                            className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="max-w-xs">
                            <p className="font-semibold text-slate-800 dark:text-slate-100">
                              {location.name}
                            </p>
                            <p className="mt-1 line-clamp-2 text-slate-500 dark:text-slate-400">
                              {location.description || ""}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">{location.address}</td>

                      <td className="px-5 py-4">{location.category}</td>

                      <td className="px-5 py-4">
                        {location.sector
                          ? `Sector ${location.sector?.sector}`
                          : ""}
                      </td>

                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                        {location.unit_id
                          ? (unitNames.get(location.unit_id) ?? "Unknown unit")
                          : "Unassigned"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-form-title"
            className="my-auto max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
              <div>
                <h2 id="location-form-title" className="text-lg font-bold">
                  {editingId
                    ? "Edit Critical Infrastructure"
                    : "Add Critical Infrastructure"}
                </h2>
                <p className="mt-1 text-slate-500 dark:text-slate-400">
                  Enter the location information and GPS coordinates.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                aria-label="Close form"
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5 p-5 sm:p-6">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </div>
              )}

              <div>
                <label className={labelClass}>Location Name *</label>
                <input
                  required
                  maxLength={200}
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="e.g. Municipal Police Station"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Category *</label>
                <select
                  required
                  value={form.category}
                  onChange={(event) =>
                    updateField("category", event.target.value)
                  }
                  className={inputClass}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Address</label>
                <input
                  value={form.address}
                  onChange={(event) =>
                    updateField("address", event.target.value)
                  }
                  placeholder="Street, municipality, or nearby landmark"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Description / Remarks</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                  placeholder="Additional information about this location..."
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Unit/Station</label>
                <select
                  value={form.unit_id}
                  onChange={(event) => {
                    updateField("unit_id", event.target.value);
                    updateField("sector_id", "");
                  }}
                  className={inputClass}
                >
                  <option value="">Select Unit/Station</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.unit_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Sector</label>
                <select
                  value={form.sector_id}
                  onChange={(event) =>
                    updateField("sector_id", event.target.value)
                  }
                  className={inputClass}
                >
                  <option value="">Select Sector</option>
                  {filteredSectors.map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {`Sector ${sector.sector}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
                <div className="mb-3 flex items-center gap-2">
                  <Navigation
                    size={18}
                    className="text-blue-600 dark:text-blue-400"
                  />
                  <h3 className="font-semibold">GPS Coordinates</h3>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Latitude *</label>
                    <input
                      required
                      type="number"
                      min="-90"
                      max="90"
                      step="any"
                      value={form.latitude}
                      onChange={(event) =>
                        updateField("latitude", event.target.value)
                      }
                      placeholder="18.196000"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Longitude *</label>
                    <input
                      required
                      type="number"
                      min="-180"
                      max="180"
                      step="any"
                      value={form.longitude}
                      onChange={(event) =>
                        updateField("longitude", event.target.value)
                      }
                      placeholder="120.592700"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 font-semibold transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save size={16} />
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Save Changes"
                      : "Add Location"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
