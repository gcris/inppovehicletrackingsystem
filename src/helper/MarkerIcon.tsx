import {
  Bike,
  Car,
  Footprints,
  LucideIcon,
  Motorbike,
  Radio,
  ShieldCheck,
  Siren,
  Star,
  Waves,
} from "lucide-react";
import L from "leaflet";
import { renderToString } from "react-dom/server";

const dutyTypeIconMap: Record<string, LucideIcon> = {
  "Mobile Patrol": Car,
  "TMRU Patrol": Motorbike,
  "Foot Patrol": Footprints,
  "Bike Patrol": Bike,
  "Seaborne Patrol": Waves,
  Checkpoint: ShieldCheck,
  "Simulation Exercise": Radio,
  "Special Event": Star,
  EMERGENCY_SOS: Siren,
};

export const createMarkerIcon = (
  duty_type: string,
  date: string,
  status: string,
  isStale: boolean,
) => {
  if (typeof window === "undefined") return new L.Icon.Default();

  const color =
    duty_type === "EMERGENCY_SOS" ? "#ef4444" : isStale ? "#6b6b6b" : "#10b981";

  const IconComponent = dutyTypeIconMap[duty_type] || Car;
  const logDate = new Date(date);
  const now = new Date();

  const ONE_HOUR_IN_MS = 60 * 60 * 1000;
  const animate_ping = now.getTime() - logDate.getTime() <= ONE_HOUR_IN_MS;

  const innerSvgString = renderToString(
    <IconComponent
      size={duty_type === "EMERGENCY_SOS" ? 40 : 25}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />,
  );

  return L.divIcon({
    className: "custom-div-icon",
    html: `
      <div class="relative flex items-center justify-center" style="position: relative; display: flex; align-items: center; justify-content: center;">
        ${
          duty_type === "EMERGENCY_SOS"
            ? `<div class="absolute w-10 h-10 rounded-full ${animate_ping ? "animate-ping" : ""}" style="position: absolute; width: 60px; height: 60px; border-radius: 50%; background-color: ${!animate_ping ? "green" : color}; opacity: 0.6;"></div>`
            : ""
        }
        <div class="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white" 
             style="width: 42px; height: 42px; border-radius: 50%; border: 2px solid #ffffff; background-color: ${color}; display: flex; align-items: center; justify-content: center; color: #ffffff; ${isStale ? "opacity: 0.8;" : ""}">
          ${innerSvgString}
        </div>
        <div class="absolute -bottom-1 w-2 h-2 rotate-45" style="position: absolute; bottom: -4px; width: 8px; height: 8px; transform: rotate(45deg); background-color: ${color};"></div>
      </div>
    `,
    iconSize: [42, 42],
    iconAnchor: [21, 42],
    popupAnchor: [0, -42],
  });
};
