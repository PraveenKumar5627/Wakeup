const API_URL = import.meta.env.VITE_API_BASE_URL;

export async function calculateDistance(data) {
  const response = await fetch(
    `${API_URL}/calculate-distance`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return await response.json();
}