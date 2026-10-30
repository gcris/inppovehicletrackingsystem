import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import {
  GoogleMap,
  OverlayView,
  OverlayViewF,
  useGoogleMap,
  useJsApiLoader,
} from "@react-google-maps/api";
import { GOOGLE_MAPS_LOADER_OPTIONS } from "../lib/googleMapsConfig";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Signal,
  Navigation,
  Notebook,
  ShieldCheck,
  Network,
  Car,
  Bike,
  Footprints,
  Waves,
  Activity,
  Star,
  Siren,
  Motorbike,
  LucideIcon,
  DroneIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

import { MobilityAsset, PatrolLog, Personnel } from "../lib/supabase";

/* ============================================================
   DUTY TYPE ICONS
============================================================ */

export const dutyTypeIconMap: Record<string, LucideIcon> = {
  "Mobile Patrolling": Car,
  "TMRU Patrolling": Motorbike,
  "Foot Patrolling": Footprints,
  "Bike Patrolling": Bike,
  "Seaborne Patrolling": Waves,
  Checkpoint: ShieldCheck,
  "Simulation Exercise": Activity,
  "Special Event": Star,
  "DODON": DroneIcon,
  EMERGENCY_SOS: Siren,
};

function getIconForDutyType(dutyType?: string): LucideIcon {
  if (!dutyType) {
    return Car;
  }

  if (dutyTypeIconMap[dutyType]) {
    return dutyTypeIconMap[dutyType];
  }

  const formatted = dutyType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  if (dutyTypeIconMap[formatted]) {
    return dutyTypeIconMap[formatted];
  }

  if (dutyType === "CHECKPOINT") {
    return ShieldCheck;
  }

  return Car;
}

/* ============================================================
   TYPES
============================================================ */

interface MapProps {
  vehicles: Record<string, MobilityAsset>;
  logs: Record<string, PatrolLog>;
  personnel: Record<string, Personnel>;
}

interface Position {
  lat: number;
  lng: number;
}

interface SelectedMarker {
  trackingId: string;
  trackingKey: string;
  log: PatrolLog;
  position: Position;
}

interface TrackingItem {
  trackingId: string;
  trackingKey: string;
  log: PatrolLog;
}

/* ============================================================
   MAP CONSTANTS
============================================================ */

const containerStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
};

const DEFAULT_CENTER: Position = Object.freeze({
  lat: 18.196,
  lng: 120.5927,
});

const DEFAULT_ZOOM = 11;

const mapOptions: google.maps.MapOptions = {
  streetViewControl: true,
  mapTypeControl: true,
  fullscreenControl: true,
  zoomControl: true,
  draggable: true,
  scrollwheel: true,
  gestureHandling: "auto",
  disableDoubleClickZoom: false,
  draggableCursor: "grab",
  draggingCursor: "grabbing",
  mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID,
};

/* ============================================================
   HELPERS
============================================================ */

/**
 * Returns the actual identity of a tracking log.
 *
 * IMPORTANT:
 *
 * A log can be:
 *
 *   vehicle_id = UUID
 *   personnel_id = UUID
 *
 * or:
 *
 *   vehicle_id = null
 *   personnel_id = UUID
 *
 * Therefore we MUST NOT use the Record<string, PatrolLog>
 * object's key as the vehicle ID.
 */
function getTrackingIdentity(log: PatrolLog): {
  trackingId: string | null;
  trackingKey: string | null;
} {
  if (log.vehicle_id) {
    return {
      trackingId: log.vehicle_id,
      trackingKey: `vehicle:${log.vehicle_id}`,
    };
  }

  if (log.personnel_id) {
    return {
      trackingId: log.personnel_id,
      trackingKey: `personnel:${log.personnel_id}`,
    };
  }

  return {
    trackingId: null,
    trackingKey: null,
  };
}

/**
 * Offset markers that have exactly the same coordinates.
 *
 * This prevents multiple markers from sitting directly on top
 * of each other.
 */
function getOffsetPosition(
  lat: number,
  lng: number,
  index: number,
  total: number,
): Position {
  if (total <= 1) {
    return { lat, lng };
  }

  const radius = 0.00003;
  const angle = (2 * Math.PI * index) / total;

  return {
    lat: lat + radius * Math.cos(angle),
    lng: lng + radius * Math.sin(angle),
  };
}

/**
 * Used for grouping markers that occupy approximately the same
 * physical location.
 */
function getCoordinateGroupKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

/* ============================================================
   ADVANCED MARKER ENTRY
============================================================ */

interface AdvancedMarkerEntry {
  marker: google.maps.marker.AdvancedMarkerElement;
  element: HTMLDivElement;
  iconContainer: HTMLSpanElement;

  clickHandler: (event: Event) => void;
  mouseEnterHandler: () => void;
  mouseLeaveHandler: () => void;
}

/* ============================================================
   TRACKING MARKERS
============================================================ */

function findPersonnel(
  personnel: Record<string, Personnel>,
  personnelId?: string | null,
): Personnel | undefined {
  if (!personnelId) {
    return undefined;
  }

  return personnel[personnelId] || undefined;
}

type MarkerStatus = "emergency" | "offline" | "moving" | "stationary";

function getMarkerStatus(log: PatrolLog): MarkerStatus {
  const dutyType = (log.duty_type || "").toUpperCase();

  const isEmergency =
    dutyType === "EMERGENCY_SOS" || dutyType === "DISTRESS_SIGNAL";

  if (isEmergency) {
    return "emergency";
  }

  const lastUpdated = new Date(log.captured_at).getTime();
  const isStale =
    !Number.isFinite(lastUpdated) || Date.now() - lastUpdated > 5 * 60 * 1000;

  if (isStale) {
    return "offline";
  }

  const speed = Number(log.speed ?? 0);

  if (speed >= 1.0) {
    return "moving";
  }

  return "stationary";
}

const markerColorMap = {
  emergency: {
    border: "#DC2626",
    background: "#FEE2E2",
    icon: "#DC2626",
  },
  offline: {
    border: "#64748B",
    background: "#E2E8F0",
    icon: "#64748B",
  },
  moving: {
    border: "#16A34A",
    background: "#DCFCE7",
    icon: "#16A34A",
  },
  stationary: {
    border: "#F59E0B",
    background: "#FEF3C7",
    icon: "#D97706",
  },
};

