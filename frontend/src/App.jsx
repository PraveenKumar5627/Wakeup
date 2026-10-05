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

  // Pre-warm user location silently if permission was already granted previously
  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions
          .query({ name: 'geolocation' })
          .then((status) => {
            if (status.state === 'granted') {
              setLocationStatus('granted');
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  const { latitude, longitude } = position.coords;
                  setCurrentLocation({ lat: latitude, lng: longitude });
                  lastLocationTimestampRef.current = Date.now();
                  setLastUpdated(new Date().toLocaleTimeString());
                },
                () => {},
                {
                  enableHighAccuracy: false,
                  timeout: 3000,
                  maximumAge: 300000, // 5 min cached
                }
              );
            }
          })
          .catch(() => {});
      }
    }
  }, []);

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
      lastLocationTimestampRef.current = Date.now();
      setCurrentLocation({ lat: latitude, lng: longitude });
      setGpsError(null);
      syncLocationWithBackend(latitude, longitude, destination, alertDistance);
    };

    const onWatchError = (error) => {
      console.warn('Live tracking warning:', error);
      // Ignore silent timeouts during active transit
      if (error.code === error.TIMEOUT) return;
      if (error.code === error.POSITION_UNAVAILABLE) {
        setGpsError('📡 Fine-tuning satellite GPS signal...');
      }
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      onWatchSuccess,
      onWatchError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 3000,
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
   * requestCurrentLocation:
   * Fast-first hybrid geolocation strategy:
   * 1. If recent location is already cached in memory (< 20 seconds old), returns it in 0ms!
   * 2. Ultra-fast initial location (Tier 1):
   *    Requests cached / network position with enableHighAccuracy: false and maximumAge: 120000.
   *    On Android, when device location is on, this returns coordinates in ~50-250ms without
   *    waiting for satellite locks or triggering slow Google Location Accuracy checking prompts.
   * 3. Parallel high-accuracy request (Tier 2):
   *    Runs with a 5.5s timeout. Whichever resolves first delivers the location immediately.
   * 4. Background live watch:
   *    Once resolved, startLiveWatch() runs in the background with continuous high-accuracy GPS
   *    so satellite updates refine accuracy dynamically without blocking the user.
   */
  const requestCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        const err = new Error('Geolocation is not supported by your browser.');
        err.code = 2; // POSITION_UNAVAILABLE
        reject(err);
        return;
      }

      // If we already have a recent location (< 25s old), return immediately!
      if (
        currentLocation &&
        lastLocationTimestampRef.current &&
        Date.now() - lastLocationTimestampRef.current < 25000
      ) {
        resolve({
          coords: {
            latitude: currentLocation.lat,
            longitude: currentLocation.lng,
          },
        });
        return;
      }

      // If running inside a supported native Android wrapper (Capacitor/Cordova/Android bridge),
      // invoke the native settings/resolution intent.
      try {
        if (window.Capacitor?.Plugins?.LocationSettings) {
          window.Capacitor.Plugins.LocationSettings.enable();
        } else if (window.Android?.openLocationSettings) {
          window.Android.openLocationSettings();
        }
      } catch (e) {
        console.warn('Native wrapper call not available:', e);
      }

      let isResolved = false;

      const handleSuccess = (position) => {
        if (!isResolved) {
          isResolved = true;
          lastLocationTimestampRef.current = Date.now();
          resolve(position);
        }
      };

      const handleError = (error) => {
        if (!isResolved) {
          isResolved = true;
          reject(error);
        }
      };

      // TIER 1: Ultra-fast low-accuracy / cached fetch (instant sub-second resolution)
      // When Location is ON, this returns cellular/Wi-Fi/cached GPS in ~100-250ms!
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        (fastErr) => {
          console.warn('Fast geolocation attempt bypassed, waiting for GPS:', fastErr);
        },
        {
          enableHighAccuracy: false,
          timeout: 2500,
          maximumAge: 120000,
        }
      );

      // TIER 2: High-accuracy request in parallel
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        (highErr) => {
          console.warn('High accuracy attempt error:', highErr);
          // If high-accuracy errors and fast tier hasn't resolved within 3s, reject
          setTimeout(() => {
            if (!isResolved) {
              handleError(highErr);
            }
          }, 2600);
        },
        {
          enableHighAccuracy: true,
          timeout: 5500,
          maximumAge: 30000,
        }
      );

      // Safety cutoff timer: NEVER let the UI hang on "Checking..." for more than 6s
      setTimeout(() => {
        if (!isResolved) {
          const timeoutErr = new Error('Location check timed out. Please verify Location toggle is on in Android settings.');
          timeoutErr.code = 3;
          handleError(timeoutErr);
        }
      }, 6000);
    });
  };

  /**
   * handleStartTrip:
   * Triggered when the user clicks START TRIP.
   * Checks permissions and either starts tracking or presents the location dialog.
   */
  const handleStartTrip = async () => {
    if (!destination) {
      alert('Please select or search for a destination first.');
      return;
    }

    if (isRequestingLocation) {
      return; // Prevent duplicate requests
    }

    // 1. Instant Start: If we already have a recent location (< 2 minutes old), start immediately!
    if (
      currentLocation &&
      lastLocationTimestampRef.current &&
      Date.now() - lastLocationTimestampRef.current < 120000
    ) {
      setLocationStatus('granted');
      setIsRequestingLocation(false);
      setIsLocationDialogOpen(false);
      setLocationError(null);
      setGpsError(null);
      setIsTripActive(true);

      syncLocationWithBackend(currentLocation.lat, currentLocation.lng, destination, alertDistance);
      startLiveWatch();
      return;
    }

    // 2. Check browser permissions state if explicitly blocked
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        if (perm.state === 'denied') {
          setLocationStatus('denied');
          setLocationError(
            'Browser location permission is blocked. Tap the 🔒 lock icon in your address bar to allow location.'
          );
          setIsLocationDialogOpen(true);
          return;
        }
      } catch {
        // Permissions API unsupported or failed, continue directly
      }
    }

    // Reset error states and stop any existing tracker
    stopAllTracking();
    setGpsError(null);
    setBackendError(null);
    setIsTripActive(false);
    setIsSimulating(false);
    setLocationError(null);

    setIsRequestingLocation(true);
    setLocationStatus('requesting');
    setGpsError('⚡ Connecting to your location quickly...');

    try {
      const position = await requestCurrentLocation();
      onLocationSuccess(position);
    } catch (error) {
      console.warn('Geolocation request failed:', error);
      setIsRequestingLocation(false);
      stopAllTracking();
      setIsTripActive(false);
      setGpsError(null);

      let msg = '';
      if (error.code === 1) {
        setLocationStatus('denied');
        msg = 'Location permission was denied in your browser settings. Please allow location access.';
      } else if (error.code === 2) {
        setLocationStatus('unavailable');
        msg = 'Device location is turned off. Please ensure Location is enabled in your Android notification shade, then tap Turn on location.';
      } else if (error.code === 3) {
        setLocationStatus('unavailable');
        msg = 'Location check timed out. Please check that Location toggle is ON and try again.';
      } else {
        setLocationStatus('unavailable');
        msg = error.message || 'Unable to access device location.';
      }

      setLocationError(msg);
      setIsLocationDialogOpen(true);
    }
  };

  /**
   * handleTurnOnLocation:
   * Triggered when the user clicks "Turn on location" inside the dialog.
   */
  const handleTurnOnLocation = async () => {
    if (isRequestingLocation) return;

    setIsRequestingLocation(true);
    setLocationStatus('requesting');
    setLocationError(null);

    try {
      const position = await requestCurrentLocation();
      onLocationSuccess(position);
    } catch (error) {
      console.warn('Turn on location failed:', error);
      setIsRequestingLocation(false);
      let msg = '';
      if (error.code === 1) {
        setLocationStatus('denied');
        msg = 'Browser permission denied. Tap the 🔒 lock icon in the address bar → Site settings → Location → Allow.';
      } else if (error.code === 2) {
        setLocationStatus('unavailable');
        msg = 'Device location is turned off. Please swipe down from top of screen to turn ON Location, then tap Turn on location.';
      } else if (error.code === 3) {
        setLocationStatus('unavailable');
        msg = 'Location check timed out. Please ensure Location is turned on and try again.';
      } else {
        setLocationStatus('unavailable');
        msg = error.message || 'Unable to access device location.';
      }
      setLocationError(msg);
      // Keep dialog open so user can see instructions or tap No, thanks
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
