import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "../../lib/supabase";

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

interface DriverLicenseModalProps {
  personnel: DriverLicensePersonnel;

  onClose: () => void;
}

export default function DriverLicenseModal({
  personnel,
  onClose,
}: DriverLicenseModalProps) {
  const [licenseNo, setLicenseNo] = useState(
    personnel.drivers_license_no ?? "",
  );

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
                  {personnel.drivers_license_type?.replaceAll("_", " ") || "—"}
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
        </div>

        {/* ===================================================== */}
        {/* FOOTER */}
        {/* ===================================================== */}

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-5 py-2.5 font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
