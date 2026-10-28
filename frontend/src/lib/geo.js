// GeoJSON parcels to SVG: a plain equirectangular projection fitted to the box, no tiles, so the map works offline.

function polygonsOf(geometry) {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

export function projectParcels(collection, width = 320, height = 190, pad = 10) {
  const points = collection.features.flatMap((f) => polygonsOf(f.geometry).flatMap((polygon) => polygon.flat()));
  if (!points.length) return [];
  const lons = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  const [minLon, maxLon, minLat, maxLat] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  // one degree of longitude is shorter than one of latitude, by cos(latitude)
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = Math.max((maxLon - minLon) * kx, 1e-9);
  const spanY = Math.max(maxLat - minLat, 1e-9);
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;
  const project = ([lon, lat]) => [offsetX + (lon - minLon) * kx * scale, offsetY + (maxLat - lat) * scale];

  return collection.features.map((feature) => {
    const projected = polygonsOf(feature.geometry).map((polygon) => polygon.map((ring) => ring.map(project)));
    const outer = projected.flatMap((polygon) => polygon[0]);
    const cx = outer.reduce((sum, p) => sum + p[0], 0) / outer.length;
    const cy = outer.reduce((sum, p) => sum + p[1], 0) / outer.length;
    const path = projected
      .map((polygon) => polygon.map((ring) => `M${ring.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L")}Z`).join(""))
      .join("");
    return { id: feature.id, props: feature.properties, path, center: [cx, cy] };
  });
}
