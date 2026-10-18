export const GOOGLE_MAPS_LIBRARIES: (
    | "places"
    | "geometry"
    | "drawing"
    | "marker"
)[] = ["places", "geometry", "drawing", "marker"];

export const GOOGLE_MAPS_LOADER_OPTIONS = {
    id: "script-loader",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
};
