import React, { useEffect, useMemo, useState } from "react";
import { mobilityType } from "../../types/mobilityType";
import { Check, ImagePlus, Loader2, X } from "lucide-react";
import { MobilityPhoto, Personnel, supabase } from "../../lib/supabase";
import DriverLicenseModal, {
  DriverLicensePersonnel,
} from "./DriverLicenseModal";
import { useAuth } from "../../components/AuthProvider";

// Form state interface aligned with your state structure
export type MobilityFormData = {
  plate_number: string;
  vehicle_type: string;
  year_model: string;
  source: "Organic" | "Loaned" | "Donated";
  current_odometer: number;
  status: string;
  description: string;
  unit_id: string;
  driver_id: string | null;
  or_number: string;
  cr_number: string;
  date_of_last_registration: string;
  date_registration_expires: string;
  engine_number: string;
  chassis_number: string;
  insurance_provider: string;
  insurance_coverage_date: string;
  remarks: string;

  photos: File[];
};

export interface UnitOption {
  id: string;
  unit_name: string;
}

interface MobilityFormModalProps {
  open: boolean;
  editingVehicle: boolean;
  formData: MobilityFormData;
  // New photos selected by the user
  mobilityPhotos: File[];

  // Existing photos from Supabase
  existingPhotos?: MobilityPhoto[];
  unitList?: UnitOption[];
  personnelList?: Personnel[];

  onPersonnelUpdated?: (personnel: Personnel) => void;

  closeModal: () => void;
  handleInputChange: (field: keyof MobilityFormData, value: any) => void;
  handleAddVehicle: (e: React.SyntheticEvent) => Promise<void>;
  handleUpdateVehicle: (e: React.SyntheticEvent) => Promise<void>;
  handleRemoveExistingPhoto: (photo: MobilityPhoto) => Promise<void>;
  getStatusColor: (status: string) => string;
}

