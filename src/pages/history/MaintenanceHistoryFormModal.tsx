import { useEffect, useState } from "react";
import {
  MaintenanceHistory,
  MobilityAsset,
  MaintenanceType,
  supabase,
  Personnel,
  Unit,
} from "../../lib/supabase";
import { X } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";

export interface MaintenanceHistoryItem {
  id: string;
  maintenance_history_id: string;
  maintenance_type_id: string;

  maintenance_type: {
    id: string;
    code: string;
    name: string;
  };
}

export interface MaintenanceHistoryFormData {
  id: string;

  mobility_asset_id: string;

  mobility_asset: MobilityAsset;

  last_service_date: string | null;
  last_service_odometer: number;

  next_service_date: string | null;
  next_service_odometer: number;

  service_center: string;
  service_center_name: string;
  service_center_location: string;

  proof_photo_url: string;

  changed_by: string;

  personnel: Personnel;

  items: MaintenanceHistoryItem[];
}

interface MaintenanceHistoryFormModalProps {
  mode: "add" | "edit";
  record?: MaintenanceHistory | null;
  mobilityAssets: MobilityAsset[];
  maintenanceTypes: MaintenanceType[];
  setError: (message: string) => void;
  setSuccess: (message: string) => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export default function MaintenanceHistoryFormModal({
  mode,
  record,
  mobilityAssets,
  maintenanceTypes,
  setError,
  setSuccess,
  onClose,
  onSaved,
}: MaintenanceHistoryFormModalProps) {
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const { isAdmin, user, unitId } = useAuth();

  type MaintenanceHistoryFormErrors = Partial<
    Record<keyof MaintenanceHistoryFormData, string>
  >;

  const [errors, setErrors] = useState<MaintenanceHistoryFormErrors>({});
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [proofPhoto, setProofPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [proofImageUrl, setProofImageUrl] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");

  const [formData, setFormData] = useState({
    mobility_asset_id: record?.mobility_asset_id ?? "",
    last_service_date: record?.last_service_date ?? today,
    last_service_odometer: record?.last_service_odometer ?? 0,
    next_service_date: record?.next_service_date ?? "",
    next_service_odometer: record?.next_service_odometer ?? 0,
    service_center: record?.service_center ?? "",
    service_center_name: record?.service_center_name ?? "",
    service_center_location: record?.service_center_location ?? "",
    proof_photo_url: record?.proof_photo_url ?? "",
  });

  const toggleTypes = (typeId: string) => {
    setSelectedTypes((prev) =>
      prev.includes(typeId)
        ? prev.filter((id) => id !== typeId)
        : [...prev, typeId],
    );
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUnits();
    }

    // 1. Extract only the 'id' strings from the objects
    const itemIds: string[] =
      record?.items?.map((item) => String(item.maintenance_type_id)) ?? [];

    // 2. Pass the string array to state
    setSelectedTypes(itemIds);

    if (isAdmin) {
      setSelectedUnit(record?.mobility_asset?.unit_id ?? "");
    } else {
      setSelectedUnit(unitId ?? "");
    }

    const loadImage = async () => {
      if (!formData.proof_photo_url) return;

      const { data, error } = await supabase.storage
        .from("pms-proofs")
        .createSignedUrl(formData.proof_photo_url, 3600);

      if (!error) {
        setProofImageUrl(data.signedUrl);
      }
    };

    loadImage();
  }, [formData.proof_photo_url]);

  const fetchUnits = async () => {
    const { data, error } = await supabase
      .from("unit")
      .select("*")
      .order("level", { ascending: false })
      .order("unit_name");

    if (error) throw error;

    setUnits(data);
  };

  const filteredMobility =
    isAdmin && selectedUnit
      ? mobilityAssets.filter((asset) => asset.unit_id === selectedUnit)
      : mobilityAssets.filter((asset) => asset.unit_id === unitId);

  const filteredMaintenanceTypes = maintenanceTypes.filter((type) => {
    const search = serviceSearch.trim().toLowerCase();

    if (!search) return true;

    return (
      type.name?.toLowerCase().includes(search) ||
      type.description?.toLowerCase().includes(search)
    );
  });