const TrackingMarkers = React.memo(function TrackingMarkers({
  vehicles,
  logs,
  personnel,
  onSelect,
}: MapProps & {
  onSelect: (marker: SelectedMarker) => void;
}) {
  const map = useGoogleMap();

  const markersRef = useRef<Map<string, AdvancedMarkerEntry>>(new Map());

  const logsRef = useRef(logs);
  const vehiclesRef = useRef(vehicles);
  const personnelRef = useRef(personnel);
  const onSelectRef = useRef(onSelect);

  const groupedMarkersRef = useRef<Map<string, TrackingItem[]>>(new Map());

  /* ============================================================
     KEEP REFS CURRENT
  ============================================================ */

  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  useEffect(() => {
    vehiclesRef.current = vehicles;
  }, [vehicles]);

  useEffect(() => {
    personnelRef.current = personnel;
  }, [personnel]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  /* ============================================================
     BUILD TRACKING ITEMS
  ============================================================ */

  const trackingItems = useMemo(() => {
    const items: TrackingItem[] = [];

    Object.values(logs).forEach((log) => {
      const { trackingId, trackingKey } = getTrackingIdentity(log);

      /*
       * IMPORTANT:
       *
       * Do not rely on the Object.entries(logs) key.
       *
       * latest_asset_logs may contain:
       *
       *   vehicle_id = null
       *   personnel_id = UUID
       *
       * In that case the personnel UUID becomes the tracking
       * identity.
       */
      if (!trackingId || !trackingKey) {
        return;
      }

      const lat = Number(log.latitude);
      const lng = Number(log.longitude);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }

      items.push({
        trackingId,
        trackingKey,
        log,
      });
    });

    return items;
  }, [logs]);

  /* ============================================================
     GROUP TRACKERS BY LOCATION
  ============================================================ */

  const groupedMarkers = useMemo<Map<string, TrackingItem[]>>(() => {
    const groups = new Map<string, TrackingItem[]>();

    trackingItems.forEach((item) => {
      const lat = Number(item.log.latitude);
      const lng = Number(item.log.longitude);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }

      const key = getCoordinateGroupKey(lat, lng);

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key)!.push(item);
    });

    return groups;
  }, [trackingItems]);

  useEffect(() => {
    groupedMarkersRef.current = groupedMarkers;
  }, [groupedMarkers]);

  /* ============================================================
     CREATE / UPDATE / REMOVE ADVANCED MARKERS
  ============================================================ */

  useEffect(() => {
    if (!map) {
      return;
    }

    if (!window.google?.maps?.marker?.AdvancedMarkerElement) {
      console.warn(
        "AdvancedMarkerElement is not available. Make sure the Google Maps marker library is loaded.",
      );

      return;
    }

    const activeMarkerIds = new Set<string>();

    /* ==========================================================
       PROCESS EACH LOCATION GROUP
    ========================================================== */

    groupedMarkers.forEach((group) => {
      /*
       * Stable sorting is important.
       *
       * If multiple trackers are in the same location,
       * their offset positions should not randomly change
       * between realtime updates.
       */
      const sortedGroup = [...group].sort((a, b) =>
        a.trackingKey.localeCompare(b.trackingKey),
      );

      sortedGroup.forEach((item, index) => {
        const { trackingId, trackingKey, log } = item;

        /*
         * trackingId is the actual database ID.
         * trackingKey is the namespaced marker identity.
         *
         * Vehicle and personnel are resolved from the LOG's
         * actual IDs.
         *
         * We do NOT do:
         *
         * vehicles[trackingKey]
         *
         * because trackingKey may represent a personnel tracker.
         */
        const vehicle = log.vehicle_id ? vehicles[log.vehicle_id] : undefined;

        const personnelInfo = findPersonnel(personnel, log.personnel_id);

        /*
         * DO NOT discard the GPS marker if metadata
         * isn't available.
         *
         * The PatrolLog itself contains a valid GPS position.
         */
        if (!vehicle && !personnelInfo) {
          console.warn("Creating tracking marker without metadata:", {
            trackingKey,
            vehicleId: log.vehicle_id,
            personnelId: log.personnel_id,
          });
        }

        const lat = Number(log.latitude);
        const lng = Number(log.longitude);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return;
        }

        activeMarkerIds.add(trackingKey);

        const position = getOffsetPosition(lat, lng, index, sortedGroup.length);

        const markerStatus = getMarkerStatus(log);
        const markerColors = markerColorMap[markerStatus];

        const isEmergency = markerStatus === "emergency";

        let entry = markersRef.current.get(trackingKey);

        /* ======================================================
           CREATE MARKER
        ====================================================== */

        if (!entry) {
          const element = document.createElement("div");

          element.className = [
            "flex",
            "h-10",
            "w-10",
            "cursor-pointer",
            "items-center",
            "justify-center",
            "rounded-full",
            "border-2",
            "shadow-md",
            "select-none",
          ].join(" ");

          /*
           * These styles prevent browser drag behavior and
           * reduce visual jumping when the Google Map itself
           * is being dragged.
           */
          element.style.width = "40px";
          element.style.height = "40px";
          element.style.userSelect = "none";
          element.style.webkitUserSelect = "none";
          element.style.cursor = "pointer";
          element.style.touchAction = "none";
          element.style.transformOrigin = "center";
          element.style.transition = "transform 120ms ease";
          element.style.willChange = "transform";
          element.draggable = false;

          /* ====================================================
             ICON CONTAINER
          ==================================================== */

          const iconContainer = document.createElement("span");

          iconContainer.style.display = "flex";
          iconContainer.style.alignItems = "center";
          iconContainer.style.justifyContent = "center";
          iconContainer.style.width = "20px";
          iconContainer.style.height = "20px";
          iconContainer.style.pointerEvents = "none";
          iconContainer.style.flexShrink = "0";

          const IconComponent = getIconForDutyType(log.duty_type);

          iconContainer.innerHTML = renderToStaticMarkup(
            <IconComponent size={20} strokeWidth={2.5} />,
          );

          element.appendChild(iconContainer);

          /* ====================================================
             CLICK HANDLER
          ==================================================== */

          const clickHandler = (event: Event) => {
            event.stopPropagation();

            // ------------------------------------------------------------
            // DO NOT assume the logs object is keyed by trackingKey.
            // Find the actual PatrolLog by vehicle_id/personnel_id.
            // ------------------------------------------------------------

            const currentLog = Object.values(logsRef.current).find(
              (candidate) => {
                const identity = getTrackingIdentity(candidate);

                return identity.trackingKey === trackingKey;
              },
            );

            if (!currentLog) {
              console.warn("Unable to find log for clicked marker:", {
                trackingKey,
              });

              return;
            }

            const currentLat = Number(currentLog.latitude);
            const currentLng = Number(currentLog.longitude);

            if (!Number.isFinite(currentLat) || !Number.isFinite(currentLng)) {
              console.warn("Invalid coordinates for clicked marker:", {
                trackingKey,
                latitude: currentLog.latitude,
                longitude: currentLog.longitude,
              });

              return;
            }

            // ------------------------------------------------------------
            // Recalculate the marker's offset position.
            // ------------------------------------------------------------

            const currentKey = `${currentLat.toFixed(5)},${currentLng.toFixed(5)}`;

            const currentGroup =
              groupedMarkersRef.current.get(currentKey) || [];

            const currentSortedGroup = [...currentGroup].sort((a, b) =>
              a.trackingKey.localeCompare(b.trackingKey),
            );

            const currentIndex = currentSortedGroup.findIndex(
              (item) => item.trackingKey === trackingKey,
            );

            const currentPosition = getOffsetPosition(
              currentLat,
              currentLng,
              Math.max(currentIndex, 0),
              Math.max(currentSortedGroup.length, 1),
            );

            // ------------------------------------------------------------
            // THIS OPENS THE INFO WINDOW / MODAL
            // ------------------------------------------------------------

            onSelectRef.current({
              trackingId:
                currentLog.vehicle_id || currentLog.personnel_id || trackingKey,
              trackingKey,
              log: currentLog,
              position: currentPosition,
            });
          };

          /* ====================================================
             HOVER HANDLERS
          ==================================================== */

          const mouseEnterHandler = () => {
            element.style.transform = "scale(1.10)";
          };

          const mouseLeaveHandler = () => {
            element.style.transform = "scale(1)";
          };

          element.addEventListener("click", clickHandler);

          element.addEventListener("mouseenter", mouseEnterHandler);

          element.addEventListener("mouseleave", mouseLeaveHandler);

          /* ====================================================
             ADVANCED MARKER
          ==================================================== */

          const displayTitle =
            vehicle?.plate_number ||
            personnelInfo?.fullname ||
            "Tracking Marker";

          const marker = new google.maps.marker.AdvancedMarkerElement({
            map,
            position,
            content: element,
            title: displayTitle,
            zIndex: 100,
            gmpClickable: true,
          });

          entry = {
            marker,
            element,
            iconContainer,
            clickHandler,
            mouseEnterHandler,
            mouseLeaveHandler,
          };

          markersRef.current.set(trackingKey, entry);
        }

        if (!entry) {
          return;
        }

        /* ======================================================
            REATTACH MARKER TO THE CURRENT MAP
          ====================================================== */

        // Important when navigating between pages that use
        // different Google Maps instances.
        if (entry.marker.map !== map) {
          entry.marker.map = map;
        }

        /* ======================================================
            UPDATE EXISTING MARKER
          ====================================================== */

        entry.marker.position = position;

        entry.marker.title =
          vehicle?.plate_number || personnelInfo?.fullname || "Tracking Marker";

        entry.marker.zIndex = isEmergency ? 200 : 100;

        /* ======================================================
           RESET VISUAL CLASSES
        ====================================================== */

        entry.element.className = [
          "flex",
          "h-10",
          "w-10",
          "cursor-pointer",
          "items-center",
          "justify-center",
          "rounded-full",
          "border-2",
          "shadow-md",
          "select-none",
        ].join(" ");

        /* ======================================================
           APPLY STATUS
        ====================================================== */

        entry.element.style.border = `2px solid ${markerColors.border}`;
        entry.element.style.backgroundColor = markerColors.background;
        entry.element.style.color = markerColors.icon;

        entry.element.style.boxShadow = isEmergency
          ? "0 0 0 4px rgba(220, 38, 38, 0.20), 0 4px 8px rgba(0,0,0,0.25)"
          : "0 2px 6px rgba(0,0,0,0.25)";

        entry.marker.zIndex = isEmergency
          ? 200
          : markerStatus === "moving"
            ? 150
            : 100;

        /* ======================================================
           UPDATE ICON
        ====================================================== */

        const CurrentIconComponent = getIconForDutyType(log.duty_type);

        entry.iconContainer.innerHTML = renderToStaticMarkup(
          <CurrentIconComponent size={20} strokeWidth={2.5} />,
        );
      });
    });

    /* ==========================================================
       REMOVE MARKERS NO LONGER ACTIVE
    ========================================================== */

    markersRef.current.forEach((entry, trackingKey) => {
      if (!activeMarkerIds.has(trackingKey)) {
        entry.marker.map = null;

        entry.element.removeEventListener("click", entry.clickHandler);

        entry.element.removeEventListener(
          "mouseenter",
          entry.mouseEnterHandler,
        );

        entry.element.removeEventListener(
          "mouseleave",
          entry.mouseLeaveHandler,
        );

        entry.element.remove();

        markersRef.current.delete(trackingKey);
      }
    });
  }, [map, groupedMarkers, vehicles, logs, personnel]);

  /* ============================================================
     CLEANUP
  ============================================================ */

  useEffect(() => {
    return () => {
      markersRef.current.forEach((entry) => {
        entry.marker.map = null;

        entry.element.removeEventListener("click", entry.clickHandler);

        entry.element.removeEventListener(
          "mouseenter",
          entry.mouseEnterHandler,
        );

        entry.element.removeEventListener(
          "mouseleave",
          entry.mouseLeaveHandler,
        );

        entry.element.remove();
      });

      markersRef.current.clear();
    };
  }, []);

  return null;
});

