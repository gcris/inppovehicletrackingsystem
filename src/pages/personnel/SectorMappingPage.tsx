import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../components/AuthProvider";
import {
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Search,
  X,
  Save,
  ChevronRight,
  Users,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Check,
  Maximize2,
  Minus,
  Fullscreen,
  Minimize,
  CircleAlert,
  MessageCircle,
  Phone,
} from "lucide-react";
import {
  GoogleMap,
  InfoWindowF,
  MarkerF,
  OverlayView,
  OverlayViewF,
  useJsApiLoader,
} from "@react-google-maps/api";
import { GOOGLE_MAPS_LOADER_OPTIONS } from "../../lib/googleMapsConfig";

/* ---------------------------------  ----------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type Unit = {
  id: string;
  unit_name: string;
};

type Barangay = {
  id: number;
  name: string;
  city_mun_id: number;
  city_municipality?: {
    name: string;
    district: string;
    province: string;
  } | null;
};

type SectorDetail = {
  id: string;
  brgy_id: number | null;
  sector_id: string | null;
  barangay?: Barangay | null;
};

type Sector = {
  id: string;
  deployment: string | null;
  sector: number | null;
  unit_id: string | null;
  unit?: Unit | null;
  sector_details?: SectorDetail[];
};

type ScheduleRank = {
  id: string;
  rank_name: string;
};

type SchedulePersonnel = {
  id: string;
  badge_number: string | null;
  fullname: string;
  rank?: ScheduleRank | ScheduleRank[] | null;
  phone_number: string | null;
  viber_number: string | null;
};

type ScheduleAssignment = {
  id: string;
  schedule_id: string;
  personnel_id: string;
  personnel?: SchedulePersonnel | SchedulePersonnel[] | null;
};

type PatrolSchedule = {
  id: string;
  unit_id: string;
  date: string;
  time_from: string;
  time_to: string;
  sector_id: string | null;
  mobility_id: string | null;
  patrol_type: string | null;
  schedule_assignments?: ScheduleAssignment[];
};

type StrategicLocation = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  unit_id: string;
  sector_id: string;
};

type BarangayGeoJSON = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id?: number | string;
    geometry: {
      type: string;
      coordinates: unknown;
    };
    properties: {
      id: number | string;
      ogc_fid: number | string;
      barangay: string;
      municipality: string;
      province: string;
      region: string;
      type: string;
    };
  }>;
};

type MainCategory =
  | "PNP"
  | "Vital Installations"
  | "Key Assets and Places of Convergence";

const GROUP_COLORS: Record<string, string> = {
  PNP: "#1E40AF",
  "Vital Installations": "#B45309",
  "Key Assets and Places of Convergence": "#089b02",
  Others: "#089b02",
};

const CATEGORY_GROUPS: Record<MainCategory, string[]> = {
  PNP: [
    "Police Station/PMFC/Police Office",
    "FVP-P.R.O.T.E.C.T. Box",
    "FVP-Police Assistance Center (PAC)",
    "Tourist Assistance Center (TAC)",
  ],
  "Vital Installations": [
    "Government and Administrative Buildings",
    "Health and Medical Facilities",
    "Transportation and Logistics Hubs",
    "Financial and Economic Key points",
    "Energy and Power Utilities",
    "Telecommunication and Broadcast Facilities",
    "Fuel and Petroleum Facility",
    "Water and Sanitation Systems",
  ],
  "Key Assets and Places of Convergence": [
    "Commercial and Economic Hubs",
    "Educational Institutions",
    "Religious and Cultural Institutions",
    "Entertainment, Recreation, and Tourism Hubs",
    "Public Markets, Commercial Hubs, and Memorial Parks",
    "Heritage and Institutional Assets",
    "Sports and Convention Complexes",
  ],
};

const CATEGORIES: Record<string, { color: string }> = {
  "Police Station/PMFC/Police Office": {
    color: "#1E40AF",
  },
  "FVP-P.R.O.T.E.C.T. Box": {
    color: "#1E40AF",
  },
  "FVP-Police Assistance Center (PAC)": {
    color: "#1E40AF",
  },
  "Tourist Assistance Center (TAC)": {
    color: "#1E40AF",
  },
  "Government and Administrative Buildings": {
    color: "#B45309",
  },
  "Health and Medical Facilities": {
    color: "#B45309",
  },
  "Transportation and Logistics Hubs": {
    color: "#B45309",
  },
  "Financial and Economic Key points": {
    color: "#B45309",
  },
  "Energy and Power Utilities": {
    color: "#B45309",
  },
  "Telecommunication and Broadcast Facilities": {
    color: "#B45309",
  },
  "Fuel and Petroleum Facility": {
    color: "#B45309",
  },
  "Water and Sanitation Systems": {
    color: "#B45309",
  },
  "Commercial and Economic Hubs": {
    color: "#089b02",
  },
  "Educational Institutions": {
    color: "#089b02",
  },
  "Religious and Cultural Institutions": {
    color: "#089b02",
  },
  "Entertainment, Recreation, and Tourism Hubs": {
    color: "#089b02",
  },
  "Public Markets, Commercial Hubs, and Memorial Parks": {
    color: "#089b02",
  },
  "Heritage and Institutional Assets": {
    color: "#089b02",
  },
  "Sports and Convention Complexes": {
    color: "#089b02",
  },
};

const SECTOR_COLORS = [
  "#2563EB",
  "#DC2626",
  "#16A34A",
  "#9333EA",
  "#EA580C",
  "#0891B2",
  "#DB2777",
  "#65A30D",
  "#7C3AED",
  "#CA8A04",
  "#089b02",
  "#BE123C",
  "#4F46E5",
  "#15803D",
  "#C2410C",
  "#0369A1",
];

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "An unexpected error occurred.";
}

/* -------------------------------------------------------------------------- */
/* PAGE                                                                       */
/* -------------------------------------------------------------------------- */

