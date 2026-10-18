export type PatrolGPSPoint = {
    latitude: number;
    longitude: number;
    captured_at?: string | null;
};

export type CleanRouteOptions = {
    // Reject physically implausible vehicle GPS jumps.
    maxSpeedKmh?: number;

    // Remove isolated GPS spikes when surrounding points support it.
    spikeDistanceMeters?: number;

    // Smooth small deviations on nearly straight sections.
    smoothingThresholdMeters?: number;

    // Ramer-Douglas-Peucker simplification tolerance.
    simplifyToleranceMeters?: number;
};

type Coordinate = {
    lat: number;
    lng: number;
    timestamp: number | null;
};

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(value: number) {
    return (value * Math.PI) / 180;
}

function distanceMeters(a: Coordinate, b: Coordinate): number {
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);
    const deltaLat = toRadians(b.lat - a.lat);
    const deltaLng = toRadians(b.lng - a.lng);

    const h = Math.sin(deltaLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

function pointToSegmentDistance(
    point: Coordinate,
    start: Coordinate,
    end: Coordinate,
): number {
    // Local equirectangular projection, appropriate for short patrol routes.
    const referenceLat = toRadians(point.lat);
    const scaleX = EARTH_RADIUS_METERS * Math.cos(referenceLat);
    const scaleY = EARTH_RADIUS_METERS;

    const px = toRadians(point.lng) * scaleX;
    const py = toRadians(point.lat) * scaleY;
    const ax = toRadians(start.lng) * scaleX;
    const ay = toRadians(start.lat) * scaleY;
    const bx = toRadians(end.lng) * scaleX;
    const by = toRadians(end.lat) * scaleY;

    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
        return distanceMeters(point, start);
    }

    const t = Math.max(
        0,
        Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared),
    );

    const closest = {
        lat: ((ay + t * dy) / scaleY) * (180 / Math.PI),
        lng: ((ax + t * dx) / scaleX) * (180 / Math.PI),
        timestamp: null,
    };

    return distanceMeters(point, closest);
}

function removeImplausibleJumps(
    points: Coordinate[],
    maxSpeedKmh: number,
): Coordinate[] {
    if (points.length < 3) return points;

    const maxSpeedMetersPerSecond = (maxSpeedKmh * 1000) / 3600;
    const keep = points.map(() => true);

    // Preserve endpoints and only remove isolated bad readings.
    for (let i = 1; i < points.length - 1; i++) {
        const previous = points[i - 1];
        const current = points[i];
        const next = points[i + 1];

        const previousToCurrent = distanceMeters(previous, current);
        const currentToNext = distanceMeters(current, next);
        const previousToNext = distanceMeters(previous, next);

        const previousSeconds =
            previous.timestamp !== null && current.timestamp !== null
                ? (current.timestamp - previous.timestamp) / 1000
                : null;

        const nextSeconds =
            current.timestamp !== null && next.timestamp !== null
                ? (next.timestamp - current.timestamp) / 1000
                : null;

        const impossibleFromPrevious = previousSeconds !== null &&
            previousSeconds > 0 &&
            previousToCurrent >
                maxSpeedMetersPerSecond * previousSeconds + 15;

        const impossibleToNext = nextSeconds !== null &&
            nextSeconds > 0 &&
            currentToNext > maxSpeedMetersPerSecond * nextSeconds + 15;

        // Detect a spike that jumps away from a nearby path and back again.
        const isolatedSpike = previousToNext <= 50 &&
            previousToCurrent > 25 &&
            currentToNext > 25 &&
            pointToSegmentDistance(current, previous, next) > 25;

        if (
            (impossibleFromPrevious && impossibleToNext) ||
            isolatedSpike
        ) {
            keep[i] = false;
        }
    }

    return points.filter((_, index) => keep[index]);
}

