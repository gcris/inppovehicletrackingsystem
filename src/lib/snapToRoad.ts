export interface Coordinate {
  latitude: number;
  longitude: number;
}

export async function snapToRoad(points: Coordinate[]): Promise<Coordinate[]> {
  try {
    if (points.length === 0) {
      return [];
    }

    const coordinates = points
      .map((p) => `${p.longitude},${p.latitude}`)
      .join(";");

    const url =
      `https://router.project-osrm.org/match/v1/driving/${coordinates}` +
      `?overview=full&geometries=geojson&tidy=true`;

    const response = await fetch(url);

    if (!response.ok) {
      return points;
    }

    const data = await response.json();

    if (!data.matchings?.length) {
      return points;
    }

    return data.matchings[0].geometry.coordinates.map(
      ([lng, lat]: [number, number]) => ({
        latitude: lat,
        longitude: lng,
      }),
    );
  } catch (e) {
    console.warn("Snap to road failed", e);
    return points;
  }
}
