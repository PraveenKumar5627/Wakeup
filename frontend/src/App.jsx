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
  const [lastUpdated, setLastUpdated] = useState('');
  const [gpsError, setGpsError] = useState(null);
  const [backendError, setBackendError] = useState(null);
  const [isBackendOnline, setIsBackendOnline] = useState(false);

  // Location Permission State Machine:
  // 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'cancelled'
  const [locationStatus, setLocationStatus] = useState('idle');
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [locationErrorCode, setLocationErrorCode] = useState(null);
  const [locationErrorMessage, setLocationErrorMessage] = useState('');

  // Alarm modal & audio state
  const [isAlarmActive, setIsAlarmActive] = useState(false);

  // Simulation mode for desktop testing
  const [isSimulating, setIsSimulating] = useState(false);
  const simOffsetRef = useRef(0.1); // ~11 km away initially

  // Watch position reference for continuous live GPS tracking
  const watchIdRef = useRef(null);

  // Helper to completely stop active geolocation watcher
  const stopAllTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

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
      setCurrentLocation({ lat: latitude, lng: longitude });
      setGpsError(null);
      syncLocationWithBackend(latitude, longitude, destination, alertDistance);
    };

    const onWatchError = (error) => {
      console.warn('Live tracking warning:', error);
      // Ignore silent timeouts during active transit
      if (error.code === error.TIMEOUT) return;
      if (error.code === error.POSITION_UNAVAILABLE) {
        setGpsError('📡 Searching for GPS satellite signal...');
      }
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      onWatchSuccess,
      onWatchError,
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 5000,
      }
    );
  };

  // 4. Start Trip: request GPS and begin tracking
  const handleStartTrip = async () => {
    if (!destination) {
      alert('Please select or search for a destination first.');
      return;
    }

    // Prevent duplicate concurrent requests if already requesting
    if (locationStatus === 'requesting') {
      return;
    }

    // Reset error states and stop any existing tracker
    stopAllTracking();
    setGpsError(null);
    setBackendError(null);
    setIsTripActive(false);
    setIsSimulating(false);
    setLocationErrorCode(null);
    setLocationErrorMessage('');

    // Check browser geolocation support
    if (!('geolocation' in navigator)) {
      setLocationStatus('unavailable');
      setLocationErrorCode('POSITION_UNAVAILABLE');
      setLocationErrorMessage('Geolocation is not supported by your browser. Please use the simulator below.');
      setIsLocationDialogOpen(true);
      return;
    }

    // Check browser permissions state if supported
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        if (perm.state === 'denied') {
          setLocationStatus('denied');
          setLocationErrorCode('PERMISSION_DENIED');
          setLocationErrorMessage(
            'Browser location permission is blocked. Tap the 🔒 lock icon in your address bar to allow location.'
          );
          setIsLocationDialogOpen(true);
          return;
        }
      } catch {
        // Permissions API unsupported or failed, continue directly to request
      }
    }

    // Transition state to 'requesting'
    setLocationStatus('requesting');
    setGpsError('📡 Requesting location... Tap "Allow" or "Turn on" if your device asks for location.');

    // Execute a single, non-repeating location request.
    // CRITICAL: We do NOT use automatic background timers, loops, or pokes.
    // If the user rejects or taps "No, thanks", it will NOT prompt again.
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // SUCCESS: Coordinates successfully acquired
        const { latitude, longitude } = position.coords;
        setLocationStatus('granted');
        setIsLocationDialogOpen(false);
        setGpsError(null);
        setCurrentLocation({ lat: latitude, lng: longitude });
        setIsTripActive(true);

        // Sync with backend API
        syncLocationWithBackend(latitude, longitude, destination, alertDistance);

        // Start continuous live tracking for transit updates
        startLiveWatch();
      },
      (error) => {
        // REJECTION OR ERROR: User tapped "No, thanks", "Block", or GPS is disabled
        console.warn('Geolocation request failed:', error);
        stopAllTracking();
        setIsTripActive(false);
        setGpsError(null);

        switch (error.code) {
          case error.PERMISSION_DENIED: // Code 1
            setLocationStatus('denied');
            setLocationErrorCode('PERMISSION_DENIED');
            setLocationErrorMessage(
              'Location permission was denied in your browser settings.'
            );
            setIsLocationDialogOpen(true);
            break;

          case error.POSITION_UNAVAILABLE: // Code 2 (Android "No, thanks" or GPS disabled)
            setLocationStatus('unavailable');
            setLocationErrorCode('POSITION_UNAVAILABLE');
            setLocationErrorMessage(
              'Device location is turned off or was not enabled in settings.'
            );
            setIsLocationDialogOpen(true);
            break;

          case error.TIMEOUT: // Code 3
            setLocationStatus('unavailable');
            setLocationErrorCode('TIMEOUT');
            setLocationErrorMessage(
              'Location request timed out. Please check your GPS signal and try again.'
            );
            setIsLocationDialogOpen(true);
            break;

          default:
            setLocationStatus('unavailable');
            setLocationErrorCode('POSITION_UNAVAILABLE');
            setLocationErrorMessage(
              error.message || 'Unable to retrieve location. Please check device location settings.'
            );
            setIsLocationDialogOpen(true);
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  // 5. User Action: Try Again from custom dialog
  const handleTryAgain = () => {
    setIsLocationDialogOpen(false);
    handleStartTrip();
  };

  // 6. User Action: Enter Destination Manually from custom dialog
  const handleEnterDestinationManually = () => {
    setIsLocationDialogOpen(false);
    setLocationStatus('cancelled');
    stopAllTracking();
    setIsTripActive(false);
    setGpsError(null);

    // Scroll to destination search container smoothly
    const searchEl = document.querySelector('.search-input') || document.querySelector('.destination-card');
    if (searchEl) {
      searchEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof searchEl.focus === 'function') {
        searchEl.focus();
      }
    }
  };

  // 7. User Action: Cancel from custom dialog (stops attempt and does not reopen)
  const handleCancelLocationDialog = () => {
    setIsLocationDialogOpen(false);
    setLocationStatus('cancelled');
    stopAllTracking();
    setIsTripActive(false);
    setGpsError(null);
  };

  // 8. Stop Trip
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
              <DestinationSearch
                destination={destination}
                setDestination={setDestination}
                disabled={isTripActive}
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

      {/* User-Friendly Location Permission & Settings Modal */}
      <LocationPermissionDialog
        isOpen={isLocationDialogOpen}
        status={locationStatus}
        errorCode={locationErrorCode}
        errorMessage={locationErrorMessage}
        onTryAgain={handleTryAgain}
        onEnterDestinationManually={handleEnterDestinationManually}
        onCancel={handleCancelLocationDialog}
      />

      <footer className="app-footer">
        <p>Calculates straight-line distance via Haversine formula.</p>
        <p>Keep browser open & device volume on during your journey.</p>
      </footer>
    </div>
  );
}
