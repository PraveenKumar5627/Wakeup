/**
 * API client to communicate with the FastAPI backend.
 */

// Default backend URL: can be overridden via environment or localStorage if testing on mobile over Wi-Fi
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? `http://${window.location.hostname}:8000`
    : 'http://localhost:8000');

/**
 * Sends current location and destination coordinates to the FastAPI backend
 * to calculate straight-line distance and check alert status.
 *
 * @param {Object} params
 * @param {number} params.currentLat
 * @param {number} params.currentLng
 * @param {number} params.destLat
 * @param {number} params.destLng
 * @param {number} params.alertDistance
 * @returns {Promise<{distance_km: number, alert: boolean, message: string}>}
 */
export async function calculateDistance({
  currentLat,
  currentLng,
  destLat,
  destLng,
  alertDistance,
}) {
  const payload = {
    current_latitude: Number(currentLat),
    current_longitude: Number(currentLng),
    destination_latitude: Number(destLat),
    destination_longitude: Number(destLng),
    alert_distance: Number(alertDistance),
  };

  const response = await fetch(`${BACKEND_URL}/calculate-distance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.detail || `Server returned error status ${response.status}`;
    throw new Error(message);
  }

  return await response.json();
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