  const validateForm = () => {
    const newErrors: MaintenanceHistoryFormErrors = {};

    if (!formData.mobility_asset_id) {
      newErrors.mobility_asset_id = "Mobility Asset is required.";
    }

    if (!formData.last_service_date) {
      newErrors.last_service_date = "Last Service Date is required.";
    }

    if (!formData.last_service_odometer) {
      newErrors.last_service_odometer = "Last Odometer Reading is required.";
    }

    if (!formData.next_service_date) {
      newErrors.next_service_date = "Next Service Date is required.";
    }

    if (!formData.next_service_odometer) {
      newErrors.next_service_odometer = "Next Odometer Reading is required.";
    }

    if (!formData.service_center) {
      newErrors.service_center = "Service Center is required.";
    }

    if (!formData.service_center_name) {
      newErrors.service_center_name = "Service Center Name is required.";
    }

    if (!formData.service_center_location) {
      newErrors.service_center_location =
        "Service Center Location is required.";
    }

    if (!formData.proof_photo_url && !previewUrl) {
      newErrors.proof_photo_url =
        "Proof of PMS/Official Receipt (Photo) is required.";
    }

    if (selectedTypes.length === 0) {
      newErrors.items = "Select the completed services above.";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const lastOdometer = (id: string) => {
    const data = filteredMobility.find((mob) => mob.id === id);

    return data?.current_odometer;
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setProofPhoto(file);

    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (selectedTypes.length === 0) {
      setError("Please select at least one PMS Catalog.");
      return;
    }

    setSaving(true);

    try {
      const proofPhotoUrl = await uploadProofPhoto();
      const history = {
        mobility_asset_id: formData.mobility_asset_id,
        last_service_date: formData.last_service_date || null,
        last_service_odometer: formData.last_service_odometer,
        next_service_date: formData.next_service_date || null,
        next_service_odometer: formData.next_service_odometer,
        changed_by: user?.id,
        service_center_name: formData.service_center_name,
        service_center_location: formData.service_center_location,
        service_center: formData.service_center,
        proof_photo_url: proofPhotoUrl,
      };

      let historyId: string;

      if (mode === "edit" && record) {
        // Update history
        const { error } = await supabase
          .from("mobility_assets_maintenance_history")
          .update(history)
          .eq("id", record.id);

        if (error) {
          await deleteProofPhoto(proofPhotoUrl);

          throw error;
        }

        historyId = record.id;

        // Remove existing PMS Catalog items
        const { error: deleteError } = await supabase
          .from("mobility_assets_maintenance_history_items")
          .delete()
          .eq("maintenance_history_id", historyId);

        if (deleteError) throw deleteError;
      } else {
        // Insert history
        const { data, error } = await supabase
          .from("mobility_assets_maintenance_history")
          .insert(history)
          .select("id")
          .single();

        if (error) {
          await deleteProofPhoto(proofPhotoUrl);

          throw error;
        }

        historyId = data.id;
      }

      // Insert selected PMS Catalog items
      const items = selectedTypes.map((typeId) => ({
        maintenance_history_id: historyId,
        maintenance_type_id: typeId,
      }));

      const { error: itemError } = await supabase
        .from("mobility_assets_maintenance_history_items")
        .insert(items);

      if (itemError) throw itemError;

      await onSaved();

      setSuccess("Successfully saved!");
    } catch (error) {
      console.error(error);
      setError("Save PMS History error: " + String(error));
    } finally {
      setSaving(false);
    }
  };

  const uploadProofPhoto = async () => {
    if (!proofPhoto) return formData.proof_photo_url;

    const extension = proofPhoto.name.split(".").pop();

    const filename = `${crypto.randomUUID()}.${extension}`;

    const { error } = await supabase.storage
      .from("pms-proofs")
      .upload(filename, proofPhoto, {
        upsert: false,
      });

    if (error) throw error;

    return filename;
  };

  const deleteProofPhoto = async (proofPhotoUrl: string) => {
    await supabase.storage.from("pms-proofs").remove([proofPhotoUrl]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-6">
      <div className="w-full max-w-6xl max-h-[95vh] overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-8 py-6">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
              {mode === "edit" && record
                ? "Edit PMS History"
                : "Add PMS History"}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-500 dark:text-slate-400"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-8 py-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {isAdmin && (
                <div>
                  <label className="text-base text-slate-600 dark:text-white">
                    Unit/Station
                  </label>

                  <select
                    onChange={(e) => setSelectedUnit(e.target.value)}
                    value={selectedUnit}
                    disabled={isAdmin && unitId === null}
                    className="w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white border-slate-300"
                  >
                    <option value="">Select Unit/Station</option>

                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.unit_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-base text-slate-600 dark:text-white">
                  Mobility
                </label>

                <select
                  value={formData.mobility_asset_id}
                  onChange={(e) => {
                    handleChange("mobility_asset_id", e.target.value);
                    const odoMeter = lastOdometer(e.target.value);
                    console.log("odoMeter: ", odoMeter);
                    formData.last_service_odometer = odoMeter ?? 0;
                  }}
                  className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.mobility_asset_id
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                >
                  <option value="">Select Mobility</option>

                  {filteredMobility.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.plate_number}
                      {"-"}
                      {asset.description}
                      {isAdmin ? "-" + asset.unit?.unit_name : ""}
                    </option>
                  ))}
                </select>
                {errors.mobility_asset_id && (
                  <p className="mt-1 text-red-500">
                    {errors.mobility_asset_id}
                  </p>
                )}
              </div>

              <div>
                <label className="text-base text-slate-600 dark:text-white">
                  Last Service Date
                </label>

                <input
                  type="date"
                  value={formData.last_service_date}
                  onChange={(e) =>
                    handleChange("last_service_date", e.target.value)
                  }
                  className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.last_service_date
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                />
                {errors.last_service_date && (
                  <p className="mt-1 text-red-500">
                    {errors.last_service_date}
                  </p>
                )}
              </div>

              <div>
                <label className="text-base text-slate-600 dark:text-white">
                  Last Odometer Reading
                </label>

                <input
                  type="number"
                  value={formData.last_service_odometer}
                  onChange={(e) =>
                    handleChange(
                      "last_service_odometer",
                      Number(e.target.value),
                    )
                  }
                  className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.last_service_odometer
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                />
                {errors.last_service_odometer && (
                  <p className="mt-1 text-red-500">
                    {errors.last_service_odometer}
                  </p>
                )}
              </div>

              <div>
                <label className="text-base text-slate-600 dark:text-white">
                  Next Service Date
                </label>

                <input
                  type="date"
                  value={formData.next_service_date}
                  onChange={(e) =>
                    handleChange("next_service_date", e.target.value)
                  }
                  className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.next_service_date
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                />
                {errors.next_service_date && (
                  <p className="mt-1 text-red-500">
                    {errors.next_service_date}
                  </p>
                )}
              </div>

              <div>
                <label className="text-base text-slate-600 dark:text-white">
                  Next Odometer
                </label>

                <input
                  type="number"
                  value={formData.next_service_odometer}
                  onChange={(e) =>
                    handleChange(
                      "next_service_odometer",
                      Number(e.target.value),
                    )
                  }
                  className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.next_service_odometer
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                />
                {errors.next_service_odometer && (
                  <p className="mt-1 text-red-500">
                    {errors.next_service_odometer}
                  </p>
                )}
              </div>

              <div>
                <label className="text-base text-slate-600 dark:text-white">
                  Service Center
                </label>

                <select
                  value={formData.service_center}
                  onChange={(e) =>
                    handleChange("service_center", e.target.value)
                  }
                  className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.service_center
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                >
                  <option value="">Select Service Center</option>

                  <option value="Independent Auto Repair Shop">
                    Independent Auto Repair Shop
                  </option>
                  <option value="Car Service Center (CASA)">
                    Car Service Center (CASA)
                  </option>
                  <option value="Mechanic Shop">Mechanic Shop</option>
                  <option value="DIY Mechanic">DIY Mechanic</option>
                </select>
                {errors.service_center && (
                  <p className="mt-1 text-red-500">{errors.service_center}</p>
                )}
              </div>

              <div>
                <label className="text-base text-slate-600 dark:text-white">
                  Service Center/Shop Name
                </label>

                <input
                  type="text"
                  value={formData.service_center_name}
                  onChange={(e) =>
                    handleChange("service_center_name", e.target.value)
                  }
                  className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.service_center_name
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                  placeholder="Name of the Service Center/Shop"
                />
                {errors.service_center_name && (
                  <p className="mt-1 text-red-500">
                    {errors.service_center_name}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <div>
                <label className="text-base text-slate-600 dark:text-white">
                  Service Center/Shop Location
                </label>

                <input
                  type="text"
                  value={formData.service_center_location}
                  onChange={(e) =>
                    handleChange("service_center_location", e.target.value)
                  }
                  className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.service_center_location
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                  placeholder="Location of the Service Center/Shop"
                />
                {errors.service_center_location && (
                  <p className="mt-1 text-red-500">
                    {errors.service_center_location}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <div>
                <label className="text-slate-600 dark:text-white">
                  PMS Catalog
                </label>

                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Search services..."
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div
                  className={`max-h-52 overflow-y-auto rounded-xl border dark:border-slate-700 ${
                    errors.items ? "border-red-500" : "border-slate-300"
                  }`}
                >
                  <table className="w-full text-left text-slate-600 dark:text-slate-300">
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {filteredMaintenanceTypes.map((type) => {
                        const isChecked = selectedTypes.includes(type.id);
                        return (
                          <tr
                            key={type.id}
                            onClick={() => toggleTypes(type.id)}
                            className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                          >
                            {/* Checkbox Column: Shrink to fit content only */}
                            <td className="p-3 text-center w-1 whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleTypes(type.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 cursor-pointer"
                              />
                            </td>

                            {/* Name Column: Fits contents without wrapping */}
                            <td className="px-4 py-3 font-medium whitespace-nowrap">
                              {type.name || "-"}
                            </td>

                            {/* Description Column: Expands (w-full) to absorb all extra space */}
                            <td className="px-4 py-3 w-full">
                              <p className="text-slate-700 dark:text-slate-200">
                                {type.description || "-"}
                              </p>
                            </td>

                            {/* Interval Column: Fixed fit so text stays inline */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1 text-slate-700 dark:text-slate-200">
                                {type.default_interval_km && (
                                  <span>{type.default_interval_km} km</span>
                                )}
                                {type.default_interval_km &&
                                  type.default_interval_months && (
                                    <span>or</span>
                                  )}
                                {type.default_interval_months && (
                                  <span>
                                    {type.default_interval_months} months
                                  </span>
                                )}
                                {!type.default_interval_km &&
                                  !type.default_interval_months && (
                                    <span>-</span>
                                  )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-slate-500 dark:text-white">
                  Selected: {selectedTypes.length} service/s.{" "}
                  {errors.items && (
                    <span className="text-red-500">{errors.items}</span>
                  )}
                </p>
              </div>
            </div>

            <div>
              <label className="text-slate-600 dark:text-white">
                Proof of PMS/Official Receipt (Photo)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                    ${
                      errors.proof_photo_url
                        ? "border-red-500"
                        : "border-slate-300"
                    }`}
              />
              {!previewUrl && proofImageUrl && (
                <img
                  src={proofImageUrl}
                  className="mt-4 mx-auto block max-h-48 w-full max-w-md rounded-xl border object-cover"
                  alt="Current Proof"
                />
              )}

              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="mt-4 mx-auto block max-h-48 w-full max-w-md rounded-xl border object-cover"
                />
              )}
              {errors.proof_photo_url && (
                <p className="mt-1 text-red-500">{errors.proof_photo_url}</p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 px-5 py-2 dark:border-slate-700"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-blue-600 px-5 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : mode === "edit" ? "Update" : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