/* ============================================================
   MAIN TRACKING MAP
============================================================ */

function TrackingMap({ vehicles, logs, personnel }: MapProps) {
  const [selectedMarker, setSelectedMarker] = useState<SelectedMarker | null>(
    null,
  );
  /*
   * IMPORTANT:
   *
   * These refs are intentionally NOT passed to <GoogleMap>
   * as center/zoom props.
   *
   * This prevents React realtime updates from repeatedly
   * controlling the camera while the user is dragging/
   * zooming the map.
   */
  const centerRef = useRef<Position>(DEFAULT_CENTER);

  const zoomRef = useRef<number>(DEFAULT_ZOOM);

  const mapRef = useRef<google.maps.Map | null>(null);

  /* ============================================================
     LOAD GOOGLE MAPS API
  ============================================================ */

  const { isLoaded, loadError } = useJsApiLoader(GOOGLE_MAPS_LOADER_OPTIONS);

  const [isMarkerLibraryReady, setIsMarkerLibraryReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!isLoaded) {
      setIsMarkerLibraryReady(false);
      return;
    }

    google.maps
      .importLibrary("marker")
      .then(() => {
        if (!cancelled) {
          setIsMarkerLibraryReady(true);
        }
      })
      .catch((error) => {
        console.error("Failed to load Google Maps marker library:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded]);

  const isApiReady = isLoaded && isMarkerLibraryReady;

  /* ============================================================
     MAP LOAD
  ============================================================ */

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;

    requestAnimationFrame(() => {
      if (!window.google?.maps) {
        return;
      }

      google.maps.event.trigger(map, "resize");

      /*
       * Set the initial camera only once when the map
       * becomes available.
       *
       * Realtime marker updates do not modify the map
       * camera.
       */
      map.setCenter(centerRef.current);

      map.setZoom(zoomRef.current);
    });
  }, []);

  /* ============================================================
     MAP UNMOUNT
  ============================================================ */

  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  /* ============================================================
     MARKER SELECTION
  ============================================================ */

  const handleSelectMarker = useCallback((marker: SelectedMarker) => {
    setSelectedMarker(marker);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedMarker(null);
  }, []);

  /* ============================================================
     API LOADING STATE
  ============================================================ */

  if (!isApiReady) {
    return (
      <div className="flex h-full min-h-[500px] w-full items-center justify-center rounded-3xl border border-slate-200 bg-slate-100 font-medium text-slate-400 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        Connecting to Map API...
      </div>
    );
  }

  /* ============================================================
     MAP
  ============================================================ */

  return (
    <div className="relative h-full min-h-[500px] w-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <GoogleMap
        mapContainerStyle={containerStyle}
        options={mapOptions}
        mapTypeId="hybrid"
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={() => {
          setSelectedMarker(null);
        }}
      >
        <TrackingMarkers
          vehicles={vehicles}
          logs={logs}
          personnel={personnel}
          onSelect={handleSelectMarker}
        />

        {selectedMarker && (
          <TrackingInfoWindow
            selectedMarker={selectedMarker}
            vehicles={vehicles}
            personnel={personnel}
            onClose={handleClose}
          />
        )}
      </GoogleMap>
    </div>
  );
}

/* ============================================================
   TRACKING INFO WINDOW
============================================================ */

const TrackingInfoWindow = React.memo(function TrackingInfoWindow({
  selectedMarker,
  vehicles,
  personnel,
  onClose,
}: {
  selectedMarker: SelectedMarker;
  vehicles: Record<string, MobilityAsset>;
  personnel: Record<string, Personnel>;
  onClose: () => void;
}) {
  const { trackingId, log, position } = selectedMarker;

  /*
   * IMPORTANT:
   *
   * Resolve vehicle from log.vehicle_id.
   *
   * Do NOT use:
   *
   * vehicles[trackingId]
   *
   * because trackingId may actually be a
   * personnel_id when vehicle_id is null.
   */
  const vehicle = log.vehicle_id ? vehicles[log.vehicle_id] : undefined;

  const personnelInfo = findPersonnel(personnel, log.personnel_id);

  const lastUpdated = new Date(log.captured_at);

  const isStale = Date.now() - lastUpdated.getTime() > 5 * 60 * 1000;

  /* ==========================================================
       DISPLAY NAME
    ========================================================== */

  const personnelDisplayName = [
    personnelInfo?.rank?.rank_name,
    personnelInfo?.fullname,
  ]
    .filter(Boolean)
    .join(" ");

  const displayName =
    vehicle?.plate_number || personnelDisplayName || "Unknown Asset";

  /* ==========================================================
       UNIT
    ========================================================== */

  const unitName =
    vehicle?.unit?.unit_name ||
    personnelInfo?.unit?.unit_name ||
    "Unassigned Unit";

  /* ==========================================================
       STATUS
    ========================================================== */

  const markerStatus = getMarkerStatus(log);

  const statusText = {
    emergency: "EMERGENCY",
    offline: "OFFLINE",
    moving: "MOVING",
    stationary: "NOT MOVING",
  }[markerStatus];

  /* ==========================================================
       HISTORY TARGET
    ========================================================== */

  /*
   * vehicle_id is preferred because the existing
   * /trackingmap/:id route historically represents a
   * mobility asset.
   *
   * If this is a personnel-only tracker, trackingId
   * becomes the personnel ID.
   *
   * This preserves your existing route structure while
   * ensuring the correct ID is passed.
   */
  const historyId = log.vehicle_id || log.personnel_id || trackingId;

  return (
    <OverlayViewF
      position={position}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      zIndex={999999}
    >
      <div className="relative min-w-[280px] max-w-[340px] -translate-x-1/2 -translate-y-full rounded-xl border border-slate-200 bg-white p-3 font-sans text-slate-900 shadow-xl">
        {/* HEADER */}
        <div className="mb-3 border-b border-slate-200 pb-3">
          <p className="text-lg font-black tracking-tight">{displayName}</p>

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-slate-600">{unitName}</span>

            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                isStale
                  ? "bg-slate-100 text-slate-600"
                  : log.status === "Moving"
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
              }`}
            >
              {statusText}
            </span>
          </div>
        </div>

        {/* DETAILS */}
        <div className="space-y-2.5 text-sm">
          {vehicle?.description && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-slate-500">
                <Notebook className="h-4 w-4 shrink-0" />
                <span className="font-medium">Description</span>
              </div>
              <span className="break-words text-right font-bold">
                {vehicle.description}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-slate-500">
              <Navigation className="h-4 w-4 shrink-0" />
              <span className="font-medium">Current Speed</span>
            </div>
            <span className="shrink-0 font-black">
              {Number(log.speed ?? 0).toFixed(1)} km/h
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-slate-500">
              <Network className="h-4 w-4 shrink-0" />
              <span className="font-medium">Network Signal</span>
            </div>
            <span className="shrink-0 font-black">
              {log.network_signal > 5
                ? log.network_signal
                : `${log.network_signal}/4`}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-slate-500">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span className="font-medium">Duty Type</span>
            </div>
            <span className="text-right font-black">{log.duty_type}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-slate-500">
              <Signal className="h-4 w-4 shrink-0" />
              <span className="font-medium">Last Update</span>
            </div>
            <span className="shrink-0 text-right font-bold">
              {formatDistanceToNow(lastUpdated)} ago
            </span>
          </div>
        </div>

        {/* HISTORY */}
        {historyId && (
          <Link
            to={`/trackingmap/${historyId}`}
            className="mt-4 flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
          >
            View History Replay
          </Link>
        )}

        {/* POINTER */}
        <div className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-slate-200 bg-white" />
      </div>
    </OverlayViewF>
  );
});

/* ============================================================
   EXPORT
============================================================ */

export default React.memo(TrackingMap);
