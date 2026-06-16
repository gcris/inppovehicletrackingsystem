import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase, Unit } from "../lib/supabase";
import {
  Shield,
  Mail,
  Lock,
  User,
  BadgeCheck,
  Building2,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  QrCode,
} from "lucide-react";
import QRCode from "react-qr-code";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    rank: "",
    badgeNumber: "",
    unitId: "",
    designation: "",
  });

  const [mfaData, setMfaData] = useState<{
    id: string;
    qrCodeUrl: string;
  } | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
      const { data, error } = await supabase
        .from("unit")
        .select("*")
        .order("unit_name");
      if (error) {
        console.error("Error fetching units:", error);
      } else if (data) {
        setUnits(data);
      }
    } catch (err) {
      console.error("Fetch units failed:", err);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      // 0. Validate registration against personnel table
      if (!formData.badgeNumber || !formData.rank || !formData.unitId) {
        setError(
          "Please fill in all required fields: Badge Number, Rank, and Unit",
        );
        setLoading(false);
        return;
      }

      const { data: personnelData, error: personnelError } = await supabase
        .from("personnel")
        .select("*")
        .eq("badge_number", formData.badgeNumber)
        .eq("rank", formData.rank)
        .eq("unit_id", formData.unitId)
        .maybeSingle();

      if (personnelError) {
        console.error("Personnel validation error:", personnelError);
        setError(
          "Validation failed. Please check your information and try again.",
        );
        setLoading(false);
        return;
      }

      if (!personnelData) {
        setError(
          "No matching personnel record found. Please ensure your badge number, rank, and unit are correct and that you have been added to the personnel table by an administrator.",
        );
        setLoading(false);
        return;
      }

      // Check if this personnel record already has an associated auth account
      // The personnel.id field is a foreign key to auth.users.id
      // If personnel.id is not null, it means it's already linked to an auth user
      if (personnelData.id) {
        setError(
          "This personnel record is already associated with an account. Please contact administrator if you believe this is in error.",
        );
        setLoading(false);
        return;
      }

      // 1. Sign up user
      const {
        data: { user },
        error: signUpError,
      } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (signUpError) throw signUpError;

      if (user) {
        // 2. Update personnel profile with the auth user ID and set role
        const { error: profileError } = await supabase
          .from("personnel")
          .update({
            id: user.id, // Link to auth user
            fullname: formData.fullName,
            designation: formData.designation,
            // Keep existing rank, badge_number, unit_id from validation
            is_approved: false, // Requires admin approval
            role: "user", // Default role
          })
          .eq("badge_number", formData.badgeNumber)
          .eq("rank", formData.rank)
          .eq("unit_id", formData.unitId);

        if (profileError) {
          console.error("Profile creation error:", profileError);
          // Clean up the auth user since profile creation failed
          await supabase.auth.admin.deleteUser(user.id);
          setError(
            "Account created but failed to set up profile. Please contact support.",
          );
          return;
        }

        // 3. Start MFA Enrollment
        const { data: factorData, error: enrollError } =
          await supabase.auth.mfa.enroll({
            factorType: "totp",
          });

        if (enrollError) {
          setError(
            "Failed to initialize Google Authenticator 2FA. " +
              enrollError.message,
          );
        } else if (factorData) {
          setMfaData({ id: factorData.id, qrCodeUrl: factorData.totp.uri });
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during registration");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaData) return;
    setLoading(true);
    setError(null);

    try {
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: mfaData.id });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaData.id,
        challengeId: challengeData.id,
        code: mfaCode,
      });
      if (verifyError) throw verifyError;

      setSuccess(true);
      await supabase.auth.signOut(); // Force signout so they login again and wait for approval
    } catch (err: any) {
      setError(err.message || "Invalid authentication code");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 transition-colors">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-blue-500/5 p-8 text-center border border-slate-100 dark:border-slate-800 transition-colors">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
            Registration Successful
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">
            Your account has been created. Please check your email to verify
            your address. Once verified, an administrator will need to approve
            your account before you can log in.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
          >
            Return to Login
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  if (mfaData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 transition-colors">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-blue-500/5 p-8 text-center border border-slate-100 dark:border-slate-800 transition-colors">
          <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <QrCode className="w-10 h-10 text-blue-600 dark:text-blue-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
            Setup Google Authenticator
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6 font-medium text-sm leading-relaxed">
            Scan the QR code below using your Google Authenticator app (or any
            TOTP app).
          </p>

          <div className="flex justify-center bg-white p-4 rounded-2xl mb-8 border border-slate-100">
            <QRCode value={mfaData.qrCodeUrl} size={180} />
          </div>

          <form onSubmit={handleVerifyMfa} className="space-y-4">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm font-bold">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-1.5 text-left">
              <label className=" font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                Authentication Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={mfaCode}
                onChange={(e) =>
                  setMfaCode(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="123456"
                className="w-full text-center tracking-widest bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-4 text-xl font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
              />
            </div>

            <button
              type="submit"
              disabled={loading || mfaCode.length !== 6}
              className="w-full bg-blue-600 text-white rounded-xl py-4 font-black text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify & Complete"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 transition-colors">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-blue-500/5 transition-colors flex flex-col md:flex-row overflow-hidden border border-slate-100 dark:border-slate-800">
        {/* Left Side Info */}
        <div className="md:w-1/3 bg-blue-600 p-8 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center mb-6">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="text-3xl font-black leading-tight mb-4">
              Join the Force
            </h2>
            <p className="text-blue-100 font-medium">
              Create your officer account to access the patrol tracking system.
            </p>
          </div>

          <div className="relative z-10 mt-12 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <p className=" font-black uppercase tracking-widest mb-2 text-blue-200">
              Security Check
            </p>
            <p className="text-xs font-semibold leading-relaxed">
              Administrator approval is required for all new registrations.
            </p>
          </div>

          {/* Abstract BG */}
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute top-24 -left-12 w-32 h-32 bg-blue-400/20 rounded-full blur-2xl"></div>
        </div>

        {/* Right Side Form */}
        <div className="md:w-2/3 p-8 lg:p-12">
          <div className="mb-8">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">
              Registration
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
              Please fill in your official details.
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm font-bold">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className=" font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    placeholder="Enter full name"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 pl-12 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className=" font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                  Badge Number
                </label>
                <div className="relative">
                  <BadgeCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={formData.badgeNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, badgeNumber: e.target.value })
                    }
                    placeholder="Enter badge #"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 pl-12 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className=" font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                  Rank
                </label>
                <div className="relative">
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={formData.rank}
                    onChange={(e) =>
                      setFormData({ ...formData, rank: e.target.value })
                    }
                    placeholder="e.g. PCPT"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 pl-12 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className=" font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                  Designation
                </label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={formData.designation}
                    onChange={(e) =>
                      setFormData({ ...formData, designation: e.target.value })
                    }
                    placeholder="e.g. Driver, Investigator"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 pl-12 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className=" font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                  Assign Unit
                </label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    required
                    value={formData.unitId}
                    onChange={(e) =>
                      setFormData({ ...formData, unitId: e.target.value })
                    }
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 pl-12 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Select Unit</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.unit_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className=" font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="name@official.gov.ph"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 pl-12 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className=" font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder="••••••••"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 pl-12 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className=" font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        confirmPassword: e.target.value,
                      })
                    }
                    placeholder="••••••••"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 pl-12 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white rounded-xl py-4 font-black text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {loading ? "Creating Account..." : "Register Account"}
              {!loading && (
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tighter">
            ALREADY HAVE AN ACCOUNT?{" "}
            <Link to="/login" className="text-blue-600 hover:underline">
              SIGN IN HERE
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
