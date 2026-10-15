import React, { useState, useEffect, useRef, useCallback } from 'react';
import StatusBar from '../components/StatusBar';
import {
  ArrowLeft,
  Search,
  MapPin,
  Check,
  LocateFixed,
  X,
  ExternalLink,
  Loader2,
  Navigation,
  Plus,
  Minus,
  Clock,
  Bus,
  Train,
  Building2,
  Plane,
  GraduationCap,
} from 'lucide-react';
import {
  haversineDistanceKm,
  fetchOsrmRoadDistance,
  formatDuration,
  searchPlacesOnline,
} from '../utils/api';
import {
  searchDestinationsLocally,
  QUICK_DESTINATION_CHIPS,
  ALL_DESTINATIONS,
  normalizeQuery,
} from '../data/destinationsData';

const POPULAR_DESTINATIONS = ALL_DESTINATIONS;

function getPlacePinClass(type) {
  switch (type) {
    case 'bus_stand':
      return 'pin-bus';
    case 'station':
      return 'pin-station';
    case 'city':
      return 'pin-city';
    case 'airport':
      return 'pin-airport';
    case 'college':
      return 'pin-college';
    case 'hospital':
      return 'pin-hospital';
    default:
      return 'pin-landmark';
  }
}

function renderPlaceIcon(type) {
  switch (type) {
    case 'bus_stand':
      return <Bus size={17} />;
    case 'station':
      return <Train size={17} />;
    case 'city':
      return <Building2 size={17} />;
    case 'airport':
      return <Plane size={17} />;
    case 'college':
      return <GraduationCap size={17} />;
    case 'hospital':
      return <Plus size={17} className="font-bold" />;
    default:
      return <MapPin size={17} />;
  }
}

function formatPlaceType(type) {
  switch (type) {
    case 'bus_stand':
      return 'Bus Stand';
    case 'station':
      return 'Railway Station';
    case 'city':
      return 'Town / City';
    case 'airport':
      return 'Airport';
    case 'college':
      return 'College';
    case 'hospital':
      return 'Hospital';
    case 'coords':
      return 'Coordinates';
    default:
      return 'Place';
  }
}

/** Parse Google Maps URLs or direct coordinate strings */
function parseCoordinatesOrUrl(input) {
  if (!input) return null;
  const str = input.trim();

  // Extract from Google Maps /place/NAME/@lat,lng
  const atMatch = str.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return {
      lat: parseFloat(atMatch[1]),
      lng: parseFloat(atMatch[2]),
    };
  }

  // Extract from ?q=lat,lng or ll=lat,lng
  const qMatch = str.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/i);
  if (qMatch) {
    return {
      lat: parseFloat(qMatch[1]),
      lng: parseFloat(qMatch[2]),
    };
  }

  // Extract plain coordinates "11.7851, 79.3671"
  const plainMatch = str.match(/^(-?\d+\.\d+)[\s,]+(-?\d+\.\d+)$/);
  if (plainMatch) {
    return {
      lat: parseFloat(plainMatch[1]),
      lng: parseFloat(plainMatch[2]),
    };
  }

  return null;
}

// Google Maps Places Autocomplete Loader
const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

let googlePlacesScriptPromise = null;
function loadGoogleMapsPlaces(apiKey) {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.google?.maps?.places) return Promise.resolve(window.google);
  if (googlePlacesScriptPromise) return googlePlacesScriptPromise;

  googlePlacesScriptPromise = new Promise((resolve) => {
    const existing = document.getElementById('google-maps-places-script');
    if (existing) {
      const poll = setInterval(() => {
        if (window.google?.maps?.places) {
          clearInterval(poll);
          resolve(window.google);
        }
      }, 100);
      setTimeout(() => { clearInterval(poll); resolve(null); }, 4000);
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-maps-places-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.maps?.places) resolve(window.google);
      else resolve(null);
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return googlePlacesScriptPromise;
}

/** Highlight matching search text inside suggestion name */
function highlightMatch(text, query) {
  if (!query || !query.trim() || !text) return text;
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let bestIdx = -1;
  let bestLen = 0;
  for (const w of words) {
    const idx = text.toLowerCase().indexOf(w);
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
      bestIdx = idx;
      bestLen = w.length;
    }
  }
  if (bestIdx === -1) return text;
  return (
    <>
      {text.slice(0, bestIdx)}
      <strong style={{ color: '#1d4ed8', fontWeight: 800 }}>
        {text.slice(bestIdx, bestIdx + bestLen)}
      </strong>
      {text.slice(bestIdx + bestLen)}
    </>
  );
}

