import { useState } from "react";
import { ChevronDown, X } from "lucide-react";

export interface DriverLicensePersonnel {
  id: string;
  fullname: string;
  drivers_license_no?: string | null;
  drivers_license_expiration?: string | null;
  drivers_license_type?: string | null;
  drivers_license_transmission?: "MANUAL" | "AUTOMATIC" | "BOTH" | null;
  drivers_license_restrictions?: string[] | null;
}

interface DriverLicenseModalProps {
  personnel: DriverLicensePersonnel;

  onClose: () => void;

  onSave: (data: {
    drivers_license_no: string;
    drivers_license_expiration: string;
    drivers_license_type: string;
    drivers_license_transmission: "MANUAL" | "AUTOMATIC" | "BOTH";
    drivers_license_restrictions: string[];
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
  onClose,
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

      await onSave({
        drivers_license_no: licenseNo.trim(),
        drivers_license_expiration: expiration,
        drivers_license_type: licenseType,
        drivers_license_transmission: transmission,
        drivers_license_restrictions: restrictions,
      });

      onClose();
    } catch (error) {
      console.error("Failed to save driver's license:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Driver's License Information
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Add or complete the driver's license information for{" "}
              <span className="font-semibold">{personnel.fullname}</span>.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-5 p-6">
          {/* License Number */}
          <div>
            <label className="mb-2 block text-sm font-semibold">
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

          {/* Expiration */}
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Expiration Date
            </label>

            <input
              type="date"
              value={expiration}
              onChange={(e) => setExpiration(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* License Type */}
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Driver's License Type
            </label>

            <select
              value={licenseType}
              onChange={(e) => setLicenseType(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="NON_PROFESSIONAL">Non-Professional License</option>

              <option value="PROFESSIONAL">Professional License</option>
              <option value="STUDENT_PERMIT">Student Permit</option>
            </select>
          </div>

          {/* Transmission */}
          <div>
            <label className="mb-2 block text-sm font-semibold">
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

          {/* Restrictions */}
          <div className="relative">
            <label className="mb-2 block text-sm font-semibold">
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
                                ? prev.filter((code) => code !== option.code)
                                : [...prev, option.code],
                            );
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600"
                        />

                        <span className="text-sm">{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl px-5 py-2.5 font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save & Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
