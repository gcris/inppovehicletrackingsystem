import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  RefreshCcw,
  Search,
  AlertCircle,
  X,
} from "lucide-react";
import { MaintenanceType, supabase } from "../../lib/supabase";
import { profile } from "console";
import { useAuth } from "../../components/AuthProvider";
import ConfirmDeleteModal from "../../helper/ConfirmDeleteModal";

export type MaintenanceTypeForm = {
  code: string;
  name: string;
  description: string;
  default_interval_km: number;
  default_interval_months: number;
};

export default function MaintenanceTypesPage() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState<MaintenanceType[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedType, setSelectedType] = useState<MaintenanceType | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    default_interval_km: 0,
    default_interval_months: 0,
  });

  type MaintenanceTypeFormErrors = Partial<
    Record<keyof MaintenanceTypeForm, string>
  >;

  const [errors, setErrors] = useState<MaintenanceTypeFormErrors>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (error || success) {
      // Automatically clear the error after 5 seconds (5000ms)
      const timer = setTimeout(() => {
        setError(null); // Replace setError with whatever your state setter is named
        setSuccess(null);
      }, 8000);

      // Clean up the timer if the component unmounts or if error changes before 5s
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  useEffect(() => {
    fetchTypes();
  }, []);

  const validateForm = () => {
    const newErrors: MaintenanceTypeFormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Service Name is required.";
    }

    const hasKm = formData.default_interval_km > 0;

    const hasMonths = formData.default_interval_months > 0;

    if (!hasKm && !hasMonths) {
      newErrors.default_interval_km =
        "Enter either an interval in kilometers or months.";

      newErrors.default_interval_months =
        "Enter either an interval in kilometers or months.";
    }

    if (!formData.description.trim()) {
      newErrors.description = "Description is required.";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const fetchTypes = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("maintenance_types")
        .select("*")
        .order("name", {
          ascending: true,
        });

      if (error) throw error;

      setTypes(data ?? []);
    } catch (error) {
      console.error("Fetch PMS Catalogs error:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      default_interval_km: 0,
      default_interval_months: 0,
    });
  };

  const filteredTypes = useMemo(() => {
    return types.filter((item) => {
      return (
        searchTerm === "" ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [types, searchTerm]);

  const handleConfirmDelete = async (word: string) => {
    if (!selectedId) return;

    setDeleteLoading(true);
    setDeleteError("");

    try {
      if (word !== "DELETE") {
        setDeleteError("Incorrect word.");
        return;
      }

      await handleDelete(selectedId);

      setShowDeleteModal(false);
      setSelectedId(null);
    } catch (err) {
      console.error(err);
      setDeleteError("Unable to delete record.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);

    try {
      const { error } = await supabase
        .from("maintenance_types")
        .delete()
        .eq("id", id);

      if (error) {
        console.error(error);

        setError("Error deleted: " + error);

        return;
      }

      fetchTypes();

      setSuccess("Successfully deleted!");
    } catch (error) {
      setError("Failed to delete maintenence type: " + error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: formData.name.trim(),

        description: formData.description || null,

        default_interval_km: formData.default_interval_km
          ? Number(formData.default_interval_km)
          : null,

        default_interval_months: formData.default_interval_months
          ? Number(formData.default_interval_months)
          : null,
      };

      if (selectedType) {
        const { error } = await supabase
          .from("maintenance_types")
          .update(payload)
          .eq("id", selectedType.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("maintenance_types")
          .insert(payload);

        if (error) throw error;
      }

      setShowModal(false);
      setSelectedType(null);
      resetForm();

      fetchTypes();

      setSuccess("Successfully saved!");
    } catch (error: any) {
      setError(
        error.code === "23505"
          ? "Maintenance code already exists."
          : "Unable to save PMS Catalog.",
      );
    } finally {
      setSaving(false);
      setErrors({});
    }
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCcw className="h-10 w-10 animate-spin text-blue-600" />

          <p className="text-slate-500">
            Loading preventive maintenance catalog...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            PMS Catalog
          </h1>

          <p className="text-slate-500">
            Manage available maintenance categories.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search input placed before Refresh */}
          <div className="relative w-64">
            <Search className="absolute left-3.5 top-2.5 h-5 w-5 text-slate-400" />

            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search PMS Catalog..."
              className="w-full rounded-xl border py-2 pl-10 pr-4 text-base border-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchTypes}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-base border-slate-200 dark:border-slate-700 dark:text-white"
          >
            <RefreshCcw className="h-5 w-5" />
            Refresh
          </button>

          {/* Add Type Button */}
          {isAdmin && (
            <button
              onClick={() => {
                setSelectedType(null);
                resetForm();
                setShowModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-base text-white"
            >
              <Plus className="h-5 w-5" />
              Add
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white border-slate-200 dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="px-5 py-4 text-left">Name</th>
              <th className="px-5 py-4 text-left">Description</th>
              <th className="px-5 py-4 text-left">Interval (Kilometer)</th>
              <th className="px-5 py-4 text-left">Interval (Months)</th>
              {isAdmin && <th className="px-5 py-4 text-center">Actions</th>}
            </tr>
          </thead>

          <tbody>
            {filteredTypes.map((item) => (
              <tr
                key={item.id}
                className="border-t hover:bg-slate-50 border-slate-200 dark:border-slate-800 dark:hover:bg-slate-800"
              >
                <td className="px-5 py-4 font-medium">{item.name}</td>

                <td className="px-5 py-4">{item.description ?? "-"}</td>

                <td className="px-5 py-4">
                  {item.default_interval_km
                    ? item.default_interval_km.toLocaleString() + " km"
                    : "-"}
                </td>

                <td className="px-5 py-4">
                  {item.default_interval_months
                    ? item.default_interval_months + " month/s"
                    : "-"}
                </td>
                {isAdmin && (
                  <td className="px-5 py-4">
                    <div className="flex justify-center gap-2">
                      <div className="group relative inline-block">
                        <button
                          onClick={() => {
                            setSelectedType(item);
                            setFormData({
                              name: item.name,
                              description: item.description ?? "",
                              default_interval_km: item.default_interval_km,
                              default_interval_months:
                                item.default_interval_months,
                            });
                            setShowModal(true);
                          }}
                          className="rounded-lg border border-slate-300 p-2 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          <Edit2 className="h-5 w-5" />
                        </button>

                        <div className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 hidden flex-col items-end group-hover:flex">
                          <div className="rounded-md bg-slate-900 px-2.5 py-1 text-white whitespace-nowrap shadow-lg">
                            Update PMS Catalog
                          </div>

                          <div className="mr-3 h-2 w-2 -mt-1 rotate-45 bg-slate-900" />
                        </div>
                      </div>

                      <div className="group relative inline-block">
                        <button
                          onClick={() => {
                            setSelectedId(item.id);
                            setError("");
                            setShowDeleteModal(true);
                          }}
                          className="rounded-lg border border-red-300 p-2 text-red-600 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>

                        <div className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 hidden flex-col items-end group-hover:flex">
                          <div className="rounded-md bg-slate-900 px-2.5 py-1 text-white whitespace-nowrap shadow-lg">
                            Delete Mobility Asset
                          </div>

                          <div className="mr-3 h-2 w-2 -mt-1 rotate-45 bg-slate-900" />
                        </div>
                      </div>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {success && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm p-4 bg-green-50 dark:bg-green-900 border border-green-500 dark:border-green-900/30 text-green-600 dark:text-green-400 rounded-xl flex items-start gap-3 shadow-2xl transition-all pointer-events-auto">
          {/* Alert Icon */}
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />

          {/* Error Text Message */}
          <div className="flex-1">
            <p className="text-base font-medium">PMS Catalog</p>
            <p className="text-base opacity-90 mt-0.5">{success}</p>
          </div>

          {/* Manual Dismiss Button */}
          <button
            type="button"
            onClick={() => {
              setSuccess(null);
            }} // Clears the state instantly
            className="p-1 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors shrink-0"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm p-4 bg-red-500 dark:bg-red-900 border border-red-100 dark:border-red-900/30 text-white rounded-xl flex items-start gap-3 shadow-2xl transition-all pointer-events-auto">
          {/* Alert Icon */}
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />

          {/* Error Text Message */}
          <div className="flex-1">
            <p className="text-base font-medium">PMS Catalog</p>
            <p className="text-base opacity-90 mt-0.5">{error}</p>
          </div>

          {/* Manual Dismiss Button */}
          <button
            type="button"
            onClick={() => {
              setError(null);
            }} // Clears the state instantly
            className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 text-white transition-colors shrink-0"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 dark:bg-slate-900">
            <h2 className="mb-5 text-xl font-bold">
              {selectedType ? "Edit PMS Catalog" : "Add PMS Catalog"}
            </h2>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Maintenance Name
                </label>
                <input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      name: e.target.value,
                    })
                  }
                  placeholder="Ex. Periodic Maintenance Service, Tire Rotation, Change Brake Pad"
                  className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${errors.name ? "border-red-500" : "border-slate-300"}`}
                />
                {errors.name && (
                  <p className="mt-1 text-base text-red-500">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-1">
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
                  placeholder="Description of the PMS Catalog"
                  className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${errors.description ? "border-red-500" : "border-slate-300"}`}
                />
                {errors.description && (
                  <p className="mt-1 text-base text-red-500">
                    {errors.description}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Interval (kilometer)
                </label>
                <input
                  type="number"
                  value={formData.default_interval_km}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      default_interval_km: Number(e.target.value),
                    })
                  }
                  placeholder="Interval KM"
                  className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${errors.default_interval_km ? "border-red-500" : "border-slate-300"}`}
                />
                {errors.default_interval_km && (
                  <p className="mt-1 text-base text-red-500">
                    {errors.default_interval_km}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Interval (months)
                </label>
                <input
                  type="number"
                  value={formData.default_interval_months}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      default_interval_months: Number(e.target.value),
                    })
                  }
                  placeholder="Interval Months"
                  className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${errors.default_interval_months ? "border-red-500" : "border-slate-300"}`}
                />
                {errors.default_interval_months && (
                  <p className="mt-1 text-base text-red-500">
                    {errors.default_interval_months}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setErrors({});
                }}
                className="rounded-xl border px-4 py-2"
              >
                Cancel
              </button>

              <button
                disabled={saving}
                onClick={handleSave}
                className="rounded-xl bg-blue-600 px-5 py-2 text-white"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        open={showDeleteModal}
        loading={deleteLoading}
        error={deleteError || ""}
        onClose={() => {
          setDeleteLoading(false);
          setDeleteError("");
          setShowDeleteModal(false);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
