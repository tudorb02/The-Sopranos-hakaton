// The parcel map: Esri World Imagery satellite tiles with place names on top, no API key. VITE_MAP_TILES (a JSON array
// of { url, attribution }) replaces them. Without internet the tiles fail and the parcels stay on the plain background
// of the map, so the step still works offline (CLAUDE.md rule 3).

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
const DEFAULT_TILES = [
  { url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, attribution: "Imagery © Esri, Maxar, Earthstar Geographics and the GIS User Community" },
  { url: `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`, attribution: "Places © Esri" },
];

function tilesFromEnv() {
  const raw = typeof import.meta !== "undefined" ? import.meta.env?.VITE_MAP_TILES : undefined;
  if (!raw) return null;
  try {
    const tiles = JSON.parse(raw);
    return Array.isArray(tiles) && tiles.every((t) => typeof t.url === "string") ? tiles : null;
  } catch {
    return null;
  }
}

export const MAP_TILES = tilesFromEnv() ?? DEFAULT_TILES;
export const PARCELS_ATTRIBUTION = "Parcels © OpenStreetMap contributors (ODbL)";
export const ROMANIA_BOUNDS = [
  [43.6, 20.2],
  [48.3, 29.8],
];
// At this zoom and below the polygons are a few pixels wide; a marker at the farm shows where it is in the country.
export const MARKER_MAX_ZOOM = 11;
