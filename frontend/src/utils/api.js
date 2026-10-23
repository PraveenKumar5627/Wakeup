/**
 * API client to communicate with the FastAPI backend and routing services.
 */

// Backend URL is set via VITE_API_BASE_URL environment variable.
// In production (Vercel), set VITE_API_BASE_URL=https://your-app.onrender.com in the Vercel dashboard.
// Fallback to localhost for local development.
export const BACKEND_URL = (
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'http://localhost:8000'
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
 * Strictly guards against invalid, negative, NaN, or non-finite coordinate values.
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return 0.0;
  }

  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);

  if (
    !Number.isFinite(nLat1) ||
    !Number.isFinite(nLon1) ||
    !Number.isFinite(nLat2) ||
    !Number.isFinite(nLon2)
  ) {
    return 0.0;
  }

  // Same coordinates or negligible distance (< 5 meters)
  if (Math.abs(nLat1 - nLat2) < 0.00005 && Math.abs(nLon1 - nLon2) < 0.00005) {
    return 0.0;
  }

  const R = 6371.0;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(nLat2 - nLat1);
  const dLon = toRad(nLon2 - nLon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(nLat1)) * Math.cos(toRad(nLat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const safeA = Math.min(1.0, Math.max(0.0, a));
  const c = 2 * Math.atan2(Math.sqrt(safeA), Math.sqrt(Math.max(0.0, 1.0 - safeA)));
  const dist = Number((R * c).toFixed(2));
  return Number.isFinite(dist) && !Number.isNaN(dist) ? Math.max(0, dist) : 0.0;
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const url = `https://router.project-osrm.org/route/v1/driving/${lon1.toFixed(6)},${lat1.toFixed(6)};${lon2.toFixed(6)},${lat2.toFixed(6)}?overview=false`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const primary = data.routes[0];
        const distKm = Math.max(0, Number((primary.distance / 1000.0).toFixed(2)));
        const durMin = Math.max(0, Number((primary.duration / 60.0).toFixed(1)));
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
    console.warn('OSRM road routing direct fetch notice:', err?.message || err);
  }

  return null;
}

/**
 * Calculates real driving/road distance between current location and destination.
 * Checks alert distance threshold, computes travelled distance from start,
 * synchronizes with FastAPI backend when reachable, and falls back seamlessly.
 *
 * @param {Object} params
 * @param {number} params.currentLat
 * @param {number} params.currentLng
 * @param {number} params.destLat
 * @param {number} params.destLng
 * @param {number} params.alertDistance
 * @param {number} [params.startLat]
 * @param {number} [params.startLng]
 * @returns {Promise<{
 *   distance_km: number,
 *   alert: boolean,
 *   message: string,
 *   route_type: string,
 *   duration_min: number|null,
 *   duration_text: string|null,
 *   straight_line_km: number,
 *   travelled_distance_km: number,
 *   initial_distance_km: number
 * }>}
 */
