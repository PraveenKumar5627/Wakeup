import React, { useState, useEffect, useRef, useCallback } from 'react';
import InteractiveMapPicker from './InteractiveMapPicker';

// Curated transit stations, colleges, and hubs for instant zero-lag lookup
const KNOWN_PLACES = [
  {
    name: 'Suguna College of Engineering',
    aliases: ['suguna', 'suguna college', 'suguna college of engineering', 'suguna engg'],
    lat: 11.0512101,
    lng: 77.0375837,
    city: 'Kalapatti Main Rd, Coimbatore, Tamil Nadu',
  },
  {
    name: 'Suguna PIP School / Tex Park',
    aliases: ['suguna pip', 'tex park', 'civil aerodrome coimbatore'],
    lat: 11.0506333,
    lng: 77.0314166,
    city: 'Civil Aerodrome, Coimbatore, Tamil Nadu',
  },
  {
    name: 'PSG College of Arts and Science',
    aliases: ['psg arts', 'psg cas', 'psg arts college', 'psg arts and science', 'psg college of arts and sciences'],
    lat: 11.0371,
    lng: 77.0315,
    city: 'Civil Aerodrome, Coimbatore, Tamil Nadu',
  },
  {
    name: 'PSG College of Technology',
    aliases: ['psg tech', 'psg ctech', 'peelamedu psg'],
    lat: 11.0247,
    lng: 77.0028,
    city: 'Peelamedu, Coimbatore, Tamil Nadu',
  },
  {
    name: 'Sulur',
    aliases: ['sulur', 'sulur bus stand', 'sulur town'],
    lat: 11.0256,
    lng: 77.1264,
    city: 'Tamil Nadu',
  },
  {
    name: 'Sundarapuram',
    aliases: ['sundarapuram', 'sundarapuram coimbatore', 'kurichi'],
    lat: 10.9575,
    lng: 76.9698,
    city: 'Kurichi, Coimbatore, Tamil Nadu',
  },
  {
    name: 'Subway',
    aliases: ['subway', 'subway restaurant', 'subway coimbatore'],
    lat: 11.0016,
    lng: 76.9634,
    city: 'Coimbatore, Tamil Nadu',
  },
  {
    name: 'Sungam',
    aliases: ['sungam', 'sungam roundana', 'ramanathapuram'],
    lat: 10.9942,
    lng: 76.9806,
    city: 'Ramanathapuram, Coimbatore, Tamil Nadu',
  },
  {
    name: 'Gandhipuram Central Bus Stand',
    aliases: ['gandhipuram', 'coimbatore bus stand', 'gandhipuram bus stand'],
    lat: 11.0183,
    lng: 76.9678,
    city: 'Gandhipuram, Coimbatore, Tamil Nadu',
  },
  {
    name: 'Singanallur Bus Stand',
    aliases: ['singanallur', 'singanallur bus stand'],
    lat: 10.9997,
    lng: 77.0272,
    city: 'Coimbatore',
  },
  {
    name: 'Ukkadam Bus Stand',
    aliases: ['ukkadam', 'ukkadam bus stand'],
    lat: 10.9859,
    lng: 76.9582,
    city: 'Coimbatore',
  },
  {
    name: 'Chennai Central Station',
    aliases: ['chennai central', 'mgr central', 'chennai railway station'],
    lat: 13.0827,
    lng: 80.2707,
    city: 'Chennai',
  },
  {
    name: 'Koyambedu CMBT Bus Stand',
    aliases: ['koyambedu', 'cmbt', 'chennai mofussil bus terminus'],
    lat: 13.0673,
    lng: 80.2075,
    city: 'Chennai',
  },
  {
    name: 'Bangalore Majestic (KSRTC/BMTC)',
    aliases: ['majestic', 'kempegowda bus station', 'bangalore majestic'],
    lat: 12.9781,
    lng: 77.5696,
    city: 'Bangalore',
  },
  {
    name: 'Hyderabad MGBS Bus Station',
    aliases: ['mgbs', 'imlibun', 'hyderabad bus station'],
    lat: 17.3786,
    lng: 78.4815,
    city: 'Hyderabad',
  },
  {
    name: 'Mumbai Dadar Bus Station',
    aliases: ['dadar', 'dadar bus station', 'asiad dadar'],
    lat: 19.0178,
    lng: 72.8478,
    city: 'Mumbai',
  },
];

/**
 * Robust parser for Google Maps URLs, directions, and coordinates.
 */
