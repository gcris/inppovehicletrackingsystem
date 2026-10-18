import React from "react";
import { type Personnel } from "../../lib/supabase";

interface Props {
  open: boolean;
  onClose: () => void;
  user: Personnel | null;
}

const InfoItem = ({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) => {
  return (
    <div className="min-w-0">
      <p className="tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>

      <div className="mt-1 break-words pl-1 font-semibold text-slate-800 dark:text-slate-200">
        {value !== null && value !== undefined && value !== "" ? value : "—"}
      </div>
    </div>
  );
};

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-700 dark:bg-slate-800/40">
      <h3 className="mb-5 border-b border-slate-200 pb-3 text-base font-bold text-slate-800 dark:border-slate-700 dark:text-slate-100">
        {title}
      </h3>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </section>
  );
};

const StatusBadge = ({
  status,
  type = "default",
}: {
  status: string;
  type?: "success" | "warning" | "danger" | "default";
}) => {
  const styles = {
    success:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    warning:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    danger: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    default:
      "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${styles[type]}`}
    >
      {status}
    </span>
  );
};

const getDateStatus = (date?: string | null) => {
  if (!date) {
    return {
      label: "—",
      type: "default" as const,
    };
  }

  const expirationDate = new Date(date);
  const today = new Date();

  expirationDate.setHours(23, 59, 59, 999);
  today.setHours(0, 0, 0, 0);

  const diff = expirationDate.getTime() - today.getTime();

  const daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return {
      label: "Expired",
      type: "danger" as const,
    };
  }

  if (daysRemaining <= 30) {
    return {
      label: `Expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
      type: "warning" as const,
    };
  }

  return {
    label: "Valid",
    type: "success" as const,
  };
};

const formatDate = (date?: string | null) => {
  if (!date) return "—";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export default function UserDetailsModal({ open, onClose, user }: Props) {
  if (!open || !user) return null;

  /*
   * These fields are intentionally accessed through the personnel object
   * so the modal remains compatible even if some optional information
   * is not available for older personnel records.
   *
   * If your exact database field names are different, simply rename
   * them below.
   */

  const pnpIdExpiration = user.expiration_date ?? user.expiration_date ?? null;

  const pnpIdStatus = getDateStatus(pnpIdExpiration);

  const licenseExpiration = user.drivers_license_expiration;

  const licenseStatus = getDateStatus(licenseExpiration);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        {/* ========================================================= */}
        {/* HEADER */}
        {/* ========================================================= */}

        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
              User Information
            </h2>

            <p className="mt-1 text-slate-500 dark:text-slate-400">
              Personnel profile and identification information
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg px-3 py-2 text-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* ========================================================= */}
        {/* CONTENT */}
        {/* ========================================================= */}

        <div className="overflow-y-auto p-4 sm:p-6">
          <div className="space-y-6">
            {/* ===================================================== */}
            {/* PROFILE */}
            {/* ===================================================== */}

            <div className="flex flex-col items-center gap-5 rounded-xl border border-slate-200 bg-slate-50/70 p-6 dark:border-slate-700 dark:bg-slate-800/40 sm:flex-row">
              <img
                src={user.photo_url ? user.photo_url : "/avatar.png"}
                className="h-32 w-32 shrink-0 rounded-full border-4 border-white object-cover shadow-md dark:border-slate-700"
                alt={user.fullname}
              />

              <div className="min-w-0 text-center sm:text-left">
                <p className="text-slate-500 dark:text-slate-400">Personnel</p>

                <h3 className="mt-1 break-words text-2xl font-bold text-slate-900 dark:text-white">
                  {user.rank?.rank_name ? `${user.rank.rank_name} ` : ""}
                  {user.fullname}
                </h3>

                <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                  {user.badge_number && (
                    <StatusBadge status={`Badge No. ${user.badge_number}`} />
                  )}

                  {user.is_approved ? (
                    <StatusBadge status="Approved" type="success" />
                  ) : (
                    <StatusBadge status="Not Approved" type="danger" />
                  )}
                </div>
              </div>
            </div>

            {/* ===================================================== */}
            {/* PERSONAL INFORMATION */}
            {/* ===================================================== */}

            <Section title="Personal Information">
              <InfoItem label="Designation" value={user.unit?.unit_name} />

              <InfoItem label="Designation" value={user.designation} />

              <InfoItem label="Duty Status" value={user.duty_status} />
            </Section>

            {/* ===================================================== */}
            {/* CONTACT */}
            {/* ===================================================== */}

            <Section title="Contact Information">
              <InfoItem label="Phone Number" value={user.phone_number} />

              <InfoItem label="Viber Number" value={user.viber_number} />

              <InfoItem
                label="Email"
                value={
                  (
                    user as Personnel & {
                      email?: string | null;
                    }
                  ).email
                }
              />
            </Section>

            {/* ===================================================== */}
            {/* PNP ID INFORMATION */}
            {/* ===================================================== */}

            <Section title="PNP ID Information">
              <InfoItem
                label="PNP ID Number"
                value={
                  (
                    user as Personnel & {
                      pnp_id_number?: string | null;
                    }
                  ).pnp_id_number
                }
              />

              <InfoItem
                label="Date Issued"
                value={formatDate(
                  (
                    user as Personnel & {
                      pnp_id_date_issued?: string | null;
                      pnp_id_issued_date?: string | null;
                    }
                  ).pnp_id_date_issued ??
                    (
                      user as Personnel & {
                        pnp_id_issued_date?: string | null;
                      }
                    ).pnp_id_issued_date,
                )}
              />

              <InfoItem
                label="Expiration Date"
                value={formatDate(pnpIdExpiration)}
              />

              <InfoItem
                label="Status"
                value={
                  <StatusBadge
                    status={pnpIdStatus.label}
                    type={pnpIdStatus.type}
                  />
                }
              />
            </Section>
          </div>
        </div>

        {/* ========================================================= */}
        {/* FOOTER */}
        {/* ========================================================= */}

        <div className="flex shrink-0 justify-end border-t border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-700 px-5 py-2.5 font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:hover:bg-slate-600 dark:focus:ring-offset-slate-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