export async function calculateDistance({
  currentLat,
  currentLng,
  destLat,
  destLng,
  alertDistance,
  startLat,
  startLng,
}) {
  const currentLatitude = Number(currentLat);
  const currentLongitude = Number(currentLng);
  const destinationLatitude = Number(destLat);
  const destinationLongitude = Number(destLng);
  const alertDistKm = Math.max(0.1, Number(alertDistance) || 3.0);

  // 1. Instant baseline straight-line distance (0ms, 100% reliable)
  const straightKm = haversineDistanceKm(
    currentLatitude,
    currentLongitude,
    destinationLatitude,
    destinationLongitude
  );

  // Calculate local travelled distance fallback
  let localTravelledKm = 0.0;
  if (startLat != null && startLng != null) {
    localTravelledKm = haversineDistanceKm(
      Number(startLat),
      Number(startLng),
      currentLatitude,
      currentLongitude
    );
  }

  // 2. Try Backend API first if reachable (handles OSRM road routing + travelled distance in one trip)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2800);

    const payload = {
      current_latitude: currentLatitude,
      current_longitude: currentLongitude,
      destination_latitude: destinationLatitude,
      destination_longitude: destinationLongitude,
      alert_distance: alertDistKm,
      start_latitude: startLat != null ? Number(startLat) : undefined,
      start_longitude: startLng != null ? Number(startLng) : undefined,
    };

    const response = await fetch(`${BACKEND_URL}/calculate-distance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const backendResult = await response.json();
      if (backendResult && Number.isFinite(backendResult.distance_km)) {
        return {
          distance_km: Math.max(0, Number(backendResult.distance_km)),
          alert: Boolean(backendResult.alert),
          message: backendResult.message || '',
          route_type: backendResult.route_type || 'road',
          duration_min: backendResult.duration_min != null ? Math.max(0, Number(backendResult.duration_min)) : null,
          duration_text: backendResult.duration_text || '',
          straight_line_km: Math.max(0, Number(backendResult.straight_line_km ?? straightKm)),
          travelled_distance_km: Math.max(0, Number(backendResult.travelled_distance_km ?? localTravelledKm)),
          initial_distance_km: backendResult.initial_distance_km != null ? Math.max(0, Number(backendResult.initial_distance_km)) : straightKm,
        };
      }
    }
  } catch (err) {
    // Backend offline or slow network: continue to client fallback
  }

  // 3. Client OSRM road driving fallback
  const roadData = await fetchOsrmRoadDistance(
    currentLatitude,
    currentLongitude,
    destinationLatitude,
    destinationLongitude
  );

  if (roadData) {
    const distKm = Math.max(0, roadData.distanceKm);
    const isAlert = distKm <= alertDistKm;
    const durText = roadData.durationText ? ` (~${roadData.durationText})` : '';
    const message = isAlert
      ? `WAKE UP! Your destination is approximately ${distKm} km away${durText} (alert threshold: ${alertDistKm} km). Get ready to get down!`
      : `On the way. You are ${distKm} km (road driving distance)${durText} from destination. Alarm will trigger at ${alertDistKm} km.`;

    return {
      distance_km: distKm,
      alert: isAlert,
      message,
      route_type: 'road',
      duration_min: roadData.durationMin,
      duration_text: roadData.durationText,
      straight_line_km: straightKm,
      travelled_distance_km: Math.max(0, localTravelledKm),
      initial_distance_km: distKm,
    };
  }

  // 4. Straight-line Haversine fallback (when routing services are unreachable or offline)
  const isAlert = straightKm <= alertDistKm;
  const estimatedMin = Math.round(straightKm * 2.0);
  return {
    distance_km: straightKm,
    alert: isAlert,
    message: isAlert
      ? `WAKE UP! Your destination is approximately ${straightKm} km away (straight-line). Get ready to get down!`
      : `On the way. You are ${straightKm} km (straight-line) from destination. Alarm will trigger at ${alertDistKm} km.`,
    route_type: 'straight_line',
    duration_min: estimatedMin,
    duration_text: `${estimatedMin} min`,
    straight_line_km: straightKm,
    travelled_distance_km: Math.max(0, localTravelledKm),
    initial_distance_km: straightKm,
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

// ---------------------------------------------------------------------------
// Trip Persistence & Offline Storage
// ---------------------------------------------------------------------------
const LOCAL_STORAGE_TRIPS_KEY = 'arrivo_saved_trips_v2';

export const SEED_TRIPS = [
  {
    id: 'trip-cbe-1',
    destination_name: 'Coimbatore',
    destination_city: 'Tamil Nadu',
    destination_latitude: 11.0168,
    destination_longitude: 76.9558,
    start_latitude: 11.0503,
    start_longitude: 77.0310,
    alert_distance_km: 3.0,
    distance_at_start_km: 5.0,
    status: 'completed',
    start_time: 'Today, 09:55 AM',
    end_time: 'Today, 10:15 AM',
    duration_text: '~ 20 min',
    alarm_triggered: true,
    created_at: 'Today, 10:15 AM',
  },
  {
    id: 'trip-chn-2',
    destination_name: 'Chennai',
    destination_city: 'Tamil Nadu',
    destination_latitude: 13.0827,
    destination_longitude: 80.2707,
    start_latitude: 13.0067,
    start_longitude: 80.2206,
    alert_distance_km: 2.0,
    distance_at_start_km: 14.5,
    status: 'completed',
    start_time: 'Yesterday, 06:10 PM',
    end_time: 'Yesterday, 06:45 PM',
    duration_text: '~ 35 min',
    alarm_triggered: true,
    created_at: 'Yesterday, 6:45 PM',
  },
  {
    id: 'trip-mdu-3',
    destination_name: 'Madurai',
    destination_city: 'Tamil Nadu',
    destination_latitude: 9.9252,
    destination_longitude: 78.1198,
    start_latitude: 9.9800,
    start_longitude: 78.1500,
    alert_distance_km: 3.0,
    distance_at_start_km: 8.4,
    status: 'completed',
    start_time: '12 Oct 2025, 02:00 PM',
    end_time: '12 Oct 2025, 02:30 PM',
    duration_text: '~ 30 min',
    alarm_triggered: true,
    created_at: '12 Oct 2025, 2:30 PM',
  },
  {
    id: 'trip-try-4',
    destination_name: 'Tiruchirappalli',
    destination_city: 'Tamil Nadu',
    destination_latitude: 10.7905,
    destination_longitude: 78.7047,
    start_latitude: 10.8500,
    start_longitude: 78.7200,
    alert_distance_km: 5.0,
    distance_at_start_km: 12.0,
    status: 'completed',
    start_time: '5 Oct 2025, 10:40 AM',
    end_time: '5 Oct 2025, 11:20 AM',
    duration_text: '~ 40 min',
    alarm_triggered: true,
    created_at: '5 Oct 2025, 11:20 AM',
  },
  {
    id: 'trip-slm-5',
    destination_name: 'Salem',
    destination_city: 'Tamil Nadu',
    destination_latitude: 11.6643,
    destination_longitude: 78.1460,
    start_latitude: 11.7000,
    start_longitude: 78.1800,
    alert_distance_km: 2.0,
    distance_at_start_km: 6.2,
    status: 'completed',
    start_time: '2 Oct 2025, 04:45 PM',
    end_time: '2 Oct 2025, 05:10 PM',
    duration_text: '~ 25 min',
    alarm_triggered: true,
    created_at: '2 Oct 2025, 5:10 PM',
  },
];

export async function fetchTrips() {
  // 1. Try local cache first for instant render
  let localTrips = [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TRIPS_KEY);
    if (raw) {
      localTrips = JSON.parse(raw);
    }
  } catch (e) {
    console.warn('LocalStorage trips read error:', e);
  }

  // 2. Try fetching from backend
  try {
    const res = await fetch(`${BACKEND_URL}/trips`, { timeout: 3000 });
    if (res.ok) {
      const serverTrips = await res.json();
      if (Array.isArray(serverTrips) && serverTrips.length > 0) {
        localStorage.setItem(LOCAL_STORAGE_TRIPS_KEY, JSON.stringify(serverTrips));
        return serverTrips;
      }
    }
  } catch (err) {
    // Backend unavailable, fallback to local
  }

  if (localTrips && localTrips.length > 0) {
    return localTrips;
  }

  // Fallback to seed trips
  localStorage.setItem(LOCAL_STORAGE_TRIPS_KEY, JSON.stringify(SEED_TRIPS));
  return SEED_TRIPS;
}

export async function saveTrip(tripData) {
  const tripItem = {
    ...tripData,
    id: tripData.id || `trip-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    created_at: tripData.created_at || 'Just now',
  };

  // Update local storage immediately
  try {
    const existing = await fetchTrips();
    const updated = [tripItem, ...existing.filter((t) => t.id !== tripItem.id)];
    localStorage.setItem(LOCAL_STORAGE_TRIPS_KEY, JSON.stringify(updated));
  } catch (e) {}

  // Sync with backend
  try {
    await fetch(`${BACKEND_URL}/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tripItem),
    });
  } catch (err) {
    console.warn('Backend trip save sync notice:', err.message);
  }

  return tripItem;
}

export async function deleteTrip(tripId) {
  try {
    const existing = await fetchTrips();
    const filtered = existing.filter((t) => t.id !== tripId);
    localStorage.setItem(LOCAL_STORAGE_TRIPS_KEY, JSON.stringify(filtered));
  } catch (e) {}

  try {
    await fetch(`${BACKEND_URL}/trips/${tripId}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('Backend trip delete sync notice:', err.message);
  }

  return true;
}

import { searchDestinationsLocally, normalizeQuery } from '../data/destinationsData.js';

/**
 * Searches places, colleges, bus stands, railway stations, and landmarks
 * like Google Maps.
 *
 * Strategy:
 * 1. Checks instant local destinations database with typo tolerance & related places (0ms)
 * 2. Queries FastAPI backend /search-places (fast server-side cache & parallel Nominatim)
 * 3. Fallbacks seamlessly to parallel client-side Nominatim with 2.5s timeout.
 */
export async function searchPlacesOnline(query, userLat = null, userLng = null, signal = null) {
  const trimmed = (query || '').trim();
  if (trimmed.length < 2) return [];

  const biasLat = userLat !== null && !isNaN(userLat) ? Number(userLat) : 11.0168;
  const biasLng = userLng !== null && !isNaN(userLng) ? Number(userLng) : 76.9558;

  const results = [];
  const seenCoords = [];

  function isUnique(lat, lng, name = '') {
    for (const [sLat, sLng, sName] of seenCoords) {
      if (name && sName && name.toLowerCase().trim() === sName.toLowerCase().trim()) {
        return false;
      }
      if (Math.abs(lat - sLat) < 0.0006 && Math.abs(lng - sLng) < 0.0006) {
        return false;
      }
    }
    return true;
  }

  // 1. Instant local curated search with typo correction & related places (0ms)
  const localMatches = searchDestinationsLocally(trimmed, { lat: biasLat, lng: biasLng });
  for (const item of localMatches) {
    if (isUnique(item.lat, item.lng, item.name)) {
      seenCoords.push([item.lat, item.lng, item.name]);
      results.push({
        ...item,
        source: 'curated',
      });
    }
  }

  const cleanQuery = trimmed.replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').trim();
  const hasComma = cleanQuery.includes(',');

  // If local curated database has rich matching results AND not a comma search, return immediately
  if (!hasComma && results.length >= 6) {
    return results;
  }

  // 2. High-Accuracy Fuzzy Geocoding via Photon (OSM / Komoot Elasticsearch)
  // Handles typos, bus stops, flyovers, colleges, and comma-separated places (e.g. 'kanuvai ,coimbatore'),
  // with strict India bounding box & live user GPS bias (0-150ms)
  try {
    const photonCtrl = new AbortController();
    const photonTimeout = setTimeout(() => photonCtrl.abort(), 2500);
    const INDIA_BBOX = '68.7,8.4,97.25,37.6';
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
      cleanQuery
    )}&limit=10&lang=en&lat=${biasLat}&lon=${biasLng}&bbox=${INDIA_BBOX}`;

    const pRes = await fetch(photonUrl, { signal: signal || photonCtrl.signal });
    clearTimeout(photonTimeout);

    if (pRes.ok) {
      const pData = await pRes.json();
      const features = pData?.features || [];
      for (const f of features) {
        const props = f.properties || {};
        const coords = f.geometry?.coordinates;
        if (coords && coords.length >= 2) {
          const fLat = coords[1];
          const fLng = coords[0];
          const fName = props.name || props.street || props.city || trimmed;

          const addrParts = [
            props.street,
            props.locality,
            props.district || props.suburb,
            props.city || props.town || props.village || props.county,
            props.state,
            props.country,
          ]
            .filter(Boolean)
            .filter((v, i, arr) => v !== arr[i - 1]);

          const cityStr = addrParts.slice(0, 4).join(', ') || 'Tamil Nadu, India';

          const osmVal = (props.osm_value || props.type || '').toLowerCase();
          let classified = 'landmark';
          if (osmVal.includes('bus') || fName.toLowerCase().includes('bus')) {
            classified = 'bus_stand';
          } else if (
            osmVal.includes('station') ||
            fName.toLowerCase().includes('station') ||
            fName.toLowerCase().includes('railway')
          ) {
            classified = 'station';
          } else if (
            ['city', 'town', 'village', 'administrative', 'suburb', 'district'].includes(osmVal)
          ) {
            classified = 'city';
          } else if (
            osmVal.includes('college') ||
            osmVal.includes('university') ||
            fName.toLowerCase().includes('college')
          ) {
            classified = 'college';
          } else if (osmVal.includes('hospital') || fName.toLowerCase().includes('hospital')) {
            classified = 'hospital';
          }

          if (isUnique(fLat, fLng, fName)) {
            seenCoords.push([fLat, fLng, fName]);
            results.push({
              name: fName,
              city: cityStr,
              lat: fLat,
              lng: fLng,
              source: 'photon',
              type: classified,
              isRelated: false,
            });
          }
        }
      }
      if (results.length >= 6) return results;
    }
  } catch (err) {
    if (signal?.aborted) throw err;
  }

  // 2. Try Backend API (fast multi-source geocoder)
  try {
    const backendTimeout = new AbortController();
    const timeoutTimer = setTimeout(() => backendTimeout.abort(), 2000);

    const backendUrl = `${BACKEND_URL}/search-places?q=${encodeURIComponent(
      trimmed
    )}&lat=${biasLat}&lng=${biasLng}&limit=12`;

    const res = await fetch(backendUrl, {
      signal: signal || backendTimeout.signal,
    });
    clearTimeout(timeoutTimer);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        for (const item of data) {
          if (isUnique(item.lat, item.lng, item.name)) {
            seenCoords.push([item.lat, item.lng, item.name]);
            results.push(item);
          }
        }
        if (results.length >= 6) return results;
      }
    }
  } catch (err) {
    if (signal?.aborted) throw err;
  }

  // 3. Client-side Nominatim OpenStreetMap (India prioritized, with fast timeout)
  const normQuery = normalizeQuery(trimmed);
  const searchVariants = [normQuery];
  if (!normQuery.toLowerCase().includes('bus') && !normQuery.toLowerCase().includes('station')) {
    searchVariants.push(`${normQuery} bus stand`);
  }

  for (const v of searchVariants) {
    if (signal?.aborted) return results;
    try {
      const clientCtrl = new AbortController();
      const timer = setTimeout(() => clientCtrl.abort(), 2000);

      const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        v
      )}&format=json&addressdetails=1&countrycodes=in&limit=6`;

      const res = await fetch(nomUrl, { signal: signal || clientCtrl.signal });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          for (const item of data) {
            const dLat = parseFloat(item.lat);
            const dLng = parseFloat(item.lon);
            const parts = (item.display_name || '').split(',');
            const shortName = parts[0]?.trim() || v;

            if (isUnique(dLat, dLng, shortName)) {
              seenCoords.push([dLat, dLng, shortName]);
              const cityStr =
                parts
                  .slice(1, 4)
                  .map((p) => p.trim())
                  .join(', ') || 'Tamil Nadu';

              const pType = item.type || '';
              let classifiedType = 'landmark';
              if (pType.includes('bus') || shortName.toLowerCase().includes('bus')) {
                classifiedType = 'bus_stand';
              } else if (
                pType.includes('station') ||
                shortName.toLowerCase().includes('station') ||
                shortName.toLowerCase().includes('railway')
              ) {
                classifiedType = 'station';
              } else if (['city', 'town', 'administrative', 'village'].includes(pType)) {
                classifiedType = 'city';
              }

              results.push({
                name: shortName,
                city: cityStr,
                lat: dLat,
                lng: dLng,
                source: 'nominatim',
                type: classifiedType,
                isRelated: false,
              });
            }
          }
        }
      }
    } catch (e) {
      if (signal?.aborted) throw e;
    }

    if (results.length >= 8) break;
  }

  return results;
}


