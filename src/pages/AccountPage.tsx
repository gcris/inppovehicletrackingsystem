import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../components/AuthProvider";
import {
  User,
  Mail,
  Shield,
  ShieldCheck,
  LogOut,
  ArrowRight,
  Clock,
  BadgeCheck,
  AlertCircle,
  Loader2,
  Building2,
  Award,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AccountPage() {
  const {
    user,
    profile,
    isAdmin,
    loading: authLoading,
    clearAuthCache,
  } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await clearAuthCache();
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      navigate("/login");
    }
  };

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const initial =
    profile?.fullname?.slice(0, 2).toUpperCase() ||
    user?.email?.slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto w-full py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-slate-900 dark:text-white flex items-center gap-3">
            <User className="w-8 h-8 text-blue-600" />
            Account
          </h1>
          <p className="text-slate-800 dark:text-slate-200 mt-1">
            Manage your account
          </p>
        </div>

        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-2 px-6 py-3 bg-red-500 dark:bg-slate-900 text-white rounded-2xl hover:bg-red-300 dark:hover:bg-slate-400/40 transition-all disabled:opacity-50"
        >
          {isLoggingOut ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
          Sign out
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none p-8 space-y-8 transition-colors">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="text-5xl w-24 h-24 rounded-[28px] bg-blue-600 flex items-center justify-center text-white text-3xlshadow-lg shadow-blue-200">
                  {initial}
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-md border border-slate-50 dark:border-slate-700">
                  {profile?.is_approved ? (
                    <BadgeCheck className="w-5 h-5 text-green-500" />
                  ) : (
                    <Clock className="w-5 h-5 text-amber-500" />
                  )}
                </div>
              </div>
              <div>
                <h2 className="font-bold text-2xl text-slate-900 dark:text-white">
                  {profile?.rank?.rank_name}{" "}
                  {profile?.fullname || user?.email?.split("@")[0]}
                </h2>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-full">
                    <ShieldCheck className="w-3 h-3" />
                    {isAdmin ? "Central Admin" : "Verified Operator"}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-1.5">
                <label className="text-slate-800 dark:text-slate-200 ml-1">
                  Badge Number
                </label>
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
                  <Award className="w-4 h-4 text-slate-400 dark:text-slate-600" />
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {profile?.badge_number}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-slate-800 dark:text-slate-200 ml-1">
                  Unit/Station
                </label>
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
                  <Building2 className="w-4 h-4 text-slate-400 dark:text-slate-600" />
                  <span className="font-bold text-slate-700 dark:text-slate-300 uppercase">
                    {(profile as any)?.unit?.unit_name ||
                      "Unit Assignment Pending"}
                  </span>
                </div>
              </div>
            </div>
            <div className="gap-6 pt-2">
              <div className="space-y-1.5">
                <label className="text-slate-800 dark:text-slate-200 ml-1">
                  Designation
                </label>
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
                  <Mail className="w-4 h-4 text-slate-400 dark:text-slate-600" />
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {profile?.designation}
                  </span>
                </div>
              </div>
            </div>
            <div className="gap-6 pt-2">
              <div className="space-y-1.5">
                <label className="text-slate-800 dark:text-slate-200 ml-1">
                  Email Address
                </label>
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
                  <Mail className="w-4 h-4 text-slate-400 dark:text-slate-600" />
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {user?.email}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Sidebar */}
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-[32px] p-8 transition-colors">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-blue-600 shrink-0" />
              <div>
                <p className="text-blue-900 dark:text-blue-300 mb-2">
                  Technical Support
                </p>
                <p className=" font-bold text-blue-700/70 dark:text-blue-400/70 leading-relaxed mb-4">
                  Encountering issues with live tracking or data sync? Contact
                  the INPPO-POMU Support Team for priority assistance.
                </p>
                <button className="text-blue-600 dark:text-blue-400 hover:underline">
                  Submit Support Ticket
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SecurityEvent({
  title,
  desc,
  time,
  type,
}: {
  title: string;
  desc: string;
  time: string;
  type: string;
}) {
  return (
    <div className="flex items-start gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl transition-colors">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          type === "login"
            ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
            : "bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-600"
        }`}
      >
        <Shield className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <p className="text-smtext-slate-900 dark:text-white">{title}</p>
          <span className=" font-bold text-slate-800 dark:text-slate-200 uppercase">
            {time}
          </span>
        </div>
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
          {desc}
        </p>
      </div>
    </div>
  );
}
