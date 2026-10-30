import React, { useState, useEffect, useCallback } from "react";
import { Rank, supabase } from "../../lib/supabase";
import { useAuth } from "../../components/AuthProvider";
import { PasswordChangeModal } from "../../components/PasswordChangeModal";
import {
  Phone,
  Mail,
  Building2,
  AlertCircle,
  Loader2,
  MessageCircle,
  BadgeCheck,
  Edit,
  Save,
  Eye,
  User,
  X,
  ShieldCheck,
  Camera,
  CheckCircle2,
  LockKeyhole,
  UserRound,
  BriefcaseBusiness,
  Check,
} from "lucide-react";

export default function AccountPage() {
  const { user, profile, loading: authLoading } = useAuth();

  const [formData, setFormData] = useState({
    rank_id: profile?.rank?.id || "",
    fullname: "",
    phone_number: "",
    viber_number: "",
    designation: "",
    photo_url: profile?.photo_url || "",
  });

  const [originalFormData, setOriginalFormData] = useState({
    rank_id: profile?.rank?.id || "",
    fullname: "",
    phone_number: "",
    viber_number: "",
    designation: "",
    photo_url: profile?.photo_url || "",
  });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrlPreview, setPhotoUrlPreview] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [ranks, setRanks] = useState<Array<Rank>>([]);

  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] =
    useState(false);

  const validateForm = () => {
    if (!formData.fullname.trim()) {
      return "Full name is required.";
    }

    if (!formData.rank_id) {
      return "Rank is required.";
    }

    if (!formData.designation.trim()) {
      return "Designation is required.";
    }

    if (!formData.phone_number.trim()) {
      return "Phone number is required.";
    }

    if (!formData.viber_number.trim()) {
      return "Viber number is required.";
    }

    return null;
  };

  useEffect(() => {
    if (!error && !success) return;

    const timer = setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 8000);

    return () => clearTimeout(timer);
  }, [error, success]);

  useEffect(() => {
    const fetchRanks = async () => {
      try {
        const { data, error } = await supabase
          .from("rank")
          .select("id, rank_name, description, level")
          .order("level");

        if (error) throw error;

        setRanks(data || []);
      } catch (err) {
        console.error("Error fetching ranks:", err);
        setRanks([]);
      }
    };

    fetchRanks();
  }, []);

  useEffect(() => {
    const changed =
      formData.rank_id !== originalFormData.rank_id ||
      formData.fullname !== originalFormData.fullname ||
      formData.phone_number !== originalFormData.phone_number ||
      formData.viber_number !== originalFormData.viber_number ||
      formData.designation !== originalFormData.designation ||
      formData.photo_url !== originalFormData.photo_url;

    setHasChanges(changed);
  }, [formData, originalFormData]);

  useEffect(() => {
    if (!profile) return;

    const profileData = {
      rank_id: profile.rank?.id || "",
      fullname: profile.fullname || "",
      phone_number: profile.phone_number || "",
      viber_number: profile.viber_number || "",
      designation: profile.designation || "",
      photo_url: profile.photo_url || "",
    };

    setFormData(profileData);
    setOriginalFormData(profileData);
  }, [profile]);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      setSuccess(null);
      return;
    }

    if (!user?.id) {
      setError("User not authenticated.");
      return;
    }

    const trimmedData = {
      rank_id: formData.rank_id || "",
      fullname: formData.fullname.trim(),
      phone_number: formData.phone_number.trim(),
      viber_number: formData.viber_number.trim(),
      designation: formData.designation.trim(),
    };

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let photoUrlToSave = formData.photo_url;

      if (photoFile) {
        const fileExt = photoFile.name.split(".").pop()?.toLowerCase() || "jpg";

        const fileName = `${user.id}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("personnel-photos")
          .upload(fileName, photoFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("personnel-photos").getPublicUrl(fileName);

        photoUrlToSave = publicUrl;

        if (formData.photo_url) {
          try {
            const oldFileName = formData.photo_url.split("/").pop();

            if (oldFileName) {
              await supabase.storage
                .from("personnel-photos")
                .remove([oldFileName]);
            }
          } catch (deleteErr) {
            console.error("Failed to delete old profile photo:", deleteErr);
          }
        }
      }

      const { error: updateError } = await supabase
        .from("personnel")
        .update({
          rank_id: trimmedData.rank_id,
          fullname: trimmedData.fullname,
          phone_number: trimmedData.phone_number,
          viber_number: trimmedData.viber_number,
          designation: trimmedData.designation,
          photo_url: photoUrlToSave,
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      const updatedFormData = {
        ...trimmedData,
        photo_url: photoUrlToSave,
      };

      setOriginalFormData(updatedFormData);
      setFormData(updatedFormData);

      setSuccess("Your profile has been updated successfully.");
      setError(null);

      setPhotoFile(null);
      setPhotoUrlPreview(null);
      setIsEditMode(false);
    } catch (err: any) {
      setError(err.message || "Failed to update profile.");
      setSuccess(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = useCallback(() => {
    setFormData({
      rank_id: originalFormData.rank_id,
      fullname: originalFormData.fullname,
      phone_number: originalFormData.phone_number,
      viber_number: originalFormData.viber_number,
      designation: originalFormData.designation,
      photo_url: originalFormData.photo_url,
    });

    setPhotoFile(null);
    setPhotoUrlPreview(null);
    setIsEditMode(false);
  }, [originalFormData]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasChanges) return;

      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasChanges]);

  const getInitials = (name?: string | null) => {
    if (!name) return "?";

    return name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  if (authLoading || !user || !profile) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="flex items-center gap-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-6 py-5 shadow-xl">
          <Loader2 className="w-7 h-7 animate-spin text-blue-600" />

          <div>
            <p className="text-base font-bold text-slate-900 dark:text-white">
              Loading your account
            </p>

            <p className="text-base text-slate-500 dark:text-slate-400">
              Please wait while your profile is being loaded.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const selectedRank =
    ranks.find((rank) => rank.id === formData.rank_id)?.description ||
    profile.rank?.description ||
    "Not assigned";

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10">
        {/* ============================================================
            PAGE HEADER
        ============================================================ */}

        <div className="mb-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                <UserRound className="h-7 w-7" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                    Account Settings
                  </h1>

                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-base font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Active account
                  </span>
                </div>

                <p className="mt-2 text-base text-slate-500 dark:text-slate-400">
                  Manage your personnel information and account security.
                </p>
              </div>
            </div>

            {!isEditMode && (
              <button
                type="button"
                onClick={() => setIsEditMode(true)}
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-base font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Edit className="h-5 w-5" />
                Edit profile
              </button>
            )}
          </div>
        </div>

        {/* ============================================================
            NOTIFICATIONS
        ============================================================ */}

        {success && (
          <div className="fixed left-1/2 top-5 z-50 flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-start gap-4 rounded-2xl border border-emerald-200 bg-white p-4 text-emerald-700 shadow-2xl dark:border-emerald-900/50 dark:bg-slate-900 dark:text-emerald-400">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5" />
            </div>

            <div className="flex-1">
              <p className="text-base font-bold">Profile updated</p>

              <p className="mt-1 text-base text-slate-600 dark:text-slate-400">
                {success}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSuccess(null)}
              className="rounded-lg p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {error && (
          <div className="fixed left-1/2 top-5 z-50 flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-start gap-4 rounded-2xl border border-red-200 bg-white p-4 text-red-700 shadow-2xl dark:border-red-900/50 dark:bg-slate-900 dark:text-red-400">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10">
              <AlertCircle className="h-5 w-5" />
            </div>

            <div className="flex-1">
              <p className="text-base font-bold">Unable to save changes</p>

              <p className="mt-1 text-base text-slate-600 dark:text-slate-400">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setError(null)}
              className="rounded-lg p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* ============================================================
            PROFILE HERO
        ============================================================ */}

        <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 px-6 py-8 md:px-10 md:py-10">
            <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-indigo-300/10 blur-3xl" />

            <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
              <div className="relative shrink-0">
                <div className="h-28 w-28 overflow-hidden rounded-3xl border-4 border-white/30 bg-white/10 shadow-2xl backdrop-blur-sm md:h-32 md:w-32">
                  {formData.photo_url ? (
                    <img
                      src={formData.photo_url}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl font-black text-white">
                      {getInitials(formData.fullname)}
                    </div>
                  )}
                </div>

                <div className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-xl border-4 border-blue-600 bg-emerald-500 text-white shadow-lg">
                  <Check className="h-4 w-4" />
                </div>
              </div>

              <div className="min-w-0 flex-1 text-white">
                <p className="mb-1 text-base font-medium text-blue-100">
                  Personnel profile
                </p>

                <h2 className="truncate text-3xl font-black md:text-4xl">
                  {formData.fullname || "Personnel"}
                </h2>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-base font-bold backdrop-blur-sm">
                    <BadgeCheck className="h-5 w-5" />
                    {selectedRank}
                  </span>

                  <span className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-base font-bold backdrop-blur-sm">
                    <BriefcaseBusiness className="h-5 w-5" />
                    {formData.designation || "No designation"}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm md:min-w-[220px]">
                <p className="text-base font-medium text-blue-100">
                  Badge number
                </p>

                <p className="mt-1 text-2xl font-black text-white">
                  {profile.badge_number || "Not assigned"}
                </p>

                <div className="mt-3 flex items-center gap-2 text-base text-blue-100">
                  <ShieldCheck className="h-5 w-5" />
                  Personnel account
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================
            MAIN CONTENT
        ============================================================ */}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* ==========================================================
              PROFILE INFORMATION
          ========================================================== */}

          <div className="lg:col-span-3">
            <div className="h-full rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/30 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
              <div className="border-b border-slate-200 px-6 py-6 dark:border-slate-800 md:px-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                        <UserRound className="h-5 w-5" />
                      </div>

                      <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white">
                          Profile information
                        </h2>

                        <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                          Your personal and contact information.
                        </p>
                      </div>
                    </div>
                  </div>

                  {!isEditMode && (
                    <button
                      type="button"
                      onClick={() => setIsEditMode(true)}
                      className="hidden items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-base font-bold text-slate-700 transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 sm:flex dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-400"
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </button>
                  )}
                </div>
              </div>

              <div className="p-6 md:p-8">
                {!isEditMode ? (
                  <div className="space-y-4">
                    <ProfileDisplayField
                      icon={<BadgeCheck />}
                      label="Rank"
                      value={profile.rank?.description || "Not assigned"}
                    />

                    <ProfileDisplayField
                      icon={<User />}
                      label="Full name"
                      value={formData.fullname || "Not set"}
                    />

                    <ProfileDisplayField
                      icon={<Phone />}
                      label="Phone number"
                      value={formData.phone_number || "Not set"}
                    />

                    <ProfileDisplayField
                      icon={<MessageCircle />}
                      label="Viber number"
                      value={formData.viber_number || "Not set"}
                    />

                    <ProfileDisplayField
                      icon={<Building2 />}
                      label="Designation"
                      value={formData.designation || "Not set"}
                    />

                    <div className="pt-4 sm:hidden">
                      <button
                        type="button"
                        onClick={() => setIsEditMode(true)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-base font-bold text-white transition-all hover:bg-blue-700"
                      >
                        <Edit className="h-5 w-5" />
                        Edit profile
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Avatar */}

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/50">
                      <div className="flex flex-col items-center gap-5 sm:flex-row">
                        <div className="relative shrink-0">
                          <div className="h-28 w-28 overflow-hidden rounded-3xl border-4 border-white bg-slate-200 shadow-lg dark:border-slate-800 dark:bg-slate-800">
                            {photoUrlPreview ? (
                              <img
                                src={photoUrlPreview}
                                alt="Preview"
                                className="h-full w-full object-cover"
                              />
                            ) : formData.photo_url ? (
                              <img
                                src={formData.photo_url}
                                alt="Profile"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <User className="h-12 w-12 text-slate-400" />
                              </div>
                            )}
                          </div>

                          <label
                            htmlFor="avatar-upload"
                            className="absolute -bottom-2 -right-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border-4 border-white bg-blue-600 text-white shadow-lg transition-all hover:scale-105 hover:bg-blue-700 dark:border-slate-900"
                            title="Change profile photo"
                          >
                            <Camera className="h-5 w-5" />
                          </label>

                          <input
                            id="avatar-upload"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];

                              if (!file) return;

                              const validTypes = [
                                "image/jpeg",
                                "image/png",
                                "image/webp",
                              ];

                              if (!validTypes.includes(file.type)) {
                                setError(
                                  "Only JPG, JPEG, PNG, and WEBP images are allowed.",
                                );
                                return;
                              }

                              if (file.size > 5 * 1024 * 1024) {
                                setError(
                                  "Profile photo must be smaller than 5 MB.",
                                );
                                return;
                              }

                              setPhotoFile(file);
                              setPhotoUrlPreview(URL.createObjectURL(file));
                              setError(null);
                            }}
                          />
                        </div>

                        <div className="text-center sm:text-left">
                          <h3 className="text-lg font-black text-slate-900 dark:text-white">
                            Profile photo
                          </h3>

                          <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                            Upload a clear personnel photo.
                          </p>

                          <p className="mt-2 text-base text-slate-400 dark:text-slate-500">
                            JPG, PNG, or WEBP up to 5 MB.
                          </p>

                          {photoUrlPreview && (
                            <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-base font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                              <Eye className="h-4 w-4" />
                              New photo selected
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Rank */}

                    <FormField
                      label="Rank"
                      changed={formData.rank_id !== originalFormData.rank_id}
                    >
                      <select
                        value={formData.rank_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            rank_id: e.target.value,
                          })
                        }
                        className={`w-full rounded-xl border bg-slate-50 px-4 py-3.5 text-base font-bold text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:bg-slate-950 dark:text-white ${
                          formData.rank_id !== originalFormData.rank_id
                            ? "border-blue-500"
                            : "border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        <option value="">Select rank</option>

                        {ranks.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.description}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    {/* Full Name */}

                    <FormField
                      label="Full name"
                      changed={formData.fullname !== originalFormData.fullname}
                    >
                      <InputWithIcon
                        icon={<User />}
                        value={formData.fullname}
                        placeholder="Enter your full name"
                        onChange={(value) =>
                          setFormData({
                            ...formData,
                            fullname: value,
                          })
                        }
                      />
                    </FormField>

                    {/* Phone */}

                    <FormField
                      label="Phone number"
                      changed={
                        formData.phone_number !== originalFormData.phone_number
                      }
                    >
                      <InputWithIcon
                        icon={<Phone />}
                        type="tel"
                        value={formData.phone_number}
                        placeholder="Enter your phone number"
                        onChange={(value) =>
                          setFormData({
                            ...formData,
                            phone_number: value,
                          })
                        }
                      />
                    </FormField>

                    {/* Viber */}

                    <FormField
                      label="Viber number"
                      changed={
                        formData.viber_number !== originalFormData.viber_number
                      }
                    >
                      <InputWithIcon
                        icon={<MessageCircle />}
                        type="tel"
                        value={formData.viber_number}
                        placeholder="Enter your Viber number"
                        onChange={(value) =>
                          setFormData({
                            ...formData,
                            viber_number: value,
                          })
                        }
                      />
                    </FormField>

                    {/* Designation */}

                    <FormField
                      label="Designation"
                      changed={
                        formData.designation !== originalFormData.designation
                      }
                    >
                      <InputWithIcon
                        icon={<Building2 />}
                        value={formData.designation}
                        placeholder="Enter your designation"
                        onChange={(value) =>
                          setFormData({
                            ...formData,
                            designation: value,
                          })
                        }
                      />
                    </FormField>

                    {/* Actions */}

                    <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end dark:border-slate-800">
                      <button
                        type="button"
                        onClick={handleReset}
                        disabled={isLoading}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-base font-bold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <X className="h-5 w-5" />
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={isLoading || !hasChanges}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-base font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Saving changes
                          </>
                        ) : (
                          <>
                            <Save className="h-5 w-5" />
                            Save changes
                          </>
                        )}
                      </button>
                    </div>

                    {hasChanges && !isLoading && (
                      <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-base font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                        <AlertCircle className="h-5 w-5" />
                        You have unsaved changes.
                      </div>
                    )}
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* ==========================================================
              ACCOUNT DETAILS
          ========================================================== */}

          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/30 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
              <div className="border-b border-slate-200 px-6 py-6 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                    <ShieldCheck className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">
                      Account details
                    </h2>

                    <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                      Your official account information.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-6">
                <AccountInfoCard
                  icon={<Building2 />}
                  label="Unit/Station"
                  value={profile.unit?.unit_name || "Not assigned"}
                />

                <AccountInfoCard
                  icon={<Mail />}
                  label="Email address"
                  value={user.email || "Not available"}
                />
              </div>
            </div>

            {/* Security */}

            <div className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/30 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
              <div className="border-b border-slate-200 px-6 py-6 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <LockKeyhole className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">
                      Account security
                    </h2>

                    <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                      Keep your account credentials secure.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/50">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                      <LockKeyhole className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">
                        Password
                      </h3>

                      <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                        Change your password regularly to keep your account
                        protected.
                      </p>

                      <button
                        type="button"
                        onClick={() => setIsChangePasswordModalOpen(true)}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-base font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700"
                      >
                        <Edit className="h-5 w-5" />
                        Change password
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Account status */}

            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900/40 dark:bg-emerald-500/5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
                  <ShieldCheck className="h-5 w-5" />
                </div>

                <div>
                  <h3 className="text-lg font-black text-emerald-900 dark:text-emerald-300">
                    Account is active
                  </h3>

                  <p className="mt-1 text-base leading-6 text-emerald-700 dark:text-emerald-400">
                    Your personnel account is currently active and available for
                    system access.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==============================================================
          PASSWORD MODAL
      ============================================================== */}

      <PasswordChangeModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
        email={user.email!}
        title="Change password"
        description="For security, please enter your current and new password."
      />
    </div>
  );
}

