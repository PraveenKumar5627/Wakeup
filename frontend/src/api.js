const API_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "https://travel-destination-alarm.onrender.com"
).replace(/\/+$/, "");

// Check whether the deployed backend is online
export async function checkBackendHealth() {
  try {
    const response = await fetch(`${API_URL}/health`);
    return response.ok;
  } catch (error) {
    console.error("Backend health check failed:", error);
    return false;
  }
}

// Send location data to the backend or fallback to OSRM road distance
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

  // Fast local Haversine straight-line distance (0ms)
  const R = 6371.0;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(destinationLatitude - currentLatitude);
  const dLon = toRad(destinationLongitude - currentLongitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(currentLatitude)) * Math.cos(toRad(destinationLatitude)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(Math.min(1.0, Math.max(0.0, a))), Math.sqrt(1 - Math.min(1.0, Math.max(0.0, a))));
  const straightKm = Number((R * c).toFixed(2));

  // 1. OSRM Direct driving route (~150ms)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${currentLongitude.toFixed(6)},${currentLatitude.toFixed(6)};${destinationLongitude.toFixed(6)},${destinationLatitude.toFixed(6)}?overview=false`;
    const res = await fetch(osrmUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const roadDistKm = Number((data.routes[0].distance / 1000.0).toFixed(2));
        const durMin = Number((data.routes[0].duration / 60.0).toFixed(1));
        const isAlert = roadDistKm <= alertDistKm;
        return {
          distance_km: roadDistKm,
          alert: isAlert,
          message: isAlert ? "WAKE UP! You are near your stop!" : `On the way: ${roadDistKm} km`,
          route_type: "road",
          duration_min: durMin,
          straight_line_km: straightKm,
        };
      }
    }
  } catch {}

  // 2. Fast Backend fallback with 1.2s timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const response = await fetch(`${API_URL}/calculate-distance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alert_distance: alertDistKm,
        current_latitude: currentLatitude,
        current_longitude: currentLongitude,
        destination_latitude: destinationLatitude,
        destination_longitude: destinationLongitude,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const backendResult = await response.json();
      if (backendResult) return backendResult;
    }
  } catch {}

  // 3. Instant Haversine fallback (0ms)
  return {
    distance_km: straightKm,
    alert: straightKm <= alertDistKm,
    message: "On the way.",
    route_type: "straight_line",
    duration_min: Math.round(straightKm * 2.0),
    straight_line_km: straightKm,
  };
}