/**
 * App.jsx — Smart Transit Wakeup
 *
 * Full-stack mobile-friendly Travel Destination Alarm application.
 *
 * Workflow:
 *   1. User opens app and selects/searches destination.
 *   2. User clicks "Start Trip".
 *   3. App requests location permission using the correct API:
 *      - Web (Vercel): `navigator.geolocation.getCurrentPosition()`
 *      - Native: `@capacitor/geolocation`
 *   4. Once granted, retrieves real latitude & longitude (never fake or hardcoded).
 *   5. Detects if device location is off and shows instructions to enable in Quick Settings.
 *   6. Displays real-time location on the map and tracks movement via `watchPosition()`.
 *   7. Calculates remaining road distance via routing API (OSRM driving route).
 *   8. Sounds wake-up siren alarm and displays alarm screen when destination threshold is reached.
 *   9. Full handling of loading, success, denied, disabled, timeout, and unavailable states.
 *  10. Cleans up watcher and releases Screen Wake Lock when trip is stopped.
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

  // Alert distance threshold in metres (backend receives kilometres)
  const [alertDistance, setAlertDistance] = useState(3000);

  // ── Trip state ───────────────────────────────────────────────────────────
  const [isTripActive, setIsTripActive] = useState(false);
  const [remainingDistance, setRemainingDistance] = useState(null);
  const [routeDetails, setRouteDetails] = useState({
    routeType: 'road',
    durationText: '',
    straightLineKm: null,
  });
  const [gpsError, setGpsError] = useState(null);
  const [backendError, setBackendError] = useState(null);
  const [isBackendOnline, setIsBackendOnline] = useState(false);

  // ── Alarm ────────────────────────────────────────────────────────────────
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const alarmFiredRef = useRef(false);

  // ── Simulator ────────────────────────────────────────────────────────────
  const [isSimulating, setIsSimulating] = useState(false);
  const simOffsetRef = useRef(0.1);

  // ── Permission dialog ────────────────────────────────────────────────────
  const [isPermDialogOpen, setIsPermDialogOpen] = useState(false);

  // ── Screen Wake Lock (prevents mobile phone screen from sleeping) ────────
  const wakeLockRef = useRef(null);

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
    isTimeout,
    isUnavailable,
    isFetchingLocation,
    isNative,
    checkPermissionStatus,
    requestPermission,
    getCurrentLocation,
    startWatch,
    stopWatch,
    lastFixTimestampRef,
  } = useLocationPermission();

  // ── Screen Wake Lock management during active journey ─────────────────────
  useEffect(() => {
    let active = true;

    const acquireLock = async () => {
      if (isTripActive && 'wakeLock' in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        } catch (err) {
          console.warn('[App] Screen Wake Lock not acquired:', err);
        }
      }
    };

    if (isTripActive) {
      acquireLock();
    } else {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    }

    return () => {
      active = false;
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [isTripActive]);

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
    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, []);

  // ── Backend distance sync & alert trigger ─────────────────────────────────
  const syncWithBackend = useCallback(
    async (lat, lng, dest, thresholdMeters) => {
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

        // Trigger wake-up alarm when approaching selected destination threshold
        if (result.alert && !isAlarmActive && !alarmFiredRef.current) {
          alarmFiredRef.current = true;
          setIsAlarmActive(true);
          alarmAudio.startAlarm();
        }
      } catch (err) {
        console.error('Backend sync failed:', err);
        setBackendError(`Backend request failed: ${err.message}`);
      }
    },
    [isAlarmActive]
  );

  // ── Start live GPS watch during trip ─────────────────────────────────────
  const startLiveWatch = useCallback(
    (dest, threshold) => {
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
    },
    [startWatch, syncWithBackend]
  );

  // ── Handle START TRIP (Step 2 & 3: Requests location permission) ──────────
  const handleStartTrip = async () => {
    if (!destination) {
      alert('Please select or search for a destination first.');
      return;
    }
    if (isFetchingLocation) return;

    // Retrieve real coordinates
    let loc = currentLocation;
    const age = Date.now() - lastFixTimestampRef.current;
    const isStale = !loc || age > 60000;

    // If permission has not been granted or fix is stale, trigger permission request
    if (locationPermStatus !== 'granted' || isStale) {
      loc = await requestPermission();
    }

    if (!loc) {
      // Permission denied, device location off, or timed out
      // Open dialog to guide the user on how to enable it
      setIsPermDialogOpen(true);
      return;
    }

    // Permission granted and valid coordinates acquired!
    alarmFiredRef.current = false;
    setIsTripActive(true);
    setIsPermDialogOpen(false);
    setGpsError(null);

    // Initial road distance calculation & start continuous watch
    await syncWithBackend(loc.lat, loc.lng, destination, alertDistance);
    startLiveWatch(destination, alertDistance);
  };

  // ── Dialog action: user taps "Turn on location" / "Retry" ─────────────────
  const handleDialogTurnOnLocation = async () => {
    const loc = await requestPermission();

    if (loc) {
      setIsPermDialogOpen(false);
      if (!isTripActive && destination) {
        // Auto-start trip if destination is selected
        alarmFiredRef.current = false;
        setIsTripActive(true);
        setGpsError(null);
        await syncWithBackend(loc.lat, loc.lng, destination, alertDistance);
        startLiveWatch(destination, alertDistance);
      } else if (isTripActive && destination) {
        syncWithBackend(loc.lat, loc.lng, destination, alertDistance);
      }
    }
  };

  // ── Dialog action: user dismisses dialog ──────────────────────────────────
  const handleNoThanks = () => {
    setIsPermDialogOpen(false);
  };

  // ── Dialog action: enter destination manually ─────────────────────────────
  const handleEnterManually = () => {
    setIsPermDialogOpen(false);
    const el =
      document.querySelector('.search-input') ||
      document.querySelector('.destination-card');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof el.focus === 'function') el.focus();
    }
  };

  // ── Manual "Check Location" / "Retry Location" button ────────────────────
  const handleCheckLocation = async () => {
    if (isFetchingLocation) return;
    if (needsPermission || isPermanentlyDenied || isServicesOff || isTimeout) {
      const loc = await requestPermission();
      if (!loc) {
        setIsPermDialogOpen(true);
      }
    } else {
      await getCurrentLocation({ force: true });
    }
  };

  // ── Alarm controls ────────────────────────────────────────────────────────
  const handleStopAlarm = () => {
    setIsAlarmActive(false);
    alarmAudio.stopAlarm();
  };

  // ── Stop trip (Step 10: Tracking cleanup) ─────────────────────────────────
  const handleStopTrip = () => {
    stopWatch();
    setIsTripActive(false);
    setIsSimulating(false);
    setGpsError(null);
    alarmFiredRef.current = false;
    handleStopAlarm();
  };

  // ── Simulator controls (for testing without physical travel) ──────────────
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
  const cardState = hasValidLocation
    ? 'is-on'
    : isFetchingLocation
    ? 'is-checking'
    : 'is-off';

  const statusLabel = () => {
    if (hasValidLocation) {
      return <span className="loc-status-badge badge-on">🟢 Location Detected</span>;
    }
    if (locationPermStatus === 'requesting') {
      return (
        <span className="loc-status-badge badge-checking">
          📍 Requesting Location Permission...
        </span>
      );
    }
    if (isFetchingLocation) {
      return (
        <span className="loc-status-badge badge-checking">
          🔄 Acquiring GPS Location...
        </span>
      );
    }
    if (isPermanentlyDenied || locationPermStatus === 'denied') {
      return (
        <span className="loc-status-badge badge-off">
          🔒 Location Permission Denied
        </span>
      );
    }
    if (isServicesOff) {
      return (
        <span className="loc-status-badge badge-off">
          📵 Location Services Disabled
        </span>
      );
    }
    if (isTimeout) {
      return (
        <span className="loc-status-badge badge-off">
          ⏱️ Location Request Timed Out
        </span>
      );
    }
    if (isUnavailable) {
      return (
        <span className="loc-status-badge badge-off">
          ❌ Geolocation Unavailable
        </span>
      );
    }
    return <span className="loc-status-badge badge-off">📍 Location Not Connected</span>;
  };

  const statusSubtext = () => {
    if (hasValidLocation) {
      return (
        <span className="loc-coords-text">
          GPS: {currentLocation.lat.toFixed(4)}°, {currentLocation.lng.toFixed(4)}° • Real device coordinates
        </span>
      );
    }
    if (locationPermStatus === 'requesting') {
      return <span>Please tap "Allow" on your browser's location permission prompt.</span>;
    }
    if (isFetchingLocation) {
      return <span>Connecting to device GPS satellites...</span>;
    }
    if (isPermanentlyDenied) {
      return (
        <span>
          Location access is blocked. Tap the 🔒 lock icon in your address bar → Site Settings → Location → Allow, then retry.
        </span>
      );
    }
    if (isServicesOff) {
      return (
        <span>
          Device GPS is turned off. Web apps cannot turn on GPS automatically. Please swipe down Android Quick Settings, enable Location, and tap Retry.
        </span>
      );
    }
    if (isTimeout) {
      return (
        <span>
          GPS timed out before receiving a satellite fix. Move towards a window or outdoors, and tap Retry.
        </span>
      );
    }
    if (isUnavailable) {
      return (
        <span>
          Geolocation requires a secure connection (HTTPS). This site is not served over HTTPS.
        </span>
      );
    }
    if (locationError) {
      return <span>{locationError}</span>;
    }
    return <span>Click "Start Trip" or "Enable Location" to detect your position.</span>;
  };

  const checkBtnLabel = () => {
    if (isFetchingLocation) {
      return (
        <>
          <span className="loc-btn-spinner" />
          <span>Checking...</span>
        </>
      );
    }
    if (hasValidLocation) return '🔄 Re-check';
    if (locationPermStatus === 'prompt' || locationPermStatus === 'idle') {
      return '📍 Enable Location';
    }
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
              {/* ── Location Status Card (Shows all 6 states) ── */}
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
                        <span className="loc-status-time">Fix: {lastUpdated}</span>
                      )}
                    </div>
                    <div className="loc-status-subtext">{statusSubtext()}</div>
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
              <span>Bus Travel Guide &amp; Background Tips</span>
            </div>
            <ul className="travel-tips-list">
              <li>
                <strong>📱 Screen Wake Lock Active:</strong> While your trip is
                running, the app requests a Screen Wake Lock to prevent your phone
                from sleeping automatically.
              </li>
              <li>
                <strong>🔒 Keep Tab Open in Foreground:</strong> Mobile browsers
                (Chrome / Safari) aggressively suspend JavaScript timers and GPS
                tracking when tabs are minimized or the screen is locked. Keep this tab
                in the foreground during your journey.
              </li>
              <li>
                <strong>🔊 Media Volume:</strong> Ensure your phone's media volume
                is turned up so you can hear the repeating siren alert.
              </li>
              <li>
                <strong>🛣️ Road Distance Accuracy:</strong> Distances are
                calculated along real driving highways and roads via OSRM routing,
                matching Google Maps navigation.
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

      {/* ── Location Permission Recovery Dialog ── */}
      <LocationPermissionDialog
        isOpen={isPermDialogOpen}
        isRequesting={isFetchingLocation}
        locationError={locationError}
        locationPermStatus={locationPermStatus}
        locationFixStatus={locationFixStatus}
        isPermanentlyDenied={isPermanentlyDenied}
        isServicesOff={isServicesOff}
        isTimeout={isTimeout}
        isUnavailable={isUnavailable}
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
