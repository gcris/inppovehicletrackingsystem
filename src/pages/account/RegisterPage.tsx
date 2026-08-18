import React, { useState, useCallback, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase, Unit, Rank, Designation } from "../../lib/supabase";
import {
  Lock,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  X,
  User,
  Camera,
  Moon,
  Sun,
  EyeOff,
  Eye,
  Loader2,
} from "lucide-react";
import {
  validatePersonnelForRegistration,
  linkAuthUserToPersonnel,
} from "../../lib/authService";
import { useTheme, useThemeActions } from "../../components/ThemeProvider";
import { FaInfo, FaInfoCircle } from "react-icons/fa";

type PersonnelData = {
  id: string;
  badge_number: string | null;
  rank_id: string | null;
  fullname: string;
  unit_id: string;
  email: string | null;
  phone_number: string | null;
  viber_number: string | null;
  designation: string | null;
  photo_url: string | null;

  // PNP ID
  id_card_number: string;
  date_issued: string;
  expiration_date: string;

  password: string;
  confirmPassword: string;
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const theme = useTheme();
  const { toggleTheme } = useThemeActions();
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setConfirmShowPassword] =
    useState<boolean>(false);

  const [formData, setFormData] = useState({
    badgeNumber: "",
    id_card_number: "",
    date_issued: "",
    expiration_date: "",
    rankId: "",
    fullname: "",
    unitId: "",
    designation: "",
    phoneNumber: "",
    viberNumber: "",
    email: "",
    photoUrl: "",
    password: "",
    confirmPassword: "",
  });
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [ranksLoading, setRanksLoading] = useState(true);
  type PersonnelDataFormErrors = Partial<Record<keyof PersonnelData, string>>;
  const [formErrors, setFormErrors] = useState<PersonnelDataFormErrors>({});

  // Inside your component function (e.g., PersonnelRegistration):
  useEffect(() => {
    if (error) {
      // Automatically clear the error after 8 seconds (8000ms)
      const timer = setTimeout(() => {
        setError(null); // Replace setError with whatever your state setter is named
      }, 8000);

      // Clean up the timer if the component unmounts or if error changes before 5s
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    const fetchUnits = async () => {
      try {
        setUnitsLoading(true);
        const { data, error } = await supabase
          .from("unit")
          .select("*")
          .order("unit_name");

        if (error) {
          throw error;
        }

        console.log("data: ", data);

        setUnits(data || []);
      } catch (err) {
        console.error("Error fetching units:", err);
        // Don't set error state here as it might confuse users - just log and continue with empty units
        setUnits([]);
      } finally {
        setUnitsLoading(false);
      }
    };

    const fetchRanks = async () => {
      try {
        setRanksLoading(true);
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
      } finally {
        setRanksLoading(false);
      }
    };

    const fetchDesignations = async () => {
      const { data, error } = await supabase.from("designation").select("*");

      if (error) {
        console.error(error);
        return;
      }

      setDesignations(data ?? []);
    };

    fetchUnits();
    fetchRanks();
    fetchDesignations();
  }, []);

  const selectedUnit = units.find((u) => u.id === formData.unitId);

  const filteredDesignations = designations.filter(
    (d) => d.unit_classification === selectedUnit?.classification,
  );

  const validateForm = () => {
    const newErrors: PersonnelDataFormErrors = {};

    if (!formData.photoUrl.trim()) {
      newErrors.photo_url = "Profile Photo is required.";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email Address is required.";
    }

    if (!formData.password) {
      newErrors.password = "Password is required.";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Confirm Password is required.";
    }

    if (
      formData.confirmPassword &&
      formData.confirmPassword &&
      formData.password != formData.confirmPassword
    ) {
      newErrors.confirmPassword = "Password confirmation does not match.";
    }

    if (!formData.badgeNumber.trim()) {
      newErrors.badge_number = "Badge Number is required.";
    }

    if (!formData.date_issued.trim()) {
      newErrors.date_issued = "PNP ID Date Issued is required.";
    }

    if (!formData.expiration_date) {
      newErrors.expiration_date = "PNP ID Expiration Date is required.";
    }

    if (!formData.id_card_number) {
      newErrors.id_card_number = "PNP ID Card Number is required.";
    }

    if (!formData.rankId) {
      newErrors.rank_id = "Please select rank.";
    }

    if (!formData.fullname) {
      newErrors.fullname = "Full name is required.";
    }

    if (!formData.unitId) {
      newErrors.unit_id = "Please select unit/station.";
    }

    if (!formData.designation) {
      newErrors.designation = "Designation is required.";
    }

    if (!formData.phoneNumber) {
      newErrors.phone_number = "Phone Number is required.";
    }

    if (!formData.viberNumber) {
      newErrors.viber_number = "Viber Number is required.";
    }

    setFormErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = useCallback(
    async (e: React.SyntheticEvent) => {
      e.preventDefault();

      if (!validateForm()) return;

      setLoading(true);
      setError(null);
      setSuccess(false);

      try {
        // Step 1: Validate personnel exists and is ready for registration
        const { personnel, error: validationError } =
          await validatePersonnelForRegistration(formData.badgeNumber);

        if (validationError) {
          setError(validationError);
          setLoading(false);
          return;
        }

        if (!personnel) {
          setError(
            "Badge number is not registered. Please contact your administrator.",
          );
          setLoading(false);
          return;
        }

        // Check that the personnel data matches what the user entered
        if (
          personnel.rank_id !== formData.rankId ||
          personnel.fullname.trim() !== formData.fullname.trim() ||
          personnel.unit_id !== formData.unitId ||
          personnel.designation.trim() !== formData.designation.trim()
        ) {
          setError(
            "Personnel information does not match our records. Please contact your administrator.",
          );
          setLoading(false);
          return;
        }

        // Step 2: Create Supabase Auth user
        const { data: authData, error: signUpError } =
          await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
          });

        if (signUpError) throw signUpError;

        if (!authData.user) {
          throw new Error("Failed to create auth user");
        }

        // Step 3: Link auth user to existing personnel record
        const { error: linkError } = await linkAuthUserToPersonnel(
          personnel.badge_number,
          personnel.rank_id,
          personnel.unit_id,
          authData.user.id,
          formData.phoneNumber,
          formData.viberNumber,
          formData.photoUrl || null,
        );

        if (linkError) throw linkError;

        // Step 4: Registration successful
        setSuccess(true);
        setLoading(false);

        // Auto-redirect to login after 3 seconds
        setTimeout(() => {
          navigate("/login", { replace: true });
        }, 3000);
      } catch (err: any) {
        console.error("Registration error:", err);
        setError(
          err.message ||
            "An unexpected error occurred during registration. Please try again.",
        );
        setLoading(false);
      }
    },
    [formData, navigate],
  );

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 transition-colors">
        {/* Added text-center here to align the heading and paragraph, and flex/flex-col/items-center to align the button */}
        <div className="w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-blue-500/5 p-8 border border-slate-100 dark:border-slate-800 transition-colors flex flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-500" />
          </div>

          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
            Registration Successful
          </h2>

          <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">
            Registration successful. Redirecting to login...
          </p>

          {/* Changed inline-flex to flex so it stays perfectly centered within the parent container */}
          <Link
            to="/login"
            className="flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none w-fit"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="min-h-screen bg-slate-100 dark:bg-[#020617] relative overflow-hidden transition-colors">
        {/* Right Side */}
        <div className="flex-1 flex items-center justify-center px-6 py-10 max-h-screen overflow-y-auto py-12 scrollbar-hide">
          <div className="w-full max-w-5xl h-[90vh]">
            {/* Registration Form Box (Added 'relative') */}
            <div className="relative w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-blue-500/5 p-6 border border-slate-100 dark:border-slate-800 transition-colors flex flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
              {/* Theme Button inside Top Right of Registration Box */}
              <div className="absolute top-6 right-6 z-10">
                <button
                  onClick={toggleTheme}
                  className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm"
                  title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
                >
                  {theme === "light" ? (
                    <Moon className="h-5 w-5" />
                  ) : (
                    <Sun className="h-5 w-5" />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-4 mb-6 pr-14">
                <ShieldAlert className="w-12 h-12 text-amber-500" />
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    Personnel Registration
                  </h2>
                  <p className="text-slate-600 dark:text-slate-300">
                    Authorized personnel only. Please enter your badge number
                    and email to register.
                  </p>
                </div>
              </div>

              <form onSubmit={handleRegister} className="space-y-8">
                {error && (
                  <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm p-4 bg-red-500 dark:bg-red-900 border border-red-100 dark:border-red-900/30 text-white rounded-xl flex items-start gap-3 shadow-2xl transition-all pointer-events-auto">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />

                    <div className="flex-1">
                      <p className="font-medium">Registration Error</p>
                      <p className="opacity-90 mt-0.5">{error}</p>
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

                <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
                  {/* ===================================================== */}
                  {/* LEFT COLUMN - ACCOUNT INFORMATION                     */}
                  {/* ===================================================== */}

                  <div className="space-y-6">
                    <div className="border-b border-slate-200 pb-3 dark:border-slate-700">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        Account Information
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Upload your profile photo and create your login
                        credentials.
                      </p>
                    </div>

                    {/* Photo */}
                    <div className="flex flex-col items-center justify-center space-y-3 py-2">
                      <label className="block font-medium text-slate-700 dark:text-slate-200">
                        Personnel Photo
                      </label>

                      <div className="relative w-36 h-36">
                        <div className="w-full h-full rounded-full overflow-hidden border-4 border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-800 shadow-lg flex items-center justify-center">
                          {formData.photoUrl ? (
                            <img
                              src={formData.photoUrl}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-20 h-20 text-slate-400" />
                          )}
                        </div>

                        <label
                          htmlFor="avatar-upload"
                          className="absolute bottom-1 right-1 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg cursor-pointer transition hover:scale-105"
                        >
                          <Camera className="w-5 h-5" />
                        </label>

                        <input
                          id="avatar-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              const reader = new FileReader();

                              reader.onloadend = () => {
                                setFormData({
                                  ...formData,
                                  photoUrl: reader.result as string,
                                });
                              };

                              reader.readAsDataURL(e.target.files[0]);
                            }
                          }}
                        />
                      </div>

                      <p className="italic">
                        <span className="flex items-center gap-1">
                          <FaInfoCircle className="w-4 h-4 text-blue-600" />{" "}
                          Note: Upload only original or unfiltered photo.
                        </span>
                      </p>
                      {formErrors.photo_url && (
                        <p className="text-red-500">{formErrors.photo_url}</p>
                      )}
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                      <label className="block font-medium text-slate-700 dark:text-slate-200">
                        Email Address
                      </label>

                      <input
                        type="email"
                        maxLength={64}
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            email: e.target.value.trim(),
                          })
                        }
                        placeholder="name@department.gov"
                        className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                    ${
                      formErrors.email
                        ? "border-red-500"
                        : "border-slate-300 dark:border-slate-700"
                    }`}
                      />

                      {formErrors.email && (
                        <p className="text-red-500">{formErrors.email}</p>
                      )}
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                      <label className="block font-medium text-slate-700 dark:text-slate-200">
                        Password
                      </label>

                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />

                        <input
                          type={showPassword ? "text" : "password"}
                          maxLength={64}
                          value={formData.password}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              password: e.target.value,
                            })
                          }
                          placeholder="••••••••"
                          className={`pl-12 w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                    ${
                      formErrors.password
                        ? "border-red-500"
                        : "border-slate-300 dark:border-slate-700"
                    }`}
                        />

                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-600 transition-colors"
                        >
                          {showPassword ? (
                            <EyeOff className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </button>
                      </div>

                      {formErrors.password && (
                        <p className="text-red-500">{formErrors.password}</p>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2">
                      <label className="block font-medium text-slate-700 dark:text-slate-200">
                        Confirm Password
                      </label>

                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />

                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          maxLength={64}
                          value={formData.confirmPassword}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              confirmPassword: e.target.value,
                            })
                          }
                          placeholder="••••••••"
                          className={`pl-12 w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        formErrors.confirmPassword
                          ? "border-red-500"
                          : "border-slate-300 dark:border-slate-700"
                      }`}
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setConfirmShowPassword(!showConfirmPassword)
                          }
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-600 transition-colors"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </button>
                      </div>

                      {formErrors.confirmPassword && (
                        <p className="text-red-500">
                          {formErrors.confirmPassword}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ===================================================== */}
                  {/* RIGHT COLUMN - PERSONNEL INFORMATION                 */}
                  {/* ===================================================== */}

                  <div className="space-y-6">
                    <div className="border-b border-slate-200 pb-3 dark:border-slate-700">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        Personnel Information
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Enter your official personnel details.
                      </p>
                    </div>

                    {/* Badge Number */}
                    <div className="space-y-2">
                      <label className="block font-medium text-slate-700 dark:text-slate-200">
                        Badge Number
                      </label>

                      <input
                        type="text"
                        maxLength={20}
                        value={formData.badgeNumber}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            badgeNumber: e.target.value.trim(),
                          })
                        }
                        placeholder="Enter your badge number"
                        className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                    ${
                      formErrors.badge_number
                        ? "border-red-500"
                        : "border-slate-300 dark:border-slate-700"
                    }`}
                      />

                      {formErrors.badge_number && (
                        <p className="text-red-500">
                          {formErrors.badge_number}
                        </p>
                      )}
                    </div>

                    {/* Date Issued */}
                    <div className="space-y-2">
                      <label className="block font-medium text-slate-700 dark:text-slate-200">
                        PNP ID Date Issued
                      </label>

                      <input
                        type="date"
                        maxLength={20}
                        value={formData.date_issued}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            date_issued: e.target.value.trim(),
                          })
                        }
                        placeholder="Enter PNP ID Date Issued"
                        className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                    ${
                      formErrors.date_issued
                        ? "border-red-500"
                        : "border-slate-300 dark:border-slate-700"
                    }`}
                      />

                      {formErrors.date_issued && (
                        <p className="text-red-500">{formErrors.date_issued}</p>
                      )}
                    </div>

                    {/* Expiration Date */}
                    <div className="space-y-2">
                      <label className="block font-medium text-slate-700 dark:text-slate-200">
                        PNP ID Expiration Date
                      </label>

                      <input
                        type="date"
                        maxLength={20}
                        value={formData.expiration_date}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            expiration_date: e.target.value.trim(),
                          })
                        }
                        placeholder="Enter PNP ID Expiration Date"
                        className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                    ${
                      formErrors.expiration_date
                        ? "border-red-500"
                        : "border-slate-300 dark:border-slate-700"
                    }`}
                      />

                      {formErrors.expiration_date && (
                        <p className="text-red-500">
                          {formErrors.expiration_date}
                        </p>
                      )}
                    </div>

                    {/* ID Card Number */}
                    <div className="space-y-2">
                      <label className="block font-medium text-slate-700 dark:text-slate-200">
                        PNP ID Card Number
                      </label>

                      <input
                        type="text"
                        maxLength={20}
                        value={formData.id_card_number}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            id_card_number: e.target.value.trim(),
                          })
                        }
                        placeholder="Enter PNP ID Card Number"
                        className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                    ${
                      formErrors.id_card_number
                        ? "border-red-500"
                        : "border-slate-300 dark:border-slate-700"
                    }`}
                      />

                      {formErrors.id_card_number && (
                        <p className="text-red-500">
                          {formErrors.id_card_number}
                        </p>
                      )}
                    </div>

                    {/* Rank */}
                    <div className="space-y-2">
                      <label className="block font-medium text-slate-700 dark:text-slate-200">
                        Rank
                      </label>

                      <select
                        value={formData.rankId}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            rankId: e.target.value,
                          })
                        }
                        className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                    ${
                      formErrors.rank_id
                        ? "border-red-500"
                        : "border-slate-300 dark:border-slate-700"
                    }`}
                      >
                        <option value="">Select your rank</option>

                        {ranksLoading ? (
                          <option disabled>Loading ranks...</option>
                        ) : ranks.length === 0 ? (
                          <option disabled>No ranks available</option>
                        ) : (
                          ranks.map((rank) => (
                            <option key={rank.id} value={rank.id}>
                              {rank.description}
                            </option>
                          ))
                        )}
                      </select>

                      {formErrors.rank_id && (
                        <p className="text-red-500">{formErrors.rank_id}</p>
                      )}
                    </div>

                    {/* Full Name */}
                    <div className="space-y-2">
                      <label className="block font-medium text-slate-700 dark:text-slate-200">
                        Full Name
                      </label>

                      <input
                        type="text"
                        maxLength={100}
                        value={formData.fullname}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            fullname: e.target.value.trim(),
                          })
                        }
                        placeholder="Enter your full name"
                        className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                    ${
                      formErrors.fullname
                        ? "border-red-500"
                        : "border-slate-300 dark:border-slate-700"
                    }`}
                      />

                      {formErrors.fullname && (
                        <p className="text-red-500">{formErrors.fullname}</p>
                      )}
                    </div>

                    {/* Unit / Station */}
                    <div className="space-y-2">
                      <label className="block font-medium text-slate-700 dark:text-slate-200">
                        Unit / Station
                      </label>

                      <select
                        value={formData.unitId}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            unitId: e.target.value,
                          })
                        }
                        className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                    ${
                      formErrors.unit_id
                        ? "border-red-500"
                        : "border-slate-300 dark:border-slate-700"
                    }`}
                      >
                        <option value="">Select your unit/station</option>

                        {unitsLoading ? (
                          <option disabled>Loading units/stations...</option>
                        ) : units.length === 0 ? (
                          <option disabled>No units available</option>
                        ) : (
                          units.map((unit) => (
                            <option key={unit.id} value={unit.id}>
                              {unit.unit_name}
                            </option>
                          ))
                        )}
                      </select>
                      {formErrors.unit_id && (
                        <p className="text-red-500">{formErrors.unit_id}</p>
                      )}
                    </div>

                    {/* Designation */}
                    <div className="space-y-2">
                      <label className="block font-medium text-slate-700 dark:text-slate-200">
                        Designation
                      </label>

                      <select
                        value={formData.designation}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            designation: e.target.value,
                          })
                        }
                        className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                    ${
                      formErrors.designation
                        ? "border-red-500"
                        : "border-slate-300 dark:border-slate-700"
                    }`}
                      >
                        <option value="">Select Designation</option>

                        {filteredDesignations.map((designation) => (
                          <option key={designation.id} value={designation.name}>
                            {designation.name}
                          </option>
                        ))}
                      </select>

                      {formErrors.designation && (
                        <p className="text-red-500">{formErrors.designation}</p>
                      )}
                    </div>

                    {/* Contact Numbers */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="block font-medium text-slate-700 dark:text-slate-200">
                          Phone Number
                        </label>

                        <input
                          type="tel"
                          maxLength={20}
                          value={formData.phoneNumber}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              phoneNumber: e.target.value.trim(),
                            })
                          }
                          placeholder="09XXXXXXXXX"
                          className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        formErrors.phone_number
                          ? "border-red-500"
                          : "border-slate-300 dark:border-slate-700"
                      }`}
                        />

                        {formErrors.phone_number && (
                          <p className="text-red-500">
                            {formErrors.phone_number}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="block font-medium text-slate-700 dark:text-slate-200">
                          Viber Number
                        </label>

                        <input
                          type="tel"
                          maxLength={20}
                          value={formData.viberNumber}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              viberNumber: e.target.value.trim(),
                            })
                          }
                          placeholder="09XXXXXXXXX"
                          className={`w-full rounded-xl bg-white border dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white
                      ${
                        formErrors.viber_number
                          ? "border-red-500"
                          : "border-slate-300 dark:border-slate-700"
                      }`}
                        />

                        {formErrors.viber_number && (
                          <p className="text-red-500">
                            {formErrors.viber_number}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ===================================================== */}
                {/* Form Footer                                           */}
                {/* ===================================================== */}

                <div className="sticky bottom-0 mt-10 border-t border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-2 py-5">
                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    {/* Cancel */}
                    <button
                      type="button"
                      onClick={() => navigate("/login", { replace: true })}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 transition-all hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      Cancel
                    </button>

                    {/* Register */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Registering...
                        </>
                      ) : (
                        "Register Account"
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
