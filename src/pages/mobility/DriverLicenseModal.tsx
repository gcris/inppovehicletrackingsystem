import { useEffect, useState } from "react";
import { ChevronDown, ImageIcon, Loader2, Upload, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import IdCardScanner, { ExtractedIdData } from "../account/IdCardScanner";

export interface DriverLicensePersonnel {
  id: string;
  rank: string;
  fullname: string;

  drivers_license_no?: string | null;
  drivers_license_expiration?: string | null;
  drivers_license_type?: string | null;

  drivers_license_transmission?: "MANUAL" | "AUTOMATIC" | "BOTH" | null;

  drivers_license_restrictions?: string[] | null;

  drivers_license_photo_path?: string | null;

  existing_photo_path?: string | null;
}

type DriverLicenseModalMode = "view" | "edit";

interface DriverLicenseModalProps {
  personnel: DriverLicensePersonnel;
  mode: DriverLicenseModalMode;

  onClose: () => void;
  onEdit?: () => void;

  onSave?: (data: {
    drivers_license_no: string;
    drivers_license_expiration: string;
    drivers_license_type: string;
    drivers_license_transmission: "MANUAL" | "AUTOMATIC" | "BOTH";
    drivers_license_restrictions: string[];
    drivers_license_photo: File | null;
    existing_photo_path: string | null;
  }) => Promise<void>;
}

const restrictionOptions = [
  {
    code: "A",
    label: "A — Motorcycle",
  },
  {
    code: "A1",
    label: "A1 — Tricycle",
  },
  {
    code: "B",
    label: "B — Passenger Car",
  },
  {
    code: "B1",
    label: "B1 — Passenger Van / Jeepney",
  },
  {
    code: "B2",
    label: "B2 — Light Commercial Vehicle",
  },
  {
    code: "BE",
    label: "BE — Light Articulated Vehicle",
  },
  {
    code: "C",
    label: "C — Heavy Commercial Vehicle",
  },
  {
    code: "CE",
    label: "CE — Heavy Articulated Vehicle",
  },
  {
    code: "D",
    label: "D — Heavy Passenger Bus",
  },
];

export default function DriverLicenseModal({
  personnel,
  mode,
  onClose,
  onEdit,
  onSave,
}: DriverLicenseModalProps) {
  const [licenseNo, setLicenseNo] = useState(
    personnel.drivers_license_no ?? "",
  );

  const [expiration, setExpiration] = useState(
    personnel.drivers_license_expiration ?? "",
  );

  const [licenseType, setLicenseType] = useState(
    personnel.drivers_license_type ?? "NON_PROFESSIONAL",
  );

  const [transmission, setTransmission] = useState<
    "MANUAL" | "AUTOMATIC" | "BOTH" | ""
  >(personnel.drivers_license_transmission ?? "");

  const [restrictions, setRestrictions] = useState<string[]>(
    personnel.drivers_license_restrictions ?? [],
  );

  const [showRestrictions, setShowRestrictions] = useState(false);

  const [saving, setSaving] = useState(false);

  const [licensePhoto, setLicensePhoto] = useState<File | null>(null);

  const [licensePhotoPreview, setLicensePhotoPreview] = useState<string | null>(
    null,
  );

  /*
   * Load existing driver's license image from Supabase
   * when viewing/editing an existing license.
   */
  useEffect(() => {
    let active = true;

    const loadLicensePhoto = async () => {
      if (!personnel.drivers_license_photo_path) {
        setLicensePhotoPreview(null);
        return;
      }

      const { data, error } = await supabase.storage
        .from("drivers-licenses")
        .createSignedUrl(personnel.drivers_license_photo_path, 60 * 60);

      if (error) {
        console.error("Failed to load driver's license photo:", error);

        return;
      }

      if (active) {
        setLicensePhotoPreview(data.signedUrl);
      }
    };

    loadLicensePhoto();

    return () => {
      active = false;
    };
  }, [personnel.drivers_license_photo_path]);

  /*
   * Clean up object URLs when component unmounts.
   */
  useEffect(() => {
    return () => {
      if (licensePhotoPreview && licensePhotoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(licensePhotoPreview);
      }
    };
  }, [licensePhotoPreview]);

  /*
   * Handle selected driver's license image.
   */
  const handleLicensePhoto = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("License photo must be 5 MB or smaller.");
      return;
    }

    if (licensePhotoPreview && licensePhotoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(licensePhotoPreview);
    }

    setLicensePhoto(file);
    setLicensePhotoPreview(URL.createObjectURL(file));
  };

  /*
   * Remove selected driver's license image.
   */
  const handleRemovePhoto = () => {
    if (licensePhotoPreview && licensePhotoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(licensePhotoPreview);
    }

    setLicensePhoto(null);
    setLicensePhotoPreview(null);
  };

  /*
   * Save driver's license information.
   */
  const handleSave = async () => {
    if (!licenseNo.trim()) {
      alert("Please enter the driver's license number.");
      return;
    }

    if (!expiration) {
      alert("Please enter the license expiration date.");
      return;
    }

    if (!transmission) {
      alert("Please select the transmission authorization.");
      return;
    }

    if (restrictions.length === 0) {
      alert("Please select at least one driver's license restriction.");
      return;
    }

    try {
      setSaving(true);

      await onSave?.({
        drivers_license_no: licenseNo.trim(),

        drivers_license_expiration: expiration,

        drivers_license_type: licenseType,

        drivers_license_transmission: transmission,

        drivers_license_restrictions: restrictions,

        drivers_license_photo: licensePhoto,

        existing_photo_path: personnel.drivers_license_photo_path ?? null,
      });

      onClose();
    } catch (error) {
      console.error("Failed to save driver's license:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        {/* ===================================================== */}
        {/* HEADER */}
        {/* ===================================================== */}

        <div className="shrink-0 border-b border-slate-200 px-6 py-5 dark:border-slate-700">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Driver's License Information
              </h2>

              <p className="mt-1 text-slate-500 dark:text-slate-400">
                Driver's License Information for{" "}
                <span className="font-semibold">
                  {personnel.rank} {personnel.fullname}
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ===================================================== */}
        {/* CONTENT */}
        {/* ===================================================== */}

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* =================================================== */}
          {/* VIEW MODE */}
          {/* =================================================== */}

          {mode === "view" ? (
            <div className="space-y-6">
              {/* License Photo */}
              <div>
                <p className="mb-2 font-semibold text-slate-700 dark:text-slate-300">
                  Driver's License Photo
                </p>

                {licensePhotoPreview ? (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                    <img
                      src={licensePhotoPreview}
                      alt="Driver's License"
                      className="max-h-72 w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800">
                    No license photo uploaded
                  </div>
                )}
              </div>

              {/* License Details */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* License Number */}
                <div>
                  <p className="font-medium text-slate-400">License No.</p>

                  <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                    {personnel.drivers_license_no || "—"}
                  </p>
                </div>

                {/* Expiration */}
                <div>
                  <p className="font-medium text-slate-400">Expiration</p>

                  <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                    {personnel.drivers_license_expiration
                      ? new Date(
                          personnel.drivers_license_expiration,
                        ).toLocaleDateString("en-PH", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "—"}
                  </p>
                </div>

                {/* License Type */}
                <div>
                  <p className="font-medium text-slate-400">License Type</p>

                  <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                    {personnel.drivers_license_type?.replaceAll("_", " ") ||
                      "—"}
                  </p>
                </div>

                {/* Transmission */}
                <div>
                  <p className="font-medium text-slate-400">Transmission</p>

                  <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                    {personnel.drivers_license_transmission === "BOTH"
                      ? "Manual & Automatic"
                      : personnel.drivers_license_transmission || "—"}
                  </p>
                </div>

                {/* Restrictions */}
                <div className="sm:col-span-2">
                  <p className="font-medium text-slate-400">Restrictions</p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {personnel.drivers_license_restrictions?.length ? (
                      personnel.drivers_license_restrictions.map(
                        (restriction) => (
                          <span
                            key={restriction}
                            className="rounded-lg bg-blue-100 px-3 py-1.5 font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                          >
                            {restriction}
                          </span>
                        ),
                      )
                    ) : (
                      <span className="text-slate-400">
                        No restrictions recorded
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ================================================= */
            /* EDIT MODE */
            /* ================================================= */
            <div className="space-y-5">
              {/* ================================================= */}
              {/* LICENSE PHOTO */}
              {/* ================================================= */}

              <div>
                <label className="mb-2 block font-semibold text-slate-700 dark:text-slate-200">
                  Driver's License Photo
                </label>

                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                  {licensePhotoPreview ? (
                    <div className="space-y-3">
                      {/* Preview */}
                      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                        <img
                          src={licensePhotoPreview}
                          alt="Driver's license"
                          className="max-h-56 w-full object-contain"
                        />

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="absolute right-2 top-2 rounded-full bg-red-500 p-2 text-white shadow-lg hover:bg-red-600"
                          title="Remove photo"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Change Photo */}
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
                        <Upload className="h-4 w-4" />
                        Change Photo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];

                            if (!file) return;

                            handleLicensePhoto(file);

                            // Allow selecting the same file again
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  ) : (
                    <>
                      {/* Upload Area */}
                      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl px-4 py-8 text-center transition hover:bg-slate-100 dark:hover:bg-slate-800">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                          <ImageIcon className="h-6 w-6" />
                        </div>

                        <p className="font-semibold text-slate-700 dark:text-slate-200">
                          Upload Driver's License
                        </p>

                        <p className="mt-1 text-slate-500">
                          JPG or PNG • Maximum 5 MB
                        </p>

                        <span className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                          <Upload className="h-4 w-4" />
                          Choose Image
                        </span>

                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];

                            if (!file) return;

                            handleLicensePhoto(file);

                            e.target.value = "";
                          }}
                        />
                      </label>
                    </>
                  )}
                </div>
              </div>

              {/* ================================================= */}
              {/* LICENSE NUMBER */}
              {/* ================================================= */}

              <div>
                <label className="mb-2 block font-semibold text-slate-700 dark:text-slate-200">
                  Driver's License No.
                </label>

                <input
                  type="text"
                  value={licenseNo}
                  onChange={(e) => setLicenseNo(e.target.value)}
                  placeholder="Enter license number"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* ================================================= */}
              {/* EXPIRATION */}
              {/* ================================================= */}

              <div>
                <label className="mb-2 block font-semibold text-slate-700 dark:text-slate-200">
                  Expiration Date
                </label>

                <input
                  type="date"
                  value={expiration}
                  onChange={(e) => setExpiration(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* ================================================= */}
              {/* LICENSE TYPE */}
              {/* ================================================= */}

              <div>
                <label className="mb-2 block font-semibold text-slate-700 dark:text-slate-200">
                  Driver's License Type
                </label>

                <select
                  value={licenseType}
                  onChange={(e) => setLicenseType(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="NON_PROFESSIONAL">
                    Non-Professional License
                  </option>

                  <option value="PROFESSIONAL">Professional License</option>
                </select>
              </div>

              {/* ================================================= */}
              {/* TRANSMISSION */}
              {/* ================================================= */}

              <div>
                <label className="mb-2 block font-semibold text-slate-700 dark:text-slate-200">
                  Transmission Authorization
                </label>

                <select
                  value={transmission}
                  onChange={(e) =>
                    setTransmission(
                      e.target.value as "MANUAL" | "AUTOMATIC" | "BOTH" | "",
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">Select transmission</option>

                  <option value="MANUAL">Manual</option>

                  <option value="AUTOMATIC">Automatic</option>

                  <option value="BOTH">Manual & Automatic</option>
                </select>
              </div>

              {/* ================================================= */}
              {/* RESTRICTIONS */}
              {/* ================================================= */}

              <div className="relative">
                <label className="mb-2 block font-semibold text-slate-700 dark:text-slate-200">
                  Driver's License Restriction
                </label>

                <button
                  type="button"
                  onClick={() => setShowRestrictions((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-3 text-left dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <span className="truncate">
                    {restrictions.length === 0
                      ? "Select restriction"
                      : restrictions.join(", ")}
                  </span>

                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      showRestrictions ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {showRestrictions && (
                  <div className="absolute bottom-full z-[110] mb-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    <div className="max-h-64 overflow-y-auto p-2">
                      {restrictionOptions.map((option) => {
                        const selected = restrictions.includes(option.code);

                        return (
                          <label
                            key={option.code}
                            className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => {
                                setRestrictions((prev) =>
                                  selected
                                    ? prev.filter(
                                        (code) => code !== option.code,
                                      )
                                    : [...prev, option.code],
                                );
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600"
                            />

                            <span className="text-sm text-slate-700 dark:text-slate-200">
                              {option.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ===================================================== */}
        {/* FOOTER */}
        {/* ===================================================== */}

        {mode === "view" ? (
          <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-5 py-2.5 font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Close
            </button>

            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700"
              >
                Edit License
              </button>
            )}
          </div>
        ) : (
          <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl px-5 py-2.5 font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save & Continue"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
