import React, { useState } from 'react';
import InteractiveMapPicker from './InteractiveMapPicker';

// Curated transit stations, colleges, and hubs for instant zero-lag lookup
const KNOWN_PLACES = [
  {
    name: 'Suguna College of Engineering',
    aliases: ['suguna', 'suguna college', 'suguna college of engineering', 'suguna engg'],
    lat: 11.0512101,
    lng: 77.0375837,
    city: 'Coimbatore',
  },
  {
    name: 'Suguna PIP School / Tex Park',
    aliases: ['suguna pip', 'tex park', 'civil aerodrome coimbatore'],
    lat: 11.0506333,
    lng: 77.0314166,
    city: 'Coimbatore',
  },
  {
    name: 'Gandhipuram Central Bus Stand',
    aliases: ['gandhipuram', 'coimbatore bus stand', 'gandhipuram bus stand'],
    lat: 11.0183,
    lng: 76.9678,
    city: 'Coimbatore',
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

export default function DestinationSearch({
  destination,
  setDestination,
  disabled,
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

  // Open Google Maps in a new tab
  const handleOpenGoogleMaps = () => {
    const searchTerm = gmapsInput.trim() || query.trim() || destination?.name || '';
    if (searchTerm) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchTerm)}`,
        '_blank'
      );
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
      setConfirmMsg(`✅ Confirmed: "${parsedGmaps.name}" (${parsedGmaps.lat}, ${parsedGmaps.lng}) sent to project!`);
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
      setConfirmMsg(`✅ Confirmed: "${resolved.name}" (${resolved.lat}, ${resolved.lng}) sent to project!`);
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
        setConfirmMsg(`✅ Confirmed: "${top.name}" (${top.lat.toFixed(4)}, ${top.lng.toFixed(4)}) sent to project!`);
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
        setConfirmMsg(`✅ Confirmed: "${top.name}" (${top.lat.toFixed(4)}, ${top.lng.toFixed(4)}) sent to project!`);
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
          {/* Main Input + Confirm Destination */}
          <form onSubmit={handleConfirmInput} style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <div className="input-with-icon" style={{ flex: '1 1 200px' }}>
              <span className="input-icon">🔍</span>
              <input
                type="text"
                className="text-input"
                placeholder="Enter college, bus stop, city or paste Google link..."
                value={gmapsInput}
                onChange={(e) => setGmapsInput(e.target.value)}
                disabled={disabled}
              />
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

          {/* Popular Transit & Destination Presets */}
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
                      setDestination({ name: preset.name, lat: preset.lat, lng: preset.lng });
                      setConfirmMsg(`✅ Confirmed: "${preset.name}" sent to project!`);
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
                    `https://www.google.com/maps?q=${destination.lat},${destination.lng}`,
                    '_blank'
                  )
                }
                title="Open exact coordinates on Google Maps"
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
                src={`https://maps.google.com/maps?q=${destination.lat},${destination.lng}&z=15&output=embed`}
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
