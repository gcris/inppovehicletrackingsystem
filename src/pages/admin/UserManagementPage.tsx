import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Users,
  Shield,
  UserCheck,
  UserX,
  RefreshCw,
  Filter,
  Plus,
  RefreshCcw,
  AlertCircle,
  X,
  Info,
  Edit,
  ThumbsUp,
  ThumbsDown,
  InfoIcon,
} from "lucide-react";
import { Personnel, supabase, Unit } from "../../lib/supabase";
import { useAuth } from "../../components/AuthProvider";
import UserDetailsModal from "./UserDetailsModal";
import { FaCheck, FaEdit, FaInfo, FaUserEdit } from "react-icons/fa";

export default function UserManagementPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<Personnel[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<Personnel[]>([]);

  const [units, setUnits] = useState<Unit[]>([]);

  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");

  const [unitFilter, setUnitFilter] = useState("");

  const [selectedUser, setSelectedUser] = useState<Personnel | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("personnel_accounts")
        .select(
          `
            *,
            unit(*),
            rank(*)
        `,
        )
        .eq("has_account", true) // Ensures personnel with null user_id are excluded
        //.not("role", "in", "(admin, admin_supply)")
        .order("fullname");

      if (error) throw error;

      console.log("Fetched users:", data);

      setUsers(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnits = async () => {
    const { data, error } = await supabase
      .from("unit")
      .select("*")
      .order("level", { ascending: false })
      .order("unit_name");

    if (error) {
      console.error(error);
      return;
    }

    setUnits(data ?? []);
  };

  const statistics = useMemo(() => {
    return {
      total: users.length,

      approved: users.filter((u) => u.is_approved).length,

      pending: users.filter((u) => !u.is_approved).length,

      blocked: users.filter((u) => u.is_blocked).length,

      admins: users.filter((u) => u.role.includes("admin")).length,
    };
  }, [users]);

  const formatRole = (role: string) => {
    if (!role) return "";
    return role
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const approveUser = async (user: Personnel) => {
    if (
      !window.confirm(
        `Are you sure you want to ${user.is_approved ? "unapprove" : "approve"} this user?`,
      )
    ) {
      return;
    }
    const { error } = await supabase
      .from("personnel")
      .update({
        is_approved: true,
      })
      .eq("id", user.id);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess("User approved.");

    fetchUsers();
  };

  const blockUser = async (user: Personnel, blocked: boolean) => {
    if (
      !window.confirm(
        `Are you sure you want to ${blocked ? "block" : "unblock"} this user?`,
      )
    ) {
      return;
    }
    const { error } = await supabase
      .from("personnel")
      .update({
        is_blocked: blocked,
        blocked_at: blocked ? new Date().toISOString() : null,
        blocked_by: blocked ? profile?.id : null,
        block_reason: blocked ? "Blocked by administrator." : null,
      })
      .eq("id", user.id);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(blocked ? "User blocked." : "User unblocked.");

    fetchUsers();
  };

  const resetMFA = async (id: string) => {
    if (
      !window.confirm(
        "Are you sure you want to reset MFA for this officer? This will require them to set up MFA again on their next login.",
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase.functions.invoke("reset-user-mfa", {
        body: {
          userId: id,
        },
      });

      if (error) throw error;

      setSuccess("MFA has been successfully reset for this officer.");
    } catch (err: any) {
      setError(err.message ?? "Failed to reset MFA.");
    } finally {
      fetchUsers();
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchUnits();
  }, []);

  useEffect(() => {
    let result = [...users];

    if (search.trim()) {
      const keyword = search.toLowerCase();

      result = result.filter((user) => {
        return (
          user.fullname.toLowerCase().includes(keyword) ||
          user.badge_number?.toLowerCase().includes(keyword)
        );
      });
    }

    if (unitFilter) {
      result = result.filter((user) => user.unit_id === unitFilter);
    }

    setFilteredUsers(result);
  }, [users, search, unitFilter]);

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

  return (
    <div className="flex flex-col gap-6">
      {success && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm p-4 bg-green-50 dark:bg-green-900 border border-green-500 dark:border-green-900/30 text-green-600 dark:text-green-400 rounded-xl flex items-start gap-3 shadow-2xl transition-all pointer-events-auto">
          {/* Alert Icon */}
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />

          {/* Error Text Message */}
          <div className="flex-1">
            <p className="text-base font-medium">User Management</p>
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
            <p className="text-base font-medium">User Management</p>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">
            User Management
          </h1>

          <p className="mt-1 text-slate-800 dark:text-slate-200">
            Manage user accounts, permissions, approvals and MFA.
          </p>
        </div>

        <button
          className="
            flex items-center gap-2
            rounded-xl
            bg-blue-600
            px-4
            py-2
            font-medium
            text-white
            transition
            hover:bg-blue-700
          "
        >
          <Plus size={18} />
          Add User
        </button>
      </div>

      {/* Statistics */}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Total Users"
          value={statistics.total.toString()}
          color="text-blue-600"
          icon={<Users size={22} />}
        />

        <StatCard
          title="Approved"
          value={statistics.approved.toString()}
          color="text-green-600"
          icon={<UserCheck size={22} />}
        />

        <StatCard
          title="Pending"
          value={statistics.pending.toString()}
          color="text-yellow-600"
          icon={<RefreshCw size={22} />}
        />

        <StatCard
          title="Blocked"
          value={statistics.blocked.toString()}
          color="text-red-600"
          icon={<UserX size={22} />}
        />

        <StatCard
          title="Administrators"
          value={statistics.admins.toString()}
          color="text-purple-600"
          icon={<Shield size={22} />}
        />
      </div>

      <div
        className="
          rounded-xl
          border
          border-slate-200
          bg-white
          p-4
          shadow-sm
          dark:border-slate-700
          dark:bg-slate-900
        "
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Search (Left side) */}
          <div className="relative w-full sm:max-w-xs">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search badge, fullname..."
              className="
                w-full
                rounded-xl
                border
                border-slate-300
                py-2
                pl-10
                pr-4
                outline-none
                focus:border-blue-500
                dark:border-slate-700
                dark:bg-slate-800
            "
            />
          </div>

          {/* Filters Group (Right side) */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* Filters: Unit/Station */}
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="rounded-xl border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">All Units</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.unit_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-[70vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCcw className="h-10 w-10 animate-spin text-blue-600" />

            <p className="text-slate-800 dark:text-slate-200">
              Loading users...
            </p>
          </div>
        </div>
      ) : (
        <div
          className="
          overflow-hidden
          rounded-xl
          border
          border-slate-200
          bg-white
          shadow-sm
          dark:border-slate-700
          dark:bg-slate-900
        "
        >
          <table className="min-w-full">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="px-5 py-3 text-left">No.</th>

                <th className="px-5 py-3 text-left">Badge</th>

                <th className="px-5 py-3 text-left">Personnel</th>

                <th className="px-5 py-3 text-left">Unit/Station</th>

                <th className="px-5 py-3 text-left">Role</th>

                <th className="px-5 py-3 text-center" colSpan={2}>
                  Access Status
                </th>

                <th className="px-5 py-3 text-left">MFA Status</th>

                <th className="px-5 py-3 text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map((user, index) => (
                <tr
                  key={user.id}
                  className="border-t border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <td className="px-5 py-4">{index + 1}</td>
                  <td className="px-5 py-4">{user.badge_number}</td>

                  <td className="px-5 py-4">
                    <div className="font-medium">
                      {user.rank?.rank_name} {user.fullname}
                    </div>

                    <div className="text-slate-800 dark:text-slate-200">
                      {user.designation}
                    </div>
                  </td>

                  <td className="px-5 py-4">{user.unit?.unit_name}</td>

                  <td className="px-5 py-4">{formatRole(user.role)}</td>

                  <td className="px-5 py-4">
                    {user.is_approved ? (
                      <span className="rounded-full bg-green-100 px-3 py-1 text-green-700">
                        Approved
                      </span>
                    ) : (
                      <span className="rounded-full bg-yellow-100 px-3 py-1 text-yellow-700">
                        Pending
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-4">
                    {user.is_blocked && (
                      <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">
                        Blocked
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-4">
                    {!user.mfa_enabled ? (
                      <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">
                        MFA disabled
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-3 py-1 text-green-700">
                        MFA enabled
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      {/* View */}
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowViewModal(true);
                        }}
                        className="rounded-lg border p-2 border-blue-600 text-blue-600"
                      >
                        <FaInfo className="h-5 w-5" />
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowEditModal(true);
                        }}
                        className="rounded-lg border p-2 border-orange-600 text-orange-600"
                      >
                        <FaUserEdit className="h-5 w-5" />
                      </button>

                      {/* Approve */}
                      {!user.is_approved && (
                        <button
                          onClick={() => approveUser(user)}
                          className="rounded-lg border p-2 border-green-600 text-green-600"
                        >
                          <FaCheck className="h-5 w-5" />
                        </button>
                      )}

                      {/* Block / Unblock */}
                      <button
                        onClick={() => blockUser(user, !user.is_blocked)}
                        className={`rounded-lg border p-2
                            ${
                              user.is_blocked
                                ? "border-green-600 text-green-600"
                                : "border-red-600 text-red-600"
                            }
                        `}
                      >
                        {user.is_blocked ? (
                          <ThumbsUp className="h-5 w-5" />
                        ) : (
                          <ThumbsDown className="h-5 w-5" />
                        )}
                      </button>

                      {/* Reset MFA */}
                      {user.mfa_enabled && (
                        <button
                          onClick={() => resetMFA(user.id)}
                          className="
                            rounded-lg
                            bg-purple-600
                            px-3
                            py-2
                            text-sm
                            font-medium
                            text-white
                            transition
                            hover:bg-purple-700
                        "
                        >
                          Reset MFA
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UserDetailsModal
        open={showViewModal}
        user={selectedUser}
        onClose={() => {
          setShowViewModal(false);
          setSelectedUser(null);
        }}
      />
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  color: string;
  icon: React.ReactNode;
}

function StatCard({ title, value, color, icon }: StatCardProps) {
  return (
    <div
      className="
        rounded-xl
        border
        border-slate-200
        bg-white
        p-5
        shadow-sm
        dark:border-slate-700
        dark:bg-slate-900
      "
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-800 dark:text-slate-200">{title}</p>

          <h2 className={`mt-2 text-4xl font-bold ${color}`}>{value}</h2>
        </div>

        <div className={color}>{icon}</div>
      </div>
    </div>
  );
}
