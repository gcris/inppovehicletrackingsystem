import React, { useEffect, useMemo, useState } from "react";
import { X, Save, RefreshCcw } from "lucide-react";

import {
  MobilityAsset,
  Personnel,
  Unit,
  VehicleInspection,
  VehicleInspectionCategory,
  VehicleInspectionItem,
  supabase,
} from "../../lib/supabase";
import e from "express";
import { useAuth } from "../../components/AuthProvider";

interface Props {
  open: boolean;
  onClose: () => void;
  inspection: VehicleInspection | null;
  onSaved: () => void;
  setError: (message: string) => void;
  setSuccess: (message: string) => void;
}

type InspectionStatus = "COMPLIED" | "UNCOMPLIED" | "NOT_APPLICABLE";

interface InspectionResultForm {
  inspection_item_id: string;
  status: InspectionStatus;
  remarks: string;
}

export type InspectionFormData = {
  unit_id: string;
  mobility_asset_id: string;
  inspection_date: string;
  inspected_by: string;
  designated_driver_id: string;
  alternate_driver_id: string;
  overall_status: string;
  supervisor_name: string;
};

export default function InspectionFormModal({
  open,
  onClose,
  inspection,
  onSaved,
  setError,
  setSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<VehicleInspectionCategory[]>([]);
  const [items, setItems] = useState<VehicleInspectionItem[]>([]);
  const [results, setResults] = useState<InspectionResultForm[]>([]);
  const [vehicles, setVehicles] = useState<MobilityAsset[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [units, setUnit] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState("");
  const { isAdmin, unitId } = useAuth();

  const [formData, setFormData] = useState({
    unit_id: inspection?.unit_id ?? "",
    mobility_asset_id: inspection?.mobility_asset_id ?? "",
    inspected_at:
      inspection?.inspected_at ?? new Date().toISOString().slice(0, 16),
    inspected_by: inspection?.inspected_by ?? "",
    supervisor_name: inspection?.supervisor_name ?? "",
    designated_driver_id: inspection?.designated_driver_id ?? "",
    alternate_driver_id: inspection?.alternate_driver_id ?? "",
    overall_status: inspection?.overall_status ?? "PASSED",
    remarks: inspection?.remarks ?? "",
  });

  type InspectionFormDataErrors = Partial<
    Record<keyof InspectionFormData, string>
  >;

  const [errors, setErrors] = useState<InspectionFormDataErrors>({});

  useEffect(() => {
    if (!open) return;

    const init = async () => {
      // 1. Wait for loadPage to finish completely
      await loadPage();

      // 2. Set selected unit
      if (isAdmin) {
        setSelectedUnit(inspection?.unit_id ?? "");
      } else {
        setSelectedUnit(unitId ?? "");
      }

      // 3. Set form data AFTER loadPage finishes
      setFormData({
        unit_id: inspection?.unit_id ?? "",
        mobility_asset_id: inspection?.mobility_asset_id ?? "",
        inspected_at: inspection?.inspected_at ?? "",
        inspected_by: inspection?.inspected_by ?? "",
        supervisor_name: inspection?.supervisor_name ?? "",
        designated_driver_id: inspection?.designated_driver_id ?? "",
        alternate_driver_id: inspection?.alternate_driver_id ?? "",
        overall_status: inspection?.overall_status ?? "PASSED",
        remarks: inspection?.remarks ?? "",
      });
    };

    init();
  }, [open, inspection]);

  const filteredVehicles = useMemo(() => {
    if (!formData.unit_id) return [];

    return vehicles.filter((vehicle) => vehicle.unit_id === formData.unit_id);
  }, [vehicles, formData.unit_id]);

  const filteredPersonnel = useMemo(() => {
    let filtered = personnel;

    if (formData.unit_id) {
      filtered = filtered.filter(
        (person) => person.unit_id === formData.unit_id,
      );
    }

    return [...filtered].sort((a, b) => {
      const levelA = a.rank?.level ?? -1;
      const levelB = b.rank?.level ?? -1;

      // Descending: highest rank first
      if (levelA !== levelB) {
        return levelB - levelA;
      }

      // Same rank → alphabetical
      return a.fullname.localeCompare(b.fullname);
    });
  }, [personnel, formData.unit_id]);

  const filteredPersonnelExcludeDesignated = useMemo(() => {
    return filteredPersonnel.filter(
      (person) => person.id !== formData.designated_driver_id,
    );
  }, [filteredPersonnel, formData.designated_driver_id]);

  const loadPage = async () => {
    setLoading(true);
    try {
      await fetchUnits();
      await fetchLookupData();
      await fetchCategories();
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
    setLoading(false);
  };

  const fetchLookupData = async () => {
    const [vehicleResult, personnelResult] = await Promise.all([
      supabase
        .from("mobility_assets")
        .select("*, unit(*)")
        .order("plate_number"),

      fetchAllRows(
        supabase.from("personnel").select("*, rank(*)").order("fullname"),
      ),
    ]);

    if (vehicleResult.error) throw vehicleResult.error;

    setVehicles(vehicleResult.data ?? []);
    setPersonnel(personnelResult ?? []);
  };

  // Helper function to bypass the 1,000-row Supabase limit
  const fetchAllRows = async (queryBuilder: any) => {
    let allRows: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await queryBuilder.range(
        page * pageSize,
        (page + 1) * pageSize - 1,
      );

      if (error) throw error;

      if (data) {
        allRows = [...allRows, ...data];
        if (data.length < pageSize) {
          hasMore = false; // Reached the end of records
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    return allRows;
  };

  const fetchCategories = async () => {
    const [categoryResult, itemResult] = await Promise.all([
      supabase
        .from("vehicle_inspection_categories")
        .select("*")
        .order("display_order", {
          ascending: true,
        }),

      supabase
        .from("vehicle_inspection_items")
        .select("*")
        .eq("is_active", true)
        .order("display_order", {
          ascending: true,
        }),
    ]);

    if (categoryResult.error) throw categoryResult.error;

    if (itemResult.error) throw itemResult.error;

    setCategories(categoryResult.data ?? []);

    setItems(itemResult.data ?? []);

    if (inspection) {
      await loadInspectionResults(inspection.id);
    } else {
      const defaults = (itemResult.data ?? []).map((item) => ({
        inspection_item_id: item.id,

        status: "COMPLIED" as InspectionStatus,

        remarks: "",
      }));

      setResults(defaults);
    }
  };

  const fetchUnits = async () => {
    const { data, error } = await supabase
      .from("unit")
      .select("*")
      .order("level", { ascending: true })
      .order("unit_name");

    if (error) throw error;

    setUnit(data);
  };

  const loadInspectionResults = async (inspectionId: string) => {
    const { data, error } = await supabase
      .from("vehicle_inspection_results")
      .select("*")
      .eq("inspection_id", inspectionId);

    if (error) {
      console.error(error);
      return;
    }

    setResults(
      (data ?? []).map((row) => ({
        inspection_item_id: row.inspection_item_id,
        status: row.status as InspectionStatus,
        remarks: row.remarks ?? "",
      })),
    );
  };

  const updateResult = (
    itemId: string,
    field: "status" | "remarks",
    value: string,
  ) => {
    setResults((prev) =>
      prev.map((item) =>
        item.inspection_item_id === itemId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
  };

  const validateForm = () => {
    const newErrors: InspectionFormDataErrors = {};

    if (!formData.unit_id) {
      newErrors.unit_id = "Unit/Station is required.";
    }

    if (!formData.mobility_asset_id) {
      newErrors.mobility_asset_id = "Mobility Asset is required.";
    }

    if (!formData.inspected_at) {
      newErrors.inspection_date = "Inspection date  is required.";
    }

    if (!formData.overall_status) {
      newErrors.overall_status = "Overall Status is required.";
    }

    if (!formData.inspected_by.trim()) {
      newErrors.inspected_by = "Inspected by is required.";
    }

    if (!formData.supervisor_name) {
      newErrors.supervisor_name = "Supervisor is required.";
    }

    if (!formData.designated_driver_id) {
      newErrors.designated_driver_id = "Please select a Designated Driver.";
    }

    if (!formData.alternate_driver_id) {
      newErrors.alternate_driver_id = "Please select Alternative Driver.";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      // Determine overall status automatically
      let overallStatus: VehicleInspection["overall_status"] = "PASSED";

      const failedCount = results.filter(
        (r) => r.status === "UNCOMPLIED",
      ).length;

      if (failedCount === 0) {
        overallStatus = "PASSED";
      } else if (failedCount <= 5) {
        overallStatus = "WITH_DEFECTS";
      } else {
        overallStatus = "FAILED";
      }
      let inspectionId = inspection?.id;

      const inspectionData = {
        unit_id: formData.unit_id,
        mobility_asset_id: formData.mobility_asset_id,
        inspected_at: formData.inspected_at,
        inspected_by: formData.inspected_by || null,
        supervisor_name: formData.supervisor_name || null,
        designated_driver_id: formData.designated_driver_id || null,
        alternate_driver_id: formData.alternate_driver_id || null,
        overall_status: overallStatus,
        remarks: formData.remarks,
        updated_at: new Date().toISOString(),
      };

      if (inspection) {
        const { error } = await supabase
          .from("vehicle_inspections")
          .update(inspectionData)
          .eq("id", inspection.id);

        if (error) throw error;

        await supabase
          .from("vehicle_inspection_results")
          .delete()
          .eq("inspection_id", inspection.id);
      } else {
        const { data, error } = await supabase
          .from("vehicle_inspections")
          .insert(inspectionData)
          .select()
          .single();

        if (error) throw error;

        inspectionId = data.id;
      }

      const insertRows = results.map((item) => ({
        inspection_id: inspectionId,
        inspection_item_id: item.inspection_item_id,
        status: item.status,
        remarks: item.remarks || null,
      }));

      const { error } = await supabase
        .from("vehicle_inspection_results")
        .insert(insertRows);

      if (error) throw error;

      setSuccess(
        inspection
          ? "Inspection updated successfully."
          : "Inspection saved successfully.",
      );

      onSaved();
    } catch (error) {
      console.log(error);
      setError("Failed to save Mobility Inspection: " + error);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const formatForDateTimeLocal = (dateString?: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";

    // Formats to ISO string and slices to YYYY-MM-DDThh:mm
    const localDate = new Date(
      date.getTime() - date.getTimezoneOffset() * 60000,
    );
    return localDate.toISOString().slice(0, 16);
  };

  console.log("selectedUnit: ", selectedUnit);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="rounded-2xl bg-white p-8 dark:bg-slate-900">
          <div className="flex flex-col items-center gap-4">
            <RefreshCcw className="h-10 w-10 animate-spin text-blue-600" />
            <p>Loading inspection...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[95vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-2xl font-bold">
              {inspection
                ? "Edit Mobility Inspection"
                : "New Mobility Inspection"}
            </h2>

            <p className="text-slate-500">
              Complete the mobility inspection checklist.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Mobility Information */}
          <div className="rounded-2xl border p-6 border-slate-200 dark:border-slate-700">
            <h3 className="mb-5 text-lg font-semibold">Mobility Information</h3>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {/* Unit/Station */}
              <div>
                <label className="mb-2 block font-medium">Unit/Station</label>

                <select
                  value={selectedUnit}
                  disabled={isAdmin && unitId === null}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      unit_id: e.target.value,
                    });

                    setSelectedUnit(e.target.value);
                  }}
                  className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.unit_id ? "border-red-500" : "border-slate-300"
                      }`}
                >
                  <option value="">Select Unit/Station</option>

                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.unit_name}
                    </option>
                  ))}
                </select>
                {errors.unit_id && (
                  <p className="mt-1 text-red-500">{errors.unit_id}</p>
                )}
              </div>

              {/* Mobility */}
              <div>
                <label className="mb-2 block font-medium">Mobility</label>

                <select
                  value={formData.mobility_asset_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      mobility_asset_id: e.target.value,
                    })
                  }
                  className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.mobility_asset_id
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                >
                  <option value="">Select Mobility</option>

                  {filteredVehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.plate_number}
                      {"-"}
                      {vehicle.description}
                      {isAdmin ? "-" + vehicle.unit?.unit_name : ""}
                    </option>
                  ))}
                </select>
                {errors.mobility_asset_id && (
                  <p className="mt-1 text-red-500">
                    {errors.mobility_asset_id}
                  </p>
                )}
              </div>

              {/* Inspection Date */}
              <div>
                <label className="mb-2 block font-medium">
                  Inspection Date
                </label>

                <input
                  type="datetime-local"
                  value={formatForDateTimeLocal(formData.inspected_at)}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      inspected_at: e.target.value,
                    })
                  }
                  className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.inspection_date
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                />
                {errors.inspection_date && (
                  <p className="mt-1 text-red-500">{errors.inspection_date}</p>
                )}
              </div>

              {/* Overall Status */}
              <div>
                <label className="mb-2 block font-medium">Overall Status</label>

                <select
                  value={formData.overall_status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      overall_status: e.target
                        .value as VehicleInspection["overall_status"],
                    })
                  }
                  className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.overall_status
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                >
                  <option value="PASSED">PASSED</option>
                  <option value="WITH_DEFECTS">WITH DEFECTS</option>
                  <option value="FAILED">FAILED</option>
                </select>
                {errors.overall_status && (
                  <p className="mt-1 text-red-500">{errors.overall_status}</p>
                )}
              </div>

              {/* Inspector */}
              <div>
                <label className="mb-2 block font-medium">Inspector</label>

                <input
                  type="text"
                  value={formData.inspected_by}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      inspected_by: e.target.value,
                    }))
                  }
                  placeholder="Name of the Inspector (Rank/Name)"
                  className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.inspected_by
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                />
                {errors.inspected_by && (
                  <p className="mt-1 text-red-500">{errors.inspected_by}</p>
                )}
              </div>

              {/* Supervisor */}
              <div>
                <label className="mb-2 block font-medium">Supervisor</label>

                <input
                  type="text"
                  value={formData.supervisor_name}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      supervisor_name: e.target.value,
                    }))
                  }
                  placeholder="Name of the Supervisor (Rank/Name)"
                  className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.supervisor_name
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                />
                {errors.supervisor_name && (
                  <p className="mt-1 text-red-500">{errors.supervisor_name}</p>
                )}
              </div>

              {/* Designated Driver */}
              <div>
                <label className="mb-2 block font-medium">
                  Designated Driver
                </label>

                <select
                  value={formData.designated_driver_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      designated_driver_id: e.target.value,
                    })
                  }
                  className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.designated_driver_id
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                >
                  <option value="">Select Driver</option>

                  {filteredPersonnel.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.rank?.rank_name} {person.fullname}
                    </option>
                  ))}
                </select>
                {errors.designated_driver_id && (
                  <p className="mt-1 text-red-500">
                    {errors.designated_driver_id}
                  </p>
                )}
              </div>

              {/* Alternate Driver */}
              <div>
                <label className="mb-2 block font-medium">
                  Alternate Driver
                </label>

                <select
                  value={formData.alternate_driver_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      alternate_driver_id: e.target.value,
                    })
                  }
                  className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.alternate_driver_id
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                >
                  <option value="">Select Alternate Driver</option>

                  {filteredPersonnelExcludeDesignated.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.rank?.rank_name} {person.fullname}
                    </option>
                  ))}
                </select>
                {errors.alternate_driver_id && (
                  <p className="mt-1 text-red-500">
                    {errors.alternate_driver_id}
                  </p>
                )}
              </div>
            </div>

            {/* Remarks */}
            <div className="mt-6">
              <label className="mb-2 block font-medium">Remarks</label>

              <textarea
                rows={3}
                value={formData.remarks}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    remarks: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-white"
                placeholder="General remarks..."
              />
            </div>
          </div>

          {/* Inspection Checklist */}

          <div className="mt-6 space-y-6">
            {categories.map((category) => {
              const categoryItems = items.filter(
                (item) => item.category_id === category.id,
              );

              if (categoryItems.length === 0) return null;

              return (
                <div
                  key={category.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700"
                >
                  <div className="border-b border-slate-200 bg-slate-100 px-5 py-3 dark:border-slate-700 dark:bg-slate-800">
                    <h3 className="text-lg font-semibold">{category.name}</h3>

                    {category.description && (
                      <p className="mt-1 text-slate-500">
                        {category.description}
                      </p>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-slate-50 dark:bg-slate-900">
                        <tr>
                          <th className="w-16 px-4 py-3 text-left">Code</th>

                          <th className="px-4 py-3 text-left">
                            Inspection Item
                          </th>

                          <th className="w-70 px-4 py-3 text-center">Status</th>

                          <th className="w-100 px-4 py-3 text-left">Remarks</th>
                        </tr>
                      </thead>

                      <tbody>
                        {categoryItems.map((item) => {
                          const result = results.find(
                            (r) => r.inspection_item_id === item.id,
                          );

                          return (
                            <tr
                              key={item.id}
                              className="border-t dark:border-slate-700 border-slate-200"
                            >
                              <td className="px-4 py-4 font-semibold">
                                {item.code}
                              </td>

                              <td className="px-4 py-4">
                                <div className="font-medium">{item.name}</div>

                                {item.description && (
                                  <div className="mt-1 text-slate-500">
                                    {item.description}
                                  </div>
                                )}
                              </td>

                              <td className="px-4 py-4">
                                <div className="grid grid-cols-2 gap-2">
                                  <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                      type="radio"
                                      name={item.id}
                                      checked={
                                        result?.status
                                          ? result?.status === "COMPLIED"
                                          : true
                                      }
                                      onChange={() =>
                                        updateResult(
                                          item.id,
                                          "status",
                                          "COMPLIED",
                                        )
                                      }
                                    />

                                    <span className="text-green-600">
                                      Complied
                                    </span>
                                  </label>

                                  <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                      type="radio"
                                      name={item.id}
                                      checked={result?.status === "UNCOMPLIED"}
                                      onChange={() =>
                                        updateResult(
                                          item.id,
                                          "status",
                                          "UNCOMPLIED",
                                        )
                                      }
                                    />

                                    <span className="text-red-600">
                                      Uncomplied
                                    </span>
                                  </label>
                                </div>
                              </td>

                              <td className="px-4 py-4">
                                <textarea
                                  rows={2}
                                  value={result?.remarks ?? ""}
                                  onChange={(e) =>
                                    updateResult(
                                      item.id,
                                      "remarks",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-white"
                                  placeholder="Remarks..."
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t bg-slate-50 px-6 py-4 border-slate-300 dark:border-slate-700 dark:bg-slate-900">
          {Object.keys(errors).length > 0 && (
            <span className="text-red-600 dark:text-red-400">
              Please fix the highlighted errors before submitting.
            </span>
          )}

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border px-5 py-2 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 border-slate-300 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCcw className="h-5 w-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                {inspection ? "Update Inspection" : "Save Inspection"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