/* ==========================================================================
   REUSABLE DISPLAY FIELD
============================================================================ */

function ProfileDisplayField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-all hover:border-blue-200 hover:bg-blue-50/50 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/5">
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium text-slate-500 dark:text-slate-400">
          {label}
        </p>

        <p className="mt-1 break-words text-base font-black text-slate-900 dark:text-white">
          {value}
        </p>
      </div>
    </div>
  );
}

/* ==========================================================================
   FORM FIELD
============================================================================ */

function FormField({
  label,
  changed,
  children,
}: {
  label: string;
  changed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-base font-bold text-slate-700 dark:text-slate-200">
          {label}
        </label>

        {changed && (
          <span className="inline-flex items-center gap-1.5 text-base font-bold text-blue-600 dark:text-blue-400">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Changed
          </span>
        )}
      </div>

      {children}
    </div>
  );
}

/* ==========================================================================
   INPUT WITH ICON
============================================================================ */

function InputWithIcon({
  icon,
  value,
  placeholder,
  onChange,
  type = "text",
}: {
  icon: React.ReactNode;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-base font-bold text-slate-900 outline-none transition-all placeholder:font-medium placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600 dark:focus:border-blue-500 dark:focus:bg-slate-950"
      />
    </div>
  );
}

/* ==========================================================================
   ACCOUNT INFO CARD
============================================================================ */

function AccountInfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium text-slate-500 dark:text-slate-400">
            {label}
          </p>

          <p className="mt-1 break-words text-base font-black text-slate-900 dark:text-white">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}
