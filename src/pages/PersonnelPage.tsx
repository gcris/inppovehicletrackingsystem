import React, { useState, useEffect } from "react";
import { supabase, Personnel, Unit, Rank } from "../lib/supabase";
import { AuthProvider, useAuth } from "../components/AuthProvider";
import {
  Users,
  Search,
  Filter,
  Shield,
  Phone,
  MessageCircle,
  Edit,
  RefreshCw,
  Trash,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
export default function PersonnelPage() {
  const [personnel, setPersonnel] = useState<
    (Personnel & {
      unit?: Unit;
      rank?: Rank;
    })[]
  >([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [rankList, setRankList] = useState<Rank[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<string>("all");

  const { isAdmin, role, unitId, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<"all" | "pending">("all");

  // Automatically set selectedUnit to user's unitId if not admin
  useEffect(() => {
    if (!isAdmin && unitId) {
      setSelectedUnit(unitId);
    }
  }, [isAdmin, unitId]);
  const [editingPerson, setEditingPerson] = useState<
    (Personnel & { unit?: Unit }) | null
  >(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullname: "",
    rank_id: "",
    badge_number: "",
    phone_number: "",
    viber_number: "",
    designation: "",
    duty_status: "Active Duty",
    remarks: "",
    unit_id: "",
    createAuth: false, // Whether to create login credentials (Supabase auth account)
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Detect edit mode
  const isEditMode = !!editingPerson;

  // Initialize form data when editingPerson changes (for edit mode)
  useEffect(() => {
    if (editingPerson) {
      setFormData({
        email: "", // Clear email in edit mode as we won't modify credentials
        password: "", // Clear password in edit mode as we won't modify credentials
        fullname: editingPerson.fullname || "",
        rank_id: editingPerson.rank_id || "",
        badge_number: editingPerson.badge_number || "",
        phone_number: editingPerson.phone_number || "",
        viber_number: editingPerson.viber_number || "",
        designation: editingPerson.designation || "",
        duty_status: editingPerson.duty_status || "Active Duty",
        remarks: editingPerson.remarks || "",
        unit_id: editingPerson.unit_id || "",
        createAuth: false, // In edit mode, we don't create auth by default
      });
    } else {
      // Reset form when exiting edit mode
      setFormData({
        email: "",
        password: "",
        fullname: "",
        rank_id: "",
        badge_number: "",
        phone_number: "",
        viber_number: "",
        designation: "",
        duty_status: "Active Duty",
        remarks: "",
        unit_id: !isAdmin && unitId ? unitId : "",
        createAuth: false,
      });
    }
  }, [editingPerson]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch fundamental data
      let personnelQuery = supabase
        .from("personnel")
        .select("*, unit(*), rank(*)")
        .order("unit_id", { ascending: true }); // <-- Added database-level sorting here

      if (activeTab === "pending") {
        personnelQuery = personnelQuery.eq("is_approved", false);
      }

      const [personnelRes, unitsRes, rankRes] = await Promise.all([
        personnelQuery,
        supabase.from("unit").select("*"),
        supabase.from("rank").select("*").order("level", { ascending: true }),
      ]);

      if (personnelRes.error) throw personnelRes.error;
      if (unitsRes.error) throw unitsRes.error;
      if (rankRes.error) throw rankRes.error;

      if (personnelRes.data) {
        const sortedPersonnel = [...personnelRes.data].sort((a, b) => {
          // 1. PRIMARY SORT: Group completely by unit_id (ascending)
          const unitA = a.unit_id ?? 0;
          const unitB = b.unit_id ?? 0;

          if (unitA !== unitB) {
            return unitA - unitB;
          }

          // 2. SECONDARY SORT: Order by rank level within that same unit (highest rank first)
          const rankA = a.rank?.level ?? -Infinity;
          const rankB = b.rank?.level ?? -Infinity;
          return rankB - rankA;
        });

        const enrichedPersonnel = sortedPersonnel.map((p) => {
          return { ...p };
        });
        setPersonnel(enrichedPersonnel);
      }

      if (unitsRes.data) setUnits(unitsRes.data);
      if (rankRes.data) setRankList(rankRes.data);
    } catch (err: any) {
      console.error("Error fetching personnel data:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredPersonnel = personnel.filter((p) => {
    const matchesSearch =
      (p.fullname || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.rank?.rank_name || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    const matchesUnit = selectedUnit === "all" || p.unit_id === selectedUnit;
    return matchesSearch && matchesUnit;
  });

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .from("personnel")
        .update({ is_approved: true })
        .eq("id", id);

      if (error) {
        setFormError("Error approving user: " + error.message);
      } else {
        fetchData();
      }
    } catch (err: any) {
      setFormError("Error approving user: " + (err.message || "Unknown error"));
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this officer? This will also remove their assignments.",
      )
    )
      return;

    try {
      // First clear assignments in other tables if needed,
      // but if we have ON DELETE CASCADE in SQL we don't need to manually do it.
      // Assuming basic delete for now.
      const { error } = await supabase.from("personnel").delete().eq("id", id);

      if (error) throw error;
      fetchData();
    } catch (err: any) {
      setFormError("Error deleting personnel: " + err.message);
    }
  };

  const handleResetMFA = async (id: string) => {
    if (
      !window.confirm(
        "Are you sure you want to reset MFA for this officer? This will require them to set up MFA again on their next login.",
      )
    )
      return;

    try {
      const response = await fetch("/api/admin/reset-mfa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to reset MFA");
      }

      const result = await response.json();
      console.log("MFA reset result:", result);
      setFormSuccess("MFA has been successfully reset for this officer.");
    } catch (err: any) {
      setFormError("Error resetting MFA: " + (err.message || "Unknown error"));
    }
  };

  const handleAddPersonnel = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    try {
      // Handle edit mode
      if (isEditMode) {
        const { error } = await supabase
          .from("personnel")
          .update({
            fullname: formData.fullname,
            rank_id: formData.rank_id,
            badge_number: formData.badge_number,
            phone_number: formData.phone_number,
            viber_number: formData.viber_number,
            designation: formData.designation,
            duty_status: formData.duty_status,
            remarks: formData.remarks,
            unit_id: formData.unit_id || null,
          })
          .eq("id", editingPerson.id);

        if (error) throw error;
        setFormSuccess("Personnel successfully updated!");
        setEditingPerson(null);
        setShowAddModal(false);
        fetchData();
        return;
      }

      // Handle add mode
      // Only show security notice if creating auth account
      // Only admins can create login credentials
      const canCreateAuth = formData.createAuth && role === "admin";

      if (canCreateAuth) {
        const confirmLogOut = window.confirm(
          "Security Notice: Registering a new personnel directly overrides the current session. You will be logged out after creation. Continue?",
        );
        if (!confirmLogOut) return;
      }

      if (canCreateAuth) {
        // Original logic: Create auth account first, then personnel record
        const {
          data: { user },
          error: signUpError,
        } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
        });

        if (signUpError) throw signUpError;

        if (user) {
          const { error: profileError } = await supabase
            .from("personnel")
            .insert({
              id: user.id,
              fullname: formData.fullname,
              rank_id: formData.rank_id,
              badge_number: formData.badge_number,
              phone_number: formData.phone_number,
              viber_number: formData.viber_number,
              designation: formData.designation,
              unit_id: formData.unit_id || null,
              is_approved: true, // Auto-approve since admin created
              role: "user",
            });

          if (profileError) throw profileError;
          setFormSuccess(
            "Personnel successfully created. Redirecting to login...",
          );
        }
      } else {
        // New logic: Skip auth, insert directly into personnel table
        // Generate a temporary ID (in production, you might want to use a proper UUID or let the DB handle it)
        // const tempId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        const { error: insertError } = await supabase.from("personnel").insert({
          //id: tempId, // Temporary ID - ideally this would be handled by the database or a proper UUID generator
          fullname: formData.fullname,
          rank_id: formData.rank_id,
          badge_number: formData.badge_number,
          phone_number: formData.phone_number,
          viber_number: formData.viber_number,
          designation: formData.designation,
          duty_status: formData.duty_status,
          remarks: formData.remarks,
          unit_id: formData.unit_id || null,
          is_approved: true, // Auto-approve since admin created
          role: "user",
        });

        if (insertError) throw insertError;
        setFormSuccess(
          "Personnel successfully created (without login credentials).",
        );
      }

      // Reset form and close modal after successful add
      setShowAddModal(false);
      setFormData({
        email: "",
        password: "",
        fullname: "",
        rank_id: "",
        badge_number: "",
        phone_number: "",
        viber_number: "",
        designation: "",
        duty_status: "Active Duty",
        remarks: "",
        unit_id: "",
        createAuth: false,
      });
      fetchData();
    } catch (err: any) {
      setFormError(
        "Error creating personnel: " + (err.message || "Unknown error"),
      );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-[var(--text)] flex items-center gap-2">
            <Users className="w-6 h-6 text-[var(--accent)]" />
            Personnel Directory
          </h1>
          <p className="text-slate-800 dark:text-slate-200 font-boldr mt-1">
            Manage officers, ranks, and unit assignments
          </p>
        </div>

        <div className="flex items-center gap-4">
          {isAdmin && (
            <div className="flex bg-[var(--secondary)]/[0.1] dark:bg-[var(--secondary)]/[0.2] p-1 rounded-xl">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-4 py-1.5 rounded-lg font-blacktracking-tighter transition-all ${
                  activeTab === "all"
                    ? "bg-[var(--primary)]/[0.9] dark:bg-[var(--primary)]/[0.8] text-white shadow-sm"
                    : "text-black hover:text-[var(--text)]/[0.7] dark:hover:text-[var(--text)]/[0.4]"
                }`}
              >
                All Directory
              </button>
              <button
                onClick={() => setActiveTab("pending")}
                className={`px-4 py-1.5 rounded-lg font-blacktracking-tighter transition-all ${
                  activeTab === "pending"
                    ? "bg-[var(--primary)]/[0.9] dark:bg-[var(--primary)]/[0.8] text-white shadow-sm"
                    : "text-black hover:text-[var(--text)]/[0.7] dark:hover:text-[var(--text)]/[0.4]"
                }`}
              >
                Pending Approvals
              </button>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-sm transition-all focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              <Users className="w-4 h-4" />
              New
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text)]/[0.5]" />
              <input
                type="text"
                placeholder="Search officer name or rank..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-50 dark:bg-slate-600 border border-[var(--secondary)]/[0.3] dark:border-[var(--secondary)]/[0.2] rounded-xl py-2 pl-10 pr-4 font-bold text-[var(--text)] dark:text-[var(--text)]/[0.8] outline-none focus:ring-2 focus-ring-[var(--accent)]/[0.3] w-64 shadow-sm"
              />
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text)]/[0.5]" />
              <select
                value={selectedUnit}
                onChange={(e) => {
                  if (isAdmin) {
                    setSelectedUnit(e.target.value);
                  }
                }}
                disabled={!isAdmin}
                className={`bg-[var(--primary)]/[0.1] dark:bg-[var(--primary)]/[0.2] border border-[var(--secondary)]/[0.3] dark:border-[var(--secondary)]/[0.2] rounded-xl py-2 pl-10 pr-8 font-bold text-[var(--text)] dark:text-[var(--text)]/[0.8] outline-none focus:ring-2 focus-ring-[var(--accent)]/[0.3] appearance-none shadow-sm ${!isAdmin ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <option value="all">All Units</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unit_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]/[0.5]"></div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--secondary)]/[0.2] dark:border-[var(--secondary)]/[0.1] bg-[var(--primary)]/[0.05] dark:bg-[var(--primary)]/[0.02]">
                  <th className="p-4 font-blackst">No.</th>
                  <th className="p-4 font-blackst">Badge Number</th>
                  <th className="p-4 font-blackst">Rank/Name</th>
                  <th className="p-4 font-blackst">Designation</th>
                  <th className="p-4 font-blackst">Unit/Station</th>
                  <th className="p-4 font-blackst">Contact Info</th>
                  <th className="p-4 font-blackst">Duty Status</th>
                  <th className="p-4 font-blackst">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-[var(--primary)]/[0.02] dark:bg-[var(--primary)]/[0.01] divide-y divide-[var(--secondary)]/[0.1]">
                {filteredPersonnel.length === 0 ? (
                  <tr>
                    <td
                      className="px-6 py-4 text-center text-[var(--text)]/[0.5]"
                      colSpan={7}
                    >
                      No personnel found
                    </td>
                  </tr>
                ) : (
                  filteredPersonnel.map((person, index) => (
                    <tr
                      key={person.id}
                      className={`hover:bg-[var(--secondary)]/[0.05] ${person.rank?.level! > 7 ? "font-bold" : ""}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <span className="text-[var(--text)]/[0.6]r">
                              {index + 1}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <span className="text-[var(--text)]/[0.6]r">
                              {person.badge_number}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <span className="text-[var(--text)]/[0.6]r">
                              {person.rank?.rank_name || "No Rank"}{" "}
                              {person.fullname}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <span className="text-[var(--text)]/[0.6]r">
                              {person.designation}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-[var(--text)]/[0.6]r">
                          {person.unit?.unit_name || "Not Assigned"}
                          {person.remarks}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {person.phone_number && (
                            <>
                              <a
                                href={`tel:${person.phone_number}`}
                                className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                              >
                                <Phone className="w-5 h-5" />
                                <span>{person.phone_number}</span>
                              </a>
                            </>
                          )}
                          {person.viber_number && (
                            <>
                              <a
                                href={`viber://chat?number=${person.viber_number}`}
                                className="flex items-center gap-2 text-purple-600 hover:text-purple-800"
                              >
                                <MessageCircle className="w-5 h-5" />
                                <span>{person.viber_number}</span>
                              </a>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-[var(--text)]/[0.6]r">
                          {person.duty_status || "Not Assigned"}
                        </span>
                      </td>
                      <td className="p-4 flex items-center justify-center gap-2">
                        {isAdmin && !person.is_approved ? (
                          <button
                            onClick={() => handleApprove(person.id)}
                            title="Approve Account"
                            className="p-2 text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                          >
                            <Shield className="w-5 h-5" />
                          </button>
                        ) : null}
                        <button
                          onClick={() => {
                            setEditingPerson(person);
                            setShowAddModal(true);
                          }}
                          title="Edit Officer"
                          className="p-2 text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => handleDelete(person.id)}
                              title="Delete Officer"
                              className="p-2 text-slate-800 dark:text-slate-200 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                            >
                              <Trash className="w-5 h-5" />
                            </button>
                            {person.is_approved && (
                              <button
                                onClick={() => handleResetMFA(person.id)}
                                title="Reset MFA"
                                className="p-2 text-slate-800 dark:text-slate-200 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all"
                              >
                                <RefreshCw className="w-5 h-5" />
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h1 className="font-bold text-slate-900 dark:text-white">
                  {isEditMode ? "Edit Personnel" : "Add New Personnel"}
                </h1>
                <p className="text-slate-800 dark:text-slate-200 mt-1r">
                  {isEditMode
                    ? "Update officer information"
                    : "Register new officer account"}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingPerson(null);
                }}
                className="p-2 bg-white dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                <span className="text-slate-800 dark:text-slate-200 font-bold text-lg leading-none cursor-pointer">
                  ×
                </span>
              </button>
            </div>

            <form
              onSubmit={handleAddPersonnel}
              className="p-6 space-y-4 max-h-[60vh] overflow-y-auto"
            >
              {/* Form Alerts */}
              {formError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-start gap-3 mb-4">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="font-semibold">{formError}</p>
                </div>
              )}
              {formSuccess && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 text-green-600 dark:text-green-400 p-4 rounded-xl flex items-start gap-3 mb-4">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="font-semibold">{formSuccess}</p>
                </div>
              )}
              {!isEditMode && role === "admin" && (
                <>
                  <div className="flex items-start space-y-2">
                    <div className="flex items-center h-4">
                      <input
                        id="createAuthCheckbox"
                        type="checkbox"
                        checked={formData.createAuth}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            createAuth: e.target.checked,
                          })
                        }
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3">
                      <label
                        htmlFor="createAuthCheckbox"
                        className="font-black text-slate-800 dark:text-slate-500"
                      >
                        Create Login Credentials for this Officer (Optional)
                      </label>
                    </div>
                  </div>

                  {formData.createAuth && (
                    <>
                      <div className="bg-amber-50 dark:bg-amber-900/20 px-6 py-3 border-b border-amber-100 dark:border-amber-900/50 flex gap-3 items-start">
                        <span className="text-amber-500 mt-0.5">⚠</span>
                        <p className="font-bold text-amber-700 dark:text-amber-400 leading-relaxed">
                          Security Notice: Registering a user here creates an
                          account instantly and will securely log you out of
                          your current admin session.
                        </p>
                      </div>

                      <div>
                        <label className="text-slate-800 dark:text-slate-200 ml-1">
                          Email (Login)
                        </label>
                        <input
                          required
                          type="email"
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
                          placeholder="officer@inppo.ph"
                        />
                      </div>

                      <div>
                        <label className="text-slate-800 dark:text-slate-200 ml-1">
                          Temporary Password
                        </label>
                        <input
                          required
                          type="password"
                          value={formData.password}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              password: e.target.value,
                            })
                          }
                          className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
                          placeholder="••••••••"
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              {isEditMode && (
                <div className="bg-blue-50 dark:bg-blue-900/20 px-6 py-3 border-b border-blue-100 dark:border-blue-900/50 flex gap-3 items-start">
                  <span className="text-blue-500 mt-0.5">ℹ</span>
                  <p className="font-bold text-blue-700 dark:text-blue-400 leading-relaxed">
                    Login credentials cannot be modified here. To change
                    credentials, please use the password reset feature or
                    contact system administrator.
                  </p>
                </div>
              )}

              <div>
                <label className="text-slate-800 dark:text-slate-200 ml-1">
                  Full Name
                </label>
                <input
                  required
                  type="text"
                  value={formData.fullname}
                  onChange={(e) =>
                    setFormData({ ...formData, fullname: e.target.value })
                  }
                  className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="Juan Dela Cruz"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-800 dark:text-slate-200 ml-1">
                    Rank
                  </label>
                  <select
                    value={formData.rank_id}
                    onChange={(e) =>
                      setFormData({ ...formData, rank_id: e.target.value })
                    }
                    className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  >
                    <option value="">Select Rank</option>
                    {rankList.map((rank) => (
                      <option key={rank.id} value={rank.id}>
                        {rank.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-800 dark:text-slate-200 ml-1">
                    Badge Number
                  </label>
                  <input
                    type="text"
                    value={formData.badge_number}
                    onChange={(e) =>
                      setFormData({ ...formData, badge_number: e.target.value })
                    }
                    className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
                    placeholder="e.g. 12345"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <label className="text-slate-800 dark:text-slate-200 ml-1">
                  Designation
                </label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={(e) =>
                    setFormData({ ...formData, designation: e.target.value })
                  }
                  className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="e.g. Driver, Investigator, K9 Handler"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-800 dark:text-slate-200 ml-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formData.phone_number}
                    onChange={(e) =>
                      setFormData({ ...formData, phone_number: e.target.value })
                    }
                    className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="+63 912 345 6789"
                  />
                </div>
                <div>
                  <label className="text-slate-800 dark:text-slate-200 ml-1">
                    Viber Number
                  </label>
                  <input
                    type="text"
                    value={formData.viber_number}
                    onChange={(e) =>
                      setFormData({ ...formData, viber_number: e.target.value })
                    }
                    className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="+63 912 345 6789"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-800 dark:text-slate-200 ml-1">
                  Unit/Station
                </label>
                <select
                  required
                  value={formData.unit_id}
                  onChange={(e) => {
                    if (role === "admin") {
                      setFormData({ ...formData, unit_id: e.target.value });
                    }
                  }}
                  disabled={role !== "admin"}
                  className={`w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${role !== "admin" ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <option value="" disabled>
                    Select Unit/Station
                  </option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.unit_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <label className="text-slate-800 dark:text-slate-200 ml-1">
                  Duty Status
                </label>
                <select
                  value={formData.duty_status}
                  onChange={(e) =>
                    setFormData({ ...formData, duty_status: e.target.value })
                  }
                  className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                >
                  <option value="Active Duty">Active Duty</option>
                  <option value="Mandatory Leave">Mandatory Leave</option>
                  <option value="Vacation Leave">Vacation Leave</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Maternity Leave">Maternity Leave</option>
                  <option value="Paternity Leave">Paternity Leave</option>
                  <option value="Study Leave">Study Leave</option>
                  <option value="Emergency Leave">Emergency Leave</option>
                  <option value="Detached Service">Detached Service</option>
                  <option value="Suspended">Suspended</option>
                  <option value="AWOL">AWOL</option>
                  <option value="Non-Duty Status">Non-Duty Status</option>
                  <option value="Others">Others (Please specify)</option>
                </select>
              </div>

              {/* Remarks field - only visible when duty_status is "Others" */}
              {formData.duty_status === "Others" && (
                <div className="grid grid-cols-1 gap-4">
                  <label className="text-slate-800 dark:text-slate-200 ml-1">
                    Remarks
                  </label>
                  <input
                    type="text"
                    value={formData.remarks}
                    onChange={(e) =>
                      setFormData({ ...formData, remarks: e.target.value })
                    }
                    className="w-full mt-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="Please specify duty status details"
                  />
                </div>
              )}

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingPerson(null);
                  }}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-800 rounded-xl font-blacktracking-tighter hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-blacktracking-tighter hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none transition-all"
                >
                  {isEditMode ? "Update" : "Register"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
