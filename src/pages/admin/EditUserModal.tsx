import React, { useEffect, useState } from "react";
import { X, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { supabase, type Personnel, type Unit, type Rank } from "../../lib/supabase";

interface Props {
  open: boolean;
  onClose: () => void;
  user: Personnel | null;
  onSave: () => void;
}

export default function EditUserModal({ open, onClose, user, onSave }: Props) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fullname: "",
    rank_id: "",
    badge_number: "",
    unit_id: "",
    role: "user",
    phone_number: "",
    viber_number: "",
    designation: "",
    duty_status: "Active Duty",
  });

  useEffect(() => {
    if (open) {
      fetchMetadata();
    }
  }, [open]);

  useEffect(() => {
    if (user) {
      setFormData({
        fullname: user.fullname || "",
        rank_id: user.rank_id || "",
        badge_number: user.badge_number || "",
        unit_id: user.unit_id || "",
        role: user.role || "user",
        phone_number: user.phone_number || "",
        viber_number: user.viber_number || "",
        designation: user.designation || "",
        duty_status: user.duty_status || "Active Duty",
      });
    }
  }, [user]);

  const fetchMetadata = async () => {
    setLoading(true);
    try {
      const [unitsRes, ranksRes] = await Promise.all([
        supabase.from("unit").select("*").order("unit_name"),
        supabase.from("rank").select("*").order("level", { ascending: false }),
      ]);

      if (unitsRes.error) throw unitsRes.error;
      if (ranksRes.error) throw ranksRes.error;

      setUnits(unitsRes.data || []);
      setRanks(ranksRes.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("personnel")
        .update({
          fullname: formData.fullname,
          rank_id: formData.rank_id || null,
          badge_number: formData.badge_number,
          unit_id: formData.unit_id,
          role: formData.role,
          phone_number: formData.phone_number,
          viber_number: formData.viber_number,
          designation: formData.designation,
          duty_status: formData.duty_status,
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setSuccess("User updated successfully");
      setTimeout(() => {
        onSave();
        onClose();
        setSuccess(null);
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Edit User Account
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 dark:hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-600 dark:bg-red-900/20">
              <AlertCircle size={20} />
              <p>{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-green-600 dark:bg-green-900/20">
              <CheckCircle2 size={20} />
              <p>{success}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Full Name
              </label>
              <input
                type="text"
                required
                value={formData.fullname}
                onChange={(e) =>
                  setFormData({ ...formData, fullname: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Rank
              </label>
              <select
                value={formData.rank_id}
                onChange={(e) =>
                  setFormData({ ...formData, rank_id: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">Select Rank</option>
                {ranks.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.rank_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Badge Number
              </label>
              <input
                type="text"
                value={formData.badge_number}
                onChange={(e) =>
                  setFormData({ ...formData, badge_number: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Unit / Station
              </label>
              <select
                required
                value={formData.unit_id}
                onChange={(e) =>
                  setFormData({ ...formData, unit_id: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">Select Unit</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unit_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="user">User</option>
                <option value="operation">Operation</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Phone Number
              </label>
              <input
                type="text"
                value={formData.phone_number}
                onChange={(e) =>
                  setFormData({ ...formData, phone_number: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Viber Number
              </label>
              <input
                type="text"
                value={formData.viber_number}
                onChange={(e) =>
                  setFormData({ ...formData, viber_number: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Designation
              </label>
              <input
                type="text"
                value={formData.designation}
                onChange={(e) =>
                  setFormData({ ...formData, designation: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Duty Status
              </label>
              <select
                value={formData.duty_status}
                onChange={(e) =>
                  setFormData({ ...formData, duty_status: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="Active Duty">Active Duty</option>
                <option value="Detached Service">Detached Service</option>
                <option value="Under schooling">Under Schooling</option>
                <option value="Mandatory Leave">Mandatory Leave</option>
                <option value="Vacation Leave">Vacation Leave</option>
                <option value="Sick Leave">Sick Leave</option>
                <option value="Maternity Leave">Maternity Leave</option>
                <option value="Paternity Leave">Paternity Leave</option>
                <option value="Study Leave">Study Leave</option>
                <option value="Emergency Leave">Emergency Leave</option>
                <option value="Suspended">Suspended</option>
                <option value="AWOL">AWOL</option>
                <option value="Non-Duty Status">Non-Duty Status</option>
                <option value="Others">Others</option>
              </select>
            </div>
          </div>

          <div className="mt-8">
            {/* MESSAGES */}
            {error && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-red-600 dark:bg-red-900/20 dark:text-red-400"
              >
                <AlertCircle size={20} className="mt-0.5 shrink-0" />
                <p className="min-w-0 break-words">{error}</p>
              </div>
            )}

            {success && (
              <div
                role="status"
                className="mb-4 flex items-start gap-2 rounded-lg bg-green-50 p-3 text-green-600 dark:bg-green-900/20 dark:text-green-400"
              >
                <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
                <p className="min-w-0 break-words">{success}</p>
              </div>
            )}

            {/* BUTTONS */}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-slate-100 px-6 py-2 font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving || loading}
                className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving && <Loader2 size={18} className="animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