export const MobilityFormModal: React.FC<MobilityFormModalProps> = ({
  open,
  editingVehicle,
  formData,
  mobilityPhotos,
  existingPhotos = [],
  unitList = [],
  personnelList = [],
  onPersonnelUpdated,
  closeModal,
  handleInputChange,
  handleAddVehicle,
  handleUpdateVehicle,
  handleRemoveExistingPhoto,
  getStatusColor,
}) => {
  type MobilityFormErrors = Partial<Record<keyof MobilityFormData, string>>;

  const [errors, setErrors] = useState<MobilityFormErrors>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedPersonnelForLicense, setSelectedPersonnelForLicense] =
    useState<DriverLicensePersonnel | null>(null);
  const [showLicenseModal, setShowLicenseModal] = useState(false);

  const [licenseModalMode, setLicenseModalMode] = useState<"view" | "edit">(
    "view",
  );
  const [mobilityFormData, setMobilityFormData] =
    useState<MobilityFormData>(formData);

  const { isAdmin, unitId } = useAuth();

  const photoPreviews = useMemo(() => {
    return formData.photos.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
  }, [formData.photos]);

  useEffect(() => {
    return () => {
      photoPreviews.forEach((photo) => {
        URL.revokeObjectURL(photo.url);
      });
    };
  }, [photoPreviews]);

  const filteredPersonnel = useMemo(() => {
    let filtered = personnelList;

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
  }, [personnelList, formData.unit_id]);

  const validateForm = () => {
    const newErrors: MobilityFormErrors = {};

    if (formData.photos.length < 1 && existingPhotos.length < 1) {
      newErrors.photos = "Please add at least one (1) mobility photo.";
    }

    if (!formData.plate_number.trim()) {
      newErrors.plate_number = "Plate number is required.";
    }

    if (!formData.vehicle_type) {
      newErrors.vehicle_type = "Mobility type is required.";
    }

    if (!formData.year_model.trim()) {
      newErrors.year_model = "Year Model is required.";
    }

    if (formData.current_odometer < 0) {
      newErrors.current_odometer = "Invalid odometer reading.";
    }

    if (formData.status !== "Serviceable" && !formData.remarks) {
      newErrors.remarks = `Please specify the reason why this mobility is ${formData.status}`;
    }

    if (!formData.description.trim()) {
      newErrors.description = "Mobility Description is required.";
    }

    if (!formData.unit_id) {
      newErrors.unit_id = "Please select a unit.";
    }

    if (!formData.driver_id) {
      newErrors.driver_id = "Please select a official driver.";
    }

    if (!formData.or_number) {
      newErrors.or_number = "Official Receipt Number is required.";
    }

    if (!formData.cr_number) {
      newErrors.cr_number = "Certificate of Registration Number is required.";
    }

    if (!formData.date_of_last_registration) {
      newErrors.date_of_last_registration =
        "Date of Last Registration is required.";
    }

    if (!formData.date_registration_expires) {
      newErrors.date_registration_expires =
        "Date Registration Expires is required.";
    }

    if (!formData.engine_number) {
      newErrors.engine_number = "Engine Number is required.";
    }

    if (!formData.chassis_number) {
      newErrors.chassis_number = "Chassis Number is required.";
    }

    if (!formData.insurance_provider) {
      newErrors.insurance_provider = "Insurance is required.";
    }

    if (!formData.insurance_coverage_date) {
      newErrors.insurance_coverage_date =
        "Insurance Coverage Date is required.";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    if (isLoading) return;

    setIsLoading(true);
    console.log("isLoading: ", isLoading);
    e.preventDefault();

    try {
      if (!validateForm()) return;

      if (editingVehicle) {
        await handleUpdateVehicle(e);
      } else {
        await handleAddVehicle(e);
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const addOneYear = (dateString: string) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    date.setFullYear(date.getFullYear() + 1);

    return date.toISOString().split("T")[0];
  };

  const handleDriverChange = (personnelId: string) => {
    setMobilityFormData((prev) => ({
      ...prev,
      driver_id: personnelId || null,
    }));

    if (!personnelId) return;

    const data = filteredPersonnel.find((person) => person.id === personnelId);

    if (!data) return;

    const hasCompleteLicenseInfo = hasDriverLicenseInfo(data);

    setSelectedPersonnelForLicense({
      id: personnelId,
      rank: data.rank?.rank_name ?? "",
      fullname: data.fullname,
      drivers_license_expiration: data.drivers_license_expiration,
      drivers_license_no: data.drivers_license_no,
      drivers_license_restrictions: data.drivers_license_restrictions,
      drivers_license_type: data.drivers_license_type,
      drivers_license_photo_path: data.drivers_license_photo_path,
      drivers_license_transmission: data.drivers_license_transmission,
      existing_photo_path: data.drivers_license_photo_path!,
    });

    setLicenseModalMode(hasCompleteLicenseInfo ? "view" : "edit");
    setShowLicenseModal(true);
  };

  const handleSaveDriverLicense = async (data: {
    drivers_license_no: string;
    drivers_license_expiration: string;
    drivers_license_type: string;
    drivers_license_transmission: "MANUAL" | "AUTOMATIC" | "BOTH";
    drivers_license_restrictions: string[];
    drivers_license_photo: File | null;
  }) => {
    if (!selectedPersonnelForLicense) return;

    let newPhotoPath: string | null = null;

    try {
      /*
       * 1. Upload the new photo if one was selected
       */
      if (data.drivers_license_photo) {
        const file = data.drivers_license_photo;

        const fileExtension =
          file.name.split(".").pop()?.toLowerCase() ?? "jpg";

        const fileName = `${crypto.randomUUID()}.${fileExtension}`;

        newPhotoPath = `${selectedPersonnelForLicense.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("drivers-licenses")
          .upload(newPhotoPath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          });

        if (uploadError) {
          throw uploadError;
        }
      }

      /*
       * 2. Update the personnel record in Supabase
       */
      const { error: updateError } = await supabase
        .from("personnel")
        .update({
          drivers_license_no: data.drivers_license_no,
          drivers_license_expiration: data.drivers_license_expiration,
          drivers_license_type: data.drivers_license_type,
          drivers_license_transmission: data.drivers_license_transmission,
          drivers_license_restrictions: data.drivers_license_restrictions,

          ...(newPhotoPath
            ? {
                drivers_license_photo_path: newPhotoPath,
              }
            : {}),
        })
        .eq("id", selectedPersonnelForLicense.id);

      if (updateError) {
        /*
         * Database update failed.
         * Remove uploaded photo to avoid orphaned file.
         */
        if (newPhotoPath) {
          await supabase.storage
            .from("drivers-licenses")
            .remove([newPhotoPath]);
        }

        throw updateError;
      }

      /*
       * 3. Delete old photo after successful update
       */
      if (newPhotoPath && selectedPersonnelForLicense.existing_photo_path) {
        const { error: deleteError } = await supabase.storage
          .from("drivers-licenses")
          .remove([selectedPersonnelForLicense.existing_photo_path]);

        if (deleteError) {
          console.error(
            "Failed to delete old driver's license photo:",
            deleteError,
          );
        }
      }

      /*
       * 4. Get the current Personnel object
       */
      const existingPersonnel = personnelList.find(
        (person) => person.id === selectedPersonnelForLicense.id,
      );

      if (existingPersonnel) {
        /*
         * 5. Create the updated Personnel object
         */
        const updatedPersonnel: Personnel = {
          ...existingPersonnel,

          drivers_license_no: data.drivers_license_no,
          drivers_license_expiration: data.drivers_license_expiration,
          drivers_license_type: data.drivers_license_type,
          drivers_license_transmission: data.drivers_license_transmission,
          drivers_license_restrictions: data.drivers_license_restrictions,

          drivers_license_photo_path:
            newPhotoPath ?? existingPersonnel.drivers_license_photo_path,
        };

        /*
         * 6. Tell the parent to update personnelList
         */
        onPersonnelUpdated?.(updatedPersonnel);
      }

      /*
       * 7. Update the currently selected personnel
       *    inside the license modal as well
       */
      setSelectedPersonnelForLicense((prev) =>
        prev
          ? {
              ...prev,
              drivers_license_no: data.drivers_license_no,
              drivers_license_expiration: data.drivers_license_expiration,
              drivers_license_type: data.drivers_license_type,
              drivers_license_transmission: data.drivers_license_transmission,
              drivers_license_restrictions: data.drivers_license_restrictions,
              drivers_license_photo_path:
                newPhotoPath ?? prev.drivers_license_photo_path,
              existing_photo_path: newPhotoPath ?? prev.existing_photo_path,
            }
          : prev,
      );

      /*
       * 8. Change modal to VIEW mode because
       *    license information is now complete.
       */
      setLicenseModalMode("view");
    } catch (error) {
      console.error("Failed to save driver's license:", error);

      throw error;
    }
  };

  const hasDriverLicenseInfo = (person: Personnel) => {
    return (
      !!person.drivers_license_no &&
      !!person.drivers_license_expiration &&
      !!person.drivers_license_type &&
      !!person.drivers_license_transmission &&
      !!person.drivers_license_photo_path &&
      (person.drivers_license_restrictions?.length ?? 0) > 0
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-6">
      <div className="w-full max-w-6xl max-h-[95vh] overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-8 py-6">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
              {editingVehicle
                ? "Edit Mobility Asset"
                : "Register Mobility Asset"}
            </h2>
            <p className="text-slate-500 mt-1">
              {editingVehicle
                ? "Update mobility asset."
                : "Register a new mobility asset."}
            </p>
          </div>

          <button
            onClick={closeModal}
            className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-500 dark:text-slate-400"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-8 py-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Mobility Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Plate Number */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Plate Number
                  </label>
                  <input
                    type="text"
                    value={formData.plate_number}
                    onChange={(e) =>
                      handleInputChange(
                        "plate_number",
                        e.target.value.toUpperCase(),
                      )
                    }
                    className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.plate_number
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                    placeholder="ABC-1234"
                  />
                  <p className="text-text-slate-600 dark:text-slate-200 italic">
                    <span className="font-semibold">Note</span>: If incase Plate
                    Number is not available, please indicate the MV File Number.
                  </p>
                  {errors.plate_number && (
                    <p className="mt-1 text-red-500">{errors.plate_number}</p>
                  )}
                </div>

                {/* Vehicle Type */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Mobility Type
                  </label>
                  <select
                    value={formData.vehicle_type}
                    onChange={(e) =>
                      handleInputChange("vehicle_type", e.target.value)
                    }
                    className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.vehicle_type
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                  >
                    <option value="">Select Vehicle</option>
                    {mobilityType.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  {errors.vehicle_type && (
                    <p className="mt-1 text-red-500">{errors.vehicle_type}</p>
                  )}
                </div>

                {/* Year Model */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Year Model
                  </label>
                  <input
                    type="text"
                    value={formData.year_model}
                    onChange={(e) =>
                      handleInputChange("year_model", e.target.value)
                    }
                    className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.year_model
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                    placeholder="2024"
                  />
                  {errors.year_model && (
                    <p className="mt-1 text-red-500">{errors.year_model}</p>
                  )}
                </div>

                {/* Source */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Source
                  </label>
                  <select
                    value={formData.source}
                    onChange={(e) =>
                      handleInputChange(
                        "source",
                        e.target.value as "Organic" | "Loaned" | "Donated",
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-white"
                  >
                    <option value="Organic">Organic</option>
                    <option value="Loaned">Loaned</option>
                    <option value="Donated">Donated</option>
                  </select>
                </div>

                {/* Current Odometer */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Current Odometer Reading (km)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.current_odometer}
                    onChange={(e) =>
                      handleInputChange(
                        "current_odometer",
                        Number(e.target.value),
                      )
                    }
                    className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.current_odometer
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                    placeholder="14,200"
                  />
                  {errors.current_odometer && (
                    <p className="mt-1 text-red-500">
                      {errors.current_odometer}
                    </p>
                  )}
                </div>

                {/* Status */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      handleInputChange("status", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-white"
                  >
                    <option value="Serviceable">Serviceable</option>
                    <option value="Unserviceable">Unserviceable</option>
                    <option value="Beyond Economic Repair">
                      Beyond Economic Repair
                    </option>
                  </select>
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) =>
                      handleInputChange("description", e.target.value)
                    }
                    className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.description
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                    placeholder="Specify the description of the vehicle. Example: 4x4 Double Cab"
                  />
                  {errors.description && (
                    <p className="mt-1 text-red-500">{errors.description}</p>
                  )}
                </div>

                {/* Remarks */}
                <div className="md:col-span-2">
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Remarks
                  </label>
                  <input
                    type="text"
                    value={formData.remarks}
                    onChange={(e) =>
                      handleInputChange("remarks", e.target.value)
                    }
                    className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.remarks ? "border-red-500" : "border-slate-300"
                      }`}
                    placeholder={
                      formData.status !== "Serviceable"
                        ? `Specify the reason why this mobility is ${formData.status}.`
                        : "Specity the remarks of the mobility"
                    }
                  />
                  {formData.status !== "Serviceable" && (
                    <p className="mt-2 italic">
                      Note: Specify the reason why this mobility is{" "}
                      <span
                        className={`rounded-full px-3 py-1 font-semibold ${getStatusColor(
                          formData.status,
                        )}`}
                      >
                        {formData.status}
                      </span>
                      .
                    </p>
                  )}
                  {errors.remarks && (
                    <p className="mt-1 text-red-500">{errors.remarks}</p>
                  )}
                </div>
              </div>
            </div>

            {/* =========================
                Assignment
            ========================= */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Unit/Station
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Unit */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Unit/Station
                  </label>
                  <select
                    value={formData.unit_id}
                    disabled={!isAdmin}
                    onChange={(e) => {
                      handleInputChange("unit_id", e.target.value);
                      handleInputChange("driver_id", "");
                    }}
                    className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.unit_id ? "border-red-500" : "border-slate-300"
                      }`}
                  >
                    <option value="">Select Unit</option>
                    {unitList.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.unit_name}
                      </option>
                    ))}
                  </select>
                  {errors.unit_id && (
                    <p className="mt-1 text-red-500">{errors.unit_id}</p>
                  )}
                </div>

                {/* Driver */}
                <div>
                  <label className="mb-2 block font-medium">
                    Designated Driver
                  </label>

                  <div className="flex items-center gap-2">
                    <select
                      value={formData.driver_id!}
                      onChange={(e) =>
                        handleInputChange("driver_id", e.target.value)
                      }
                      className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                                      ${
                                        errors.driver_id
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

                    {/* Driver License Status */}
                    {formData.driver_id && (
                      <div className="group relative inline-block">
                        <button
                          type="button"
                          onClick={() =>
                            handleDriverChange(formData.driver_id!)
                          }
                          className={`flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-xl border transition-colors ${(() => {
                            const selectedDriver = filteredPersonnel.find(
                              (person) => person.id === formData.driver_id,
                            );

                            const complete =
                              selectedDriver &&
                              hasDriverLicenseInfo(selectedDriver);

                            return complete
                              ? "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950/60"
                              : "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/60";
                          })()}`}
                          title={(() => {
                            const selectedDriver = filteredPersonnel.find(
                              (person) => person.id === formData.driver_id,
                            );

                            return selectedDriver &&
                              hasDriverLicenseInfo(selectedDriver)
                              ? "Driver's license information complete"
                              : "Driver's license information incomplete";
                          })()}
                        >
                          {(() => {
                            const selectedDriver = filteredPersonnel.find(
                              (person) => person.id === formData.driver_id,
                            );

                            return selectedDriver &&
                              hasDriverLicenseInfo(selectedDriver) ? (
                              <Check className="h-5 w-5" />
                            ) : (
                              <X className="h-5 w-5" />
                            );
                          })()}
                        </button>

                        <div className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 hidden flex-col items-end group-hover:flex">
                          <div className="rounded-md bg-slate-900 px-2.5 py-1 text-white whitespace-nowrap shadow-lg">
                            Click to view Driver's License Information
                          </div>

                          <div className="mr-3 h-2 w-2 -mt-1 rotate-45 bg-slate-900" />
                        </div>
                      </div>
                    )}
                  </div>

                  {errors.driver_id && (
                    <p className="mt-1 text-red-500">{errors.driver_id}</p>
                  )}
                </div>
                {/* <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Official Driver
                  </label>
                  <select
                    value={formData.driver_id}
                    onChange={(e) => {
                      handleInputChange("driver_id", e.target.value);
                    }}
                    className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.driver_id ? "border-red-500" : "border-slate-300"
                      }`}
                  >
                    <option value="">No Driver Assigned</option>
                    {filteredPersonnel.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.rank?.rank_name
                          ? `${person.rank.rank_name} `
                          : ""}
                        {person.fullname}
                      </option>
                    ))}
                  </select>
                  {errors.driver_id && (
                    <p className="mt-1 text-red-500">{errors.driver_id}</p>
                  )}
                </div> */}
              </div>
            </div>

            {/* =========================
                Registration
            ========================= */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Registration Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* OR Number */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    OR Number
                  </label>
                  <input
                    type="text"
                    value={formData.or_number}
                    onChange={(e) =>
                      handleInputChange("or_number", e.target.value)
                    }
                    placeholder="Enter OR/CR Number"
                    className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.or_number ? "border-red-500" : "border-slate-300"
                      }`}
                  />
                  {errors.or_number && (
                    <p className="mt-1 text-red-500">{errors.or_number}</p>
                  )}
                </div>

                {/* CR Number */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    CR Number
                  </label>
                  <input
                    type="text"
                    value={formData.cr_number}
                    onChange={(e) =>
                      handleInputChange("cr_number", e.target.value)
                    }
                    placeholder="Enter OR/CR Number"
                    className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.cr_number ? "border-red-500" : "border-slate-300"
                      }`}
                  />
                  {errors.cr_number && (
                    <p className="mt-1 text-red-500">{errors.cr_number}</p>
                  )}
                </div>

                {/* Date of Registration Expires */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Date of Last Registration
                  </label>
                  <input
                    type="date"
                    value={formData.date_of_last_registration}
                    onChange={(e) => {
                      const registrationDate = e.target.value;

                      handleInputChange(
                        "date_of_last_registration",
                        registrationDate,
                      );

                      handleInputChange(
                        "date_registration_expires",
                        addOneYear(registrationDate),
                      );
                    }}
                    className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.date_of_last_registration
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                  />
                  {errors.date_of_last_registration && (
                    <p className="mt-1 text-red-500">
                      {errors.date_of_last_registration}
                    </p>
                  )}
                </div>

                {/* Date Registration Expires */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Date Registration Expires
                  </label>
                  <input
                    type="date"
                    value={formData.date_registration_expires}
                    onChange={(e) =>
                      handleInputChange(
                        "date_registration_expires",
                        e.target.value,
                      )
                    }
                    className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.date_registration_expires
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                  />
                  {errors.date_registration_expires && (
                    <p className="mt-1 text-red-500">
                      {errors.date_registration_expires}
                    </p>
                  )}
                </div>

                {/* Engine Number */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Engine Number
                  </label>
                  <input
                    type="text"
                    value={formData.engine_number}
                    onChange={(e) =>
                      handleInputChange("engine_number", e.target.value)
                    }
                    placeholder="Enter Engine Number"
                    className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.engine_number
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                  />
                  {errors.engine_number && (
                    <p className="mt-1 text-red-500">{errors.engine_number}</p>
                  )}
                </div>

                {/* Chassis Number */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Chassis Number
                  </label>
                  <input
                    type="text"
                    value={formData.chassis_number}
                    onChange={(e) =>
                      handleInputChange("chassis_number", e.target.value)
                    }
                    placeholder="Enter Chassis Number"
                    className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.chassis_number
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                  />
                  {errors.chassis_number && (
                    <p className="mt-1 text-red-500">{errors.chassis_number}</p>
                  )}
                </div>
              </div>
            </div>

            {/* =========================
                Insurance
            ========================= */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Insurance Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Insurance Provider */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Insurance Provider
                  </label>
                  <input
                    type="text"
                    value={formData.insurance_provider}
                    onChange={(e) =>
                      handleInputChange("insurance_provider", e.target.value)
                    }
                    placeholder="e.g. GSIS, Pioneer, Malayan"
                    className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.insurance_provider
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                  />
                  {errors.insurance_provider && (
                    <p className="mt-1 text-red-500">
                      {errors.insurance_provider}
                    </p>
                  )}
                </div>

                {/* Coverage Until */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Insurance Coverage Until
                  </label>
                  <input
                    type="date"
                    value={formData.insurance_coverage_date}
                    onChange={(e) =>
                      handleInputChange(
                        "insurance_coverage_date",
                        e.target.value,
                      )
                    }
                    className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        errors.insurance_coverage_date
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                  />
                  {errors.insurance_coverage_date && (
                    <p className="mt-1 text-red-500">
                      {errors.insurance_coverage_date}
                    </p>
                  )}
                </div>

                {/* Preview */}
                <div className="md:col-span-2 rounded-xl bg-slate-50 dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700">
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 dark:text-slate-400">
                      Insurance Summary
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {formData.insurance_provider || "No provider selected"}
                    </span>
                    <span className="text-slate-600 dark:text-slate-300">
                      Coverage Until:&nbsp;
                      {formData.insurance_coverage_date || "-"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* =========================
                Mobility Photos
            ========================= */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Mobility Photos
                  </h3>

                  <p className="mt-1 text-slate-500 dark:text-slate-400">
                    Upload up to 4 photos of the mobility.
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {existingPhotos.length + formData.photos.length} / 4
                </span>
              </div>

              {/* Existing Photos */}
              {editingVehicle && existingPhotos.length > 0 && (
                <div className="mb-5">
                  <h4 className="mb-3 font-semibold text-slate-700 dark:text-slate-300">
                    Existing Photos
                  </h4>

                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {existingPhotos.map((photo, index) => {
                      const { data } = supabase.storage
                        .from("mobility-photos")
                        .getPublicUrl(photo.storage_path);

                      return (
                        <div
                          key={photo.storage_path}
                          className="group relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
                        >
                          <img
                            src={data.publicUrl}
                            alt={`Mobility ${index + 1}`}
                            className="aspect-video w-full object-cover"
                          />

                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 text-white">
                            Photo {index + 1}
                          </div>

                          {/* X button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveExistingPhoto(photo)}
                            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white shadow-md transition hover:bg-red-700"
                            title="Remove photo"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* New Photos */}
              {formData.photos.length > 0 && (
                <div className="mb-5">
                  <h4 className="mb-3 font-semibold text-slate-700 dark:text-slate-300">
                    New Photos
                  </h4>

                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {formData.photos.map((file, index) => {
                      const previewUrl = URL.createObjectURL(file);

                      return (
                        <div
                          key={`${file.name}-${index}`}
                          className="relative overflow-hidden rounded-xl border border-blue-300 dark:border-blue-700"
                        >
                          <img
                            src={previewUrl}
                            alt={`New mobility photo ${index + 1}`}
                            className="aspect-video w-full object-cover"
                          />

                          <button
                            type="button"
                            onClick={() => {
                              const updatedPhotos = formData.photos.filter(
                                (_, photoIndex) => photoIndex !== index,
                              );

                              handleInputChange("photos", updatedPhotos);
                            }}
                            className="absolute right-2 top-2 rounded-full bg-red-600 p-1.5 text-white shadow transition hover:bg-red-700"
                          >
                            <X className="h-4 w-4" />
                          </button>

                          <div className="absolute bottom-0 left-0 right-0 bg-blue-600/80 px-2 py-1 text-white">
                            New Photo
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Upload Button */}
              {existingPhotos.length + formData.photos.length < 4 && (
                <label
                  htmlFor="mobility-photos-upload"
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 transition hover:bg-blue-50 dark:hover:bg-blue-950/20
                     ${errors.photos ? "border-red-500 dark:border-red-700 dark:hover:border-red-500 " : "hover:border-blue-500 border-slate-300"}`}
                >
                  <ImagePlus className="mb-3 h-8 w-8 text-slate-400" />

                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Add Mobility Photos
                  </span>

                  <span className="mt-1 text-slate-500 dark:text-slate-400">
                    {4 - existingPhotos.length - formData.photos.length} slot
                    {4 - existingPhotos.length - formData.photos.length !== 1
                      ? "s"
                      : ""}{" "}
                    remaining
                  </span>

                  <input
                    id="mobility-photos-upload"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const selectedFiles = Array.from(e.target.files ?? []);

                      const remainingSlots =
                        4 - existingPhotos.length - formData.photos.length;

                      const filesToAdd = selectedFiles.slice(0, remainingSlots);

                      handleInputChange("photos", [
                        ...formData.photos,
                        ...filesToAdd,
                      ]);

                      e.target.value = "";
                    }}
                  />
                </label>
              )}

              {/* Maximum reached */}
              {existingPhotos.length + formData.photos.length >= 4 && (
                <div className="rounded-xl bg-slate-50 p-4 text-center text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  Maximum of 4 photos reached.
                </div>
              )}

              {errors.photos && (
                <p className="mt-1 text-red-500">{errors.photos}</p>
              )}
            </div>

            {/* Footer / Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              {Object.keys(errors).length > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  Please fix the highlighted errors before submitting.
                </span>
              )}
              <button
                type="button"
                onClick={closeModal}
                disabled={isLoading}
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-3 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 transition font-medium"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span className={isLoading ? "hidden" : "inline-block"}>
                  {editingVehicle ? "Update" : "Save"}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
      {showLicenseModal && selectedPersonnelForLicense && (
        <DriverLicenseModal
          personnel={selectedPersonnelForLicense}
          mode={licenseModalMode}
          onClose={() => {
            setShowLicenseModal(false);
            setSelectedPersonnelForLicense(null);
          }}
          onEdit={() => {
            setLicenseModalMode("edit");
          }}
          onSave={handleSaveDriverLicense}
        />
      )}
    </div>
  );
};

export default MobilityFormModal;
