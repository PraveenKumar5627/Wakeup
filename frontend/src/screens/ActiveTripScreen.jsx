import React, { useEffect, useRef, useState } from 'react';
import StatusBar from '../components/StatusBar';
import {
  MapPin,
  Route,
  Bell,
  LocateFixed,
  AlertCircle,
  Square,
  Play,
  RotateCcw,
  Navigation,
  Clock,
  ShieldCheck,
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
  onTriggerAlarmTest,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerDestRef = useRef(null);
  const markerUserRef = useRef(null);
  const routePolylineRef = useRef(null);

  const [confirmStopOpen, setConfirmStopOpen] = useState(false);

  // Calculate estimated completion percentage
  const initDist = initialDistanceKm || (remainingDistanceKm ? remainingDistanceKm + 2 : 5);
  const remDist = remainingDistanceKm !== null ? remainingDistanceKm : initDist;
  const progressPercent = Math.min(
    100,
    Math.max(5, Math.round(((initDist - remDist) / initDist) * 100))
  );

  // Calculate ETA string
  const formatETA = () => {
    if (routeDetails?.durationText) {
      // Calculate clock arrival
      const mins = routeDetails.durationMin || Math.round(remDist * 2.2);
      const arrival = new Date(Date.now() + mins * 60000);
      let h = arrival.getHours();
      const m = arrival.getMinutes().toString().padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${h}:${m} ${ampm}`;
    }
    // Default fallback
    const arrival = new Date(Date.now() + Math.round((remDist || 3) * 2.5) * 60000);
    let h = arrival.getHours();
    const m = arrival.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };

  // Dark Leaflet map setup
  useEffect(() => {
    if (!window.L || !mapContainerRef.current) return;

    const destLat = destination?.lat || 11.0168;
    const destLng = destination?.lng || 76.9558;
    const userLat = currentLocation?.lat || destLat - 0.035;
    const userLng = currentLocation?.lng || destLng - 0.035;

    let resizeTimer1, resizeTimer2, resizeTimer3;

    if (!mapInstanceRef.current) {
      const map = window.L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([destLat, destLng], 13);
      mapInstanceRef.current = map;

      // Authentic Google Maps Roadmap tiles with fallback to CartoDB Voyager
      const tileLayer = window.L.tileLayer(
        'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
        {
          maxZoom: 20,
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          attribution: '© Google Maps',
        }
      );
      tileLayer.on('tileerror', () => {
        if (!mapInstanceRef.current._hasFallenBack) {
          mapInstanceRef.current._hasFallenBack = true;
          window.L.tileLayer(
            'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
            { maxZoom: 19, subdomains: 'abcd', attribution: '© CartoDB' }
          ).addTo(map);
        }
      });
      tileLayer.addTo(map);

      // Destination Marker (Google Maps Red pin with label)
      const redPinIcon = window.L.divIcon({
        className: 'custom-google-dest-marker',
        html: `
          <div class="google-dest-pin-wrapper">
            <div class="google-dest-pin-label">${destination?.name || 'Destination'}</div>
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

      markerDestRef.current = window.L.marker([destLat, destLng], {
        icon: redPinIcon,
      }).addTo(map);

      // User puck marker (pulsing blue puck)
      const userPuckIcon = window.L.divIcon({
        className: 'custom-map-puck-user',
        html: `
          <div class="user-puck-wrapper">
            <div class="user-puck-pulse"></div>
            <div class="user-puck-core"></div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      markerUserRef.current = window.L.marker([userLat, userLng], {
        icon: userPuckIcon,
      }).addTo(map);

      // Blue Navigation Route Polyline
      routePolylineRef.current = window.L.polyline(
        [
          [userLat, userLng],
          [destLat, destLng],
        ],
        {
          color: '#3B82F6',
          weight: 5,
          opacity: 0.9,
          lineJoin: 'round',
        }
      ).addTo(map);

      const bounds = window.L.latLngBounds([
        [userLat, userLng],
        [destLat, destLng],
      ]);
      map.fitBounds(bounds, { padding: [40, 40] });

      // Multi-phase invalidation to guarantee Leaflet tiles render inside mobile flex containers
      resizeTimer1 = setTimeout(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      }, 50);
      resizeTimer2 = setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
          const b = window.L.latLngBounds([
            [userLat, userLng],
            [destLat, destLng],
          ]);
          mapInstanceRef.current.fitBounds(b, { padding: [40, 40] });
        }
      }, 250);
      resizeTimer3 = setTimeout(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      }, 600);
    } else {
      // Update markers
      if (markerUserRef.current && currentLocation) {
        markerUserRef.current.setLatLng([currentLocation.lat, currentLocation.lng]);
      }
      if (markerDestRef.current && destination) {
        markerDestRef.current.setLatLng([destLat, destLng]);
      }
      if (routePolylineRef.current && currentLocation) {
        routePolylineRef.current.setLatLngs([
          [currentLocation.lat, currentLocation.lng],
          [destLat, destLng],
        ]);
      }
    }

    const onResize = () => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    };
    window.addEventListener('resize', onResize);

    return () => {
      clearTimeout(resizeTimer1);
      clearTimeout(resizeTimer2);
      clearTimeout(resizeTimer3);
      window.removeEventListener('resize', onResize);
    };
  }, [destination, currentLocation]);

  const handleRecenter = () => {
    if (mapInstanceRef.current && currentLocation && destination) {
      const bounds = window.L.latLngBounds([
        [currentLocation.lat, currentLocation.lng],
        [destination.lat, destination.lng],
      ]);
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
    }
  };

  return (
    <div className="screen-container screen-active-trip">
      <StatusBar theme="dark" />

      {/* Top Banner: Emerald Green "Traveling to Coimbatore" */}
      <div className="active-top-header-banner">
        <div className="active-banner-pin-circle">
          <MapPin size={22} className="text-white" />
        </div>
        <div className="active-banner-text">
          <span className="banner-sub">Traveling to</span>
          <h2 className="banner-title">{destination?.name || 'Destination'}</h2>
        </div>
      </div>

      {/* Dark Map Area */}
      <div className="active-map-container">
        <div ref={mapContainerRef} className="leaflet-dark-map"></div>

        {/* GPS floating target button */}
        <button
          type="button"
          className="active-map-recenter-btn"
          onClick={handleRecenter}
          title="Recenter Route"
          aria-label="Recenter Route"
        >
          <LocateFixed size={20} />
        </button>
      </div>

      {/* Bottom Tracking Sheet */}
      <div className="active-bottom-sheet">
        {/* Top metrics row: Distance & ETA */}
        <div className="sheet-metrics-row">
          <div className="sheet-dist-left">
            <Route size={22} className="sheet-dist-icon text-blue-600" />
            <div className="sheet-dist-info">
              <span className="sheet-dist-val">
                {remainingDistanceKm !== null
                  ? `${remainingDistanceKm.toFixed(1)} km`
                  : 'Calculating...'}
              </span>
              <span className="sheet-dist-label">
                remaining to {destination?.name || 'Destination'}
              </span>
              <span className="sheet-dist-road-hint">
                {routeDetails?.routeType === 'road'
                  ? 'Road driving distance'
                  : 'Live GPS distance'}
              </span>
            </div>
          </div>

          <div className="sheet-eta-right">
            <span className="sheet-eta-label">ETA</span>
            <span className="sheet-eta-val">{formatETA()}</span>
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="sheet-progress-container">
          <div
            className="sheet-progress-fill"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>

        {/* Pill Banner: Alarm set for 3 km */}
        <div className="sheet-alarm-pill">
          <Bell size={16} className="text-white mr-2" />
          <span>Alarm set for {alertDistanceKm} km</span>
        </div>

        {/* Live GPS info badge */}
        <div className="sheet-gps-status-row">
          <span className="gps-live-dot"></span>
          <span className="gps-live-text">
            {gpsError ? (
              <span className="text-amber-600">{gpsError}</span>
            ) : (
              'Live GPS Tracking • High Accuracy • Wake Lock Active'
            )}
          </span>
        </div>

        {/* Controls: Stop Trip & Simulator */}
        <div className="sheet-actions-row">
          <button
            id="btn-stop-trip"
            type="button"
            className="btn-danger-stop"
            onClick={() => setConfirmStopOpen(true)}
          >
            <Square size={16} className="mr-1 fill-current" /> Stop Trip
          </button>

          <button
            type="button"
            className={`btn-simulator-toggle ${isSimulating ? 'sim-active' : ''}`}
            onClick={onToggleSimulate}
            title="Simulate movement towards destination"
          >
            {isSimulating ? (
              <>
                <RotateCcw size={14} className="animate-spin-slow mr-1" /> Simulating...
              </>
            ) : (
              <>
                <Play size={14} className="mr-1" /> Test Simulator
              </>
            )}
          </button>
        </div>
      </div>

      {/* Confirm Stop Modal */}
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
