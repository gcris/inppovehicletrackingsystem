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
} from "lucide-react";

export default function AccountPage() {
  const { user, profile, loading: authLoading } = useAuth();

  // Form state for editable fields (Rank, Full Name, Phone Number, Viber Number, Designation, Photo)
  const [formData, setFormData] = useState({
    rank_id: profile?.rank?.id || "",
    fullname: "",
    phone_number: "",
    viber_number: "",
    designation: "",
    photo_url: profile?.photo_url || "",
  });

  // Original values to detect changes and reset
  const [originalFormData, setOriginalFormData] = useState({
    rank_id: profile?.rank?.id || "",
    fullname: "",
    phone_number: "",
    viber_number: "",
    designation: "",
    photo_url: profile?.photo_url || "",
  });

  // Photo upload state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrlPreview, setPhotoUrlPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [ranks, setRanks] = useState<Array<Rank>>([]);

  // Modal state
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] =
    useState(false);

  // Validate the profile form
  const validateForm = () => {
    if (!formData.fullname.trim()) {
      return "Full name is required.";
    } else if (!formData.rank_id) {
      return "Rank is required.";
    } else if (!formData.designation) {
      return "Designation is required.";
    } else if (!formData.phone_number.trim()) {
      return "Phone Number is required.";
    } else if (!formData.viber_number.trim()) {
      return "Viber Number is required.";
    }
    return null;
  };

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

  useEffect(() => {
    const fetchRanks = async () => {
      try {
        const { data, error } = await supabase
          .from("rank")
          .select("id, rank_name, description, level")
          .order("level");

        if (error) {
          throw error;
        }

        setRanks(data || []);
      } catch (err) {
        console.error("Error fetching ranks:", err);
        // Don't set error state here as it might confuse users - just log and continue with empty ranks
        setRanks([]);
      }
    };
    fetchRanks();
  }, []);

  // Check if there are unsaved changes
  useEffect(() => {
    const hasChanges =
      formData.rank_id !== originalFormData.rank_id ||
      formData.fullname !== originalFormData.fullname ||
      formData.phone_number !== originalFormData.phone_number ||
      formData.viber_number !== originalFormData.viber_number ||
      formData.designation !== originalFormData.designation ||
      formData.photo_url !== originalFormData.photo_url;
    setHasChanges(hasChanges);
  }, [
    formData.rank_id,
    formData.fullname,
    formData.phone_number,
    formData.viber_number,
    formData.designation,
    formData.photo_url,
    originalFormData.rank_id,
    originalFormData.fullname,
    originalFormData.phone_number,
    originalFormData.viber_number,
    originalFormData.designation,
    originalFormData.photo_url,
  ]);

  // Initialize form with profile data when available
  useEffect(() => {
    if (profile) {
      setFormData({
        rank_id: profile.rank?.id || "",
        fullname: profile.fullname || "",
        phone_number: profile.phone_number || "",
        viber_number: profile.viber_number || "",
        designation: profile.designation || "",
        photo_url: profile.photo_url || "",
      });
      setOriginalFormData({
        rank_id: profile.rank?.id || "",
        fullname: profile.fullname || "",
        phone_number: profile.phone_number || "",
        viber_number: profile.viber_number || "",
        designation: profile.designation || "",
        photo_url: profile.photo_url || "",
      });
    }
  }, [profile]);

  // Handle form submission
  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    // Validate
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setSuccess(null);
      return;
    }

    // Trim whitespace
    const trimmedData = {
      rank_id: formData.rank_id || "",
      fullname: formData.fullname.trim(),
      phone_number: formData.phone_number.trim(),
      viber_number: formData.viber_number.trim(),
      designation: formData.designation.trim(),
    };

    if (!user?.id) {
      setError("User not authenticated.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let photoUrlToSave = formData.photo_url; // Keep existing photo by default

      if (photoFile) {
        // 1. Upload new photo
        const fileExt = photoFile.name.split(".").pop()?.toLowerCase() || "";
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("personnel-photos")
          .upload(fileName, photoFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // 2. Get public URL for the new photo
        const {
          data: { publicUrl },
        } = supabase.storage.from("personnel-photos").getPublicUrl(fileName);

        photoUrlToSave = publicUrl;

        // 3. CLEANUP LOGIC: Delete the old photo if it exists
        if (formData.photo_url) {
          try {
            // Extract the filename from the old URL string
            // Supabase public URLs end with /storage/v1/object/public/bucket-name/filename.ext
            const oldFileName = formData.photo_url.split("/").pop();

            if (oldFileName) {
              await supabase.storage
                .from("personnel-photos")
                .remove([oldFileName]);
            }
          } catch (deleteErr) {
            // We wrap this in a separate try/catch so that if deleting the old photo fails,
            // it doesn't crash the entire update operation for the user.
            console.error("Failed to delete old avatar file:", deleteErr);
          }
        }
      }

      // Update profile in database
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

      // Update original data to reset change detection
      const updatedFormData = {
        ...trimmedData,
        photo_url: photoUrlToSave,
      };
      setOriginalFormData(updatedFormData);
      setFormData(updatedFormData);

      setSuccess("Profile updated successfully!");
      setError(null);

      // Reset photo upload state
      setPhotoFile(null);
      setPhotoUrlPreview(null);
    } catch (err: any) {
      setError(err.message || "Failed to update profile.");
      setSuccess(null);
    } finally {
      setIsLoading(false);
      // Explicitly check for setIsUploading existence since it was in your finally block
      if (typeof setIsUploading === "function") setIsUploading(false);
    }
  };

  // Handle reset button (reset to original values)
  const handleReset = useCallback(() => {
    setFormData({
      rank_id: originalFormData.rank_id,
      fullname: originalFormData.fullname,
      phone_number: originalFormData.phone_number,
      viber_number: originalFormData.viber_number,
      designation: originalFormData.designation,
      photo_url: originalFormData.photo_url,
    });
    // Reset photo upload state
    setPhotoFile(null);
    setPhotoUrlPreview(null);
    setIsEditMode(false);
  }, [originalFormData]);

  // Warn before leaving if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasChanges]);

  if (authLoading || !user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-slate-900 dark:text-white">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    // Change 'justify-center' to 'justify-start md:px-8' (or your preferred spacing)
    <div className="w-full bg-[#f8fafc] dark:bg-slate-950 flex items-start justify-center p-4 pt-12 md:pt-16 transition-colors">
      {/* Increased max-width to accommodate a 2-column desktop layout */}
      <div className="max-w-5xl w-full">
        <div>
          <h1 className="text-2xl text-[var(--text)] flex items-center gap-4">
            <User className="w-7 h-7" />
            Account Settings
          </h1>
          <p className="text-[var(--text)]/[0.9] mt-2"></p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
          <div className="p-6 md:p-10">
            {success && (
              <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm p-4 bg-green-50 dark:bg-green-900 border border-green-500 dark:border-green-900/30 text-green-600 dark:text-green-400 rounded-xl flex items-start gap-3 shadow-2xl transition-all pointer-events-auto">
                {/* Alert Icon */}
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />

                {/* Error Text Message */}
                <div className="flex-1">
                  <p className="text-base font-medium">Account Settings</p>
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
                  <p className="text-base font-medium">Account Settings</p>
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
            {/* 2-Column Grid Layout container with vertical/horizontal dividers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">
              {/* Column 1: Profile Information */}
              <div className="space-y-6 pb-8 md:pb-0 pr-8">
                {!isEditMode ? (
                  // Read-only view
                  <div className="space-y-4">
                    {/* Profile Picture Section */}
                    <div className="space-y-6">
                      <div className="flex flex-col items-center">
                        <div className="relative w-24 h-24">
                          {formData.photo_url ? (
                            <img
                              src={formData.photo_url}
                              alt="Profile"
                              className="w-full h-full object-cover rounded-full border-2 border-slate-200 dark:border-slate-700 shadow-md"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 rounded-full border-2 border-slate-200 dark:border-slate-700 shadow-md text-slate-600 dark:text-slate-400 font-bold text-xl">
                              {formData.fullname
                                ? formData.fullname
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .substring(0, 2)
                                : "?"}
                            </div>
                          )}
                          {isEditMode && (
                            <div className="absolute bottom-0 right-0 flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full shadow-md hover:bg-blue-700 transition-colors cursor-pointer">
                              <Edit className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <h2 className="text-2xl text-slate-900 dark:text-white mb-2">
                      Profile Information
                    </h2>
                    <p className="text-base text-slate-600 dark:text-slate-400">
                      Update your personal details below.
                    </p>

                    <hr className="border-gray-300" />

                    {/* Display fields as read-only text */}
                    <div className="space-y-6">
                      {/* Rank */}
                      <div className="space-y-2">
                        <label className="text-slate-600 dark:text-slate-400 text-base">
                          Rank
                        </label>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {profile.rank?.description || "Not assigned"}
                          </span>
                        </div>
                      </div>

                      {/* Full Name */}
                      <div className="space-y-2">
                        <label className="text-slate-600 dark:text-slate-400 text-base">
                          Full Name
                        </label>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {formData.fullname || "Not set"}
                          </span>
                        </div>
                      </div>

                      {/* Phone Number */}
                      <div className="space-y-2">
                        <label className="text-slate-600 dark:text-slate-400 text-base">
                          Phone Number
                        </label>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {formData.phone_number || "Not set"}
                          </span>
                        </div>
                      </div>

                      {/* Viber Number */}
                      <div className="space-y-2">
                        <label className="text-slate-600 dark:text-slate-400 text-base">
                          Viber Number
                        </label>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {formData.viber_number || "Not set"}
                          </span>
                        </div>
                      </div>

                      {/* Designation */}
                      <div className="space-y-2">
                        <label className="text-slate-600 dark:text-slate-400 text-base">
                          Designation
                        </label>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {formData.designation || "Not set"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Edit Button */}
                    <div className="flex justify-end pt-4">
                      <button
                        type="button"
                        onClick={() => setIsEditMode(true)}
                        disabled={isLoading}
                        className="px-4 py-2 text-base font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Edit className="w-4 h-4" />
                        )}
                        <span className={isLoading ? "hidden" : "inline-block"}>
                          Edit
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  // Edit view
                  <div className="space-y-4">
                    <h2 className="text-2xl text-slate-900 dark:text-white mb-2">
                      Profile Information
                    </h2>
                    <p className="text-base font-bold text-slate-600 dark:text-slate-400">
                      Update your personal details below.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Profile Picture Section */}
                      <div className="flex flex-col items-center justify-center space-y-4 py-2">
                        {/* The title label is now centered above the image */}
                        <label className="block text-base font-medium text-slate-700 dark:text-slate-200 text-center">
                          Profile Picture
                        </label>

                        {/* Relative wrapper holding both the circular image and the floating button */}
                        <div className="relative w-32 h-32">
                          {/* Circular Avatar Container */}
                          <div className="w-full h-full rounded-full overflow-hidden border-4 border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-800 shadow-md flex items-center justify-center transition-colors">
                            {photoUrlPreview ? (
                              // Show preview of newly selected file
                              <img
                                src={photoUrlPreview}
                                alt="Preview"
                                className="w-full h-full object-cover"
                              />
                            ) : formData.photo_url ? (
                              // Show current photo
                              <img
                                src={formData.photo_url}
                                alt="Profile"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              // Show fallback icon when no photo is uploaded yet
                              <User className="w-16 h-16 text-slate-600 dark:text-slate-400" />
                            )}
                          </div>

                          {/* The Floating Edit Trigger Button (Bottom Right) */}
                          {/* This label acts as the button for the hidden input field below */}
                          {isEditMode && (
                            <label
                              htmlFor="avatar-upload"
                              className="absolute bottom-0 right-0 p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg border-4 border-white dark:border-slate-900 cursor-pointer transition-all hover:scale-105 flex items-center justify-center group"
                              title="Upload/Change Photo"
                            >
                              <Edit className="w-5 h-5 group-hover:animate-pulse" />
                            </label>
                          )}

                          {/* Hidden Native File Input linked by id to the label above */}
                          <input
                            id="avatar-upload"
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                // Validate file type
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

                                // Validate file size (5MB limit)
                                if (file.size > 5 * 1024 * 1024) {
                                  setError("File size must be less than 5 MB.");
                                  return;
                                }

                                setPhotoFile(file);
                                setPhotoUrlPreview(URL.createObjectURL(file));
                                setError(null);
                              }
                            }}
                            className="hidden" // Hides the native input completely
                          />
                        </div>

                        {/* Simplified Preview Indicator below the image, only when previewing */}
                        {photoUrlPreview && (
                          <div className="flex items-center gap-2 text-base text-blue-600 dark:text-blue-400 font-medium">
                            <Eye className="w-4 h-4" />
                            <span>Previewing New Image</span>
                          </div>
                        )}
                      </div>
                      {/* Rank Dropdown */}
                      <div className="space-y-2">
                        <label className="text-slate-600 dark:text-slate-400 text-base">
                          Rank
                        </label>
                        <div className="relative">
                          <select
                            value={formData.rank_id}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                rank_id: e.target.value,
                              })
                            }
                            className={`w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 pl-4 pr-4 text-base font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all ${
                              formData.rank_id !== originalFormData.rank_id
                                ? "border-2 border-blue-500"
                                : ""
                            }`}
                          >
                            <option value="">Select Rank</option>
                            {ranks.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.description}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Full Name */}
                      <div className="space-y-2">
                        <label className="text-slate-600 dark:text-slate-400 text-base">
                          Full Name
                        </label>
                        <div className="relative">
                          <input
                            required
                            type="text"
                            value={formData.fullname}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                fullname: e.target.value,
                              })
                            }
                            className={`w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 pl-4 pr-4 text-base font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all ${
                              formData.fullname !== originalFormData.fullname
                                ? "border-2 border-blue-500"
                                : ""
                            }`}
                            placeholder="Enter your full name"
                          />
                        </div>
                      </div>

                      {/* Phone Number */}
                      <div className="space-y-2">
                        <label className="text-slate-600 dark:text-slate-400 text-base">
                          Phone Number
                        </label>
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 dark:text-slate-700" />
                          <input
                            type="tel"
                            value={formData.phone_number}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                phone_number: e.target.value,
                              })
                            }
                            className={`w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 pl-12 pr-4 text-base font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all ${
                              formData.phone_number !==
                              originalFormData.phone_number
                                ? "border-2 border-blue-500"
                                : ""
                            }`}
                            placeholder="Enter your phone number"
                          />
                        </div>
                      </div>

                      {/* Viber Number */}
                      <div className="space-y-2">
                        <label className="text-slate-600 dark:text-slate-400 text-base">
                          Viber Number
                        </label>
                        <div className="relative">
                          <MessageCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 dark:text-slate-700" />
                          <input
                            type="tel"
                            value={formData.viber_number}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                viber_number: e.target.value,
                              })
                            }
                            className={`w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 pl-12 pr-4 text-base font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all ${
                              formData.viber_number !==
                              originalFormData.viber_number
                                ? "border-2 border-blue-500"
                                : ""
                            }`}
                            placeholder="Enter your Viber number"
                          />
                        </div>
                      </div>

                      {/* Designation */}
                      <div className="space-y-2">
                        <label className="text-slate-600 dark:text-slate-400 text-base">
                          Designation
                        </label>
                        <div className="relative">
                          <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 dark:text-slate-700" />
                          <input
                            type="text"
                            value={formData.designation}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                designation: e.target.value,
                              })
                            }
                            className={`w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 pl-12 pr-4 text-base font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all ${
                              formData.designation !==
                              originalFormData.designation
                                ? "border-2 border-blue-500"
                                : ""
                            }`}
                            placeholder="Enter your designation"
                          />
                        </div>
                      </div>

                      {/* Submit and Reset Buttons */}
                      <div className="flex justify-end space-x-3 pt-4">
                        <button
                          type="button"
                          onClick={handleReset}
                          disabled={isLoading}
                          className={`px-4 py-2 text-base font-medium text-black dark:text-white border rounded-xl hover:text-slate-900 dark:hover:text-slate-100 transition-colors disabled:opacity-50 ${
                            !hasChanges ? "opacity-50" : ""
                          }`}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="w-auto px-4 py-2 text-base font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          <span
                            className={isLoading ? "hidden" : "inline-block"}
                          >
                            Save Changes
                          </span>
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>

              {/* Column 2: Account Details (Includes left-padding to keep gap from the line on desktop) */}
              <div className="space-y-4 pt-8 md:pt-0 md:pl-12">
                <h2 className="text-2xl text-slate-900 dark:text-white mb-2">
                  Account Details
                </h2>
                <p className="text-base text-slate-600 dark:text-slate-400">
                  View your account information below.
                </p>

                <hr className="border-gray-300" />

                <div className="space-y-6">
                  {/* Badge Number */}
                  <div className="space-y-2">
                    <label className="text-slate-600 dark:text-slate-400 text-base">
                      Badge Number
                    </label>
                    <div className="relative">
                      <BadgeCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 dark:text-slate-700" />
                      <span className="inline-block pl-12 font-bold text-slate-700 dark:text-slate-300 py-3">
                        {profile.badge_number || "Not assigned"}
                      </span>
                    </div>
                  </div>

                  {/* Unit/Station */}
                  <div className="space-y-2">
                    <label className="text-slate-600 dark:text-slate-400 text-base">
                      Unit/Station
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 dark:text-slate-700" />
                      <span className="inline-block pl-12 font-bold text-slate-700 dark:text-slate-300 py-3">
                        {profile.unit?.unit_name || "Not assigned"}
                      </span>
                    </div>
                  </div>

                  {/* Email Address */}
                  <div className="space-y-2">
                    <label className="text-slate-600 dark:text-slate-400 text-base">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 dark:text-slate-700" />
                      <span className="inline-block pl-12 font-bold text-slate-700 dark:text-slate-300 py-3">
                        {user.email || "Not available"}
                      </span>
                    </div>
                  </div>

                  {/* Password Change */}
                  <div className="space-y-6">
                    {/* Button to open password change modal */}
                    <button
                      type="button"
                      onClick={() => setIsChangePasswordModalOpen(true)}
                      className="px-4 py-2 text-base font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <span>Change Password</span>
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>{" "}
            {/* End grid */}
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      <PasswordChangeModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
        email={user.email!}
        title="Change Password"
        description="For security, please enter your current and new password."
      />
    </div>
  );
}
