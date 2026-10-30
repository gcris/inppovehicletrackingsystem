import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Trash2,
  User,
  X,
} from "lucide-react";

import { supabase, Unit } from "../../lib/supabase";
import { useAuth } from "../../components/AuthProvider";

interface PhotoViewerItem {
  id: string;
  url: string;
  order: number;
}

interface PersonnelRecord {
  id: string;
  badge_number: string | null;
  rank_id: string | null;
  rank?: {
    rank_name: string;
  } | null;
  fullname: string;
  phone_number: string;
  viber_number: string;
  unit_id: string;
  unit?: {
    id: string;
    unit_name: string;
  } | null;
}

interface PatrolSummaryPhoto {
  id: string;
  photo_path: string;
  photo_order: number | null;
}

interface PatrolSummaryRecord {
  id: string;
  personnel_id: string | null;
  summary: string | null;
  submitted_at: string | null;
  unit_id: string | null;

  personnel?: PersonnelRecord | null;

  patrol_summary_photos: PatrolSummaryPhoto[];
}

const PAGE_SIZE = 20;
const STORAGE_BUCKET = "patrol-summary-proofs";

const formatDateTime = (value: string | null) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const formatDate = (value: string | null) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getToday = () => {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
};

const getUnitName = (unit: Unit | undefined) => {
  if (!unit) return "Unknown Unit";

  return unit.unit_name || unit.unit_name || "Unknown Unit";
};

const getPersonnelDisplayName = (personnel: PersonnelRecord | undefined) => {
  if (!personnel) return "Unknown Personnel";

  console.log("personnel: ", personnel);

  const rank = personnel.rank?.rank_name.trim() || "";
  const fullname = personnel.fullname?.trim() || "Unknown Personnel";

  return rank ? `${rank} ${fullname}` : fullname;
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";

  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }

  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const buildDateRange = (dateFrom: string, dateTo: string) => {
  let from: string | null = null;
  let to: string | null = null;

  if (dateFrom) {
    from = new Date(`${dateFrom}T00:00:00`).toISOString();
  }

  if (dateTo) {
    const end = new Date(`${dateTo}T00:00:00`);
    end.setDate(end.getDate() + 1);
    to = end.toISOString();
  }

  return { from, to };
};

