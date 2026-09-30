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

// Send location data to the backend
export async function calculateDistance({
  currentLat,
  currentLng,
  destLat,
  destLng,
  alertDistance,
}) {
  const response = await fetch(`${API_URL}/calculate-distance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      alert_distance: alertDistance,
      current_latitude: currentLat,
      current_longitude: currentLng,
      destination_latitude: destLat,
      destination_longitude: destLng,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Backend error ${response.status}: ${errorText}`
    );
  }

  return await response.json();
}