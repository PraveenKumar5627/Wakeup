/**
 * App.jsx — Smart Transit Wakeup
 *
 * Main application component.
 *
 * Location lifecycle is fully delegated to useLocationPermission hook.
 * On first open the hook silently checks permission status.  When the user
 * taps "START TRIP" or "Check Location", requestPermission() is called —
 * which is a genuine user-gesture — so Android shows the system dialog.
 *
 * The LocationPermissionDialog is shown automatically when the app detects
 * that permission has not yet been granted so the user is informed early.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import DestinationSearch from './components/DestinationSearch';
import AlertDistance from './components/AlertDistance';
import TripStatus from './components/TripStatus';
import AlarmModal from './components/AlarmModal';
import LocationPermissionDialog from './components/LocationPermissionDialog';
import SimulatorControl from './components/SimulatorControl';
import { calculateDistance, checkBackendHealth } from './utils/api';
import { alarmAudio } from './utils/audioAlarm';
import { useLocationPermission } from './hooks/useLocationPermission';

export default function App() {
  // ── Destination & trip settings ──────────────────────────────────────────
  const [destination, setDestination] = useState({
    name: 'Chennai Central Station',
    lat: 13.0827,
    lng: 80.2707,
  });

  // Slider value is in metres; the backend expects kilometres.
  const [alertDistance, setAlertDistance] = useState(3000);

  // ── Trip state ───────────────────────────────────────────────────────────
  const [isTripActive, setIsTripActive]         = useState(false);
  const [remainingDistance, setRemainingDistance] = useState(null);
  const [routeDetails, setRouteDetails]         = useState({
    routeType: 'road',
    durationText: '',
    straightLineKm: null,
  });
  const [gpsError, setGpsError]       = useState(null);
  const [backendError, setBackendError] = useState(null);
  const [isBackendOnline, setIsBackendOnline] = useState(false);

  // ── Alarm ────────────────────────────────────────────────────────────────
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  // Prevent the same journey from firing the alarm twice
  const alarmFiredRef = useRef(false);

  // ── Simulator ────────────────────────────────────────────────────────────
  const [isSimulating, setIsSimulating] = useState(false);
  const simOffsetRef = useRef(0.1);

  // ── Permission dialog ────────────────────────────────────────────────────
  // Show the dialog automatically once when the app detects permission is missing.
  const [isPermDialogOpen, setIsPermDialogOpen]   = useState(false);
  const hasShownDialogRef = useRef(false); // only auto-open once per session

  // ── Location hook ────────────────────────────────────────────────────────
  const {
    locationPermStatus,
    locationFixStatus,
    currentLocation,
    lastUpdated,
    locationError,
    hasValidLocation,
    needsPermission,
    isPermanentlyDenied,
    isServicesOff,
    isFetchingLocation,
    isNative,
    checkPermissionStatus,
    requestPermission,
    getCurrentLocation,
    startWatch,
    stopWatch,
    lastFixTimestampRef,
  } = useLocationPermission();

  // ── Auto-open permission dialog once permission status is known ──────────
  useEffect(() => {
    // Only open automatically the first time, and only if permission isn't granted
    if (
      !hasShownDialogRef.current &&
      !isTripActive &&
      (needsPermission || isServicesOff) &&
      locationPermStatus !== 'idle' &&
      locationPermStatus !== 'checking'
    ) {
      hasShownDialogRef.current = true;
      // Small delay so app is fully rendered before showing dialog
      const tid = setTimeout(() => setIsPermDialogOpen(true), 800);
      return () => clearTimeout(tid);
    }
  }, [locationPermStatus, needsPermission, isServicesOff, isTripActive]);

  // ── Backend health polling ────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const ping = async () => {
      try {
        const online = await checkBackendHealth();
        if (mounted) setIsBackendOnline(online);
      } catch {
        if (mounted) setIsBackendOnline(false);
      }
    };

    ping();
    const iv = setInterval(ping, 10000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  // ── Backend sync ──────────────────────────────────────────────────────────
  const syncWithBackend = useCallback(async (lat, lng, dest, thresholdMeters) => {
    try {
      setBackendError(null);
      const alertDistanceKm = thresholdMeters / 1000;

      const result = await calculateDistance({
        currentLat: lat,
        currentLng: lng,
        destLat: dest.lat,
        destLng: dest.lng,
        alertDistance: alertDistanceKm,
      });

      setRemainingDistance(result.distance_km);
      setRouteDetails({
        routeType: result.route_type || 'road',
        durationText:
          result.duration_text ||
          (result.duration_min ? `${Math.round(result.duration_min)} min` : ''),
        straightLineKm: result.straight_line_km || null,
      });

      // Alarm trigger — guard against duplicate fires for the same journey
      if (result.alert && !isAlarmActive && !alarmFiredRef.current) {
        alarmFiredRef.current = true;
        setIsAlarmActive(true);
        alarmAudio.startAlarm();
      }
    } catch (err) {
      console.error('Backend sync failed:', err);
      setBackendError(`Backend request failed: ${err.message}`);
    }
  }, [isAlarmActive]);

  // ── Start live GPS watch during trip ─────────────────────────────────────
  const startLiveWatch = useCallback((dest, threshold) => {
    startWatch(
      // onLocationUpdate callback
      ({ lat, lng }) => {
        setGpsError(null);
        syncWithBackend(lat, lng, dest, threshold);
      },
      // onWatchError callback
      (msg) => {
        setGpsError(msg);
      }
    );
  }, [startWatch, syncWithBackend]);

  // ── Handle START TRIP ─────────────────────────────────────────────────────
  const handleStartTrip = async () => {
    if (!destination) {
      alert('Please select or search for a destination first.');
      return;
    }
    if (isFetchingLocation) return;

    // --- Step 1: ensure permission ---
    let permStatus = locationPermStatus;

    if (needsPermission) {
      // This is a user-gesture context (button click), so we can request the dialog
      setIsPermDialogOpen(false);
      permStatus = await requestPermission();
    }

    if (permStatus !== 'granted') {
      // Still not granted — show the dialog with the error
      setIsPermDialogOpen(true);
      return;
    }

    // --- Step 2: get fresh location ---
    let loc = currentLocation;
    const age = Date.now() - lastFixTimestampRef.current;

    if (!loc || age > 120000) {
      loc = await getCurrentLocation({ force: true });
    }

    if (!loc) {
      setIsPermDialogOpen(true);
      return;
    }

    // --- Step 3: start trip ---
    alarmFiredRef.current = false; // reset alarm guard for new journey
    setIsTripActive(true);
    setIsPermDialogOpen(false);

    // Immediate sync and then start continuous watch
    await syncWithBackend(loc.lat, loc.lng, destination, alertDistance);
    startLiveWatch(destination, alertDistance);
  };

  // ── Dialog action: user taps "Turn on location" ───────────────────────────
  const handleDialogTurnOnLocation = async () => {
    const permStatus = await requestPermission();

    if (permStatus === 'granted') {
      setIsPermDialogOpen(false);
      const loc = await getCurrentLocation({ force: true });
      if (loc && isTripActive) {
        syncWithBackend(loc.lat, loc.lng, destination, alertDistance);
      }
    }
    // If still denied, dialog stays open and shows the error from the hook
  };

  // ── Dialog action: user taps "No, thanks" ────────────────────────────────
  const handleNoThanks = () => {
    setIsPermDialogOpen(false);
    if (isTripActive) {
      // Don't stop an active trip just because the dialog was dismissed
      return;
    }
  };

  // ── Dialog action: enter destination manually ─────────────────────────────
  const handleEnterManually = () => {
    setIsPermDialogOpen(false);
    const el = document.querySelector('.search-input') ||
               document.querySelector('.destination-card');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof el.focus === 'function') el.focus();
    }
  };

  // ── Manual "Check Location" / "Retry Location" button ────────────────────
  const handleCheckLocation = async () => {
    if (isFetchingLocation) return;
    // This is a user action, so we can request the dialog if needed
    if (needsPermission || locationPermStatus === 'denied') {
      await requestPermission();
    } else {
      await getCurrentLocation({ force: true });
    }
  };

  // ── Alarm controls ────────────────────────────────────────────────────────
  const handleStopAlarm = () => {
    setIsAlarmActive(false);
    alarmAudio.stopAlarm();
    // Don't reset alarmFiredRef here — the journey alarm should only fire once
  };

  // ── Stop trip ─────────────────────────────────────────────────────────────
  const handleStopTrip = () => {
    stopWatch();
    setIsTripActive(false);
    setIsSimulating(false);
    setGpsError(null);
    alarmFiredRef.current = false;
    handleStopAlarm();
  };

  // ── Simulator controls ────────────────────────────────────────────────────
  const handleSimulateStep = () => {
    if (!destination) return;
    setIsSimulating(true);
    simOffsetRef.current = Math.max(0.005, simOffsetRef.current - 0.02);

    const simLat = destination.lat + simOffsetRef.current;
    const simLng = destination.lng + simOffsetRef.current;

    syncWithBackend(simLat, simLng, destination, alertDistance);
  };

  const handleTriggerAlarmDirectly = () => {
    setIsAlarmActive(true);
    alarmAudio.startAlarm();
  };

  const handleResetSimulation = () => {
    simOffsetRef.current = 0.1;
    alarmFiredRef.current = false;
    const simLat = destination.lat + simOffsetRef.current;
    const simLng = destination.lng + simOffsetRef.current;
    syncWithBackend(simLat, simLng, destination, alertDistance);
  };

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopWatch();
      alarmAudio.stopAlarm();
    };
  }, [stopWatch]);

  // ── Derived: location status card display values ──────────────────────────
  const cardState =
    hasValidLocation
      ? 'is-on'
      : isFetchingLocation
        ? 'is-checking'
        : 'is-off';

  const statusLabel = () => {
    if (hasValidLocation)                      return <span className="loc-status-badge badge-on">🟢 LOCATION IS ON</span>;
    if (isFetchingLocation)                    return <span className="loc-status-badge badge-checking">🔄 CHECKING LOCATION...</span>;
    if (locationPermStatus === 'denied')       return <span className="loc-status-badge badge-off">🔒 PERMISSION DENIED</span>;
    if (locationPermStatus === 'denied_permanently') return <span className="loc-status-badge badge-off">🔒 BLOCKED IN SETTINGS</span>;
    if (locationPermStatus === 'services_off') return <span className="loc-status-badge badge-off">📵 LOCATION SERVICES OFF</span>;
    if (locationPermStatus === 'unavailable')  return <span className="loc-status-badge badge-off">❌ GPS UNAVAILABLE</span>;
    return <span className="loc-status-badge badge-off">⚠️ LOCATION NOT DETECTED</span>;
  };

  const statusSubtext = () => {
    if (hasValidLocation)
      return (
        <span className="loc-coords-text">
          GPS: {currentLocation.lat.toFixed(4)}°, {currentLocation.lng.toFixed(4)}° • Ready to track
        </span>
      );
    if (isFetchingLocation)
      return <span>Checking your phone's location...</span>;
    if (locationPermStatus === 'denied' || locationPermStatus === 'denied_permanently')
      return (
        <span>
          {isPermanentlyDenied
            ? 'Open Settings → Apps → Arrivo → Permissions → Location → Allow.'
            : 'Tap "Retry Location" to allow access.'}
        </span>
      );
    if (locationPermStatus === 'services_off')
      return <span>Enable Location in Android Quick Settings (swipe down ▾) then tap Retry.</span>;
    if (locationError)
      return <span>{locationError}</span>;
    return <span>Tap "Check Location" to detect your position.</span>;
  };

  const checkBtnLabel = () => {
    if (isFetchingLocation) return <><span className="loc-btn-spinner" /><span>Checking...</span></>;
    if (hasValidLocation)   return '🔄 Re-check';
    if (locationPermStatus === 'denied' || locationPermStatus === 'prompt' || locationPermStatus === 'idle')
      return '⚡ Check Location';
    return '🔄 Retry Location';
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="app-container">
      <Header isBackendOnline={isBackendOnline} />

      {/* GPS error banner */}
      {gpsError && (
        <div className="alert-box alert-warning">
          <span>⚠️</span>
          <span>{gpsError}</span>
        </div>
      )}

      {/* Backend error banner */}
      {backendError && (
        <div className="alert-box alert-error">
          <span>❌</span>
          <span>{backendError}</span>
        </div>
      )}

      <main className="responsive-layout">
        <section className="layout-col primary-col">
          {!isTripActive ? (
            <>
              {/* ── Location Status Card ── */}
              <div className={`device-location-status-card ${cardState}`}>
                <div className="loc-status-left">
                  <div className="loc-status-icon-bubble">
                    {hasValidLocation ? (
                      <span className="loc-dot-pulse green" />
                    ) : isFetchingLocation ? (
                      <span className="loc-spinner" />
                    ) : (
                      <span className="loc-dot-pulse orange" />
                    )}
                  </div>

                  <div className="loc-status-info">
                    <div className="loc-status-title">
                      {statusLabel()}
                      {hasValidLocation && lastUpdated && (
                        <span className="loc-status-time">Checked {lastUpdated}</span>
                      )}
                    </div>
                    <div className="loc-status-subtext">
                      {statusSubtext()}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="loc-check-btn"
                  onClick={handleCheckLocation}
                  disabled={isFetchingLocation}
                >
                  {checkBtnLabel()}
                </button>
              </div>

              {/* ── Destination Search ── */}
              <DestinationSearch
                destination={destination}
                setDestination={setDestination}
                disabled={isTripActive}
                userLocation={currentLocation}
                alertDistance={alertDistance}
              />

              {/* ── Alert Distance Slider ── */}
              <AlertDistance
                alertDistance={alertDistance}
                setAlertDistance={setAlertDistance}
                disabled={isTripActive}
              />

              {/* ── Start Trip Button ── */}
              <button
                type="button"
                className="btn-primary"
                onClick={handleStartTrip}
                disabled={!destination || isFetchingLocation}
              >
                {isFetchingLocation ? (
                  <>
                    <span className="pulse-dot" style={{ backgroundColor: '#fff' }} />
                    <span>ACQUIRING LOCATION...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>START TRIP</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <TripStatus
              destination={destination}
              alertDistance={alertDistance}
              currentLocation={currentLocation}
              remainingDistance={remainingDistance}
              routeDetails={routeDetails}
              lastUpdated={lastUpdated}
              onStopTrip={handleStopTrip}
              isSimulating={isSimulating}
            />
          )}
        </section>

        <section className="layout-col secondary-col">
          <SimulatorControl
            isTripActive={isTripActive}
            onSimulateStep={handleSimulateStep}
            onTriggerAlarmDirectly={handleTriggerAlarmDirectly}
            onResetSimulation={handleResetSimulation}
            isSimulating={isSimulating}
          />

          <div className="glass-card travel-tips-card">
            <div
              className="section-label"
              style={{ marginBottom: '0.4rem', color: 'var(--accent-blue)' }}
            >
              <span>🛡️</span>
              <span>Bus Travel Guide &amp; Tips</span>
            </div>
            <ul className="travel-tips-list">
              <li>
                <strong>📱 Keep Screen / Audio Active:</strong> Keep the app
                open and ensure your media volume is unmuted so you don't miss
                the alarm.
              </li>
              <li>
                <strong>🔋 Battery Saving:</strong> Location tracking can use
                battery, especially with high-accuracy GPS.
              </li>
              <li>
                <strong>📍 GPS Accuracy:</strong> Location accuracy depends on
                device settings, signal, and surroundings.
              </li>
              <li>
                <strong>🔒 Keep App Open:</strong> For best results keep the app
                in the foreground during your journey.
              </li>
            </ul>
          </div>
        </section>
      </main>

      {/* ── Alarm Modal ── */}
      <AlarmModal
        isOpen={isAlarmActive}
        distance={remainingDistance}
        alertDistance={alertDistance}
        destinationName={destination?.name}
        onStopAlarm={handleStopAlarm}
      />

      {/* ── Location Permission Dialog ── */}
      <LocationPermissionDialog
        isOpen={isPermDialogOpen}
        isRequesting={isFetchingLocation}
        locationError={locationError}
        locationPermStatus={locationPermStatus}
        isPermanentlyDenied={isPermanentlyDenied}
        isServicesOff={isServicesOff}
        isNative={isNative}
        onTurnOnLocation={handleDialogTurnOnLocation}
        onNoThanks={handleNoThanks}
        onEnterDestinationManually={handleEnterManually}
      />

      <footer className="app-footer">
        <p>Calculates road distance via OSRM routing (Haversine fallback when offline).</p>
        <p>Keep the app open and device volume on during your journey.</p>
      </footer>
    </div>
  );
}