export default function PatrolSummaryManagementPage() {
  const [summaries, setSummaries] = useState<PatrolSummaryRecord[]>([]);
  const [personnelMap, setPersonnelMap] = useState<
    Record<string, PersonnelRecord>
  >({});
  const [unitMap, setUnitMap] = useState<Record<string, Unit>>({});
  const [units, setUnits] = useState<Unit[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("all");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState(getToday());

  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedSummary, setSelectedSummary] =
    useState<PatrolSummaryRecord | null>(null);

  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);

  const [viewerPhotos, setViewerPhotos] = useState<PhotoViewerItem[]>([]);

  const [viewerIndex, setViewerIndex] = useState(0);

  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const { unitId, isAdmin } = useAuth();

  /*
   * ============================================================
   * LOAD UNITS
   * ============================================================
   */

  const loadUnits = useCallback(async () => {
    const { data, error } = await supabase
      .from("unit")
      .select("*")
      .order("unit_name", { ascending: true });

    if (error) {
      console.error("Failed to load units:", error);
      return;
    }

    const records = (data || []) as Unit[];

    const map: Record<string, Unit> = {};

    records.forEach((unit) => {
      map[unit.id] = unit;
    });

    setUnits(records);
    setUnitMap(map);
  }, []);

  /*
   * ============================================================
   * LOAD SUMMARIES
   * ============================================================
   */

  const loadSummaries = useCallback(
    async (showRefresh = false) => {
      try {
        setError(null);

        if (showRefresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        let personnelIds: string[] | null = null;

        const trimmedSearch = search.trim();

        if (trimmedSearch) {
          const searchValue = `%${trimmedSearch}%`;

          const { data: personnelData, error: personnelError } = await supabase
            .from("personnel")
            .select("id, fullname, rank(rank_name), unit(unit_name)")
            .or(`fullname.ilike.${searchValue},rank_name.ilike.${searchValue}`)
            .limit(500);

          if (personnelError) {
            throw personnelError;
          }

          personnelIds = (personnelData || []).map((person) => person.id);

          if (personnelIds.length === 0) {
            setSummaries([]);
            setTotalCount(0);
            setPersonnelMap({});
            return;
          }
        }

        /*
         * --------------------------------------------------------
         * Build summary query
         * --------------------------------------------------------
         */

        let query = supabase.from("patrol_summaries").select(
          `
            id,
            personnel_id,
            summary,
            submitted_at,
            unit_id,

            personnel:personnel_id (
              id,
              fullname,
              badge_number,
              rank_id,
              unit_id,
              phone_number,
              viber_number,

              rank:rank_id (
                rank_name
              ),

              unit:unit_id (
                id,
                unit_name
              )
            ),

            patrol_summary_photos (
              id,
              photo_path,
              photo_order
            )
          `,
          {
            count: "exact",
          },
        );

        if (!isAdmin && unitId) {
          query = query.eq("unit_id", unitId);
        }
        else {
          if (selectedUnit !== "all") {
            query = query.eq("unit_id", selectedUnit);
          }

          if (personnelIds) {
            query = query.in("personnel_id", personnelIds);
          }
        }

        const { from, to } = buildDateRange(dateFrom, dateTo);

        if (from) {
          query = query.gte("submitted_at", from);
        }

        if (to) {
          query = query.lt("submitted_at", to);
        }

        const fromIndex = (page - 1) * PAGE_SIZE;
        const toIndex = fromIndex + PAGE_SIZE - 1;

        const {
          data,
          error: summaryError,
          count,
        } = await query
          .order("submitted_at", {
            ascending: false,
            nullsFirst: false,
          })
          .range(fromIndex, toIndex);

        if (summaryError) {
          throw summaryError;
        }

        console.log("data: ", data);

        const records: PatrolSummaryRecord[] = (data || []).map((item) => {
          // Supabase may return FK relationships as arrays.
          const personnelData = Array.isArray(item.personnel)
            ? (item.personnel[0] ?? null)
            : (item.personnel ?? null);

          const rankData = personnelData?.rank
            ? Array.isArray(personnelData.rank)
              ? (personnelData.rank[0] ?? null)
              : personnelData.rank
            : null;

          const unitData = personnelData?.unit
            ? Array.isArray(personnelData.unit)
              ? (personnelData.unit[0] ?? null)
              : personnelData.unit
            : null;

          return {
            id: item.id,
            personnel_id: item.personnel_id,

            personnel: personnelData
              ? {
                  id: personnelData.id,
                  fullname: personnelData.fullname,
                  badge_number: personnelData.badge_number ?? null,
                  rank_id: personnelData.rank_id ?? null,
                  unit_id: personnelData.unit_id ?? null,
                  phone_number: personnelData.phone_number,
                  viber_number: personnelData.viber_number,

                  rank: rankData
                    ? {
                        rank_name: rankData.rank_name,
                      }
                    : null,

                  unit: unitData
                    ? {
                        id: unitData.id,
                        unit_name: unitData.unit_name,
                      }
                    : null,
                }
              : null,

            summary: item.summary,
            submitted_at: item.submitted_at,
            unit_id: item.unit_id,

            patrol_summary_photos: [...(item.patrol_summary_photos || [])].sort(
              (a, b) => (a.photo_order ?? 999) - (b.photo_order ?? 999),
            ),
          };
        });

        console.log("records:", records);

        setSummaries(records);
        setTotalCount(count || 0);

        /*
         * --------------------------------------------------------
         * Load personnel belonging to this page
         * --------------------------------------------------------
         */

        const ids = Array.from(
          new Set(
            records
              .map((item) => item.personnel_id)
              .filter((id): id is string => Boolean(id)),
          ),
        );

        if (ids.length > 0) {
          const { data: personnelData, error: pError } = await supabase
            .from("personnel")
            .select(
              `
                id,
                badge_number,
                fullname,
                phone_number,
                viber_number,
                rank_id,
                rank(rank_name),
                unit_id,
                unit(unit_name)
              `,
            )
            .in("id", ids);

          if (pError) {
            console.error("Failed to load personnel:", pError);
          } else {
            const map: Record<string, PersonnelRecord> = {};

            (personnelData || []).forEach((person) => {
              const rankData = Array.isArray(person.rank)
                ? (person.rank[0] ?? null)
                : (person.rank ?? null);

              const unitData = Array.isArray(person.unit)
                ? (person.unit[0] ?? null)
                : (person.unit ?? null);

              map[person.id] = {
                id: person.id,
                badge_number: person.badge_number ?? null,
                fullname: person.fullname,
                rank_id: person.rank_id ?? null,
                unit_id: person.unit_id ?? null,
                phone_number: person.phone_number,
                viber_number: person.viber_number,

                rank: rankData
                  ? {
                      rank_name: rankData.rank_name,
                    }
                  : null,

                unit: unitData
                  ? {
                      id: person.unit_id ?? null,
                      unit_name: unitData.unit_name,
                    }
                  : null,
              };
            });

            setPersonnelMap((previous) => ({
              ...previous,
              ...map,
            }));
          }
        }
      } catch (err: any) {
        console.error("Failed to load patrol summaries:", err);

        setError(err?.message || "Unable to load patrol summaries.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [search, selectedUnit, dateFrom, dateTo, page],
  );

  /*
   * ============================================================
   * INITIAL LOAD
   * ============================================================
   */

  useEffect(() => {
    if (isAdmin) {
      loadUnits();
    }
  }, [loadUnits]);

  useEffect(() => {
    loadSummaries();
  }, [loadSummaries]);

  /*
   * ============================================================
   * SEARCH / FILTER HELPERS
   * ============================================================
   */

  const resetToFirstPage = () => {
    if (page !== 1) {
      setPage(1);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);

    if (page !== 1) {
      setPage(1);
    }
  };

  const handleUnitChange = (value: string) => {
    setSelectedUnit(value);

    if (page !== 1) {
      setPage(1);
    }
  };

  const handleDateFromChange = (value: string) => {
    setDateFrom(value);

    if (page !== 1) {
      setPage(1);
    }
  };

  const handleDateToChange = (value: string) => {
    setDateTo(value);

    if (page !== 1) {
      setPage(1);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedUnit("all");
    setDateFrom("");
    setDateTo(getToday());
    setPage(1);
  };

  /*
   * ============================================================
   * PHOTO SIGNED URLS
   * ============================================================
   */

  const loadPhotoUrls = useCallback(async (summary: PatrolSummaryRecord) => {
    if (!summary.patrol_summary_photos.length) {
      setPhotoUrls({});
      return;
    }

    setIsLoadingPhotos(true);

    try {
      const entries = await Promise.all(
        summary.patrol_summary_photos.map(async (photo) => {
          const { data, error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(photo.photo_path, 60 * 60);

          if (error) {
            console.error("Failed to create signed URL:", error);

            return null;
          }

          return {
            id: photo.id,
            url: data?.signedUrl || "",
          };
        }),
      );

      const map: Record<string, string> = {};

      entries.forEach((entry) => {
        if (entry?.id && entry.url) {
          map[entry.id] = entry.url;
        }
      });

      setPhotoUrls(map);
    } finally {
      setIsLoadingPhotos(false);
    }
  }, []);

  /*
   * ============================================================
   * OPEN SUMMARY
   * ============================================================
   */

  const openSummary = async (summary: PatrolSummaryRecord) => {
    setSelectedSummary(summary);
    setPhotoUrls({});

    await loadPhotoUrls(summary);
  };

  /*
   * ============================================================
   * OPEN PHOTO VIEWER
   * ============================================================
   */

  const openPhotoViewer = (
    summary: PatrolSummaryRecord,
    selectedPhotoIndex: number,
  ) => {
    const photos: PhotoViewerItem[] = summary.patrol_summary_photos
      .map((photo, index) => {
        const url = photoUrls[photo.id];

        if (!url) return null;

        return {
          id: photo.id,
          url,
          order: photo.photo_order ?? index,
        };
      })
      .filter((photo): photo is PhotoViewerItem => Boolean(photo));

    if (!photos.length) return;

    setViewerPhotos(photos);

    const selectedPhoto = summary.patrol_summary_photos[selectedPhotoIndex];

    const viewerIndex = Math.max(
      0,
      photos.findIndex((photo) => photo.id === selectedPhoto?.id),
    );

    setViewerIndex(viewerIndex);
    setIsPhotoViewerOpen(true);
  };

  const closePhotoViewer = () => {
    setIsPhotoViewerOpen(false);
    setViewerPhotos([]);
    setViewerIndex(0);
  };

  const showPreviousPhoto = () => {
    if (!viewerPhotos.length) return;

    setViewerIndex((current) =>
      current <= 0 ? viewerPhotos.length - 1 : current - 1,
    );
  };

  const showNextPhoto = () => {
    if (!viewerPhotos.length) return;

    setViewerIndex((current) =>
      current >= viewerPhotos.length - 1 ? 0 : current + 1,
    );
  };

  /*
   * ============================================================
   * DELETE SUMMARY
   * ============================================================
   */

  const deleteSummary = async (summary: PatrolSummaryRecord) => {
    const personnel = summary.personnel_id
      ? personnelMap[summary.personnel_id]
      : undefined;

    const name = getPersonnelDisplayName(personnel);

    const confirmed = window.confirm(
      `Delete the patrol summary submitted by ${name}?\n\nThis will also delete its attached photos.`,
    );

    if (!confirmed) return;

    setDeletingId(summary.id);

    try {
      /*
       * --------------------------------------------------------
       * Delete storage files first
       * --------------------------------------------------------
       */

      const photoPaths = summary.patrol_summary_photos
        .map((photo) => photo.photo_path)
        .filter(Boolean);

      if (photoPaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove(photoPaths);

        if (storageError) {
          console.error("Storage deletion error:", storageError);

          throw storageError;
        }
      }

      /*
       * --------------------------------------------------------
       * Delete photo records first because FK is RESTRICT.
       * --------------------------------------------------------
       */

      if (summary.patrol_summary_photos.length > 0) {
        const photoIds = summary.patrol_summary_photos.map((photo) => photo.id);

        const { error: photoError } = await supabase
          .from("patrol_summary_photos")
          .delete()
          .in("id", photoIds);

        if (photoError) {
          throw photoError;
        }
      }

      /*
       * --------------------------------------------------------
       * Delete summary.
       * --------------------------------------------------------
       */

      const { error: summaryError } = await supabase
        .from("patrol_summaries")
        .delete()
        .eq("id", summary.id);

      if (summaryError) {
        throw summaryError;
      }

      if (selectedSummary?.id === summary.id) {
        setSelectedSummary(null);
      }

      /*
       * If deleting the final item on a page,
       * go back one page.
       */

      if (summaries.length === 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
      } else {
        await loadSummaries(true);
      }
    } catch (err: any) {
      console.error("Failed to delete patrol summary:", err);

      window.alert(err?.message || "Unable to delete the patrol summary.");
    } finally {
      setDeletingId(null);
    }
  };

  /*
   * ============================================================
   * KEYBOARD PHOTO VIEWER
   * ============================================================
   */

  useEffect(() => {
    if (!isPhotoViewerOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePhotoViewer();
      }

      if (event.key === "ArrowLeft") {
        showPreviousPhoto();
      }

      if (event.key === "ArrowRight") {
        showNextPhoto();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPhotoViewerOpen, viewerPhotos.length]);

  /*
   * ============================================================
   * SUMMARY STATISTICS
   * ============================================================
   */

  const currentPageStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;

  const currentPageEnd = Math.min(page * PAGE_SIZE, totalCount);

  const truncateSummary = (text: string | null | undefined, maxLength = 50) => {
    if (!text) return "";

    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  };

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <div className="min-h-full bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* ======================================================
            PAGE HEADER
            ====================================================== */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
                <FileText size={24} strokeWidth={2.3} />
              </div>

              <div>
                <h1 className="text-2xl tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                  Patrol Summary Management
                </h1>

                <p className="mt-1 text-slate-800 dark:text-slate-200">
                  Review and manage submitted patrol summaries.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadSummaries(true)}
            disabled={isRefreshing}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw
              size={17}
              className={isRefreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        {/* ======================================================
            FILTER BAR
            ====================================================== */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div
            className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${
              isAdmin
                ? "xl:grid-cols-[minmax(260px,1.5fr)_minmax(190px,1fr)_170px_170px_auto]"
                : "xl:grid-cols-[minmax(260px,1.5fr)_170px_170px_auto]"
            }`}
          >
            {/* SEARCH */}
            <div className="relative">
              <Search
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                value={search}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Search personnel..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 font-medium outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
              />
            </div>

            {isAdmin && (
              <select
                value={selectedUnit}
                onChange={(event) => handleUnitChange(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 font-semibold outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="all">All Units/Stations</option>

                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {getUnitName(unit)}
                  </option>
                ))}
              </select>
            )}

            {/* FROM */}
            <div className="relative">
              <CalendarDays
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="date"
                value={dateFrom}
                onChange={(event) => handleDateFromChange(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            {/* TO */}
            <div className="relative">
              <CalendarDays
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="date"
                value={dateTo}
                onChange={(event) => handleDateToChange(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            {/* CLEAR */}
            <button
              type="button"
              onClick={clearFilters}
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Clear
            </button>
          </div>
        </div>

        {/* ======================================================
            ERROR
            ====================================================== */}
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <AlertTriangle size={20} className="mt-0.5 shrink-0" />

            <div className="min-w-0">
              <p className="font-bold">Unable to load patrol summaries</p>

              <p className="mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* ======================================================
            TABLE
            ====================================================== */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {isLoading ? (
            <div className="flex min-h-[420px] items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={32} className="animate-spin text-blue-600" />

                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Loading patrol summaries...
                </p>
              </div>
            </div>
          ) : summaries.length === 0 ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                <FileText size={30} />
              </div>

              <h3 className="mt-4 text-lg text-slate-800 dark:text-white">
                No patrol summaries found
              </h3>

              <p className="mt-1 max-w-md text-slate-800 dark:text-slate-200">
                Try changing your search, unit, or date filters.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50">
                      <th className="px-5 py-4 text-center text-slate-800 dark:text-slate-200">
                        Actions
                      </th>

                      <th className="px-5 py-4 text-center text-slate-800 dark:text-slate-200">
                        Personnel
                      </th>

                      <th className="px-5 py-4 text-center text-slate-800 dark:text-slate-200">
                        Unit
                      </th>

                      <th className="px-5 py-4 text-center text-slate-800 dark:text-slate-200">
                        Summary
                      </th>

                      <th className="px-5 py-4 text-center text-slate-800 dark:text-slate-200">
                        Submitted
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {summaries.map((summary) => {
                      const personnel = summary.personnel_id
                        ? personnelMap[summary.personnel_id]
                        : undefined;

                      const unit = summary.unit_id
                        ? unitMap[summary.unit_id]
                        : undefined;

                      const personnelName = getPersonnelDisplayName(personnel);

                      return (
                        <tr
                          key={summary.id}
                          className="group transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        >
                          {/* ACTIONS */}
                          <td className="px-5 py-4">
                            <div className="flex justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => openSummary(summary)}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-white transition hover:bg-blue-700"
                              >
                                <Eye size={15} />
                              </button>

                              <button
                                type="button"
                                onClick={() => deleteSummary(summary)}
                                disabled={deletingId === summary.id}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/60"
                                title="Delete"
                              >
                                {deletingId === summary.id ? (
                                  <Loader2 size={15} className="animate-spin" />
                                ) : (
                                  <Trash2 size={15} />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* PERSONNEL */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-slate-800 dark:text-white">
                                  {personnelName}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* UNIT */}
                          <td className="px-5 py-4">
                            <span className="truncate text-slate-800 dark:text-white">
                              {getUnitName(unit)}
                            </span>
                          </td>

                          {/* SUMMARY */}
                          <td className="max-w-[380px] px-5 py-4">
                            <p className="line-clamp-2 leading-6 text-slate-600 dark:text-slate-300">
                              {truncateSummary(summary.summary) ||
                                "No summary provided."}
                            </p>
                          </td>

                          {/* DATE */}
                          <td className="whitespace-nowrap px-5 py-4">
                            <div className="flex items-center gap-2 font-semibold text-slate-600 dark:text-slate-300">
                              {formatDateTime(summary.submitted_at)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ==================================================
                  PAGINATION
                  ================================================== */}
              <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Showing{" "}
                  <span className="text-slate-700 dark:text-slate-200">
                    {currentPageStart}
                  </span>{" "}
                  to{" "}
                  <span className="text-slate-700 dark:text-slate-200">
                    {currentPageEnd}
                  </span>{" "}
                  of{" "}
                  <span className="text-slate-700 dark:text-slate-200">
                    {totalCount}
                  </span>{" "}
                  summaries
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <ChevronLeft size={15} />
                    Previous
                  </button>

                  <div className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-blue-600 px-3 text-white">
                    {page}
                  </div>

                  <span className="font-bold text-slate-400">
                    of {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() =>
                      setPage((current) => Math.min(totalPages, current + 1))
                    }
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Next
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ========================================================
          SUMMARY DETAIL MODAL
          ======================================================== */}
      {selectedSummary && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedSummary(null);
            }
          }}
        >
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
            {/* HEADER */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
              <div className="min-w-0">
                <h2 className="truncate text-xl text-slate-900 dark:text-white">
                  Patrol Summary
                </h2>

                <p className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">
                  {formatDateTime(selectedSummary.submitted_at)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSummary(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* CONTENT */}
            <div className="overflow-y-auto p-5 sm:p-6">
              {(() => {
                const personnel = selectedSummary.personnel_id
                  ? personnelMap[selectedSummary.personnel_id]
                  : undefined;

                const unit = selectedSummary.unit_id
                  ? unitMap[selectedSummary.unit_id]
                  : undefined;

                return (
                  <div className="space-y-6">
                    {/* PERSONNEL INFO */}
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                      <div className="flex items-center gap-4">
                        <div className="min-w-0">
                          {/* Name */}
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="min-w-0">
                              <p className="truncate text-lg font-semibold text-slate-900 dark:text-white">
                                {getPersonnelDisplayName(personnel)}
                              </p>

                              {/* Unit */}
                              {personnel?.unit?.unit_name && (
                                <p className="truncate text-slate-800 dark:text-slate-200">
                                  {personnel.unit.unit_name}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Contact information */}
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 pl-5">
                            {personnel?.phone_number && (
                              <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                <Phone size={13} className="text-emerald-500" />
                                <span className="text-slate-700 dark:text-slate-300">
                                  Contact:
                                </span>
                                <span>{personnel.phone_number}</span>
                              </span>
                            )}

                            {personnel?.viber_number && (
                              <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                <MessageCircle
                                  size={13}
                                  className="text-violet-500"
                                />
                                <span className="text-slate-700 dark:text-slate-300">
                                  Viber:
                                </span>
                                <span>{personnel.viber_number}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SUMMARY */}
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <FileText size={18} className="text-blue-600" />

                        <h3 className="text-sm text-slate-700 dark:text-slate-200">
                          Patrol Summary
                        </h3>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950">
                        <p className="whitespace-pre-wrap leading-7 text-slate-700 dark:text-slate-300">
                          {selectedSummary.summary ||
                            "No summary was provided."}
                        </p>
                      </div>
                    </div>

                    {/* PHOTOS */}
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ImageIcon size={18} className="text-blue-600" />

                          <h3 className="text-sm text-slate-700 dark:text-slate-200">
                            Attached Photos
                          </h3>
                        </div>

                        <span className="font-bold text-slate-400">
                          {selectedSummary.patrol_summary_photos.length} / 3
                        </span>
                      </div>

                      {selectedSummary.patrol_summary_photos.length === 0 ? (
                        <div className="flex min-h-[140px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
                          <div className="text-center">
                            <ImageIcon
                              size={28}
                              className="mx-auto text-slate-400"
                            />

                            <p className="mt-2 font-semibold text-slate-800 dark:text-slate-200">
                              No photos attached
                            </p>
                          </div>
                        </div>
                      ) : isLoadingPhotos ? (
                        <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700">
                          <Loader2
                            size={28}
                            className="animate-spin text-blue-600"
                          />
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          {selectedSummary.patrol_summary_photos.map(
                            (photo, index) => {
                              const url = photoUrls[photo.id];

                              return (
                                <button
                                  type="button"
                                  key={photo.id}
                                  disabled={!url}
                                  onClick={() =>
                                    openPhotoViewer(selectedSummary, index)
                                  }
                                  className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 text-left dark:border-slate-700 dark:bg-slate-950"
                                >
                                  {url ? (
                                    <img
                                      src={url}
                                      alt={`Patrol summary photo ${index + 1}`}
                                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                    />
                                  ) : (
                                    <div className="flex h-full items-center justify-center">
                                      <Loader2
                                        size={24}
                                        className="animate-spin text-slate-400"
                                      />
                                    </div>
                                  )}

                                  {url && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
                                      <div className="flex h-10 w-10 scale-75 items-center justify-center rounded-full bg-white/90 text-slate-800 opacity-0 shadow-lg transition group-hover:scale-100 group-hover:opacity-100">
                                        <Eye size={18} />
                                      </div>
                                    </div>
                                  )}

                                  <span className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2 py-1 text-[10px] text-white backdrop-blur-sm">
                                    Photo {index + 1}
                                  </span>
                                </button>
                              );
                            },
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* FOOTER */}
            <div className="flex shrink-0 justify-end border-t border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
              <button
                type="button"
                onClick={() => setSelectedSummary(null)}
                className="h-10 rounded-xl bg-slate-900 px-5 font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          FULL SCREEN PHOTO VIEWER
          ======================================================== */}
      {isPhotoViewerOpen && viewerPhotos.length > 0 && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4">
          {/* CLOSE */}
          <button
            type="button"
            onClick={closePhotoViewer}
            className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close photo viewer"
          >
            <X size={22} />
          </button>

          {/* COUNTER */}
          <div className="absolute left-1/2 top-5 z-20 -translate-x-1/2 rounded-full bg-white/10 px-4 py-2 text-white backdrop-blur-sm">
            {viewerIndex + 1} / {viewerPhotos.length}
          </div>

          {/* PREVIOUS */}
          {viewerPhotos.length > 1 && (
            <button
              type="button"
              onClick={showPreviousPhoto}
              className="absolute left-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-6"
              aria-label="Previous photo"
            >
              <ChevronLeft size={28} />
            </button>
          )}

          {/* IMAGE */}
          <div className="flex h-full w-full items-center justify-center px-10 py-14 sm:px-20">
            <img
              src={viewerPhotos[viewerIndex]?.url}
              alt={`Patrol summary photo ${viewerIndex + 1}`}
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            />
          </div>

          {/* NEXT */}
          {viewerPhotos.length > 1 && (
            <button
              type="button"
              onClick={showNextPhoto}
              className="absolute right-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-6"
              aria-label="Next photo"
            >
              <ChevronRight size={28} />
            </button>
          )}

          {/* BOTTOM INFO */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-2 font-semibold text-white backdrop-blur-sm">
            Click outside or press Esc to close
          </div>
        </div>
      )}
    </div>
  );
}