function smoothSmallDeviations(
    points: Coordinate[],
    thresholdMeters: number,
): Coordinate[] {
    if (points.length < 3 || thresholdMeters <= 0) return points;

    const result = points.map((point) => ({ ...point }));

    for (let i = 1; i < points.length - 1; i++) {
        const previous = points[i - 1];
        const current = points[i];
        const next = points[i + 1];

        const deviation = pointToSegmentDistance(current, previous, next);

        // Only smooth points already close to a straight local path.
        // This avoids smoothing sharp turns and corners.
        if (deviation > 0 && deviation <= thresholdMeters) {
            const midpointLat = (previous.lat + next.lat) / 2;
            const midpointLng = (previous.lng + next.lng) / 2;

            result[i] = {
                ...current,
                lat: current.lat * 0.65 + midpointLat * 0.35,
                lng: current.lng * 0.65 + midpointLng * 0.35,
            };
        }
    }

    return result;
}

function simplifyRoute(
    points: Coordinate[],
    toleranceMeters: number,
): Coordinate[] {
    if (points.length <= 2 || toleranceMeters <= 0) return points;

    const keep = new Set<number>([0, points.length - 1]);

    function simplifySection(startIndex: number, endIndex: number) {
        if (endIndex <= startIndex + 1) return;

        let maxDistance = 0;
        let farthestIndex = -1;

        for (let i = startIndex + 1; i < endIndex; i++) {
            const distance = pointToSegmentDistance(
                points[i],
                points[startIndex],
                points[endIndex],
            );

            if (distance > maxDistance) {
                maxDistance = distance;
                farthestIndex = i;
            }
        }

        if (farthestIndex !== -1 && maxDistance > toleranceMeters) {
            keep.add(farthestIndex);
            simplifySection(startIndex, farthestIndex);
            simplifySection(farthestIndex, endIndex);
        }
    }

    simplifySection(0, points.length - 1);

    return [...keep]
        .sort((a, b) => a - b)
        .map((index) => points[index]);
}

export function cleanPatrolRoute(
    input: PatrolGPSPoint[],
    options: CleanRouteOptions = {},
): google.maps.LatLngLiteral[] {
    const {
        maxSpeedKmh = 140,
        spikeDistanceMeters = 25,
        smoothingThresholdMeters = 8,
        simplifyToleranceMeters = 5,
    } = options;

    const validPoints: Coordinate[] = input
        .map((point) => {
            const lat = Number(point.latitude);
            const lng = Number(point.longitude);
            const parsedTime = point.captured_at
                ? Date.parse(point.captured_at)
                : NaN;

            return {
                lat,
                lng,
                timestamp: Number.isFinite(parsedTime) ? parsedTime : null,
            };
        })
        .filter(
            (point) =>
                Number.isFinite(point.lat) &&
                Number.isFinite(point.lng) &&
                point.lat >= -90 &&
                point.lat <= 90 &&
                point.lng >= -180 &&
                point.lng <= 180,
        )
        .sort((a, b) => {
            if (a.timestamp === null || b.timestamp === null) return 0;
            return a.timestamp - b.timestamp;
        });

    if (validPoints.length < 3) {
        return validPoints.map(({ lat, lng }) => ({ lat, lng }));
    }

    // Remove exact/near duplicates.
    const deduplicated: Coordinate[] = [];

    for (const point of validPoints) {
        const previous = deduplicated[deduplicated.length - 1];

        if (!previous || distanceMeters(previous, point) >= 1.5) {
            deduplicated.push(point);
        }
    }

    if (deduplicated.length < 3) {
        return deduplicated.map(({ lat, lng }) => ({ lat, lng }));
    }

    const withoutJumps = removeImplausibleJumps(
        deduplicated,
        maxSpeedKmh,
    );

    // If filtering removes too many points, retain the deduplicated trace.
    const safePoints = withoutJumps.length >= 2 &&
            withoutJumps.length >= Math.ceil(deduplicated.length * 0.5)
        ? withoutJumps
        : deduplicated;

    const smoothed = smoothSmallDeviations(
        safePoints,
        smoothingThresholdMeters,
    );

    const simplified = simplifyRoute(
        smoothed,
        simplifyToleranceMeters,
    );

    return simplified.map(({ lat, lng }) => ({ lat, lng }));
}