export default function SectorMappingPage() {
  const { unitId, isAdmin } = useAuth();

  /* ------------------------------------------------------------------------ */
  /* STATE                                                                    */
  /* ------------------------------------------------------------------------ */

  const [sectors, setSectors] = useState<Sector[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [barangays, setBarangays] = useState<Barangay[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingBarangays, setLoadingBarangays] = useState(false);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [loadingStrategicLocations, setLoadingStrategicLocations] =
    useState(false);
  const [saving, setSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [unitFilter, setUnitFilter] = useState(!isAdmin ? (unitId ?? "") : "");
  const [unitNameFilter, setUnitNameFilter] = useState<string>();

  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);
  const selectedSectorIdRef = useRef<string | null>(null);

  const [selectedBarangayIds, setSelectedBarangayIds] = useState<number[]>([]);
  const [barangayAssignmentSearch, setBarangayAssignmentSearch] = useState("");

  const [selectedScheduleDate, setSelectedScheduleDate] =
    useState(getLocalDateString());
  const [sectorSchedules, setSectorSchedules] = useState<PatrolSchedule[]>([]);
  const [sectorPanelMinimized, setSectorPanelMinimized] = useState(false);

  const [showSectorModal, setShowSectorModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);

  // const [showCriticalInfrastructures, setShowCriticalInfrastructures] =
  //   useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [strategicLocations, setStrategicLocations] = useState<
    StrategicLocation[]
  >([]);
  const [selectedStrategicLocation, setSelectedStrategicLocation] =
    useState<StrategicLocation | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("All");

  const [selectedMapBarangay, setSelectedMapBarangay] = useState<{
    id: number;
    name: string;
    municipality: string;
  } | null>(null);

  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  const [sectorForm, setSectorForm] = useState({
    deployment: "",
    sector: "",
    unit_id: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /* ------------------------------------------------------------------------ */
  /* GOOGLE MAPS                                                              */
  /* ------------------------------------------------------------------------ */

  const { isLoaded: googleMapsLoaded, loadError: googleMapsLoadError } =
    useJsApiLoader(GOOGLE_MAPS_LOADER_OPTIONS);

  const [map, setMap] = useState<google.maps.Map | null>(null);

  const mapWrapperRef = useRef<HTMLDivElement | null>(null);

  const sectorDataLayersRef = useRef<Map<string, google.maps.Data>>(new Map());

  const handleMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const getSectorColor = useCallback((index: number) => {
    return SECTOR_COLORS[index % SECTOR_COLORS.length];
  }, []);

  const clearSectorDataLayers = useCallback(() => {
    sectorDataLayersRef.current.forEach((layer) => {
      layer.setMap(null);
    });

    sectorDataLayersRef.current.clear();
  }, []);

  /* ------------------------------------------------------------------------ */
  /* FILTERED SECTORS                                                         */
  /* ------------------------------------------------------------------------ */

  const filteredSectors = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();

    return sectors.filter((sector) => {
      if (unitFilter && sector.unit_id !== unitFilter) {
        return false;
      }

      if (!search) return true;

      return (
        String(sector.sector ?? "").includes(search) ||
        (sector.deployment ?? "").toLowerCase().includes(search) ||
        (sector.unit?.unit_name ?? "").toLowerCase().includes(search)
      );
    });
  }, [sectors, searchQuery, unitFilter]);

  const unitFilteredSectors = useMemo(() => {
    if (!unitFilter) return sectors;

    return sectors.filter((sector) => sector.unit_id === unitFilter);
  }, [sectors, unitFilter]);

  /* ------------------------------------------------------------------------ */
  /* LOAD UNITS                                                               */
  /* ------------------------------------------------------------------------ */

  const fetchUnits = useCallback(async () => {
    if (!isAdmin && !unitId) {
      setUnits([]);
      return;
    }

    let query = supabase
      .from("unit")
      .select("id, unit_name")
      .lt("level", 5)
      .order("classification", { ascending: true })
      .order("unit_name", { ascending: true });

    if (!isAdmin) {
      query = query.eq("id", unitId!);
    }

    const { data, error: queryError } = await query;

    if (queryError) {
      console.error("Error fetching units:", queryError);
      setError("Failed to load units.");
      return;
    }

    setUnits((data ?? []) as Unit[]);
  }, [isAdmin, unitId]);

  /* ------------------------------------------------------------------------ */
  /* LOAD BARANGAYS                                                           */
  /* ------------------------------------------------------------------------ */

  const fetchBarangays = useCallback(async () => {
    setLoadingBarangays(true);

    try {
      const { data, error: queryError } = await supabase
        .from("barangay")
        .select(
          "id, name, city_mun_id, city_municipality(name, district, province)",
        )
        .order("name", { ascending: true });

      if (queryError) throw queryError;

      setBarangays((data ?? []) as unknown as Barangay[]);
    } catch (err) {
      console.error("Error fetching barangays:", err);
      setError("Failed to load barangays.");
    } finally {
      setLoadingBarangays(false);
    }
  }, []);

  /* ------------------------------------------------------------------------ */
  /* LOAD SECTORS                                                             */
  /* ------------------------------------------------------------------------ */

  const fetchSectors = useCallback(async () => {
    if (!isAdmin && !unitId) {
      setSectors([]);
      setSelectedSector(null);
      selectedSectorIdRef.current = null;
      setSectorSchedules([]);
      setLoading(false);
      setError("Your account is not assigned to a unit.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("sector")
        .select(
          `
          id,
          deployment,
          sector,
          unit_id,
          unit:unit_id(
            id,
            unit_name,
            level,
            classification
          ),
          sector_details:sector_detail(
            id,
            brgy_id,
            sector_id,
            barangay:brgy_id(
              id,
              name
            )
          )
        `,
        )
        .order("sector", { ascending: true });

      if (!isAdmin) {
        query = query.eq("unit_id", unitId!);
      }

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;

      const freshSectors = (data ?? []) as unknown as Sector[];

      setSectors(freshSectors);

      // Refresh the currently selected sector without depending on
      // selectedSector inside this callback.
      const selectedId = selectedSectorIdRef.current;

      if (selectedId) {
        const updatedSector = freshSectors.find(
          (sector) => sector.id === selectedId,
        );

        if (updatedSector) {
          setSelectedSector(updatedSector);
        } else {
          selectedSectorIdRef.current = null;
          setSelectedSector(null);
          setSectorSchedules([]);
          setSelectedMapBarangay(null);
          setStrategicLocations([]);
          setSelectedStrategicLocation(null);
        }
      }
    } catch (err) {
      console.error("Error fetching sectors:", err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [isAdmin, unitId]);

  /* ------------------------------------------------------------------------ */
  /* LOAD PATROL SCHEDULES                                                    */
  /* ------------------------------------------------------------------------ */

  const fetchSectorSchedule = useCallback(
    async (sectorId: string, date: string) => {
      if (!sectorId || !date) {
        setSectorSchedules([]);
        return;
      }

      setLoadingSchedule(true);

      try {
        const { data, error: queryError } = await supabase
          .from("patrol_schedule")
          .select(
            `
            *,
            schedule_assignments(
              id,
              schedule_id,
              personnel_id,
              personnel(
                *,
                rank:rank_id(
                  id,
                  rank_name
                )
              )
            )
          `,
          )
          .eq("sector_id", sectorId)
          .eq("date", date)
          .order("time_from", { ascending: true });

        if (queryError) throw queryError;

        setSectorSchedules((data ?? []) as unknown as PatrolSchedule[]);
      } catch (err) {
        console.error("Error fetching sector schedules:", err);
        setSectorSchedules([]);
      } finally {
        setLoadingSchedule(false);
      }
    },
    [],
  );

  /* ------------------------------------------------------------------------ */
  /* LOAD SECTOR GEOJSON                                                      */
  /* ------------------------------------------------------------------------ */

  const fetchSectorGeoJSON = useCallback(
    async (sectorId: string): Promise<BarangayGeoJSON | null> => {
      try {
        const { data, error: rpcError } = await supabase.rpc(
          "get_sector_barangay_geojson",
          {
            p_sector_id: sectorId,
          },
        );

        if (rpcError) throw rpcError;

        const rawResult: unknown = data;

        let geoJsonData: unknown = rawResult;

        if (Array.isArray(rawResult)) {
          const first = rawResult[0] as Record<string, unknown> | undefined;
          geoJsonData = first?.get_sector_barangay_geojson ?? rawResult;
        } else if (
          rawResult &&
          typeof rawResult === "object" &&
          "get_sector_barangay_geojson" in rawResult
        ) {
          geoJsonData = (rawResult as Record<string, unknown>)
            .get_sector_barangay_geojson;
        }

        if (typeof geoJsonData === "string") {
          geoJsonData = JSON.parse(geoJsonData);
        }

        if (
          !geoJsonData ||
          typeof geoJsonData !== "object" ||
          !("type" in geoJsonData) ||
          geoJsonData.type !== "FeatureCollection" ||
          !("features" in geoJsonData) ||
          !Array.isArray(geoJsonData.features)
        ) {
          console.error("Invalid sector GeoJSON:", sectorId, geoJsonData);
          return null;
        }

        return geoJsonData as BarangayGeoJSON;
      } catch (err) {
        console.error(`Error fetching GeoJSON for sector ${sectorId}:`, err);

        return null;
      }
    },
    [],
  );

  /* ------------------------------------------------------------------------ */
  /* LOAD Critical Infrastructure                                                 */
  /* ------------------------------------------------------------------------ */

  const fetchStrategicLocations = useCallback(
    async (sectorId: string) => {
      if (!sectorId) {
        setStrategicLocations([]);
        return;
      }

      if (!isAdmin && !unitId) {
        setStrategicLocations([]);
        return;
      }

      setLoadingStrategicLocations(true);

      try {
        let query = supabase
          .from("strategic_locations")
          .select(
            "id, name, category, description, address, latitude, longitude, unit_id, sector_id",
          )
          .eq("sector_id", sectorId)
          .order("name", { ascending: true });

        if (!isAdmin) {
          query = query.eq("unit_id", unitId!);
        }

        const { data, error: queryError } = await query;

        if (queryError) throw queryError;

        const validLocations: StrategicLocation[] = (data ?? [])
          .filter((location) => {
            const latitude = Number(location.latitude);
            const longitude = Number(location.longitude);

            return (
              Number.isFinite(latitude) &&
              Number.isFinite(longitude) &&
              latitude >= -90 &&
              latitude <= 90 &&
              longitude >= -180 &&
              longitude <= 180
            );
          })
          .map((location) => ({
            ...location,
            latitude: Number(location.latitude),
            longitude: Number(location.longitude),
          }));

        setStrategicLocations(validLocations);

        setSelectedStrategicLocation((current) => {
          if (!current) return null;

          return (
            validLocations.find((location) => location.id === current.id) ??
            null
          );
        });
      } catch (err) {
        console.error("Failed to load Critical Infrastructure:", err);
        setError(getErrorMessage(err));
      } finally {
        setLoadingStrategicLocations(false);
      }
    },
    [isAdmin, unitId],
  );

  /* ------------------------------------------------------------------------ */
  /* INITIAL LOAD                                                             */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    void fetchSectors();
    void fetchBarangays();
    void fetchUnits();
  }, [fetchSectors, fetchBarangays, fetchUnits]);

  /* ------------------------------------------------------------------------ */
  /* UPDATE UNIT FILTER FOR NON-ADMINS                                        */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!isAdmin) {
      setUnitFilter(unitId ?? "");
    }
  }, [isAdmin, unitId]);

  /* ------------------------------------------------------------------------ */
  /* LOAD SECTOR BOUNDARIES                                                   */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!map || !googleMapsLoaded) {
      return;
    }

    let cancelled = false;

    const loadBoundaries = async () => {
      clearSectorDataLayers();
      setSelectedMapBarangay(null);

      const results = await Promise.all(
        unitFilteredSectors.map(async (sector) => ({
          sector,
          geoJson: await fetchSectorGeoJSON(sector.id),
        })),
      );

      if (cancelled) return;

      const bounds = new google.maps.LatLngBounds();

      for (const { sector, geoJson } of results) {
        if (!geoJson || geoJson.features.length === 0) continue;

        const sectorIndex = sectors.findIndex((item) => item.id === sector.id);

        const color = getSectorColor(sectorIndex >= 0 ? sectorIndex : 0);

        try {
          const layer = new google.maps.Data();

          layer.addGeoJson(geoJson as GeoJSON.FeatureCollection);

          const isSelected = selectedSectorIdRef.current === sector.id;

          layer.setStyle({
            fillColor: color,
            fillOpacity: isSelected ? 0.8 : 0.1,
            strokeColor: color,
            strokeOpacity: 0.95,
            strokeWeight: isSelected ? 3 : 1.5,
          });

          layer.addListener("click", (event: google.maps.Data.MouseEvent) => {
            const rawId = event.feature.getProperty("id");
            const id = Number(rawId);

            const name = String(event.feature.getProperty("barangay") ?? "");

            const municipality = String(
              event.feature.getProperty("municipality") ?? "",
            );

            setSelectedMapBarangay({
              id,
              name,
              municipality,
            });

            selectedSectorIdRef.current = sector.id;
            setSelectedSector(sector);
            setSelectedBarangayIds([]);
            setSelectedStrategicLocation(null);
            setStrategicLocations([]);

            // if (showCriticalInfrastructures) {
            //   void fetchStrategicLocations(sector.id);
            // }
            void fetchStrategicLocations(sector.id);
          });

          layer.setMap(map);
          sectorDataLayersRef.current.set(sector.id, layer);

          layer.forEach((feature) => {
            const geometry = feature.getGeometry();

            if (!geometry) return;

            geometry.forEachLatLng((latLng) => {
              bounds.extend(latLng);
            });
          });
        } catch (err) {
          console.error(`Failed to render sector ${sector.sector}:`, err);
        }
      }

      if (!cancelled && !bounds.isEmpty()) {
        map.fitBounds(bounds);

        google.maps.event.addListenerOnce(map, "idle", () => {
          const zoom = map.getZoom();

          if (zoom !== undefined && zoom > 12) {
            map.setZoom(12);
          }
        });
      }
    };

    void loadBoundaries();

    return () => {
      cancelled = true;
      clearSectorDataLayers();
    };
  }, [
    map,
    googleMapsLoaded,
    unitFilteredSectors,
    sectors,
    fetchSectorGeoJSON,
    clearSectorDataLayers,
    getSectorColor,
    fetchStrategicLocations,
    // showCriticalInfrastructures,
  ]);

  /* ------------------------------------------------------------------------ */
  /* UPDATE BOUNDARY STYLING WHEN SELECTED SECTOR CHANGES                     */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    sectorDataLayersRef.current.forEach((layer, sectorId) => {
      const sectorIndex = sectors.findIndex((sector) => sector.id === sectorId);

      if (sectorIndex === -1) return;

      const color = getSectorColor(sectorIndex);
      const isSelected = selectedSector?.id === sectorId;

      layer.setStyle({
        fillColor: color,
        fillOpacity: isSelected ? 0.55 : 0.1,
        strokeColor: color,
        strokeOpacity: 0.95,
        strokeWeight: isSelected ? 3 : 1.5,
      });
    });
  }, [selectedSector, sectors, getSectorColor]);

  /* ------------------------------------------------------------------------ */
  /* LOAD SCHEDULE WHEN SECTOR OR DATE CHANGES                                */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!selectedSector?.id) {
      setSectorSchedules([]);
      setLoadingSchedule(false);
      return;
    }

    void fetchSectorSchedule(selectedSector.id, selectedScheduleDate);
  }, [selectedSector?.id, selectedScheduleDate, fetchSectorSchedule]);

  /* ------------------------------------------------------------------------ */
  /* FULLSCREEN STATE                                                         */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsMapFullscreen(document.fullscreenElement === mapWrapperRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleMapFullscreen = async () => {
    const wrapper = mapWrapperRef.current;

    if (!wrapper) return;

    try {
      if (document.fullscreenElement === wrapper) {
        await document.exitFullscreen();
      } else if (!document.fullscreenElement) {
        await wrapper.requestFullscreen();
      }
    } catch (err) {
      console.error("Failed to toggle fullscreen:", err);
      setError("Unable to toggle fullscreen. Check browser permissions.");
    }
  };

  /* ------------------------------------------------------------------------ */
  /* SELECT SECTOR                                                            */
  /* ------------------------------------------------------------------------ */

  const handleSelectSector = (sector: Sector) => {
    if (selectedSector?.id === sector.id) return;

    selectedSectorIdRef.current = sector.id;

    setSelectedSector(sector);
    setSelectedBarangayIds([]);
    setSelectedMapBarangay(null);
    setSelectedStrategicLocation(null);
    setStrategicLocations([]);
    setSectorSchedules([]);

    if (isAdmin) {
      setUnitFilter(sector.unit_id ?? "");
    } else {
      setUnitFilter(unitId ?? "");
    }

    // if (showCriticalInfrastructures) {
    void fetchStrategicLocations(sector.id);
    // }

    const layer = sectorDataLayersRef.current.get(sector.id);

    if (!layer || !map) return;

    const bounds = new google.maps.LatLngBounds();

    layer.forEach((feature) => {
      const geometry = feature.getGeometry();

      if (!geometry) return;

      geometry.forEachLatLng((latLng) => {
        bounds.extend(latLng);
      });
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds);

      google.maps.event.addListenerOnce(map, "idle", () => {
        const zoom = map.getZoom();

        if (zoom !== undefined && zoom > 16) {
          map.setZoom(16);
        }
      });
    }
  };

  /* ------------------------------------------------------------------------ */
  /* OPEN CREATE MODAL                                                        */
  /* ------------------------------------------------------------------------ */

  const openCreateModal = () => {
    setEditingSector(null);

    setSectorForm({
      deployment: "",
      sector: "",
      unit_id: isAdmin ? unitFilter : (unitId ?? ""),
    });

    setError(null);
    setSuccess(null);
    setShowSectorModal(true);
  };

  /* ------------------------------------------------------------------------ */
  /* OPEN EDIT MODAL                                                          */
  /* ------------------------------------------------------------------------ */

  const openEditModal = (sector: Sector) => {
    setEditingSector(sector);

    setSectorForm({
      deployment: sector.deployment ?? "",
      sector: sector.sector !== null ? String(sector.sector) : "",
      unit_id: sector.unit_id ?? "",
    });

    setError(null);
    setSuccess(null);
    setShowSectorModal(true);
  };

  /* ------------------------------------------------------------------------ */
  /* SAVE SECTOR                                                              */
  /* ------------------------------------------------------------------------ */

  const handleSaveSector = async () => {
    setError(null);
    setSuccess(null);

    if (!isAdmin && !unitId) {
      setError("Your account is not assigned to a unit.");
      return;
    }

    const sectorNumber = Number(sectorForm.sector);
    const deployment = sectorForm.deployment.trim();
    const targetUnitId = isAdmin ? sectorForm.unit_id : unitId!;

    if (!targetUnitId) {
      setError("Please select a unit.");
      return;
    }

    if (
      !sectorForm.sector.trim() ||
      !Number.isSafeInteger(sectorNumber) ||
      sectorNumber < 1
    ) {
      setError("Please enter a valid positive sector number.");
      return;
    }

    setSaving(true);

    try {
      let duplicateQuery = supabase
        .from("sector")
        .select("id")
        .eq("unit_id", targetUnitId)
        .eq("sector", sectorNumber);

      if (deployment) {
        duplicateQuery = duplicateQuery.eq("deployment", deployment);
      } else {
        duplicateQuery = duplicateQuery.is("deployment", null);
      }

      if (editingSector) {
        duplicateQuery = duplicateQuery.neq("id", editingSector.id);
      }

      const { data: duplicates, error: duplicateError } =
        await duplicateQuery.limit(1);

      if (duplicateError) throw duplicateError;

      if (duplicates?.length) {
        setError(
          "A sector with this number already exists for the selected unit and deployment.",
        );
        return;
      }

      const payload = {
        deployment: deployment || null,
        sector: sectorNumber,
        unit_id: targetUnitId,
      };

      if (editingSector) {
        const { error: updateError } = await supabase
          .from("sector")
          .update(payload)
          .eq("id", editingSector.id)
          .eq("unit_id", isAdmin ? targetUnitId : unitId!);

        if (updateError) throw updateError;

        setSuccess("Sector successfully updated.");
      } else {
        const { error: insertError } = await supabase
          .from("sector")
          .insert(payload);

        if (insertError) throw insertError;

        setSuccess("Sector successfully created.");
      }

      setShowSectorModal(false);
      setEditingSector(null);

      await fetchSectors();
    } catch (err) {
      console.error("Error saving sector:", err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* DELETE SECTOR                                                            */
  /* ------------------------------------------------------------------------ */

  const handleDeleteSector = async () => {
    if (!selectedSector) return;

    if (!isAdmin && selectedSector.unit_id !== unitId) {
      setError("You cannot delete a sector outside your assigned unit.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if ((selectedSector.sector_details ?? []).length > 0) {
        setError(
          "This sector cannot be deleted while barangays are assigned to it. Remove all barangay assignments first.",
        );
        setShowDeleteModal(false);
        return;
      }

      let query = supabase.from("sector").delete().eq("id", selectedSector.id);

      if (!isAdmin) {
        query = query.eq("unit_id", unitId!);
      }

      const { error: deleteError } = await query;

      if (deleteError) throw deleteError;

      selectedSectorIdRef.current = null;
      setSelectedSector(null);
      setSectorSchedules([]);
      setStrategicLocations([]);
      setSelectedStrategicLocation(null);
      setSelectedMapBarangay(null);
      setShowDeleteModal(false);

      setSuccess("Sector successfully deleted.");

      await fetchSectors();
    } catch (err) {
      console.error("Error deleting sector:", err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* ADD BARANGAYS                                                            */
  /* ------------------------------------------------------------------------ */

  const handleAddBarangays = async () => {
    if (!selectedSector) {
      setError("Please select a sector first.");
      return;
    }

    if (!isAdmin && selectedSector.unit_id !== unitId) {
      setError("You cannot modify a sector outside your assigned unit.");
      return;
    }

    if (selectedBarangayIds.length === 0) {
      setError("Please select at least one barangay.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const alreadyAssigned = new Set(
        (selectedSector.sector_details ?? [])
          .map((detail) => detail.brgy_id)
          .filter((id): id is number => id !== null),
      );

      const rows = selectedBarangayIds
        .filter((id) => !alreadyAssigned.has(id))
        .map((brgyId) => ({
          sector_id: selectedSector.id,
          brgy_id: brgyId,
        }));

      if (rows.length === 0) {
        setError("All selected barangays are already assigned.");
        return;
      }

      const { error: insertError } = await supabase
        .from("sector_detail")
        .insert(rows);

      if (insertError) throw insertError;

      setSelectedBarangayIds([]);

      setSuccess(
        `${rows.length} barangay${rows.length === 1 ? "" : "s"} assigned successfully.`,
      );

      await fetchSectors();
    } catch (err) {
      console.error("Error assigning barangays:", err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* REMOVE BARANGAY                                                          */
  /* ------------------------------------------------------------------------ */

  const handleRemoveBarangay = async (detailId: string) => {
    if (!selectedSector) return;

    if (!isAdmin && selectedSector.unit_id !== unitId) {
      setError("You cannot modify a sector outside your assigned unit.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      let query = supabase
        .from("sector_detail")
        .delete()
        .eq("id", detailId)
        .eq("sector_id", selectedSector.id);

      const { error: deleteError } = await query;

      if (deleteError) throw deleteError;

      setSuccess("Barangay removed from sector.");

      await fetchSectors();
    } catch (err) {
      console.error("Error removing barangay:", err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* AVAILABLE BARANGAYS                                                      */
  /* ------------------------------------------------------------------------ */

  const availableBarangays = useMemo(() => {
    if (!selectedSector) return [];

    const assignedIds = new Set(
      (selectedSector.sector_details ?? [])
        .map((detail) => detail.brgy_id)
        .filter((id): id is number => id !== null),
    );

    return barangays.filter(
      (barangay) =>
        !assignedIds.has(barangay.id) &&
        unitNameFilter?.includes(barangay.city_municipality?.name ?? ""),
    );
  }, [barangays, selectedSector]);

  const filteredAvailableBarangays = useMemo(() => {
    const search = barangayAssignmentSearch.trim().toLowerCase();

    if (!search) return availableBarangays;

    return availableBarangays.filter((barangay) => {
      const name = barangay.name.toLowerCase();
      const municipality = (
        barangay.city_municipality?.name ?? ""
      ).toLowerCase();

      return name.includes(search) || municipality.includes(search);
    });
  }, [availableBarangays, barangayAssignmentSearch]);

  const filteredStrategicLocations = strategicLocations.filter((location) => {
    const matchesUnit = !unitFilter || location.unit_id === unitFilter;

    const matchesSector =
      !selectedSector?.id || location.sector_id === selectedSector.id;

    if (categoryFilter === "All") {
      return matchesUnit && matchesSector;
    }

    // Check whether the selected filter is a main category
    const subCategories =
      CATEGORY_GROUPS[categoryFilter as keyof typeof CATEGORY_GROUPS];

    if (subCategories) {
      return (
        matchesUnit &&
        matchesSector &&
        subCategories.includes(location.category)
      );
    }

    // Otherwise, filter by the selected subcategory
    return matchesUnit && matchesSector && location.category === categoryFilter;
  });

  const toggleBarangaySelection = (barangayId: number) => {
    setSelectedBarangayIds((current) =>
      current.includes(barangayId)
        ? current.filter((id) => id !== barangayId)
        : [...current, barangayId],
    );
  };

  function createCategoryMarkerIcon(category: string): google.maps.Icon {
    const config = CATEGORIES[category] ?? {
      color: "#64748B",
    };

    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
      <circle
        cx="10"
        cy="10"
        r="7"
        fill="${config.color}"
        stroke="#FFFFFF"
        stroke-width="1.5"
      />
    </svg>
  `;

    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(20, 20),
      anchor: new google.maps.Point(10, 10),
    };
  }

  const getCategoryCount = (category: string) => {
    const subCategories =
      CATEGORY_GROUPS[category as keyof typeof CATEGORY_GROUPS];

    return strategicLocations.filter(
      (location) =>
        location.sector_id === selectedSector?.id &&
        (subCategories
          ? subCategories.includes(location.category)
          : location.category === category),
    ).length;
  };

  const getGroupCount = (subCategories: string[]) => {
    return strategicLocations.filter(
      (location) =>
        subCategories.includes(location.category) &&
        location.sector_id === selectedSector?.id,
    ).length;
  };

  /* ------------------------------------------------------------------------ */
  /* RENDER                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="min-h-screen bg-slate-50 p-4 dark:bg-slate-950 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* HEADER */}

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative shrink-0">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg">
                <MapPin className="h-7 w-7" />
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500 dark:border-slate-950">
                <Check className="h-3 w-3 text-white" />
              </div>
            </div>

            <div className="min-w-0">
              <h1 className="text-2xl tracking-tight text-slate-900 dark:text-white md:text-3xl">
                Sector Mapping
              </h1>
              <p className="mt-1 text-slate-600 dark:text-slate-300">
                Manage patrol sectors and their assigned barangays
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void fetchSectors()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700"
            >
              <Plus size={18} />
              Add Sector
            </button>
          </div>
        </div>

        {/* ALERTS */}

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <div className="flex-1">{error}</div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="rounded-lg p-1"
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
            <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
            <div className="flex-1">{success}</div>
            <button
              type="button"
              onClick={() => setSuccess(null)}
              className="rounded-lg p-1"
              aria-label="Dismiss success"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* SEARCH AND UNIT FILTER */}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search sector, deployment, or unit..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 font-semibold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <select
              value={unitFilter}
              onChange={(event) => {
                const newUnitId = event.target.value;

                setUnitFilter(newUnitId);
                const selectedText =
                  event.target.options[event.target.selectedIndex].text;
                setUnitNameFilter(selectedText);
                setSelectedBarangayIds([]);

                if (
                  selectedSector &&
                  newUnitId &&
                  selectedSector.unit_id !== newUnitId
                ) {
                  selectedSectorIdRef.current = null;
                  setSectorSchedules([]);
                  setSelectedMapBarangay(null);
                  setStrategicLocations([]);
                  setSelectedStrategicLocation(null);
                  setSelectedSector(null);
                }
              }}
              disabled={!isAdmin}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {isAdmin && <option value="">Select Unit/Station</option>}
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.unit_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* MAIN LAYOUT */}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[350px_minmax(0,1fr)]">
          {/* SECTOR LIST */}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-slate-900 dark:text-white">Sectors</h2>
                  <p className="mt-1 text-slate-500 dark:text-slate-400">
                    {filteredSectors.length} sector
                    {filteredSectors.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="rounded-lg bg-blue-50 px-3 py-1.5 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
                  {filteredSectors.length}
                </div>
              </div>
            </div>

            <div className="max-h-[650px] overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-16">
                  <RefreshCw size={24} className="animate-spin text-blue-600" />
                </div>
              ) : filteredSectors.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <MapPin size={36} className="mx-auto mb-3 text-slate-300" />
                  <p className="font-bold text-slate-600 dark:text-slate-300">
                    No sectors found
                  </p>
                  <p className="mt-1 text-slate-400">
                    Create a sector to get started.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSectors.map((sector) => {
                    const isSelected = selectedSector?.id === sector.id;
                    const barangayCount = sector.sector_details?.length ?? 0;

                    return (
                      <button
                        key={sector.id}
                        type="button"
                        onClick={() => handleSelectSector(sector)}
                        className={`w-full p-4 text-left transition ${
                          isSelected
                            ? "bg-blue-50 dark:bg-blue-950/30"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                              isSelected
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {sector.sector ?? "—"}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-slate-900 dark:text-white">
                                Sector {sector.sector ?? "—"}
                              </p>
                              <ChevronRight
                                size={17}
                                className={
                                  isSelected
                                    ? "text-blue-600"
                                    : "text-slate-300"
                                }
                              />
                            </div>

                            <p className="mt-0.5 truncate font-semibold text-slate-600 dark:text-slate-400">
                              {sector.deployment || "No deployment"}
                            </p>

                            <div className="mt-2 flex flex-wrap items-center gap-2 font-bold text-slate-600 dark:text-slate-400">
                              <span>{sector.unit?.unit_name ?? "No unit"}</span>
                              <CircleAlert size={12} />
                              <span>
                                {barangayCount} brgy
                                {barangayCount === 1 ? "" : "s"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* SECTOR DETAILS */}

          <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {!selectedSector ? (
              <div className="flex min-h-[500px] items-center justify-center px-6 text-center">
                <div>
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                    <MapPin size={30} />
                  </div>
                  <h2 className="text-slate-700 dark:text-slate-200">
                    Select a sector
                  </h2>
                  <p className="mt-1 max-w-sm text-slate-400">
                    Select a sector from the list to manage its barangay
                    assignments and patrol schedules.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* SELECTED SECTOR HEADER */}

                <div className="border-b border-slate-200 p-5 dark:border-slate-800">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-lg text-white">
                        {selectedSector.sector ?? "—"}
                      </div>
                      <div>
                        <h2 className="text-lg text-slate-900 dark:text-white">
                          Sector {selectedSector.sector ?? "—"}
                        </h2>
                        <div className="mt-1 flex flex-wrap items-center gap-3 font-semibold text-slate-500 dark:text-slate-400">
                          <span>
                            {selectedSector.deployment ||
                              "No deployment specified"}
                          </span>
                          <span>•</span>
                          <span>
                            {selectedSector.unit?.unit_name ?? "No unit"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(selectedSector)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <Pencil size={15} />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteModal(true)}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-red-600 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400"
                      >
                        <Trash2 size={15} />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                {/* MAP */}

                <div
                  ref={mapWrapperRef}
                  className={`relative w-full ${
                    isMapFullscreen
                      ? "h-screen bg-white dark:bg-slate-950"
                      : "h-[600px]"
                  }`}
                >
                  {!googleMapsLoaded && !googleMapsLoadError && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white dark:bg-slate-900">
                      <div className="flex items-center gap-2 font-bold text-slate-600 dark:text-slate-300">
                        <RefreshCw
                          size={20}
                          className="animate-spin text-blue-600"
                        />
                        Loading map...
                      </div>
                    </div>
                  )}

                  {googleMapsLoadError && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white dark:bg-slate-900">
                      <div className="px-6 text-center">
                        <AlertCircle
                          className="mx-auto mb-3 text-red-500"
                          size={32}
                        />
                        <p className="text-red-600">
                          Failed to load Google Maps
                        </p>
                        <p className="mt-1 text-slate-500">
                          Check your Google Maps API key and configuration.
                        </p>
                      </div>
                    </div>
                  )}

                  {googleMapsLoaded && (
                    <GoogleMap
                      mapContainerStyle={{
                        width: "100%",
                        height: "100%",
                      }}
                      onLoad={handleMapLoad}
                      options={{
                        streetViewControl: true,
                        fullscreenControl: false,
                        mapTypeControl: true,
                        zoomControl: true,
                      }}
                    >
                      {/* Critical Infrastructure MARKERS: SINGLE RENDER PATH */}

                      {filteredStrategicLocations.map((location) => (
                        <MarkerF
                          key={location.id}
                          position={{
                            lat: Number(location.latitude),
                            lng: Number(location.longitude),
                          }}
                          title={`${location.name} (${location.category})`}
                          icon={createCategoryMarkerIcon(location.category)}
                          zIndex={1000}
                          clickable={true}
                          onClick={() => {
                            setSelectedStrategicLocation(location);
                            setCategoryDropdownOpen(false);
                          }}
                        />
                      ))}

                      {/* Critical Infrastructure INFO WINDOW */}

                      {selectedStrategicLocation && (
                        <OverlayViewF
                          position={{
                            lat: Number(selectedStrategicLocation.latitude),
                            lng: Number(selectedStrategicLocation.longitude),
                          }}
                          mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                        >
                          <div className="relative w-[260px] -translate-x-1/2 -translate-y-full rounded-lg border border-slate-200 bg-white p-3 text-slate-900 shadow-xl">
                            <p className="text-[16px] font-bold">
                              {selectedStrategicLocation.name}
                            </p>

                            <p className="mt-1 text-sm">
                              {selectedStrategicLocation.category}
                            </p>

                            {selectedStrategicLocation.address && (
                              <p className="mt-2 text-sm">
                                {selectedStrategicLocation.address}
                              </p>
                            )}

                            {selectedStrategicLocation.description && (
                              <p className="mt-2 text-sm">
                                {selectedStrategicLocation.description}
                              </p>
                            )}

                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${selectedStrategicLocation.latitude},${selectedStrategicLocation.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-3 inline-block font-semibold text-blue-600 hover:underline"
                            >
                              Get Directions
                            </a>

                            {/* Popup pointer */}
                            <div className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-slate-200 bg-white" />
                          </div>
                        </OverlayViewF>
                      )}
                    </GoogleMap>
                  )}

                  {/* MAP CONTROLS */}
                  <div className="absolute left-2 top-15 z-999 w-[400px]">
                    <button
                      type="button"
                      onClick={() => setCategoryDropdownOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-3 text-left text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <span className="truncate">
                        {categoryFilter === "All"
                          ? `All Categories (${filteredStrategicLocations.length})`
                          : `(${getCategoryCount(categoryFilter)}) ${categoryFilter}`}
                      </span>
                      <span className="ml-2">▾</span>
                    </button>

                    {categoryDropdownOpen && (
                      <div className="mt-1 max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            setCategoryFilter("All");
                            setSelectedStrategicLocation(null);
                            setCategoryDropdownOpen(false);
                          }}
                          className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <span>All Categories</span>
                          <span className="ml-3 rounded-full bg-slate-200 px-2 py-0.5 font-semibold text-slate-700 dark:bg-slate-600 dark:text-white">
                            {strategicLocations.length}
                          </span>
                        </button>

                        {Object.entries(CATEGORY_GROUPS).map(
                          ([mainCategory, subCategories]) => (
                            <div key={mainCategory}>
                              <div
                                className="flex items-center justify-between gap-2 px-3 py-2 font-bold uppercase tracking-wide text-white"
                                onClick={() => {
                                  setCategoryFilter(mainCategory);
                                  setSelectedStrategicLocation(null);
                                  setCategoryDropdownOpen(false);
                                }}
                                style={{
                                  backgroundColor:
                                    GROUP_COLORS[mainCategory] ?? "#64748B",
                                }}
                              >
                                <span className="min-w-0 flex-1 whitespace-normal break-words">
                                  {mainCategory}
                                </span>

                                <span className="rounded-full bg-white/20 px-2 py-0.5">
                                  {getGroupCount(subCategories)}
                                </span>
                              </div>

                              {subCategories.map((subCategory) => (
                                <button
                                  key={subCategory}
                                  type="button"
                                  onClick={() => {
                                    setCategoryFilter(subCategory);
                                    setSelectedStrategicLocation(null);
                                    setCategoryDropdownOpen(false);
                                  }}
                                  className={`flex w-full items-center justify-between gap-2 rounded-md py-2 pl-8 pr-3 text-left hover:bg-slate-100 dark:hover:bg-slate-700 ${
                                    categoryFilter === subCategory
                                      ? "bg-slate-100 font-semibold dark:bg-slate-700"
                                      : ""
                                  }`}
                                >
                                  <span className="min-w-0 flex-1 whitespace-normal break-words">
                                    {subCategory}
                                  </span>
                                  <span className="ml-2 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-600 dark:text-slate-200">
                                    {getCategoryCount(subCategory)}
                                  </span>
                                </button>
                              ))}
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => void toggleMapFullscreen()}
                    className="absolute right-4 top-4 z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold text-slate-700 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    title={
                      isMapFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                    }
                  >
                    {isMapFullscreen ? (
                      <Minimize size={22} />
                    ) : (
                      <Fullscreen size={22} />
                    )}
                  </button>

                  {/* SELECTED BARANGAY */}

                  {selectedMapBarangay && (
                    <div className="absolute right-4 top-16 z-10 w-[200px] rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-slate-400">Barangay</p>
                          <h4 className="mt-1 text-slate-900 dark:text-white">
                            {selectedMapBarangay.name}
                          </h4>
                          <p className="mt-1 font-semibold text-slate-500 dark:text-slate-400">
                            {selectedMapBarangay.municipality}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedMapBarangay(null)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                          aria-label="Close barangay details"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* PATROL SCHEDULE PANEL */}

                  {selectedSector && (
                    <div
                      className={`absolute left-2 top-30 z-10 ${sectorPanelMinimized ? "w-[155px]" : "w-[400px]"} max-w-[calc(100%-2rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="mt-1 font-bold text-slate-900 dark:text-white">
                            Sector {selectedSector.sector ?? "—"}
                          </h4>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setSectorPanelMinimized((previous) => !previous)
                            }
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                            title={
                              sectorPanelMinimized
                                ? "Maximize schedule"
                                : "Minimize schedule"
                            }
                          >
                            {sectorPanelMinimized ? (
                              <Maximize2 size={16} />
                            ) : (
                              <Minus size={16} />
                            )}
                          </button>
                        </div>
                      </div>

                      {!sectorPanelMinimized && (
                        <>
                          <div className="mt-3">
                            <label
                              htmlFor="sector-schedule-date"
                              className="mb-1 block text-slate-500"
                            >
                              Schedule Date
                            </label>

                            <input
                              id="sector-schedule-date"
                              type="date"
                              value={selectedScheduleDate}
                              onChange={(event) =>
                                setSelectedScheduleDate(event.target.value)
                              }
                              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            />
                          </div>

                          <div className="mt-3 max-h-[300px] space-y-2 overflow-y-auto pr-1">
                            {loadingSchedule ? (
                              <div className="flex items-center justify-center gap-2 py-6 text-slate-500">
                                <RefreshCw
                                  size={16}
                                  className="animate-spin text-blue-600"
                                />
                                Loading schedules...
                              </div>
                            ) : sectorSchedules.length === 0 ? (
                              <div className="rounded-lg bg-slate-50 px-3 py-5 text-center dark:bg-slate-800">
                                <p className="text-slate-500 dark:text-slate-400">
                                  No patrol schedule
                                </p>
                                <p className="mt-1 text-slate-400">
                                  No personnel are scheduled for this sector on
                                  the selected date.
                                </p>
                              </div>
                            ) : (
                              sectorSchedules.map((schedule) => (
                                <div
                                  key={schedule.id}
                                  className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="rounded-md bg-blue-100 px-2 py-1 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                      {schedule.patrol_type || "Patrol"}
                                    </span>
                                    <span className="text-slate-600 dark:text-slate-300">
                                      {schedule.time_from?.slice(0, 5) ?? "—"}
                                      {" - "}
                                      {schedule.time_to?.slice(0, 5) ?? "—"}
                                    </span>
                                  </div>

                                  <div className="mt-3 space-y-2">
                                    {(schedule.schedule_assignments ?? []).map(
                                      (assignment, index) => {
                                        const rawPersonnel =
                                          assignment.personnel;

                                        const personnel = Array.isArray(
                                          rawPersonnel,
                                        )
                                          ? rawPersonnel[0]
                                          : rawPersonnel;

                                        const rawRank = personnel?.rank;

                                        const rank = Array.isArray(rawRank)
                                          ? rawRank[0]
                                          : rawRank;

                                        if (!personnel) return null;

                                        const phone =
                                          personnel.phone_number?.trim();
                                        const viber =
                                          personnel.viber_number?.trim();

                                        return (
                                          <div
                                            key={assignment.id}
                                            className="group rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-700"
                                          >
                                            {/* Personnel information */}
                                            <div className="flex items-center gap-3">
                                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                                                {index + 1}
                                              </div>

                                              <div className="min-w-0 flex-1">
                                                <p className="break-words leading-snug text-slate-800 dark:text-slate-100">
                                                  {rank?.rank_name}{" "}
                                                  {personnel.fullname}
                                                </p>
                                              </div>

                                              {phone && (
                                                <a
                                                  href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                                                  title={`${personnel.phone_number}`}
                                                  className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-1 font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/60"
                                                >
                                                  <Phone size={14} />
                                                </a>
                                              )}

                                              {viber && (
                                                <a
                                                  href={`viber://chat?number=${encodeURIComponent(
                                                    viber.replace(
                                                      /[^\d+]/g,
                                                      "",
                                                    ),
                                                  )}`}
                                                  title={`${personnel.viber_number}`}
                                                  className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 font-semibold text-purple-700 transition-colors hover:bg-purple-100 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900/60"
                                                >
                                                  <MessageCircle size={14} />
                                                </a>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      },
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* ASSIGN BARANGAYS */}

                <div className="border-b border-slate-200 p-5 dark:border-slate-800">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-700 dark:text-slate-300">
                          Assign Barangays
                        </h3>
                        {selectedBarangayIds.length > 0 && (
                          <span className="rounded-full bg-blue-100 px-2.5 py-1 font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            {selectedBarangayIds.length} selected
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedBarangayIds(
                              filteredAvailableBarangays.map(
                                (barangay) => barangay.id,
                              ),
                            )
                          }
                          disabled={filteredAvailableBarangays.length === 0}
                          className="font-semibold text-blue-600 disabled:opacity-50"
                        >
                          Select All
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedBarangayIds([])}
                          disabled={selectedBarangayIds.length === 0}
                          className="font-semibold text-slate-500 disabled:opacity-50"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <Search
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="text"
                        value={barangayAssignmentSearch}
                        onChange={(event) =>
                          setBarangayAssignmentSearch(event.target.value)
                        }
                        placeholder="Search barangay or municipality..."
                        className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-9 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      />
                      {barangayAssignmentSearch && (
                        <button
                          type="button"
                          onClick={() => setBarangayAssignmentSearch("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                          aria-label="Clear barangay search"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>

                    <div className="max-h-[200px] overflow-y-auto rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
                      {loadingBarangays ? (
                        <div className="flex items-center justify-center gap-2 p-6 text-slate-500">
                          <RefreshCw
                            size={17}
                            className="animate-spin text-blue-600"
                          />
                          Loading barangays...
                        </div>
                      ) : filteredAvailableBarangays.length === 0 ? (
                        <div className="p-5 text-center text-slate-500 dark:text-slate-400">
                          {availableBarangays.length === 0
                            ? "No available barangays."
                            : "No barangays match your search."}
                        </div>
                      ) : (
                        filteredAvailableBarangays.map((barangay) => {
                          const isSelected = selectedBarangayIds.includes(
                            barangay.id,
                          );

                          return (
                            <label
                              key={barangay.id}
                              className={`flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800 ${
                                isSelected
                                  ? "bg-blue-50 dark:bg-blue-950/30"
                                  : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() =>
                                  toggleBarangaySelection(barangay.id)
                                }
                                className="h-4 w-4 rounded border-slate-300 text-blue-600"
                              />

                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium text-slate-800 dark:text-slate-200">
                                  {barangay.name}
                                </div>
                                {barangay.city_municipality?.name && (
                                  <div className="text-slate-500 dark:text-slate-400">
                                    {barangay.city_municipality.name}
                                  </div>
                                )}
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleAddBarangays()}
                      disabled={
                        saving ||
                        !selectedSector ||
                        selectedBarangayIds.length === 0
                      }
                      className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving
                        ? "Assigning..."
                        : `Assign ${
                            selectedBarangayIds.length
                              ? `${selectedBarangayIds.length} `
                              : ""
                          }Barangay${selectedBarangayIds.length === 1 ? "" : "s"}`}
                    </button>
                  </div>
                </div>

                {/* ASSIGNED BARANGAYS */}

                <div>
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                    <div>
                      <h3 className="text-slate-900 dark:text-white">
                        Assigned Barangays
                      </h3>
                      <p className="mt-1 font-semibold text-slate-600 dark:text-slate-400">
                        {selectedSector.sector_details?.length ?? 0} assigned
                      </p>
                    </div>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
                      <Users size={17} />
                    </div>
                  </div>

                  {(selectedSector.sector_details ?? []).length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(selectedSector.sector_details ?? []).map(
                        (detail, index) => (
                          <div
                            key={detail.id}
                            className="flex items-center gap-4 px-5 py-4"
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              {index + 1}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-slate-800 dark:text-slate-200">
                                {detail.barangay?.name ??
                                  `Barangay ID: ${detail.brgy_id}`}
                              </p>
                              {detail.barangay?.city_municipality?.name && (
                                <p className="text-slate-500 dark:text-slate-400">
                                  {detail.barangay.city_municipality.name}
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                void handleRemoveBarangay(detail.id)
                              }
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                              title="Remove barangay"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <div className="px-6 py-14 text-center">
                      <MapPin
                        size={32}
                        className="mx-auto mb-3 text-slate-300 dark:text-slate-700"
                      />
                      <p className="font-bold text-slate-500 dark:text-slate-400">
                        No barangays assigned
                      </p>
                      <p className="mt-1 text-slate-400">
                        Use the assignment panel above to assign barangays.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* CREATE / EDIT SECTOR MODAL */}

      {showSectorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-slate-900 dark:text-white">
                  {editingSector ? "Edit Sector" : "Add Sector"}
                </h2>
                <p className="mt-1 text-slate-500 dark:text-slate-400">
                  Configure the sector information.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSectorModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close sector modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div>
                <label
                  htmlFor="sector-unit"
                  className="mb-2 block text-slate-500 dark:text-slate-400"
                >
                  Unit/Station
                </label>

                {isAdmin ? (
                  <select
                    id="sector-unit"
                    value={sectorForm.unit_id}
                    onChange={(event) =>
                      setSectorForm((previous) => ({
                        ...previous,
                        unit_id: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.unit_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {units.find((unit) => unit.id === unitId)?.unit_name ??
                      "Current Unit"}
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="sector-deployment"
                  className="mb-2 block text-slate-500 dark:text-slate-400"
                >
                  Deployment
                </label>
                <input
                  id="sector-deployment"
                  type="text"
                  value={sectorForm.deployment}
                  onChange={(event) =>
                    setSectorForm((previous) => ({
                      ...previous,
                      deployment: event.target.value,
                    }))
                  }
                  placeholder="e.g. Regular Patrol"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="sector-number"
                  className="mb-2 block text-slate-500 dark:text-slate-400"
                >
                  Sector Number
                </label>
                <input
                  id="sector-number"
                  type="number"
                  min="1"
                  step="1"
                  value={sectorForm.sector}
                  onChange={(event) =>
                    setSectorForm((previous) => ({
                      ...previous,
                      sector: event.target.value,
                    }))
                  }
                  placeholder="e.g. 1"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40">
              <button
                type="button"
                onClick={() => setShowSectorModal(false)}
                className="rounded-xl px-4 py-2.5 font-bold text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveSector()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                {editingSector ? "Save Changes" : "Create Sector"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE SECTOR MODAL */}

      {showDeleteModal && selectedSector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="p-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400">
                <Trash2 size={22} />
              </div>
              <div className="mt-4 text-center">
                <h2 className="text-lg text-slate-900 dark:text-white">
                  Delete Sector {selectedSector.sector}?
                </h2>
                <p className="mt-2 leading-6 text-slate-500 dark:text-slate-400">
                  This will permanently delete the sector. A sector with
                  assigned barangays cannot be deleted.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="rounded-xl px-4 py-2.5 font-bold text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteSector()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving && <RefreshCw size={16} className="animate-spin" />}
                Delete Sector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
