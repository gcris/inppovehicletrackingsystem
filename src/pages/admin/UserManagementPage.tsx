import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  Users,
  UserCheck,
  UserX,
  RefreshCw,
  Plus,
  RefreshCcw,
  AlertCircle,
  X,
  ThumbsUp,
  ThumbsDown,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { type Personnel, supabase, type Unit } from "../../lib/supabase";
import { useAuth } from "../../components/AuthProvider";
import EditUserModal from "./EditUserModal";
import { FaCheck, FaEye, FaUserEdit } from "react-icons/fa";
import UserDetailsModal from "./UserDetailsModal";

const PAGE_SIZE = 25;
const ALLOWED_ROLES = ["operation", "user", "supply"];

interface Stats {
  total: number;
  approved: number;
  pending: number;
  blocked: number;
}

export default function UserManagementPage() {
  const { profile } = useAuth();

  const [users, setUsers] = useState<Personnel[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    approved: 0,
    pending: 0,
    blocked: 0,
  });

  const [loading, setLoading] = useState(false);

  // Filters + pagination
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedUser, setSelectedUser] = useState<Personnel | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Used to ignore responses from outdated requests
  const requestId = useRef(0);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  /* ------------------------------------------------------------------ */
  /* Data fetching                                                       */
  /* ------------------------------------------------------------------ */

  const fetchUsers = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);

    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("personnel_accounts")
        .select(
          // Only the columns the table and modals need.
          // Add any extra columns your modals use (e.g. email, contact_number).
          `
          *,
          unit:unit_id(id, unit_name, level),
          rank:rank_id(id, rank_name, level)
        `,
          { count: "estimated" }, // "exact" can itself time out on big tables
        )
        .eq("has_account", true)
        .in("role", ALLOWED_ROLES)
        .order("fullname")
        .range(from, to);

      if (unitFilter) {
        query = query.eq("unit_id", unitFilter);
      }

      if (debouncedSearch) {
        // Strip characters that would break the PostgREST filter syntax
        const keyword = debouncedSearch.replace(/[%,()*]/g, "");
        if (keyword) {
          query = query.or(
            `fullname.ilike.%${keyword}%,badge_number.ilike.%${keyword}%`,
          );
        }
      }

      const { data, count, error } = await query;

      if (currentRequest !== requestId.current) return; // stale response
      if (error) throw error;

      setUsers((data as unknown as Personnel[]) ?? []);
      setTotalCount(count ?? 0);
    } catch (err: any) {
      if (currentRequest !== requestId.current) return;
      console.error(err);
      setError(err?.message ?? "Failed to load users.");
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
      }
    }
  }, [page, unitFilter, debouncedSearch]);

  const fetchStats = useCallback(async () => {
    try {
      // head: true -> returns only the count, no rows
      const base = () =>
        supabase
          .from("personnel_accounts")
          .select("id", { count: "exact", head: true })
          .eq("has_account", true)
          .in("role", ALLOWED_ROLES);

      const [total, approved, blocked] = await Promise.all([
        base(),
        base().eq("is_approved", true),
        base().eq("is_blocked", true),
      ]);

      if (total.error) throw total.error;
      if (approved.error) throw approved.error;
      if (blocked.error) throw blocked.error;

      const totalCountValue = total.count ?? 0;
      const approvedCount = approved.count ?? 0;

      setStats({
        total: totalCountValue,
        approved: approvedCount,
        pending: totalCountValue - approvedCount,
        blocked: blocked.count ?? 0,
      });
    } catch (err) {
      console.error(err);
    }
  }, []);

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

  /* ------------------------------------------------------------------ */
  /* Actions                                                             */
  /* ------------------------------------------------------------------ */

  const formatRole = (role: string) => {
    if (!role) return "";
    return role
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const approveUser = async (user: Personnel) => {
    if (!window.confirm("Are you sure you want to approve this user?")) {
      return;
    }

    // NOTE: make sure `user.id` really is `personnel.user_id`.
    // If personnel_accounts exposes a separate user_id column, use that instead.
    const { error } = await supabase
      .from("personnel")
      .update({ is_approved: true })
      .eq("user_id", user.id);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess("User approved.");

    setUsers((prev) =>
      prev.map((item) =>
        item.id === user.id ? { ...item, is_approved: true } : item,
      ),
    );
    fetchStats();
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
      .eq("user_id", user.id);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(blocked ? "User blocked." : "User unblocked.");

    setUsers((prev) =>
      prev.map((item) =>
        item.id === user.id ? { ...item, is_blocked: blocked } : item,
      ),
    );
    fetchStats();
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
        body: { userId: id },
      });

      if (error) throw error;

      setSuccess("MFA has been successfully reset for this officer.");

      // Only update local state on success
      setUsers((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, mfa_enabled: false } : item,
        ),
      );
    } catch (err: any) {
      setError(err?.message ?? "Failed to reset MFA.");
    }
  };

  /* ------------------------------------------------------------------ */
  /* Effects                                                             */
  /* ------------------------------------------------------------------ */

  // Initial load of static data
  useEffect(() => {
    fetchUnits();
    fetchStats();
  }, [fetchStats]);

  // Debounce search input (avoids a query on every keystroke)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  // Reset to first page when the unit filter changes
  useEffect(() => {
    setPage(0);
  }, [unitFilter]);

  // Fetch whenever page / filters change
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Auto-dismiss toast messages
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 8000);

      return () => clearTimeout(timer);
    }
  }, [error, success]);

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  return (
    <div className="flex flex-col gap-6">
      {success && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm p-4 bg-green-50 dark:bg-green-900 border border-green-500 dark:border-green-900/30 text-green-600 dark:text-green-400 rounded-xl flex items-start gap-3 shadow-2xl transition-all pointer-events-auto">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />

          <div className="flex-1">
            <p className="text-base font-medium">User Management</p>
            <p className="text-base opacity-90 mt-0.5">{success}</p>
          </div>

          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="p-1 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors shrink-0"
            aria-label="Dismiss message"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm p-4 bg-red-500 dark:bg-red-900 border border-red-100 dark:border-red-900/30 text-white rounded-xl flex items-start gap-3 shadow-2xl transition-all pointer-events-auto">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />

          <div className="flex-1">
            <p className="text-base font-medium">User Management</p>
            <p className="text-base opacity-90 mt-0.5">{error}</p>
          </div>

          <button
            type="button"
            onClick={() => setError(null)}
            className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 text-white transition-colors shrink-0"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 ">
          <div className="relative shrink-0">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
              <Users className="w-7 h-7" />
            </div>

            <div className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950">
              <Check className="w-3 h-3 text-white" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              User Management
            </h1>

            <p className="mt-1 text-slate-800 dark:text-slate-200">
              Manage user accounts, permissions, approvals and MFA.
            </p>
          </div>
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Users"
          value={stats.total.toString()}
          color="text-blue-600"
          icon={<Users size={22} />}
        />

        <StatCard
          title="Approved"
          value={stats.approved.toString()}
          color="text-green-600"
          icon={<UserCheck size={22} />}
        />

        <StatCard
          title="Pending"
          value={stats.pending.toString()}
          color="text-yellow-600"
          icon={<RefreshCw size={22} />}
        />

        <StatCard
          title="Blocked"
          value={stats.blocked.toString()}
          color="text-red-600"
          icon={<UserX size={22} />}
        />
      </div>

      {/* Filters */}
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
          {/* Search */}
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

          {/* Unit filter */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
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
          {users.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
              <Users className="mx-auto mb-3 h-8 w-8 text-slate-400" />

              <p className="text-slate-500 dark:text-slate-400">
                No users recorded.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-slate-100 dark:bg-slate-800">
                    <tr>
                      <th className="px-5 py-3 text-left">Actions</th>
                      <th className="px-5 py-3 text-left">Badge</th>
                      <th className="px-5 py-3 text-left">Personnel</th>
                      <th className="px-5 py-3 text-left">Unit/Station</th>
                      <th className="px-5 py-3 text-left">Role</th>
                      <th className="px-5 py-3 text-center" colSpan={2}>
                        Access Status
                      </th>
                      <th className="px-5 py-3 text-left">MFA Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {users.map((user) => (
                      <tr
                        key={user.id}
                        className="border-t border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            {/* View */}
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setShowViewModal(true);
                              }}
                              className="cursor-pointer rounded-lg border p-2 border-blue-600 text-blue-600"
                            >
                              <FaEye className="h-5 w-5" />
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setShowEditModal(true);
                              }}
                              className="cursor-pointer rounded-lg border p-2 border-orange-600 text-orange-600"
                            >
                              <FaUserEdit className="h-5 w-5" />
                            </button>

                            {/* Approve */}
                            {!user.is_approved && (
                              <button
                                onClick={() => approveUser(user)}
                                className="cursor-pointer rounded-lg border p-2 border-green-600 text-green-600"
                              >
                                <FaCheck className="h-5 w-5" />
                              </button>
                            )}

                            {/* Block / Unblock */}
                            <button
                              onClick={() => blockUser(user, !user.is_blocked)}
                              className={`cursor-pointer rounded-lg border p-2
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
                            font-medium
                            text-white
                            transition
                            hover:bg-purple-700
                            cursor-pointer
                        "
                              >
                                Reset MFA
                              </button>
                            )}
                          </div>
                        </td>

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

                        <td className="px-5 py-4 whitespace-nowrap">
                          {!user.mfa_enabled ? (
                            <span className="inline-flex items-center whitespace-nowrap rounded-full bg-red-100 px-3 py-1 font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">
                              MFA disabled
                            </span>
                          ) : (
                            <span className="inline-flex items-center whitespace-nowrap rounded-full bg-green-100 px-3 py-1 font-semibold text-green-700 dark:bg-green-500/15 dark:text-green-300">
                              MFA enabled
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 dark:border-slate-700">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Page {page + 1} of {totalPages} · {totalCount} user
                  {totalCount === 1 ? "" : "s"}
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>

                  <button
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    disabled={page >= totalPages - 1}
                    className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
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

      <EditUserModal
        open={showEditModal}
        user={selectedUser}
        onClose={() => {
          setShowEditModal(false);
          setSelectedUser(null);
        }}
        onSave={async () => {
          await Promise.all([fetchUsers(), fetchStats()]);
          setShowEditModal(false);
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