export function parseGoogleMapsInput(input) {
  if (!input) return null;
  const str = input.trim();
  let name = '';
  let lat = null;
  let lng = null;

  // 1. Extract from /place/NAME/
  const placeMatch = str.match(/\/place\/([^/@?]+)/i);
  if (placeMatch) {
    try {
      name = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
    } catch {
      name = placeMatch[1].replace(/\+/g, ' ');
    }
  }

  // 2. Extract from /dir/origin/destination
  if (!name) {
    const dirMatch = str.match(/\/dir\/[^\/]+\/([^/@?]+)/i);
    if (dirMatch) {
      try {
        name = decodeURIComponent(dirMatch[1].replace(/\+/g, ' '));
      } catch {
        name = dirMatch[1].replace(/\+/g, ' ');
      }
    }
  }

  // 3. Extract @lat,lng from URL
  const atMatch = str.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    lat = parseFloat(atMatch[1]);
    lng = parseFloat(atMatch[2]);
  }

  // 4. Extract ?q=lat,lng or ll=lat,lng
  if (lat === null) {
    const qMatch = str.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/i);
    if (qMatch) {
      lat = parseFloat(qMatch[1]);
      lng = parseFloat(qMatch[2]);
    }
  }

  // 5. Extract plain coordinates "11.0512, 77.0505"
  if (lat === null) {
    const plainMatch = str.match(/^(-?\d+\.\d+)[\s,]+(-?\d+\.\d+)$/);
    if (plainMatch) {
      lat = parseFloat(plainMatch[1]);
      lng = parseFloat(plainMatch[2]);
      if (!name) name = 'Selected Coordinates';
    }
  }

  // 6. Check for embedded coordinates in strings
  if (lat === null) {
    const embedCoordMatch = str.match(/(-?\d{1,2}\.\d{3,})[\s,]+(-?\d{1,3}\.\d{3,})/);
    if (embedCoordMatch) {
      lat = parseFloat(embedCoordMatch[1]);
      lng = parseFloat(embedCoordMatch[2]);
    }
  }

  if (lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    return {
      name: name || 'Google Maps Destination',
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
    };
  }

  return null;
}

/**
 * Highlight matching query text inside a suggestion name.
 * Returns an array of React nodes with bold spans for matched segments.
 */
function highlightMatch(text, query) {
  if (!query || !query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase().trim());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <strong style={{ color: '#fff', fontWeight: 800 }}>{text.slice(idx, idx + query.trim().length)}</strong>
      {text.slice(idx + query.trim().length)}
    </>
  );
}

/**
 * Generate a Google Maps URL for a destination.
 * Prioritizes the user-searched place name so Google Maps opens directly
 * to the place name (e.g. "PSG College of Arts and Science") in its search bar
 * and place card, rather than displaying raw latitude/longitude numbers.
 */
export function getGoogleMapsUrl(dest) {
  if (!dest) return 'https://www.google.com/maps';

  const name = (dest.name || '').trim();
  const hasCoords = dest.lat != null && dest.lng != null;

  // Check if name is generic or raw coordinates
  const isGenericOrCoords =
    !name ||
    name === 'Google Maps Destination' ||
    name === 'Pinned Location' ||
    name === 'Selected Coordinates' ||
    /^-?\d+(\.\d+)?[\s,]+-?\d+(\.\d+)?$/.test(name);

  if (!isGenericOrCoords) {
    // If destination has an address/city that isn't already in the name, append it for pinpoint accuracy
    let queryText = name;
    if (dest.address && !name.toLowerCase().includes(dest.address.toLowerCase())) {
      queryText = `${name}, ${dest.address}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryText)}`;
  }

  // Fallback to coordinates
  if (hasCoords) {
    return `https://www.google.com/maps/search/?api=1&query=${dest.lat},${dest.lng}`;
  }

  return 'https://www.google.com/maps';
}

// Google Maps Places Autocomplete Loader
const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

let googleMapsScriptPromise = null;
function loadGoogleMapsPlaces(apiKey) {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.google?.maps?.places) return Promise.resolve(window.google);
  if (googleMapsScriptPromise) return googleMapsScriptPromise;

  googleMapsScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('google-maps-places-script');
    if (existing) {
      const poll = setInterval(() => {
        if (window.google?.maps?.places) {
          clearInterval(poll);
          resolve(window.google);
        }
      }, 100);
      setTimeout(() => { clearInterval(poll); reject(new Error('Google Maps script timeout')); }, 8000);
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-maps-places-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.maps?.places) resolve(window.google);
      else reject(new Error('Google Maps places library not loaded'));
    };
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });
  return googleMapsScriptPromise;
}

