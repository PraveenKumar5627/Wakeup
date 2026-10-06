/**
 * API client to communicate with the FastAPI backend and routing services.
 */

// Backend URL is set via VITE_API_BASE_URL environment variable.
// In production (Vercel), set VITE_API_BASE_URL=https://your-app.onrender.com in the Vercel dashboard.
// Fallback to localhost for local development.
export const BACKEND_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
).replace(/\/+$/, '');

// Cache for road routing to prevent unnecessary API traffic and provide instant updates
const roadRouteCache = new Map();
const CACHE_TTL_MS = 25000; // 25 seconds

/**
 * Format duration minutes into human-readable string (e.g. '5 hr 1 min' or '45 min').
 */
export function formatDuration(durationMinutes) {
  if (!durationMinutes || durationMinutes <= 0) return '';
  const totalMins = Math.round(durationMinutes);
  if (totalMins < 60) return `${totalMins} min`;
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins === 0 ? `${hours} hr` : `${hours} hr ${mins} min`;
}

/**
 * Calculate straight-line spherical distance via Haversine formula (fallback).
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(Math.min(1.0, Math.max(0.0, a))), Math.sqrt(1 - Math.min(1.0, Math.max(0.0, a))));
  return Number((R * c).toFixed(2));
}

/**
 * Fetch actual driving/road distance directly from OpenStreetMap OSRM routing engine.
 * Matches Google Maps driving navigation distance.
 */
export async function fetchOsrmRoadDistance(lat1, lon1, lat2, lon2) {
  if (Math.abs(lat1 - lat2) < 0.0001 && Math.abs(lon1 - lon2) < 0.0001) {
    return {
      distanceKm: 0.0,
      durationMin: 0.0,
      durationText: '0 min',
      routeType: 'road',
    };
  }

  const cacheKey = `${lat1.toFixed(3)},${lon1.toFixed(3)}-${lat2.toFixed(3)},${lon2.toFixed(3)}`;
  const cached = roadRouteCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${lon1.toFixed(6)},${lat1.toFixed(6)};${lon2.toFixed(6)},${lat2.toFixed(6)}?overview=false`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const primary = data.routes[0];
        const distKm = Number((primary.distance / 1000.0).toFixed(2));
        const durMin = Number((primary.duration / 60.0).toFixed(1));
        const durText = formatDuration(durMin);
        const result = {
          distanceKm: distKm,
          durationMin: durMin,
          durationText: durText,
          routeType: 'road',
        };
        roadRouteCache.set(cacheKey, { timestamp: Date.now(), data: result });
        return result;
      }
    }
  } catch (err) {
    console.warn('OSRM road routing direct fetch error:', err);
  }

  return null;
}

/**
 * Calculates real driving/road distance between current location and destination.
 * Checks alert distance threshold and returns human-readable status.
 *
 * @param {Object} params
 * @param {number} params.currentLat
 * @param {number} params.currentLng
 * @param {number} params.destLat
 * @param {number} params.destLng
 * @param {number} params.alertDistance
 * @returns {Promise<{
 *   distance_km: number,
 *   alert: boolean,
 *   message: string,
 *   route_type: string,
 *   duration_min: number|null,
 *   duration_text: string|null,
 *   straight_line_km: number
 * }>}
 */
export async function calculateDistance({
  currentLat,
  currentLng,
  destLat,
  destLng,
  alertDistance,
}) {
  const currentLatitude = Number(currentLat);
  const currentLongitude = Number(currentLng);
  const destinationLatitude = Number(destLat);
  const destinationLongitude = Number(destLng);
  const alertDistKm = Number(alertDistance);

  // Fast baseline straight-line distance
  const straightKm = haversineDistanceKm(
    currentLatitude,
    currentLongitude,
    destinationLatitude,
    destinationLongitude
  );

  let backendResult = null;

  // 1. Try calling the backend API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const payload = {
      current_latitude: currentLatitude,
      current_longitude: currentLongitude,
      destination_latitude: destinationLatitude,
      destination_longitude: destinationLongitude,
      alert_distance: alertDistKm,
    };

    const response = await fetch(`${BACKEND_URL}/calculate-distance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      backendResult = await response.json();
    }
  } catch (err) {
    console.warn('Backend /calculate-distance request notice:', err.message);
  }

  // 2. If the backend returned a road routing distance (route_type === 'road'), use it directly!
  if (backendResult && backendResult.route_type === 'road') {
    return backendResult;
  }

  // 3. If backend returned straight-line (e.g. an older backend build deployed on Render)
  // or if backend was unavailable/sleeping:
  // Fetch real road driving route directly from OSRM to ensure user ALWAYS sees accurate Google Maps road distance!
  const roadData = await fetchOsrmRoadDistance(
    currentLatitude,
    currentLongitude,
    destinationLatitude,
    destinationLongitude
  );

  if (roadData) {
    const isAlert = roadData.distanceKm <= alertDistKm || straightKm <= alertDistKm;
    const durText = roadData.durationText ? ` (~${roadData.durationText})` : '';
    const message = isAlert
      ? `WAKE UP! Your destination is approximately ${roadData.distanceKm} km away${durText} (alert threshold: ${alertDistKm} km). Get ready to get down!`
      : `On the way. You are ${roadData.distanceKm} km (road driving distance)${durText} from destination. Alarm will trigger at ${alertDistKm} km.`;

    return {
      distance_km: roadData.distanceKm,
      alert: isAlert,
      message,
      route_type: 'road',
      duration_min: roadData.durationMin,
      duration_text: roadData.durationText,
      straight_line_km: straightKm,
    };
  }

  // 4. Fallback if road service is unreachable (e.g. offline/no coverage)
  if (backendResult) {
    return backendResult;
  }

  const isAlert = straightKm <= alertDistKm;
  return {
    distance_km: straightKm,
    alert: isAlert,
    message: isAlert
      ? `WAKE UP! Your destination is approximately ${straightKm} km away (straight-line).`
      : `On the way. You are ${straightKm} km from destination.`,
    route_type: 'straight_line',
    duration_min: null,
    duration_text: null,
    straight_line_km: straightKm,
  };
}

/**
 * Health check to verify if the FastAPI server is reachable.
 */
export async function checkBackendHealth() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.ok;
  } catch {
    return false;
  }
}
