import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import DestinationSearch from './components/DestinationSearch';
import AlertDistance from './components/AlertDistance';
import TripStatus from './components/TripStatus';
import AlarmModal from './components/AlarmModal';
import LocationPermissionDialog from './components/LocationPermissionDialog';
import SimulatorControl from './components/SimulatorControl';
import { calculateDistance, checkBackendHealth } from './utils/api';
import { alarmAudio } from './utils/audioAlarm';

export default function App() {
  // Destination: defaults to Chennai Central as in plan.md
  const [destination, setDestination] = useState({
    name: 'Chennai Central Station',
    lat: 13.0827,
    lng: 80.2707,
  });

  // Alert distance threshold stored in METERS (slider uses meters).
  // Default: 3000 m = 3 km. Convert to km before sending to backend.
  const [alertDistance, setAlertDistance] = useState(3000);

  // Trip state
  const [isTripActive, setIsTripActive] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [remainingDistance, setRemainingDistance] = useState(null);
  const [routeDetails, setRouteDetails] = useState({
    routeType: 'road',
    durationText: '',
    straightLineKm: null,
  });
  const [lastUpdated, setLastUpdated] = useState('');
  const [gpsError, setGpsError] = useState(null);
  const [backendError, setBackendError] = useState(null);
  const [isBackendOnline, setIsBackendOnline] = useState(false);

  // Location Permission State Management
  // 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'cancelled'
  const [locationStatus, setLocationStatus] = useState('idle');
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);

  // Alarm modal & audio state
  const [isAlarmActive, setIsAlarmActive] = useState(false);

  // Simulation mode for desktop testing
  const [isSimulating, setIsSimulating] = useState(false);
  const simOffsetRef = useRef(0.1); // ~11 km away initially

  // Watch position reference for continuous live GPS tracking
  const watchIdRef = useRef(null);
  // Timestamp of the latest valid location acquisition
  const lastLocationTimestampRef = useRef(0);

  // Helper to completely stop active geolocation watcher
  const stopAllTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  /**
   * checkDeviceLocation:
   * Directly, reliably, and quickly checks whether the device's location is ON or OFF.
   *
   * Crucial rule: MUST use enableHighAccuracy: false!
   * On Android, enableHighAccuracy: false queries standard device location (GPS/Network)
   * WITHOUT triggering the invasive Google Location Accuracy modal that hangs on "Checking...".
   */
  const checkDeviceLocation = (isUserAction = false) => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('geolocation' in navigator)) {
        setLocationStatus('unavailable');
        setLocationError('Geolocation is not supported by your browser.');
        resolve(null);
        return;
      }

      setIsRequestingLocation(true);
      setLocationStatus('requesting');
      setLocationError(null);
      setGpsError(null);

      let isDone = false;

      const finishSuccess = (position) => {
        if (isDone) return;
        isDone = true;
        const { latitude, longitude } = position.coords;
        lastLocationTimestampRef.current = Date.now();
        const timeStr = new Date().toLocaleTimeString();
        setCurrentLocation({ lat: latitude, lng: longitude });
        setLastUpdated(timeStr);
        setLocationStatus('granted');
        setIsRequestingLocation(false);
        setIsLocationDialogOpen(false);
        setLocationError(null);
        setGpsError(null);
        resolve(position);
      };

      const finishError = (error) => {
        if (isDone) return;
        isDone = true;
        console.warn('checkDeviceLocation error:', error);
        setIsRequestingLocation(false);
        let msg = '';
        if (error.code === 1) {
          // PERMISSION_DENIED
          setLocationStatus('denied');
          msg = 'Browser location permission denied. Tap 🔒 in address bar → Site Settings → Allow Location.';
        } else if (error.code === 2) {
          // POSITION_UNAVAILABLE - Device location toggle is OFF
          setLocationStatus('unavailable');
          msg = 'Device location is turned OFF. Please swipe down from top of screen, turn ON Location, and tap Check Location.';
        } else if (error.code === 3) {
          // TIMEOUT
          setLocationStatus('unavailable');
          msg = 'Location check timed out. Please check that phone Location toggle is ON and tap Check Location.';
        } else {
          setLocationStatus('unavailable');
          msg = error.message || 'Unable to detect device location.';
        }
        setLocationError(msg);
        resolve(null);
      };

      navigator.geolocation.getCurrentPosition(
        finishSuccess,
        finishError,
        {
          enableHighAccuracy: false, // Standard device location only - NO system prompt!
          timeout: 8000,
          maximumAge: 30000,
        }
      );
    });
  };

  // Automatically check whether device location is ON on page load & tab focus
  useEffect(() => {
    checkDeviceLocation(false);

    // Auto-check whenever user returns from phone settings to the browser tab!
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !isTripActive) {
        checkDeviceLocation(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isTripActive]);

  // 1. Periodically check backend health
  useEffect(() => {
    const pingBackend = async () => {
      const online = await checkBackendHealth();
      setIsBackendOnline(online);
    };
    pingBackend();
    const interval = setInterval(pingBackend, 10000);
    return () => clearInterval(interval);
  }, []);

  // 2. Synchronize GPS tracking with Backend
  const syncLocationWithBackend = async (lat, lng, dest, thresholdMeters) => {
    try {
      setBackendError(null);
      // Convert meters → km for the backend (backend expects km)
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
        durationText: result.duration_text || (result.duration_min ? `${Math.round(result.duration_min)} min` : ''),
        straightLineKm: result.straight_line_km || null,
      });
      setLastUpdated(new Date().toLocaleTimeString());

      // If backend reports alert threshold reached, sound the alarm!
      if (result.alert && !isAlarmActive) {
        setIsAlarmActive(true);
        alarmAudio.startAlarm();
      }
    } catch (err) {
      console.error('Backend sync failed:', err);
      setBackendError(`Backend request failed: ${err.message}`);
    }
  };

  // 3. Continuous background watcher during an active trip
  const startLiveWatch = () => {
    stopAllTracking();

    const onWatchSuccess = (position) => {
      const { latitude, longitude } = position.coords;
      lastLocationTimestampRef.current = Date.now();
      setCurrentLocation({ lat: latitude, lng: longitude });
      setGpsError(null);
      syncLocationWithBackend(latitude, longitude, destination, alertDistance);
    };

    const onWatchError = (error) => {
      console.warn('Live tracking notice:', error);
      if (error.code === error.TIMEOUT) return;
      if (error.code === error.POSITION_UNAVAILABLE) {
        setGpsError('📡 Fine-tuning satellite GPS signal...');
      }
    };

    // enableHighAccuracy: false prevents prompting the user with the GLA system dialog during active transit!
    watchIdRef.current = navigator.geolocation.watchPosition(
      onWatchSuccess,
      onWatchError,
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 4000,
      }
    );
  };

  // Helper when location is successfully obtained
  const onLocationSuccess = (position) => {
    const { latitude, longitude } = position.coords;
    lastLocationTimestampRef.current = Date.now();
    setLocationStatus('granted');
    setIsRequestingLocation(false);
    setIsLocationDialogOpen(false);
    setLocationError(null);
    setGpsError(null);
    setCurrentLocation({ lat: latitude, lng: longitude });
    setIsTripActive(true);

    // Sync with backend API
    syncLocationWithBackend(latitude, longitude, destination, alertDistance);

    // Start continuous live tracking for transit updates
    startLiveWatch();
  };

  /**
   * handleStartTrip:
   * Triggered when the user clicks START TRIP.
   * If location is already verified ON, starts immediately!
   * Otherwise verifies location state and starts trip if ON.
   */
  const handleStartTrip = async () => {
    if (!destination) {
      alert('Please select or search for a destination first.');
      return;
    }

    if (isRequestingLocation) return;

    // 1. If location is already verified ON and recent (< 2 min), start immediately!
    if (
      currentLocation &&
      lastLocationTimestampRef.current &&
      Date.now() - lastLocationTimestampRef.current < 120000
    ) {
      onLocationSuccess({
        coords: {
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
        },
      });
      return;
    }

    // 2. Otherwise test and verify location
    const pos = await checkDeviceLocation(true);
    if (pos) {
      onLocationSuccess(pos);
    } else {
      setIsLocationDialogOpen(true);
    }
  };

  /**
   * handleTurnOnLocation:
   * Triggered when the user clicks "Turn on location" inside the dialog.
   */
  const handleTurnOnLocation = async () => {
    if (isRequestingLocation) return;
    const pos = await checkDeviceLocation(true);
    if (pos) {
      onLocationSuccess(pos);
    }
  };

  /**
   * handleNoThanks:
   * Triggered when the user clicks "No, thanks" inside the dialog.
   * Cancels the trip, closes the dialog, and stops all background requests.
   */
  const handleNoThanks = () => {
    setIsLocationDialogOpen(false);
    setIsRequestingLocation(false);
    setLocationStatus('cancelled');
    setIsTripActive(false);
    setGpsError(null);
    stopAllTracking();
    // Do NOT request location again. The user remains safely on the page.
    // When the user clicks Start Trip again, the dialog will appear again cleanly.
  };

  // User action: Enter destination manually from settings guide
  const handleEnterDestinationManually = () => {
    handleNoThanks();
    const searchEl = document.querySelector('.search-input') || document.querySelector('.destination-card');
    if (searchEl) {
      searchEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof searchEl.focus === 'function') {
        searchEl.focus();
      }
    }
  };

  // Stop Trip
  const handleStopTrip = () => {
    stopAllTracking();
    setIsTripActive(false);
    setIsSimulating(false);
    setLocationStatus('idle');
    setGpsError(null);
    handleStopAlarm();
  };

  // 9. Stop Alarm
  const handleStopAlarm = () => {
    setIsAlarmActive(false);
    alarmAudio.stopAlarm();
  };

  // 6. Simulator: Move 2 km closer each step
  const handleSimulateStep = () => {
    if (!destination) return;
    setIsSimulating(true);

    // Decrease coordinate offset (~0.018 degrees is approx 2 km)
    simOffsetRef.current = Math.max(0.005, simOffsetRef.current - 0.02);

    const simLat = destination.lat + simOffsetRef.current;
    const simLng = destination.lng + simOffsetRef.current;

    setCurrentLocation({ lat: simLat, lng: simLng });
    syncLocationWithBackend(simLat, simLng, destination, alertDistance);
  };

  // 7. Instant Alarm Trigger Test
  const handleTriggerAlarmDirectly = () => {
    setIsAlarmActive(true);
    alarmAudio.startAlarm();
  };

  // 8. Reset Simulation
  const handleResetSimulation = () => {
    simOffsetRef.current = 0.1; // ~11 km away
    const simLat = destination.lat + simOffsetRef.current;
    const simLng = destination.lng + simOffsetRef.current;
    setCurrentLocation({ lat: simLat, lng: simLng });
    syncLocationWithBackend(simLat, simLng, destination, alertDistance);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllTracking();
      alarmAudio.stopAlarm();
    };
  }, []);

  return (
    <div className="app-container">
      {/* App Header with Connection Status */}
      <Header isBackendOnline={isBackendOnline} />

      {/* GPS & Backend Error Alerts */}
      {gpsError && (
        <div className="alert-box alert-warning">
          <span>⚠️</span>
          <span>{gpsError}</span>
        </div>
      )}

      {backendError && (
        <div className="alert-box alert-error">
          <span>❌</span>
          <span>{backendError}</span>
        </div>
      )}

      {/* Responsive Layout Grid (Single column on mobile, 2-column dashboard on desktop/tablet) */}
      <main className="responsive-layout">
        <section className="layout-col primary-col">
          {!isTripActive ? (
            <>
              {/* Device Location Check & Status Card */}
              <div
                className={`device-location-status-card ${locationStatus === 'granted' && currentLocation
                    ? 'is-on'
                    : locationStatus === 'requesting'
                      ? 'is-checking'
                      : 'is-off'
                  }`}
              >
                <div className="loc-status-left">
                  <div className="loc-status-icon-bubble">
                    {locationStatus === 'granted' && currentLocation ? (
                      <span className="loc-dot-pulse green" />
                    ) : locationStatus === 'requesting' ? (
                      <span className="loc-spinner" />
                    ) : (
                      <span className="loc-dot-pulse orange" />
                    )}
                  </div>
                  <div className="loc-status-info">
                    <div className="loc-status-title">
                      {locationStatus === 'granted' && currentLocation ? (
                        <>
                          <span className="loc-status-badge badge-on">🟢 LOCATION IS ON</span>
                          {lastUpdated && <span className="loc-status-time">Checked {lastUpdated}</span>}
                        </>
                      ) : locationStatus === 'requesting' ? (
                        <span className="loc-status-badge badge-checking">🔄 CHECKING LOCATION...</span>
                      ) : (
                        <span className="loc-status-badge badge-off">⚠️ LOCATION NOT DETECTED</span>
                      )}
                    </div>
                    <div className="loc-status-subtext">
                      {locationStatus === 'granted' && currentLocation ? (
                        <span className="loc-coords-text">
                          GPS: {currentLocation.lat.toFixed(4)}°, {currentLocation.lng.toFixed(4)}° • Ready to track
                        </span>
                      ) : locationStatus === 'requesting' ? (
                        <span>Checking if your phone's location toggle is on...</span>
                      ) : locationStatus === 'denied' ? (
                        <span>Browser permission blocked. Tap 🔒 in address bar to allow.</span>
                      ) : (
                        <span>Turn on Location in phone quick settings and tap Check Location.</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="loc-check-btn"
                  onClick={() => checkDeviceLocation(true)}
                  disabled={locationStatus === 'requesting'}
                >
                  {locationStatus === 'requesting' ? (
                    <>
                      <span className="loc-btn-spinner" />
                      <span>Checking...</span>
                    </>
                  ) : locationStatus === 'granted' && currentLocation ? (
                    '🔄 Re-check'
                  ) : (
                    '⚡ Check Location'
                  )}
                </button>
              </div>

              <DestinationSearch
                destination={destination}
                setDestination={setDestination}
                disabled={isTripActive}
                userLocation={currentLocation}
              />

              <AlertDistance
                alertDistance={alertDistance}
                setAlertDistance={setAlertDistance}
                disabled={isTripActive}
              />

              <button
                type="button"
                className="btn-primary"
                onClick={handleStartTrip}
                disabled={!destination || locationStatus === 'requesting'}
              >
                {locationStatus === 'requesting' ? (
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
              lastUpdated={lastUpdated}
              onStopTrip={handleStopTrip}
              isSimulating={isSimulating}
            />
          )}
        </section>

        <section className="layout-col secondary-col">
          {/* Simulator Controls for Desktop / Testing */}
          <SimulatorControl
            isTripActive={isTripActive}
            onSimulateStep={handleSimulateStep}
            onTriggerAlarmDirectly={handleTriggerAlarmDirectly}
            onResetSimulation={handleResetSimulation}
            isSimulating={isSimulating}
          />

          {/* Passenger Travel Tips & Device Battery Advice */}
          <div className="glass-card travel-tips-card">
            <div className="section-label" style={{ marginBottom: '0.4rem', color: 'var(--accent-blue)' }}>
              <span>🛡️</span>
              <span>Bus Travel Guide & Tips</span>
            </div>
            <ul className="travel-tips-list">
              <li>
                <strong>📱 Keep Screen / Audio Active:</strong> Keep this browser tab open and ensure your media volume is unmuted so you don't sleep through the alarm.
              </li>
              <li>
                <strong>🔋 Battery Saving:</strong> The GPS tracking runs efficiently in your browser without heating up your battery.
              </li>
              <li>
                <strong>📍 GPS Accuracy:</strong> Works on sleeper buses, night express coaches, and trains with device satellite GPS.
              </li>
            </ul>
          </div>
        </section>
      </main>

      {/* Fullscreen Wake-Up Alarm Modal */}
      <AlarmModal
        isOpen={isAlarmActive}
        distance={remainingDistance}
        alertDistance={alertDistance}
        destinationName={destination?.name}
        onStopAlarm={handleStopAlarm}
      />

      {/* Android Location Accuracy & Permission Dialog */}
      <LocationPermissionDialog
        isOpen={isLocationDialogOpen}
        isRequesting={isRequestingLocation}
        locationError={locationError}
        onTurnOnLocation={handleTurnOnLocation}
        onNoThanks={handleNoThanks}
        onEnterDestinationManually={handleEnterDestinationManually}
      />

      <footer className="app-footer">
        <p>Calculates straight-line distance via Haversine formula.</p>
        <p>Keep browser open & device volume on during your journey.</p>
      </footer>
    </div>
  );
}