export default function SelectDestinationScreen({
  initialDestination = null,
  initialAlertDistanceKm = 5,
  currentLocation = null,
  onGetLocation = null,
  onBack,
  onStartTrip,
}) {
  const [selectedDestination, setSelectedDestination] = useState(
    initialDestination || POPULAR_DESTINATIONS[0]
  );
  const [searchQuery, setSearchQuery] = useState(
    initialDestination ? initialDestination.name : POPULAR_DESTINATIONS[0].name
  );
  const [alertDistanceKm, setAlertDistanceKm] = useState(initialAlertDistanceKm || 5);
  const [isCustom, setIsCustom] = useState(
    ![2, 3, 5].includes(initialAlertDistanceKm)
  );
  const [customInput, setCustomInput] = useState(
    ![2, 3, 5].includes(initialAlertDistanceKm) ? String(initialAlertDistanceKm) : '4'
  );
  const [isConfirmed, setIsConfirmed] = useState(true);

  // Live Distance between User's Current Location and Selected Destination
  const [distanceInfo, setDistanceInfo] = useState({
    distanceKm: null,
    straightKm: null,
    durationText: '',
    routeType: 'straight_line',
    isCalculating: false,
  });

  // Calculate live distance from current location to selected destination immediately
  useEffect(() => {
    if (!selectedDestination?.lat || !selectedDestination?.lng) return;

    if (!currentLocation?.lat || !currentLocation?.lng) {
      if (onGetLocation) {
        onGetLocation().catch(() => {});
      }
      setDistanceInfo({
        distanceKm: null,
        straightKm: null,
        durationText: '',
        routeType: 'straight_line',
        isCalculating: false,
      });
      return;
    }

    // 1. Instant local Haversine distance (0ms latency!)
    const straight = haversineDistanceKm(
      currentLocation.lat,
      currentLocation.lng,
      selectedDestination.lat,
      selectedDestination.lng
    );

    setDistanceInfo({
      distanceKm: straight,
      straightKm: straight,
      durationText: formatDuration(straight * 2.0),
      routeType: 'straight_line',
      isCalculating: true,
    });

    // 2. High accuracy driving road distance from OSRM (~150ms)
    let cancelled = false;
    fetchOsrmRoadDistance(
      currentLocation.lat,
      currentLocation.lng,
      selectedDestination.lat,
      selectedDestination.lng
    )
      .then((roadData) => {
        if (cancelled) return;
        if (roadData) {
          setDistanceInfo({
            distanceKm: roadData.distanceKm,
            straightKm: straight,
            durationText: roadData.durationText,
            routeType: 'road',
            isCalculating: false,
          });
        } else {
          setDistanceInfo((prev) => ({ ...prev, isCalculating: false }));
        }
      })
      .catch(() => {
        if (!cancelled) setDistanceInfo((prev) => ({ ...prev, isCalculating: false }));
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDestination, currentLocation, onGetLocation]);

  // Suggestions state
  const [suggestions, setSuggestions] = useState([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimerRef = useRef(null);
  const searchInputWrapperRef = useRef(null);
  const activeSearchAbortRef = useRef(null);
  const currentSearchQueryRef = useRef('');

  // Google Places API Service refs
  const autocompleteServiceRef = useRef(null);
  const placesServiceRef = useRef(null);
  const [isGoogleMapsReady, setIsGoogleMapsReady] = useState(false);

  useEffect(() => {
    if (window.google?.maps?.places) {
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
      placesServiceRef.current = new window.google.maps.places.PlacesService(document.createElement('div'));
      setIsGoogleMapsReady(true);
    } else if (GOOGLE_MAPS_API_KEY) {
      loadGoogleMapsPlaces(GOOGLE_MAPS_API_KEY)
        .then((g) => {
          if (g?.maps?.places) {
            autocompleteServiceRef.current = new g.maps.places.AutocompleteService();
            placesServiceRef.current = new g.maps.places.PlacesService(document.createElement('div'));
            setIsGoogleMapsReady(true);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Map state & refs
  const [mapType, setMapType] = useState('roadmap'); // 'roadmap' | 'hybrid'
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markerDestRef = useRef(null);
  const markerUserRef = useRef(null);
  const routePolylineRef = useRef(null);

  // Helper to create authentic Google Maps destination red pin DivIcon
  const createDestPinIcon = useCallback((label) => {
    if (!window.L) return null;
    return window.L.divIcon({
      className: 'custom-google-dest-marker',
      html: `
        <div class="google-dest-pin-wrapper">
          <div class="google-dest-pin-label">${label || 'Destination'}</div>
          <div class="google-pin-svg-wrap">
            <svg width="28" height="38" viewBox="0 0 28 38" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 0C6.27 0 0 6.27 0 14C0 24.5 14 38 14 38C14 38 28 24.5 28 14C28 6.27 21.73 0 14 0Z" fill="#EA4335"/>
              <circle cx="14" cy="14" r="5" fill="#FFFFFF"/>
              <circle cx="14" cy="14" r="2.5" fill="#B31412"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [120, 58],
      iconAnchor: [60, 58],
    });
  }, []);

  // Update map pin and camera centered on destination point only
  const updateMapForDestination = useCallback(
    (dest, shouldAnimate = true) => {
      if (!mapInstanceRef.current || !dest) return;
      const map = mapInstanceRef.current;
      const destLat = Number(dest.lat);
      const destLng = Number(dest.lng);

      // Ensure any user starting marker or route line is removed so it ONLY pins destination
      if (markerUserRef.current) {
        map.removeLayer(markerUserRef.current);
        markerUserRef.current = null;
      }
      if (routePolylineRef.current) {
        map.removeLayer(routePolylineRef.current);
        routePolylineRef.current = null;
      }

      // Update Destination Marker — only pinned on destination point
      if (markerDestRef.current) {
        markerDestRef.current.setLatLng([destLat, destLng]);
        const newIcon = createDestPinIcon(dest.name);
        if (newIcon) markerDestRef.current.setIcon(newIcon);
      } else {
        const newIcon = createDestPinIcon(dest.name);
        markerDestRef.current = window.L.marker([destLat, destLng], {
          icon: newIcon,
          draggable: true,
        }).addTo(map);
      }

      // Smooth camera transition centered directly on destination point only (zoom 15)
      if (shouldAnimate) {
        map.flyTo([destLat, destLng], 15, { duration: 0.8 });
      } else {
        map.setView([destLat, destLng], 15);
      }
    },
    [createDestPinIcon]
  );

  // Live Geocoding Search: Curated instant matches + Google Maps related places + online geocoding
  const performGeocoding = useCallback(
    async (queryText) => {
      if (!queryText || queryText.trim().length < 2) {
        setSuggestions([]);
        setIsSearchingOnline(false);
        return;
      }

      const trimmed = queryText.trim();
      currentSearchQueryRef.current = trimmed;

      // 1. Direct coordinate check
      const parsedCoords = parseCoordinatesOrUrl(trimmed);
      if (parsedCoords) {
        const coordDest = {
          name: `Pinned Coordinates (${parsedCoords.lat.toFixed(4)}, ${parsedCoords.lng.toFixed(4)})`,
          city: 'Custom Coordinates',
          lat: parsedCoords.lat,
          lng: parsedCoords.lng,
          source: 'coords',
          type: 'coords',
        };
        setSuggestions([coordDest]);
        setShowSuggestions(true);
        setIsSearchingOnline(false);
        return;
      }

      // 2. Instant curated matches with Google Maps related places & typo tolerance (0ms response)
      const localMatches = searchDestinationsLocally(trimmed, currentLocation);
      if (localMatches.length > 0) {
        setSuggestions(localMatches);
      }
      setShowSuggestions(true);

      // 3. Cancel any previous in-flight geocode requests to prevent stale results
      if (activeSearchAbortRef.current) {
        activeSearchAbortRef.current.abort();
      }
      const abortCtrl = new AbortController();
      activeSearchAbortRef.current = abortCtrl;
      setIsSearchingOnline(true);

      try {
        // Query Google Maps Places Autocomplete if available
        let googlePredictions = [];
        if (autocompleteServiceRef.current && window.google?.maps) {
          try {
            const biasLat = currentLocation?.lat || 11.0168;
            const biasLng = currentLocation?.lng || 76.9558;
            const req = {
              input: trimmed,
              componentRestrictions: { country: 'in' },
            };
            if (biasLat && biasLng) {
              req.locationBias = new window.google.maps.LatLng(biasLat, biasLng);
              req.radius = 50000;
            }
            googlePredictions = await new Promise((resolve) => {
              autocompleteServiceRef.current.getPlacePredictions(req, (preds, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && preds) {
                  resolve(
                    preds.map((p) => ({
                      placeId: p.place_id,
                      name: p.structured_formatting?.main_text || p.description.split(',')[0],
                      city: p.structured_formatting?.secondary_text || p.description,
                      source: 'google_maps',
                      type: 'landmark',
                      isGoogle: true,
                    }))
                  );
                } else {
                  resolve([]);
                }
              });
            });
          } catch (gErr) {
            console.warn('Google Places prediction notice:', gErr);
          }
        }

        const onlineResults = await searchPlacesOnline(
          trimmed,
          currentLocation?.lat,
          currentLocation?.lng,
          abortCtrl.signal
        );

        // Ensure this is still the active search query
        if (currentSearchQueryRef.current === trimmed) {
          const combined = [...localMatches];

          for (const gItem of googlePredictions) {
            const isDup = combined.some(
              (c) => c.name.toLowerCase().trim() === gItem.name.toLowerCase().trim()
            );
            if (!isDup) combined.push(gItem);
          }

          for (const item of onlineResults) {
            const isDup = combined.some(
              (c) =>
                c.name.toLowerCase().trim() === item.name.toLowerCase().trim() ||
                (c.lat && c.lng && item.lat && item.lng &&
                  Math.abs(c.lat - item.lat) < 0.0006 &&
                  Math.abs(c.lng - item.lng) < 0.0006)
            );
            if (!isDup) combined.push(item);
          }

          setSuggestions(combined);
          setShowSuggestions(true);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Geocoding search notice:', err);
        }
      } finally {
        if (currentSearchQueryRef.current === trimmed) {
          setIsSearchingOnline(false);
        }
      }
    },
    [currentLocation]
  );

  // Handle typing with 0ms instant local response + 160ms background online debounce
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (!val.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSearchingOnline(false);
      return;
    }

    const trimmed = val.trim();
    if (trimmed.length >= 2) {
      setShowSuggestions(true);
      const instantLocal = searchDestinationsLocally(trimmed, currentLocation);
      if (instantLocal.length > 0) {
        setSuggestions(instantLocal);
      }
      if (instantLocal.length < 4) {
        setIsSearchingOnline(true);
      }
    }

    debounceTimerRef.current = setTimeout(() => {
      performGeocoding(val);
    }, 160);
  };

  // Select place from suggestions and immediately pin to map like Google Maps
  const handleSelectSuggestion = useCallback(
    (dest) => {
      if (!dest) return;

      if (dest.isGoogle && dest.placeId && placesServiceRef.current && window.google?.maps) {
        placesServiceRef.current.getDetails(
          { placeId: dest.placeId, fields: ['name', 'geometry', 'formatted_address'] },
          (place, status) => {
            if (
              status === window.google.maps.places.PlacesServiceStatus.OK &&
              place?.geometry?.location
            ) {
              const resolved = {
                name: place.name || dest.name,
                city: place.formatted_address || dest.city,
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
                type: dest.type || 'landmark',
                source: 'google_maps',
              };
              setSelectedDestination(resolved);
              setSearchQuery(resolved.name);
              setShowSuggestions(false);
              setIsConfirmed(true);
              updateMapForDestination(resolved, true);
            }
          }
        );
        return;
      }

      setSelectedDestination(dest);
      setSearchQuery(dest.name);
      setShowSuggestions(false);
      setIsConfirmed(true);
      updateMapForDestination(dest, true);
    },
    [updateMapForDestination]
  );

  // Immediate search and pin execution (triggered by Enter key or Search icon click)
  const executeImmediateSearch = useCallback(
    async (queryText) => {
      const trimmed = (queryText || '').trim();
      if (!trimmed) return;

      // 1. Direct coordinate check
      const parsedCoords = parseCoordinatesOrUrl(trimmed);
      if (parsedCoords) {
        const coordDest = {
          name: `Pinned Coordinates (${parsedCoords.lat.toFixed(4)}, ${parsedCoords.lng.toFixed(4)})`,
          city: 'Custom Coordinates',
          lat: parsedCoords.lat,
          lng: parsedCoords.lng,
          source: 'coords',
          type: 'coords',
        };
        handleSelectSuggestion(coordDest);
        return;
      }

      // 2. Check instant curated destinations first
      const localMatches = searchDestinationsLocally(trimmed, currentLocation);
      if (localMatches && localMatches.length > 0) {
        handleSelectSuggestion(localMatches[0]);
        return;
      }

      // 3. Online search and auto-pin top result
      setIsSearchingOnline(true);
      try {
        const places = await searchPlacesOnline(
          trimmed,
          currentLocation?.lat,
          currentLocation?.lng
        );
        if (places && places.length > 0) {
          handleSelectSuggestion(places[0]);
        }
      } catch (err) {
        console.warn('Immediate search execution error:', err);
      } finally {
        setIsSearchingOnline(false);
      }
    },
    [currentLocation]
  );

  // Keyboard Enter key on search input selects top result and pins it
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0) {
        handleSelectSuggestion(suggestions[0]);
      } else if (searchQuery.trim()) {
        executeImmediateSearch(searchQuery.trim());
      }
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const onMouseDown = (e) => {
      if (
        searchInputWrapperRef.current &&
        !searchInputWrapperRef.current.contains(e.target)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // Handle switching map type between Google Map Roadmap and Google Satellite Hybrid
  const handleToggleMapType = (type) => {
    setMapType(type);
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const googleTileUrl =
      type === 'hybrid'
        ? 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
        : 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    tileLayerRef.current = window.L.tileLayer(googleTileUrl, {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '© Google Maps',
    }).addTo(map);
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  const handleRecenter = () => {
    if (mapInstanceRef.current && selectedDestination) {
      mapInstanceRef.current.flyTo(
        [Number(selectedDestination.lat), Number(selectedDestination.lng)],
        15,
        { duration: 0.6 }
      );
    }
  };

  // Initialize Google Maps pinned to user entered destination only
  useEffect(() => {
    if (!window.L || !mapContainerRef.current) return;

    const destLat = Number(selectedDestination.lat);
    const destLng = Number(selectedDestination.lng);

    if (!mapInstanceRef.current) {
      const map = window.L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([destLat, destLng], 15);
      mapInstanceRef.current = map;

      // Authentic Google Maps Roadmap tiles
      const googleTileUrl =
        mapType === 'hybrid'
          ? 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
          : 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

      tileLayerRef.current = window.L.tileLayer(googleTileUrl, {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '© Google Maps',
      }).addTo(map);

      // Destination Marker — User entered destination only
      const pinIcon = createDestPinIcon(selectedDestination.name);
      markerDestRef.current = window.L.marker([destLat, destLng], {
        icon: pinIcon,
        draggable: true,
      }).addTo(map);

      // Invalidate size after layout render to ensure exact centering
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
          mapInstanceRef.current.panTo([destLat, destLng]);
        }
      }, 100);

      // Tap anywhere on map to drop and pin destination
      map.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        const newCoords = {
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
        };

        let placeName = `Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        let placeCity = 'Tamil Nadu';

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data?.display_name) {
              const parts = data.display_name.split(',');
              placeName = parts[0].trim();
              placeCity = parts.slice(1, 4).join(',').trim();
            }
          }
        } catch (err) {}

        const newDest = {
          name: placeName,
          city: placeCity,
          ...newCoords,
        };

        setSelectedDestination(newDest);
        setSearchQuery(placeName);
        setIsConfirmed(true);
        updateMapForDestination(newDest);
      });

      // Drag pin to adjust user entered destination
      markerDestRef.current.on('dragend', async (e) => {
        const pos = e.target.getLatLng();
        let placeName = `Pinned (${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)})`;
        let placeCity = 'Selected Location';

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.lat}&lon=${pos.lng}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data?.display_name) {
              const parts = data.display_name.split(',');
              placeName = parts[0].trim();
              placeCity = parts.slice(1, 4).join(',').trim();
            }
          }
        } catch (err) {}

        const newDest = {
          name: placeName,
          city: placeCity,
          lat: Number(pos.lat.toFixed(6)),
          lng: Number(pos.lng.toFixed(6)),
        };
        setSelectedDestination(newDest);
        setSearchQuery(placeName);
        setIsConfirmed(true);
        updateMapForDestination(newDest);
      });
    } else {
      updateMapForDestination(selectedDestination);
    }
  }, [selectedDestination, createDestPinIcon, updateMapForDestination, mapType]);

  const handleStartTripClick = () => {
    const finalDist = isCustom
      ? Math.max(0.5, Number(customInput) || 3)
      : alertDistanceKm;
    onStartTrip(selectedDestination, finalDist);
  };

  // Direct Google Maps Search Link (pinned at exact coordinates)
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${selectedDestination.lat},${selectedDestination.lng}`;

  return (
    <div className="screen-container screen-select-dest">
      <StatusBar theme="light" />

      {/* Top Header */}
      <header className="screen-header">
        <button
          type="button"
          className="header-back-btn"
          onClick={onBack}
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="header-title">Select Destination</h2>
      </header>

      {/* Search Bar with Live Geocoding */}
      <div className="dest-search-bar-wrap" ref={searchInputWrapperRef}>
        <div className="dest-search-input-box">
          {isSearchingOnline ? (
            <Loader2 size={18} className="search-icon animate-spin text-blue-600" />
          ) : (
            <button
              type="button"
              className="search-submit-icon-btn"
              onClick={() => {
                if (suggestions.length > 0) {
                  handleSelectSuggestion(suggestions[0]);
                } else if (searchQuery.trim()) {
                  executeImmediateSearch(searchQuery.trim());
                }
              }}
              title="Search and pin destination"
              aria-label="Search and pin destination"
            >
              <Search size={18} className="search-icon" />
            </button>
          )}

          <input
            id="input-search-destination"
            type="text"
            className="dest-search-input"
            placeholder="Search destination, village, bus stop..."
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              } else if (searchQuery.trim().length >= 2) {
                setShowSuggestions(true);
                performGeocoding(searchQuery.trim());
              }
            }}
            autoComplete="off"
          />

          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => {
                setSearchQuery('');
                setSuggestions([]);
                setShowSuggestions(false);
              }}
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Live Suggestions Dropdown */}
        {showSuggestions && (suggestions.length > 0 || isSearchingOnline) && (
          <div className="dest-suggestions-dropdown">
            {suggestions.map((item, idx) => {
              const itemDist =
                currentLocation && item.lat && item.lng
                  ? haversineDistanceKm(
                      currentLocation.lat,
                      currentLocation.lng,
                      item.lat,
                      item.lng
                    )
                  : null;

              const isFirstRelated =
                item.isRelated && (!suggestions[idx - 1] || !suggestions[idx - 1].isRelated);

              return (
                <React.Fragment key={`${item.name}-${item.lat}-${idx}`}>
                  {isFirstRelated && (
                    <div className="dest-suggestion-section-header">
                      <Navigation size={12} className="shrink-0 text-blue-600" />
                      <span>Related Places in {item.relatedTo || item.district || 'Destination'}</span>
                    </div>
                  )}

                  <div
                    className="dest-suggestion-item"
                    onClick={() => handleSelectSuggestion(item)}
                  >
                    <div className={`dest-suggestion-pin ${getPlacePinClass(item.type)}`}>
                      {renderPlaceIcon(item.type)}
                    </div>
                    <div className="dest-suggestion-info">
                      <div className="dest-suggestion-title-row">
                        <span className="dest-suggestion-name">
                          {highlightMatch(item.name, searchQuery)}
                        </span>
                        {item.isGoogle && (
                          <span className="google-source-badge">
                            Google
                          </span>
                        )}
                        {item.type && (
                          <span className="dest-type-badge">
                            {formatPlaceType(item.type)}
                          </span>
                        )}
                      </div>
                      <div className="dest-suggestion-city line-clamp-1">
                        {item.city}
                      </div>
                    </div>
                    {itemDist !== null && (
                      <span className="dest-item-distance-pill">
                        {itemDist < 10 ? itemDist.toFixed(1) : Math.round(itemDist)} km
                      </span>
                    )}
                  </div>
                </React.Fragment>
              );
            })}

            {isSearchingOnline && suggestions.length > 0 && (
              <div className="dest-suggestion-loading-more">
                <Loader2 size={12} className="animate-spin text-blue-500 shrink-0" />
                <span>Searching Google Maps & online places...</span>
              </div>
            )}

            {isSearchingOnline && suggestions.length === 0 && (
              <div className="dest-suggestion-loading-row">
                <Loader2 size={15} className="animate-spin text-blue-600 shrink-0" />
                <span>Searching Google Maps & places for "{searchQuery}"...</span>
              </div>
            )}

            {!isSearchingOnline && suggestions.length === 0 && searchQuery.trim().length >= 2 && (
              <div className="dest-suggestion-loading-row" style={{ color: '#64748B', fontWeight: 500 }}>
                <span>No places found for "{searchQuery}". Check spelling or nearby area.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Location Chips (Includes Kallakurichi, Parikkal, Coimbatore, Chennai, etc.) */}
      <div className="quick-chips-scroll">
        {QUICK_DESTINATION_CHIPS.map((item) => {
          const chipDist =
            currentLocation && item.lat && item.lng
              ? haversineDistanceKm(
                  currentLocation.lat,
                  currentLocation.lng,
                  item.lat,
                  item.lng
                )
              : null;

          return (
            <button
              key={item.name}
              type="button"
              className={`quick-chip ${
                selectedDestination.name === item.name ? 'chip-active' : ''
              }`}
              onClick={() => handleSelectSuggestion(item)}
            >
              <span>{item.name}</span>
              {chipDist !== null && (
                <span className="chip-dist">
                  ({chipDist < 10 ? chipDist.toFixed(1) : Math.round(chipDist)}km)
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Interactive Google Map View — Pinned to User Entered Destination Only */}
      <div className="interactive-map-wrapper">
        <div ref={mapContainerRef} className="leaflet-dest-map"></div>

        {/* Google Map / Satellite Layer Toggle */}
        <div className="google-map-type-toggle">
          <button
            type="button"
            className={`google-map-type-btn ${mapType === 'roadmap' ? 'active' : ''}`}
            onClick={() => handleToggleMapType('roadmap')}
          >
            Map
          </button>
          <button
            type="button"
            className={`google-map-type-btn ${mapType === 'hybrid' ? 'active' : ''}`}
            onClick={() => handleToggleMapType('hybrid')}
          >
            Satellite
          </button>
        </div>

        {/* Official Google Watermark Branding */}
        <div className="google-watermark-badge">
          <span className="g-blue">G</span>
          <span className="g-red">o</span>
          <span className="g-yellow">o</span>
          <span className="g-blue">g</span>
          <span className="g-green">l</span>
          <span className="g-red">e</span>
          <span className="g-sub">Maps</span>
        </div>

        {/* Floating Google Controls Group (Zoom In, Zoom Out, Center Pin) */}
        <div className="google-map-controls-group">
          <button
            type="button"
            className="google-ctrl-btn"
            onClick={handleZoomIn}
            title="Zoom In"
            aria-label="Zoom In"
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            className="google-ctrl-btn"
            onClick={handleZoomOut}
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <Minus size={16} />
          </button>
          <button
            type="button"
            className="google-ctrl-btn"
            onClick={handleRecenter}
            title="Center on destination"
            aria-label="Center on destination"
          >
            <LocateFixed size={16} />
          </button>
        </div>
      </div>

      {/* Selected Destination Card with Live Distance & Confirm Button */}
      <div className="destination-preview-card">
        <div className="dest-preview-top">
          <div className="dest-preview-pin">
            <MapPin size={20} className="text-blue-600" />
          </div>
          <div className="dest-preview-text">
            <h3 className="dest-preview-name">{selectedDestination.name}</h3>
            <p className="dest-preview-city">{selectedDestination.city}</p>
            <p className="dest-preview-coords text-xs text-slate-400 mt-0.5">
              {selectedDestination.lat.toFixed(4)}° N, {selectedDestination.lng.toFixed(4)}° E
            </p>
          </div>
        </div>

        {/* Live Distance Callout between Current Location and Destination */}
        <div className="dest-preview-distance-card">
          <div className="dest-preview-dist-header">
            <div className="dest-preview-dist-icon">
              <Navigation size={18} className="text-white" />
            </div>
            <div className="dest-preview-dist-text">
              <div className="dest-preview-dist-main">
                <span className="dest-preview-dist-val">
                  {distanceInfo.distanceKm !== null
                    ? `${distanceInfo.distanceKm.toFixed(1)} km`
                    : currentLocation
                    ? 'Measuring distance...'
                    : 'Location not detected'}
                </span>
                {distanceInfo.distanceKm !== null && (
                  <span className="dest-preview-dist-badge">
                    {distanceInfo.routeType === 'road' ? 'Road driving' : 'Direct line'}
                  </span>
                )}
              </div>
              <p className="dest-preview-dist-sub">
                {distanceInfo.distanceKm !== null
                  ? `Distance from your current location${distanceInfo.durationText ? ` • ~${distanceInfo.durationText}` : ''}`
                  : currentLocation
                  ? 'Calculating live distance from GPS...'
                  : 'Detect location to see exact distance to destination'}
              </p>
            </div>
          </div>

          {!currentLocation && onGetLocation && (
            <button
              type="button"
              className="dest-detect-btn"
              onClick={() => onGetLocation()}
            >
              <LocateFixed size={14} className="mr-1" />
              Detect My Location
            </button>
          )}
        </div>

        {/* Action Buttons Row */}
        <div className="dest-actions-row flex flex-col gap-2">
          <button
            id="btn-confirm-destination"
            type="button"
            className={`btn-confirm-dest ${isConfirmed ? 'btn-confirmed' : ''}`}
            onClick={() => setIsConfirmed(true)}
          >
            {isConfirmed ? (
              <>
                <Check size={18} className="mr-1 inline" /> Destination Confirmed
              </>
            ) : (
              'Confirm Destination'
            )}
          </button>

          {/* Direct Google Maps link pinned to this destination */}
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-google-maps-link"
            title="Open in Google Maps"
          >
            <ExternalLink size={14} className="mr-1.5" />
            <span>Open & Pin in Google Maps</span>
          </a>
        </div>
      </div>

      {/* Alarm Before Arrival Setup Section */}
      <section className="alarm-setup-section">
        <div className="alarm-setup-header">
          <h3 className="alarm-setup-title">Alarm Before Arrival</h3>
          <p className="alarm-setup-subtitle">
            Set the distance before your destination
          </p>
        </div>

        <div className="alarm-distance-radio-group">
          {/* 5 km option */}
          <label
            className={`alarm-radio-row ${
              !isCustom && alertDistanceKm === 5 ? 'radio-selected' : ''
            }`}
            onClick={() => {
              setIsCustom(false);
              setAlertDistanceKm(5);
            }}
          >
            <div className="radio-circle">
              {!isCustom && alertDistanceKm === 5 && <div className="radio-dot" />}
            </div>
            <span className="radio-label">5 km</span>
          </label>

          {/* 3 km option */}
          <label
            className={`alarm-radio-row ${
              !isCustom && alertDistanceKm === 3 ? 'radio-selected' : ''
            }`}
            onClick={() => {
              setIsCustom(false);
              setAlertDistanceKm(3);
            }}
          >
            <div className="radio-circle">
              {!isCustom && alertDistanceKm === 3 && <div className="radio-dot" />}
            </div>
            <span className="radio-label">3 km</span>
          </label>

          {/* 2 km option */}
          <label
            className={`alarm-radio-row ${
              !isCustom && alertDistanceKm === 2 ? 'radio-selected' : ''
            }`}
            onClick={() => {
              setIsCustom(false);
              setAlertDistanceKm(2);
            }}
          >
            <div className="radio-circle">
              {!isCustom && alertDistanceKm === 2 && <div className="radio-dot" />}
            </div>
            <span className="radio-label">2 km</span>
          </label>

          {/* Custom Distance */}
          <label
            className={`alarm-radio-row ${isCustom ? 'radio-selected' : ''}`}
            onClick={() => setIsCustom(true)}
          >
            <div className="radio-circle">
              {isCustom && <div className="radio-dot" />}
            </div>
            <span className="radio-label">Custom Distance</span>
            <div className="custom-input-box" onClick={(e) => e.stopPropagation()}>
              <input
                id="input-custom-distance"
                type="number"
                min="0.5"
                max="50"
                step="0.5"
                value={customInput}
                onChange={(e) => {
                  setIsCustom(true);
                  setCustomInput(e.target.value);
                  const val = parseFloat(e.target.value);
                  if (val > 0) setAlertDistanceKm(val);
                }}
                className="custom-distance-field"
              />
              <span className="custom-distance-unit">km</span>
            </div>
          </label>
        </div>

        {/* Start Trip Button */}
        <button
          id="btn-start-trip"
          type="button"
          className="btn-primary-blue btn-start-trip"
          onClick={handleStartTripClick}
        >
          Start Trip
        </button>
      </section>
    </div>
  );
}
