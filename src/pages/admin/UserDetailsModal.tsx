import { Personnel, supabase } from "../../lib/supabase";

interface Props {
  open: boolean;
  onClose: () => void;
  user: Personnel | null;
}

function InfoItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-slate-800 dark:text-slate-200">{label}</p>

      <p className="font-semibold">{value || "-"}</p>
    </div>
  );
}

export default function UserDetailsModal({ open, onClose, user }: Props) {
  if (!open || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-2xl font-bold">User Information</h2>

            <p className="text-slate-800 dark:text-slate-200">
              Personnel profile
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-6 p-6 md:flex-row">
          <div className="flex flex-col items-center">
            <img
              src={user.photo_url ? user.photo_url : "/avatar.png"}
              className="h-36 w-36 rounded-full border object-cover"
              alt={user.fullname}
            />

            <h3 className="mt-4 text-xl font-bold">
              {user.rank?.rank_name} {user.fullname}
            </h3>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-5">
            <InfoItem label="Badge Number" value={user.badge_number} />

            <InfoItem label="Designation" value={user.designation} />

            <InfoItem label="Role" value={user.role} />

            <InfoItem label="Unit" value={user.unit?.unit_name} />

            <InfoItem label="Phone" value={user.phone_number} />

            <InfoItem label="Viber" value={user.viber_number} />

            <InfoItem label="Duty Status" value={user.duty_status} />

            <InfoItem
              label="Approved"
              value={user.is_approved ? "Yes" : "No"}
            />
          </div>
        </div>
        <div className="flex justify-end border-t p-5">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-700 px-5 py-2 text-white hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
