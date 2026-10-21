import React, { useEffect, useRef, useState } from 'react';
import StatusBar from '../components/StatusBar';
import appLogo from '../assets/ic_launcher_round.png';
import {
  MapPin,
  Route,
  Bell,
  Settings,
  ChevronRight,
  Crosshair,
  Clock,
  Info,
  Bus,
  Compass,
  Square,
  Play,
  RotateCcw,
  X,
  Map,
  Sun,
  Moon,
} from 'lucide-react';

export default function ActiveTripScreen({
  destination,
  alertDistanceKm = 3,
  currentLocation,
  remainingDistanceKm,
  initialDistanceKm,
  routeDetails = {},
  gpsError = null,
  isSimulating = false,
  onToggleSimulate,
  onStopTrip,
  onOpenSettings,
  onSnooze,
  theme = 'light',
  onToggleTheme,
}) {
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);
  const [showLiveMap, setShowLiveMap] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('Just now');

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerDestRef = useRef(null);
  const markerUserRef = useRef(null);
  const routePolylineRef = useRef(null);

  const destName = destination?.name || 'Munnar';
  const destCity = destination?.city || 'Devikulam, Kerala, India';

  // Total journey distance established at start (never less than remaining distance)
  const initDist = Math.max(initialDistanceKm || 0, remainingDistanceKm || 0) || 165;

  // Present remaining distance (decreases as user gets closer: e.g. 165 -> 150 -> 100 -> 50 -> 0)
  const remDist = remainingDistanceKm !== null ? remainingDistanceKm : initDist;
  const displayRemDist = remDist < 10 ? remDist.toFixed(1) : Math.round(remDist);

  // Distance Travelled (starts at 0 km initially and increases as user moves)
  const distanceTravelled = Math.max(0, initDist - remDist);
  const displayTravelled = distanceTravelled < 10 ? distanceTravelled.toFixed(1) : Math.round(distanceTravelled);

  // Circular gauge progress percentage (0% at trip start, fills to 100% on arrival)
  const progressPercent = initDist > 0
    ? Math.min(100, Math.max(0, Math.round((distanceTravelled / initDist) * 100)))
    : 0;

  // Circular gauge circumference (radius = 46)
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  // Circular offset: 0% progress -> strokeDashoffset = circumference; 100% -> 0
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  // Calculate ETA clock string
  const formatETA = () => {
    const mins = routeDetails?.durationMin || Math.round((remDist || 30) * 2.1);
    const arrival = new Date(Date.now() + mins * 60000);
    let h = arrival.getHours();
    const m = arrival.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };

  const etaText = formatETA();

  // Track last update text
  useEffect(() => {
    setLastUpdated('Just now');
    const t = setInterval(() => {
      setLastUpdated('1 min ago');
    }, 60000);
    return () => clearInterval(t);
  }, [currentLocation]);

  // Leaflet map setup for expandable live map
  useEffect(() => {
    if (!showLiveMap || !window.L || !mapContainerRef.current) return;

    const destLat = destination?.lat || 10.0889;
    const destLng = destination?.lng || 77.0595;
    const userLat = currentLocation?.lat || destLat - 0.035;
    const userLng = currentLocation?.lng || destLng - 0.035;

    if (!mapInstanceRef.current) {
      const map = window.L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([destLat, destLng], 12);
      mapInstanceRef.current = map;

      window.L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '© Google Maps',
      }).addTo(map);

      // Destination pin
      const destIcon = window.L.divIcon({
        className: 'dest-custom-pin',
        html: `<div style="background:#1E6BFF;border:3px solid #FFFFFF;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(30,107,255,0.45);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      markerDestRef.current = window.L.marker([destLat, destLng], { icon: destIcon }).addTo(map);

      // User live puck
      const userIcon = window.L.divIcon({
        className: 'user-custom-puck',
        html: `<div style="background:#10B981;border:3px solid #FFFFFF;border-radius:50%;width:22px;height:22px;box-shadow:0 0 16px rgba(16,185,129,0.8);"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      markerUserRef.current = window.L.marker([userLat, userLng], { icon: userIcon }).addTo(map);

      // Route polyline
      routePolylineRef.current = window.L.polyline(
        [
          [userLat, userLng],
          [destLat, destLng],
        ],
        { color: '#1E6BFF', weight: 4.5, opacity: 0.9, dashArray: '6, 8' }
      ).addTo(map);

      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
          const bounds = window.L.latLngBounds([
            [userLat, userLng],
            [destLat, destLng],
          ]);
          mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
        }
      }, 100);
    } else {
      if (markerUserRef.current) {
        markerUserRef.current.setLatLng([userLat, userLng]);
      }
      if (routePolylineRef.current) {
        routePolylineRef.current.setLatLngs([
          [userLat, userLng],
          [destLat, destLng],
        ]);
      }
    }
  }, [showLiveMap, currentLocation, destination]);

  return (
    <div className="screen-container arraivo-white-blue-screen">
      <StatusBar theme="light" />

      {/* Top Header Bar: Arraivo Logo + Title + Alarm Pill + Settings */}
      <header className="arraivo-light-topbar">
        <div className="arraivo-header-left">
          <div className="arraivo-logo-circle">
            <img
              src={appLogo}
              alt="Arraivo Logo"
              className="arraivo-logo-img"
            />
          </div>
          <div className="arraivo-brand-text">
            <h1 className="arraivo-app-name">Arraivo</h1>
            <p className="arraivo-app-motto">Travel Smart. Arrive Safe.</p>
          </div>
        </div>

        <div className="arraivo-header-right">
          <div className="arraivo-alarm-badge-pill">
            <Bell size={13} className="text-blue-600 fill-blue-600" />
            <span>{alertDistanceKm} km alarm</span>
          </div>
          {onToggleTheme && (
            <button
              type="button"
              className="arraivo-top-settings-btn theme-toggle-btn"
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun size={18} className="theme-icon-sun" />
              ) : (
                <Moon size={18} className="theme-icon-moon" />
              )}
            </button>
          )}
          <button
            type="button"
            className="arraivo-top-settings-btn"
            onClick={onOpenSettings}
            title="Open Application Settings"
            aria-label="Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="arraivo-screen-content">
        {/* Destination Card (Image removed per request) */}
        <div
          className="arraivo-dest-card-clean"
          onClick={() => setShowLiveMap(!showLiveMap)}
          title="Click to view route on map"
        >
          <div className="dest-pin-badge">
            <MapPin size={22} className="text-blue-600" />
          </div>

          <div className="dest-text-column">
            <h2 className="dest-title-text">{destName}</h2>
            <p className="dest-location-sub">{destCity}</p>
          </div>

          <div className="dest-chevron-box">
            <ChevronRight size={20} className="text-slate-400" />
          </div>
        </div>

        {/* 3-Column Metrics Panel */}
        <div className="arraivo-metrics-panel">
          {/* Col 1: Alarm Distance */}
          <div className="metric-column">
            <div className="metric-icon-circle">
              <Crosshair size={18} className="text-blue-600" />
            </div>
            <div className="metric-number-val">{alertDistanceKm} km</div>
            <div className="metric-caption-label">Alarm Distance</div>
          </div>

          <div className="metrics-column-separator" />

          {/* Col 2: Road Distance (Actual remaining distance from present location that decreases) */}
          <div className="metric-column">
            <div className="metric-icon-circle">
              <Route size={18} className="text-blue-600" />
            </div>
            <div className="metric-number-val">{displayRemDist} km</div>
            <div className="metric-caption-label flex items-center justify-center gap-1">
              <span>Road Distance</span>
              <Info size={11} className="opacity-70" />
            </div>
          </div>

          <div className="metrics-column-separator" />

          {/* Col 3: ETA */}
          <div className="metric-column">
            <div className="metric-icon-circle">
              <Clock size={18} className="text-blue-600" />
            </div>
            <div className="metric-number-val">{etaText}</div>
            <div className="metric-caption-label flex items-center justify-center gap-1">
              <span>ETA</span>
              <Info size={11} className="opacity-70" />
            </div>
          </div>
        </div>

        {/* Main Status Card: Circular Progress Ring (Distance Travelled) & Traveling Info */}
        <div className="arraivo-status-card">
          <div className="status-card-body">
            {/* Left: Circular Donut Gauge showing Distance Travelled (starts at 0 km) */}
            <div className="gauge-donut-wrapper">
              <svg className="gauge-donut-svg" viewBox="0 0 110 110">
                {/* Background track circle */}
                <circle
                  cx="55"
                  cy="55"
                  r={radius}
                  className="gauge-circle-track"
                />
                {/* Active progress arc filling up as user travels */}
                <circle
                  cx="55"
                  cy="55"
                  r={radius}
                  className="gauge-circle-arc"
                  style={{
                    strokeDasharray: circumference,
                    strokeDashoffset: strokeDashoffset,
                  }}
                />
              </svg>

              <div className="gauge-center-content">
                <span className="gauge-center-km">{displayTravelled} km</span>
                <span className="gauge-center-sub">travelled</span>
              </div>
            </div>

            {/* Right: Traveling Status Info */}
            <div className="gauge-info-column">
              <div className="transit-vehicle-badge">
                <Bus size={22} className="text-blue-600" />
              </div>

              <div className="traveling-to-label">Traveling to</div>
              <h3 className="traveling-dest-title">{destName}</h3>

              <div className="status-live-pill">
                <span className="live-pulsing-dot" />
                <span>{gpsError ? 'GPS Reconnecting' : 'GPS Active'}</span>
              </div>

              <div className="last-update-row">
                <Compass size={13} className="text-slate-400" />
                <span>Last update • {lastUpdated}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Inspirational Journey Banner */}
        <div className="arraivo-quote-card">
          <div className="quote-left-wrap">
            <div className="quote-mountain-icon">
              <svg viewBox="0 0 48 32" className="w-full h-full">
                <polygon
                  points="4,28 18,8 32,28"
                  fill="none"
                  stroke="#1E6BFF"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polygon
                  points="24,28 36,12 46,28"
                  fill="none"
                  stroke="#1E6BFF"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.8"
                />
              </svg>
            </div>
            <p className="quote-body-text">“Great journeys begin with a single step.”</p>
          </div>

          <div className="quote-badge-right">
            <div className="neon-keep-going-badge">
              <span className="keep-going-text">Keep<br />Going</span>
            </div>
          </div>
        </div>

        {/* Action Buttons: Stop Trip & Snooze */}
        <div className="arraivo-action-buttons-group">
          <button
            id="btn-stop-trip"
            type="button"
            className="btn-arraivo-stop-trip"
            onClick={() => setConfirmStopOpen(true)}
          >
            <Square size={16} className="fill-current" />
            <span>Stop Trip</span>
          </button>

          <button
            id="btn-snooze-action"
            type="button"
            className="btn-arraivo-snooze"
            onClick={onSnooze || (() => setConfirmStopOpen(true))}
          >
            <Bell size={16} />
            <span>Snooze (5 min)</span>
          </button>
        </div>

        {/* Secondary controls: Toggle Live Map & Simulator */}
        <div className="arraivo-secondary-links-row">
          <button
            type="button"
            className="secondary-link-btn"
            onClick={() => setShowLiveMap(!showLiveMap)}
          >
            <Map size={13} />
            <span>{showLiveMap ? 'Hide Live Map' : 'View Live Map'}</span>
          </button>

          <button
            type="button"
            className={`secondary-link-btn ${isSimulating ? 'text-blue-600 font-bold' : ''}`}
            onClick={onToggleSimulate}
          >
            {isSimulating ? (
              <>
                <RotateCcw size={13} className="animate-spin-slow" />
                <span>Simulating...</span>
              </>
            ) : (
              <>
                <Play size={13} />
                <span>Test Simulator</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expandable Live Route Map Modal */}
      {showLiveMap && (
        <div className="arraivo-map-overlay" onClick={() => setShowLiveMap(false)}>
          <div className="arraivo-map-modal" onClick={(e) => e.stopPropagation()}>
            <div className="map-modal-header">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-blue-600" />
                <span className="font-bold text-sm text-slate-900">Live Route to {destName}</span>
              </div>
              <button
                type="button"
                className="map-modal-close-btn"
                onClick={() => setShowLiveMap(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="map-modal-body" ref={mapContainerRef} />
            <div className="map-modal-footer">
              <span className="text-xs text-slate-600">
                {displayRemDist} km remaining • Alarm set for {alertDistanceKm} km
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Stop Trip Modal */}
      {confirmStopOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog-card">
            <h3 className="modal-title">End This Trip?</h3>
            <p className="modal-desc">
              Are you sure you want to stop tracking? The arrival alarm will not
              sound once the trip is stopped.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary-plain"
                onClick={() => setConfirmStopOpen(false)}
              >
                Continue Tracking
              </button>
              <button
                type="button"
                className="btn-danger-confirm"
                onClick={() => {
                  setConfirmStopOpen(false);
                  onStopTrip();
                }}
              >
                Yes, End Trip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