export default function DestinationSearch({
  destination,
  setDestination,
  disabled,
  userLocation,
}) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [showMapEmbed, setShowMapEmbed] = useState(true);
  const [showInteractiveMap, setShowInteractiveMap] = useState(false);

  // Google Maps Import State
  const [gmapsInput, setGmapsInput] = useState('');
  const [confirmMsg, setConfirmMsg] = useState('');

  // Manual inputs
  const [manualName, setManualName] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  // Autocomplete suggestions
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1);
  const debounceTimer = useRef(null);
  const inputWrapperRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Google Maps Places Services
  const autocompleteServiceRef = useRef(null);
  const placesServiceRef = useRef(null);
  const [isGoogleMapsReady, setIsGoogleMapsReady] = useState(false);

  useEffect(() => {
    if (GOOGLE_MAPS_API_KEY) {
      loadGoogleMapsPlaces(GOOGLE_MAPS_API_KEY)
        .then((google) => {
          autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
          placesServiceRef.current = new google.maps.places.PlacesService(document.createElement('div'));
          setIsGoogleMapsReady(true);
        })
        .catch((err) => {
          console.warn('Google Places API could not be initialized:', err);
          setIsGoogleMapsReady(false);
        });
    }
  }, []);

  // Recent places — persisted in localStorage
  const [recentPlaces, setRecentPlaces] = useState(() => {
    try {
      const stored = localStorage.getItem('wakeup_recent_places');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  /** Save a destination to recent places (max 5, newest first, deduped by name) */
  const saveToRecent = useCallback((place) => {
    if (!place?.name || !place?.lat || !place?.lng) return;
    setRecentPlaces((prev) => {
      const filtered = prev.filter(
        (p) => p.name.toLowerCase() !== place.name.toLowerCase()
      );
      const updated = [{ name: place.name, lat: place.lat, lng: place.lng, address: place.address }, ...filtered].slice(0, 5);
      try { localStorage.setItem('wakeup_recent_places', JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (inputWrapperRef.current && !inputWrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
        setActiveSuggestionIdx(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /** Build a clean address subtitle from a Nominatim address object */
  const buildAddress = (addr) => {
    if (!addr) return '';
    const parts = [
      addr.road || addr.pedestrian || addr.hamlet,
      addr.suburb || addr.neighbourhood || addr.quarter,
      addr.city || addr.town || addr.village || addr.municipality || addr.county,
      addr.state,
      addr.country,
    ].filter(Boolean);
    // Remove consecutive duplicates
    const deduped = parts.filter((v, i) => v !== parts[i - 1]);
    return deduped.slice(0, 4).join(', ');
  };

  /** Fetch autocomplete suggestions — Google Places API or high-accuracy India-bounded multi-source */
  const fetchSuggestions = useCallback(async (text) => {
    if (!text || text.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const lower = text.toLowerCase().trim();

    // 1. Matches from recent searches history (type: 'recent' -> Clock icon)
    const recentMatches = recentPlaces
      .filter((p) => p.name.toLowerCase().includes(lower))
      .map((p) => ({
        id: `recent-${p.name}`,
        name: p.name,
        address: p.address || 'Recent search',
        lat: p.lat,
        lng: p.lng,
        type: 'recent',
      }));

    // 2. Instant local curated landmarks (type: 'place' -> Location Pin icon)
    const localMatches = KNOWN_PLACES.filter(
      (p) =>
        !recentMatches.some((r) => r.name.toLowerCase() === p.name.toLowerCase()) &&
        (p.name.toLowerCase().includes(lower) ||
          p.aliases.some((a) => a.includes(lower) || lower.includes(a)))
    ).map((p) => ({
      id: `local-${p.name}`,
      name: p.name,
      address: p.city,
      lat: p.lat,
      lng: p.lng,
      type: 'place',
    }));

    // Show instant local/recent matches immediately with zero lag
    const instantList = [...recentMatches, ...localMatches];
    setSuggestions(instantList);
    if (instantList.length > 0) setShowSuggestions(true);

    // Abort previous fetch
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    setIsFetchingSuggestions(true);
    try {
      const biasLat = userLocation?.lat || 11.0168; // Default Coimbatore / user live GPS
      const biasLng = userLocation?.lng || 76.9558;
      const INDIA_BBOX = '68.7,8.4,97.25,37.6';

      // ── OPTION A: Google Maps Places Autocomplete API (if configured) ──
      if (autocompleteServiceRef.current && isGoogleMapsReady && window.google?.maps) {
        const googlePredictions = await new Promise((resolve) => {
          const req = {
            input: text,
            componentRestrictions: { country: 'in' },
          };
          if (biasLat && biasLng) {
            req.locationBias = new window.google.maps.LatLng(biasLat, biasLng);
            req.radius = 50000;
          }
          autocompleteServiceRef.current.getPlacePredictions(req, (predictions, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
              resolve(
                predictions.map((p) => ({
                  id: `gmaps-${p.place_id}`,
                  placeId: p.place_id,
                  name: p.structured_formatting?.main_text || p.description.split(',')[0],
                  address: p.structured_formatting?.secondary_text || p.description,
                  type: 'place',
                  isGoogle: true,
                }))
              );
            } else {
              resolve([]);
            }
          });
        });

        if (googlePredictions.length > 0) {
          const seen = new Set(recentMatches.map((r) => r.name.toLowerCase()));
          const combined = [...recentMatches];
          for (const item of googlePredictions) {
            const key = item.name.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              combined.push(item);
            }
            if (combined.length >= 8) break;
          }
          setSuggestions(combined);
          setShowSuggestions(true);
          return;
        }
      }

      // ── OPTION B: Free High-Accuracy Engine (Strict India BBOX + Local Bias) ──
      const [photonRes, nominatimRes] = await Promise.allSettled([
        fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&limit=10&lang=en&lat=${biasLat}&lon=${biasLng}&bbox=${INDIA_BBOX}`,
          { signal }
        ),
        fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=6&addressdetails=1&countrycodes=in&viewbox=${INDIA_BBOX}&bounded=1&accept-language=en`,
          { headers: { 'Accept-Language': 'en' }, signal }
        ),
      ]);

      let photonItems = [];
      if (photonRes.status === 'fulfilled' && photonRes.value.ok) {
        const pData = await photonRes.value.json();
        photonItems = (pData?.features || [])
          .map((f) => {
            const p = f.properties || {};
            const addrParts = [
              p.street,
              p.district || p.suburb,
              p.city || p.town || p.village || p.county,
              p.state,
              p.country,
            ].filter(Boolean).filter((v, i, arr) => v !== arr[i - 1]);

            return {
              id: `photon-${p.osm_id || Math.random()}`,
              name: p.name || p.city || text,
              address: addrParts.slice(0, 4).join(', '),
              lat: f.geometry?.coordinates?.[1],
              lng: f.geometry?.coordinates?.[0],
              type: 'place',
              _country: (p.country || '').toLowerCase(),
            };
          })
          .filter((x) => x.lat && x.lng && x.name);
      }

      let nominatimItems = [];
      if (nominatimRes.status === 'fulfilled' && nominatimRes.value.ok) {
        const nData = await nominatimRes.value.json();
        nominatimItems = (nData || []).map((item) => ({
          id: `osm-${item.place_id}`,
          name: item.display_name.split(',')[0],
          address: buildAddress(item.address || {}),
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          type: 'place',
          _country: (item.address?.country || '').toLowerCase(),
        }));
      }

      // Hard filter: MUST be India results only
      const isIndiaResult = (item) => {
        if (item._country === 'india' || item._country === 'in') return true;
        const addr = (item.address || '').toLowerCase();
        if (/india|tamil nadu|coimbatore|chennai|kerala|karnataka|bengaluru|bangalore|hyderabad|mumbai|delhi/i.test(addr)) {
          return true;
        }
        return false;
      };

      const indiaOnline = [...photonItems, ...nominatimItems].filter(isIndiaResult);

      // Deduplicate by name & coordinates
      const seenNames = new Set(instantList.map((m) => m.name.toLowerCase()));
      const seenCoords = new Set();
      const dedupedOnline = [];

      for (const item of indiaOnline) {
        const nameKey = item.name.toLowerCase();
        const coordKey = `${item.lat?.toFixed(2)},${item.lng?.toFixed(2)}`;
        if (!seenNames.has(nameKey) && !seenCoords.has(coordKey)) {
          seenNames.add(nameKey);
          seenCoords.add(coordKey);
          dedupedOnline.push(item);
        }
        if (dedupedOnline.length >= 6) break;
      }

      const merged = [...instantList, ...dedupedOnline].slice(0, 8);
      setSuggestions(merged);
      if (merged.length > 0) setShowSuggestions(true);
    } catch (err) {
      if (err.name !== 'AbortError') console.warn('Suggestion fetch error:', err);
    } finally {
      setIsFetchingSuggestions(false);
    }
  }, [recentPlaces, userLocation, isGoogleMapsReady]);

  /** Handle input change — debounce suggestion fetch by 250 ms */
  const handleInputChange = (e) => {
    const val = e.target.value;
    setGmapsInput(val);
    setActiveSuggestionIdx(-1);
    clearTimeout(debounceTimer.current);
    if (!val.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceTimer.current = setTimeout(() => fetchSuggestions(val), 250);
  };

  /** Pick a suggestion from the dropdown */
  const handleSelectSuggestion = (sugg) => {
    if (sugg.isGoogle && sugg.placeId && placesServiceRef.current) {
      placesServiceRef.current.getDetails(
        { placeId: sugg.placeId, fields: ['name', 'geometry', 'formatted_address'] },
        (place, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
            const resolved = {
              name: place.name || sugg.name,
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
              address: place.formatted_address || sugg.address,
            };
            setDestination(resolved);
            saveToRecent(resolved);
            setConfirmMsg(`✅ Set: "${resolved.name}"`);
            setGmapsInput('');
            setSuggestions([]);
            setShowSuggestions(false);
            setSearchError('');
            setActiveSuggestionIdx(-1);
          }
        }
      );
      return;
    }

    const place = { name: sugg.name, lat: sugg.lat, lng: sugg.lng, address: sugg.address };
    setDestination(place);
    saveToRecent(place);
    setConfirmMsg(`✅ Set: "${sugg.name}"`);
    setGmapsInput('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSearchError('');
    setActiveSuggestionIdx(-1);
  };

  /** Keyboard nav in dropdown */
  const handleInputKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeSuggestionIdx >= 0) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[activeSuggestionIdx]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveSuggestionIdx(-1);
    }
  };

  // Open Google Maps in a new tab
  const handleOpenGoogleMaps = () => {
    const searchTerm = gmapsInput.trim() || destination?.name || query.trim() || '';
    if (searchTerm) {
      const target = destination && destination.name === searchTerm ? destination : { name: searchTerm };
      window.open(getGoogleMapsUrl(target), '_blank');
    } else if (destination) {
      window.open(getGoogleMapsUrl(destination), '_blank');
    } else {
      window.open('https://www.google.com/maps', '_blank');
    }
  };

  /**
   * Smart resolver:
   * Resolves ANY text, whether it is a Google Maps link, coordinates, or a place name like "Suguna College of Engineering"
   */
  const resolveAndSetDestination = async (inputText) => {
    if (!inputText || !inputText.trim()) return false;
    const raw = inputText.trim();

    // 1. Check if it's a Google Maps URL or coordinates
    const parsedGmaps = parseGoogleMapsInput(raw);
    if (parsedGmaps) {
      setDestination(parsedGmaps);
      saveToRecent(parsedGmaps);
      setConfirmMsg(`✅ Confirmed: "${parsedGmaps.name}" (${parsedGmaps.lat}, ${parsedGmaps.lng})`);
      setGmapsInput('');
      setQuery('');
      setSearchError('');
      setSearchResults([]);
      return true;
    }

    // 2. Check local curated places & aliases (case-insensitive substring match)
    const lower = raw.toLowerCase();
    const localMatch = KNOWN_PLACES.find(
      (p) =>
        p.name.toLowerCase() === lower ||
        p.name.toLowerCase().includes(lower) ||
        p.aliases.some((a) => a === lower || lower.includes(a) || a.includes(lower))
    );

    if (localMatch) {
      const resolved = {
        name: localMatch.name,
        lat: localMatch.lat,
        lng: localMatch.lng,
      };
      setDestination(resolved);
      saveToRecent(resolved);
      setConfirmMsg(`✅ Confirmed: "${resolved.name}" (${resolved.lat}, ${resolved.lng})`);
      setGmapsInput('');
      setQuery('');
      setSearchError('');
      setSearchResults([]);
      return true;
    }

    // 3. Try online geocoding (OpenStreetMap Nominatim + Komoot Photon)
    setIsSearching(true);
    setSearchError('');
    try {
      // Nominatim attempt
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        raw
      )}&limit=3`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();

      if (data && data.length > 0) {
        const top = {
          name: data[0].display_name.split(',')[0],
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
        setDestination(top);
        saveToRecent(top);
        setConfirmMsg(`✅ Confirmed: "${top.name}" (${top.lat.toFixed(4)}, ${top.lng.toFixed(4)}) `);
        setGmapsInput('');
        setQuery('');
        setSearchResults([]);
        return true;
      }

      // Photon attempt
      const pUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(raw)}&limit=3`;
      const pRes = await fetch(pUrl);
      const pData = await pRes.json();

      if (pData?.features && pData.features.length > 0) {
        const f = pData.features[0];
        const top = {
          name: f.properties.name || raw,
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
        };
        setDestination(top);
        saveToRecent(top);
        setConfirmMsg(`✅ Confirmed: "${top.name}" (${top.lat.toFixed(4)}, ${top.lng.toFixed(4)})`);
        setGmapsInput('');
        setQuery('');
        setSearchResults([]);
        return true;
      }
    } catch (err) {
      console.warn('Geocoding error:', err);
    } finally {
      setIsSearching(false);
    }

    // If still not resolved:
    setSearchError(
      `Could not automatically locate "${raw}". Click "Pick on Map" below or copy the Google Maps URL/coordinates!`
    );
    return false;
  };

  // Button: Paste from Clipboard & Confirm
  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          const success = await resolveAndSetDestination(text);
          if (success) return;
          setGmapsInput(text);
        }
      }
    } catch (err) {
      console.warn('Clipboard read error:', err);
    }

    if (gmapsInput) {
      await resolveAndSetDestination(gmapsInput);
    } else {
      setSearchError('Clipboard was empty. Please type or paste your destination name/link in the box.');
    }
  };

  // Button: Confirm Destination from text input
  const handleConfirmInput = async (e) => {
    e?.preventDefault();
    const textToResolve = gmapsInput.trim() || query.trim();
    if (!textToResolve) {
      setSearchError('Please enter a destination name (e.g. Suguna College of Engineering) or paste a Google Maps link.');
      return;
    }
    await resolveAndSetDestination(textToResolve);
  };

  // Search button clicked in main search bar
  const handleSearchSubmit = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    await resolveAndSetDestination(query.trim());
  };

  const handleApplyManual = (e) => {
    e.preventDefault();
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      alert('Please enter a valid Latitude between -90 and 90');
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      alert('Please enter a valid Longitude between -180 and 180');
      return;
    }
    const custom = {
      name: manualName.trim() || 'Custom Location',
      lat: lat,
      lng: lng,
    };
    setDestination(custom);
    setConfirmMsg(`✅ Applied Custom Location: "${custom.name}"`);
    setShowManualInput(false);
  };

  return (
    <div className="glass-card">
      <div className="section-label">
        <span>📍</span>
        <span>Destination Setup</span>
      </div>

      {!disabled && (
        <div className="search-box-wrapper">
          {/* Main Input + Autocomplete Suggestions */}
          <form onSubmit={handleConfirmInput} style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <div
              className="input-with-icon destination-input-wrapper"
              style={{ flex: '1 1 200px', position: 'relative' }}
              ref={inputWrapperRef}
            >
              {/* Destination Pin SVG Icon */}
              <span className="input-icon destination-pin-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                    fill="url(#pinGrad)"
                    opacity="0.95"
                  />
                  <circle cx="12" cy="9" r="2.8" fill="#ffffff" />
                  <circle cx="12" cy="9" r="1.4" fill="url(#pinGrad)" />
                  <defs>
                    <linearGradient id="pinGrad" x1="5" y1="2" x2="19" y2="22" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>
              {/* "To" Badge */}
              <span className="to-badge">To</span>
              <input
                type="text"
                className="text-input destination-text-input"
                placeholder="College, bus stop, city or paste Maps link…"
                value={gmapsInput}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                onFocus={() => gmapsInput.trim().length >= 2 && setShowSuggestions(suggestions.length > 0)}
                autoComplete="off"
                disabled={disabled}
              />
              {/* Suggestions Spinner */}
              {isFetchingSuggestions && (
                <span style={{
                  position: 'absolute', right: '0.75rem', top: '50%',
                  transform: 'translateY(-50%)', fontSize: '0.75rem',
                  color: 'var(--text-dim)', pointerEvents: 'none',
                }}>
                  ⏳
                </span>
              )}

              {/* ── Autocomplete Dropdown ── */}
              {showSuggestions && suggestions.length > 0 && (
                <ul className="suggestions-dropdown">
                  {suggestions.map((s, idx) => (
                    <li
                      key={s.id}
                      className={`suggestion-item${activeSuggestionIdx === idx ? ' suggestion-item--active' : ''}`}
                      onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(s); }}
                      onMouseEnter={() => setActiveSuggestionIdx(idx)}
                    >
                      {/* Icon: Clock for recent history, Pin for place recommendations */}
                      <span
                        className="suggestion-icon"
                        title={s.type === 'recent' ? 'Recent search' : 'Recommended place'}
                      >
                        {s.type === 'recent' ? (
                          /* Clock SVG matching Google Maps search history */
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                        ) : (
                          /* Location Pin SVG matching Google Maps place recommendations */
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                        )}
                      </span>
                      {/* Text: Name (bold matching) + Subtitle Address */}
                      <span className="suggestion-text">
                        <span className="suggestion-name">
                          {highlightMatch(s.name, gmapsInput)}
                          {s.isGoogle && (
                            <span
                              style={{
                                marginLeft: '0.4rem',
                                fontSize: '0.62rem',
                                padding: '0.1rem 0.35rem',
                                borderRadius: '4px',
                                background: 'rgba(66, 133, 244, 0.15)',
                                color: '#60a5fa',
                                fontWeight: 700,
                              }}
                            >
                              Google
                            </span>
                          )}
                        </span>
                        {s.address && (
                          <span className="suggestion-address">{s.address}</span>
                        )}
                      </span>
                      {/* Arrow */}
                      <span className="suggestion-arrow">↗</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="submit"
              className="preset-chip"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                fontWeight: 800,
                padding: '0 1rem',
                fontSize: '0.9rem',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
              }}
              disabled={isSearching || disabled}
              title="Resolve and confirm destination"
            >
              {isSearching ? 'Finding...' : 'Confirm Destination'}
            </button>
          </form>

          {/* Quick Helper Actions Row */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="preset-chip"
              style={{
                background: 'rgba(56, 189, 248, 0.12)',
                color: 'var(--accent-blue)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                fontWeight: 600,
                fontSize: '0.78rem',
              }}
              onClick={handlePasteFromClipboard}
            >
              📋 One-Click Paste from Clipboard
            </button>

            <button
              type="button"
              className="preset-chip"
              style={{
                background: 'rgba(168, 85, 247, 0.15)',
                color: '#c084fc',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                fontWeight: 600,
                fontSize: '0.78rem',
              }}
              onClick={() => setShowInteractiveMap(true)}
            >
              🗺️ Pick Directly on Map
            </button>

            <button
              type="button"
              className="preset-chip"
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                fontWeight: 600,
                fontSize: '0.78rem',
              }}
              onClick={handleOpenGoogleMaps}
            >
              🌐 Open in Google Maps ↗
            </button>
          </div>

          {/* Green Confirmation Message Banner */}
          {confirmMsg && (
            <div
              className="alert-box"
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#34d399',
                padding: '0.65rem 0.85rem',
                fontSize: '0.84rem',
                fontWeight: 600,
              }}
            >
              <span>{confirmMsg}</span>
            </div>
          )}

          {/* Error Message with Option to Pick on Map or Open Google Maps */}
          {searchError && (
            <div
              className="alert-box alert-warning"
              style={{
                padding: '0.65rem 0.85rem',
                fontSize: '0.8rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              <span>{searchError}</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowInteractiveMap(true)}
                  style={{
                    background: '#6366f1',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >
                  📍 Pick on Interactive Map
                </button>
                <button
                  type="button"
                  onClick={handleOpenGoogleMaps}
                  style={{
                    background: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >
                  Open Google Maps ↗
                </button>
              </div>
            </div>
          )}

          {/* Recent Places / Popular Presets */}
          <div>
            {recentPlaces.length > 0 ? (
              /* ── Recent Places ── */
              <div>
                <div style={{
                  fontSize: '0.75rem', color: 'var(--text-dim)',
                  marginBottom: '0.4rem', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span>🕐 Recent Places:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setRecentPlaces([]);
                      try { localStorage.removeItem('wakeup_recent_places'); } catch {}
                    }}
                    style={{
                      background: 'none', border: 'none',
                      color: 'var(--text-dim)', fontSize: '0.7rem',
                      cursor: 'pointer', textDecoration: 'underline',
                    }}
                  >
                    Clear
                  </button>
                </div>
                <div className="presets-grid">
                  {recentPlaces.map((place, idx) => {
                    const isSelected = destination?.name === place.name;
                    return (
                      <button
                        key={idx}
                        type="button"
                        className={`preset-chip recent-preset-chip ${isSelected ? 'active' : ''}`}
                        onClick={() => {
                          setDestination({ name: place.name, lat: place.lat, lng: place.lng });
                          saveToRecent(place);
                          setConfirmMsg(`✅ Set: "${place.name}"`);
                          setSearchError('');
                        }}
                        disabled={disabled}
                        title={`${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}`}
                      >
                        {/* Clock icon */}
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                          <circle cx="12" cy="12" r="9" stroke="#38bdf8" strokeWidth="1.8"/>
                          <path d="M12 7v5l3 3" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round"/>
                        </svg>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {place.name.split(' (')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {/* Also show popular presets below recent */}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: '0.5rem 0 0.4rem' }}>
                  Popular Presets:
                </div>
                <div className="presets-grid">
                  {KNOWN_PLACES.slice(0, 4).map((preset, idx) => {
                    const isSelected = destination?.name === preset.name;
                    return (
                      <button
                        key={idx}
                        type="button"
                        className={`preset-chip ${isSelected ? 'active' : ''}`}
                        onClick={() => {
                          const p = { name: preset.name, lat: preset.lat, lng: preset.lng };
                          setDestination(p);
                          saveToRecent(p);
                          setConfirmMsg(`✅ Confirmed: "${preset.name}"`);
                          setSearchError('');
                        }}
                        disabled={disabled}
                      >
                        <span>🚏</span>
                        {preset.name.split(' (')[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* ── No history yet: show Popular Presets ── */
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.4rem' }}>
                  Popular Presets (Tap to Set):
                </div>
                <div className="presets-grid">
                  {KNOWN_PLACES.slice(0, 6).map((preset, idx) => {
                    const isSelected = destination?.name === preset.name;
                    return (
                      <button
                        key={idx}
                        type="button"
                        className={`preset-chip ${isSelected ? 'active' : ''}`}
                        onClick={() => {
                          const p = { name: preset.name, lat: preset.lat, lng: preset.lng };
                          setDestination(p);
                          saveToRecent(p);
                          setConfirmMsg(`✅ Confirmed: "${preset.name}"`);
                          setSearchError('');
                        }}
                        disabled={disabled}
                      >
                        <span>📍</span>
                        {preset.name.split(' (')[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Toggle Manual Coordinates Input */}
          <div style={{ textAlign: 'right' }}>
            <button
              type="button"
              onClick={() => setShowManualInput(!showManualInput)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-blue)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              {showManualInput ? 'Hide Manual Coordinates' : '+ Enter Exact Coordinates Manually'}
            </button>
          </div>

          {showManualInput && (
            <div
              style={{
                background: 'rgba(11, 15, 25, 0.6)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <input
                type="text"
                className="text-input"
                style={{ padding: '0.5rem 0.75rem' }}
                placeholder="Destination Name (e.g. Suguna College)"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  step="any"
                  className="text-input"
                  style={{ padding: '0.5rem 0.75rem' }}
                  placeholder="Latitude (e.g. 11.0512)"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                />
                <input
                  type="number"
                  step="any"
                  className="text-input"
                  style={{ padding: '0.5rem 0.75rem' }}
                  placeholder="Longitude (e.g. 77.0376)"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="preset-chip"
                style={{ background: 'var(--accent-emerald)', color: '#0b0f19', fontWeight: 700 }}
                onClick={handleApplyManual}
              >
                Apply Custom Coordinates
              </button>
            </div>
          )}
        </div>
      )}

      {/* Selected Destination Preview Card with Live Google Maps Embed */}
      {destination ? (
        <div style={{ marginTop: '0.6rem' }}>
          <div className="selected-card">
            <div className="selected-info">
              <span className="selected-name">{destination.name}</span>
              <span className="selected-coords">
                Lat: {Number(destination.lat).toFixed(4)}° | Lng: {Number(destination.lng).toFixed(4)}°
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button
                type="button"
                className="preset-chip"
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: 'var(--accent-blue)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
                onClick={() =>
                  window.open(
                    getGoogleMapsUrl(destination),
                    '_blank'
                  )
                }
                title={`Open "${destination.name}" in Google Maps`}
              >
                🗺️ Open in Google Maps ↗
              </button>
              <button
                type="button"
                className="preset-chip"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '0.3rem 0.5rem',
                  fontSize: '0.75rem',
                }}
                onClick={() => setShowMapEmbed(!showMapEmbed)}
                title="Toggle Google Maps embedded preview"
              >
                {showMapEmbed ? 'Hide Map' : 'Show Map'}
              </button>
            </div>
          </div>

          {/* Embedded Google Maps Preview */}
          {showMapEmbed && (
            <div
              style={{
                marginTop: '0.6rem',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                height: '190px',
                border: '1px solid var(--border-subtle)',
                background: '#1e293b',
              }}
            >
              <iframe
                title="Google Maps Destination Preview"
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                marginHeight="0"
                marginWidth="0"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(
                  destination.name &&
                  destination.name !== 'Google Maps Destination' &&
                  destination.name !== 'Pinned Location' &&
                  destination.name !== 'Selected Coordinates' &&
                  !/^-?\d+(\.\d+)?[\s,]+-?\d+(\.\d+)?$/.test(destination.name)
                    ? (destination.address && !destination.name.toLowerCase().includes(destination.address.toLowerCase())
                        ? `${destination.name}, ${destination.address}`
                        : destination.name)
                    : `${destination.lat},${destination.lng}`
                )}&z=15&output=embed`}
                style={{ border: 0, width: '100%', height: '100%' }}
                loading="lazy"
              />
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            textAlign: 'center',
            padding: '0.85rem',
            color: 'var(--text-dim)',
            fontSize: '0.85rem',
            border: '1px dashed var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            marginTop: '0.5rem',
          }}
        >
          No destination selected yet. Choose a preset or search above.
        </div>
      )}

      {/* Interactive Map Picker Modal */}
      {showInteractiveMap && (
        <InteractiveMapPicker
          destination={destination}
          onConfirmLocation={(newLoc) => {
            setDestination(newLoc);
            setConfirmMsg(`✅ Pinned on Map: "${newLoc.name}" (${newLoc.lat}, ${newLoc.lng})`);
            setSearchError('');
          }}
          onClose={() => setShowInteractiveMap(false)}
        />
      )}
    </div>
  );
}
