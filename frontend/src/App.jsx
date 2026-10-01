import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import DestinationSearch from './components/DestinationSearch';
import AlertDistance from './components/AlertDistance';
import TripStatus from './components/TripStatus';
import AlarmModal from './components/AlarmModal';
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

  // Alarm modal & audio state
  const [isAlarmActive, setIsAlarmActive] = useState(false);

  // Simulation mode for desktop testing
  const [isSimulating, setIsSimulating] = useState(false);
  const simOffsetRef = useRef(0.1); // ~11 km away initially

  // Watch position reference & lifecycle tracking
  const watchIdRef = useRef(null);
  const isTripActiveRef = useRef(false);
  const hasReceivedFirstFixRef = useRef(false);
  const retryTimersRef = useRef([]);

  // Clear any scheduled retry timers
  const clearRetryTimers = () => {
    if (retryTimersRef.current && retryTimersRef.current.length > 0) {
      retryTimersRef.current.forEach((id) => clearTimeout(id));
      retryTimersRef.current = [];
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

  // 3. Start Trip: request GPS and begin tracking
  const handleStartTrip = async () => {
    if (!destination) {
      alert('Please select or search for a destination first.');
      return;
    }

    setGpsError(null);
    setBackendError(null);
    setIsTripActive(true);
    isTripActiveRef.current = true;
    hasReceivedFirstFixRef.current = false;
    setIsSimulating(false);

    clearRetryTimers();
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported by your browser. Please use the simulator below.');
      setIsTripActive(false);
      isTripActiveRef.current = false;
      return;
    }

    // Set reassuring status message
    setGpsError('📡 Accessing location... If your phone asks for Location Accuracy, please tap "Turn on".');

    // Check browser permission state if supported
    if (navigator.permissions) {
      try {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        if (perm.state === 'denied') {
          setGpsError('❌ Location blocked. Fix: tap the 🔒 icon in your browser address bar → Site settings → Location → Allow. Then tap START TRIP again.');
          setIsTripActive(false);
          isTripActiveRef.current = false;
          return;
        }
      } catch {
        // Permissions API unsupported or failed, continue to geolocation request
      }
    }

    // Callback on successful GPS position acquisition
    const onSuccess = (position) => {
      if (!isTripActiveRef.current) return;
      hasReceivedFirstFixRef.current = true;
      clearRetryTimers();

      const { latitude, longitude } = position.coords;
      setCurrentLocation({ lat: latitude, lng: longitude });
      setGpsError(null); // Clear loading / warning messages
      syncLocationWithBackend(latitude, longitude, destination, alertDistance);
    };

    // Callback on GPS permission denial or location acquisition failure
    const onError = (error) => {
      console.warn('Geolocation error:', error);
      if (!isTripActiveRef.current) return;

      switch (error.code) {
        case error.PERMISSION_DENIED:
          clearRetryTimers();
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          setGpsError('❌ Location access was denied. Please allow location permissions in your browser or phone settings.');
          setIsTripActive(false);
          isTripActiveRef.current = false;
          break;

        case error.POSITION_UNAVAILABLE:
          if (!hasReceivedFirstFixRef.current) {
            // User likely tapped "No, thanks" on the Android system dialog or GPS is disabled
            clearRetryTimers();
            if (watchIdRef.current !== null) {
              navigator.geolocation.clearWatch(watchIdRef.current);
              watchIdRef.current = null;
            }
            setGpsError('⚠️ Location not enabled. Please tap "Turn on" when prompted, or enable Location in your phone settings.');
            setIsTripActive(false);
            isTripActiveRef.current = false;
          } else {
            setGpsError('📡 Reconnecting to GPS signal...');
          }
          break;

        case error.TIMEOUT:
          if (!hasReceivedFirstFixRef.current) {
            // Waiting for user to tap "Turn on" or for satellites to acquire
            setGpsError('📡 Connecting to GPS... If prompted, please tap "Turn on" to enable Location Accuracy.');
          }
          break;

        default:
          if (!hasReceivedFirstFixRef.current) {
            setGpsError('Unable to retrieve your location. Please ensure location is enabled.');
          }
      }
    };

    // 1. Immediately register continuous watch tracking with high accuracy.
    // When the user taps "Turn on" on the Android dialog, watchPosition receives the fix right away!
    const watchOptions = {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 20000,
    };
    watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, watchOptions);

    // 2. Immediate single-shot request to grab any cached/quick fix
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onSuccess(pos);
      },
      (err) => {
        // Soft error, watchPosition will handle ongoing tracking
        console.log('Initial getCurrentPosition probe:', err.message);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 8000 }
    );

    // 3. Proactive retries: when the user taps "Turn on", the hardware needs 1-3 seconds
    // to warm up. A quick getCurrentPosition probe at 4s and 8s guarantees fast pickup.
    const schedulePoke = (delayMs) => {
      const timerId = setTimeout(() => {
        if (!hasReceivedFirstFixRef.current && isTripActiveRef.current) {
          navigator.geolocation.getCurrentPosition(
            onSuccess,
            () => {},
            { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
          );
        }
      }, delayMs);
      retryTimersRef.current.push(timerId);
    };

    schedulePoke(4000);
    schedulePoke(8000);
  };

  // 4. Stop Trip
  const handleStopTrip = () => {
    isTripActiveRef.current = false;
    hasReceivedFirstFixRef.current = false;
    clearRetryTimers();

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTripActive(false);
    setIsSimulating(false);
    setGpsError(null);
    handleStopAlarm();
  };

  // 5. Stop Alarm
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
      clearRetryTimers();
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
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
                disabled={!destination}
              >
                <span>🚀</span>
                <span>START TRIP</span>
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

      <footer className="app-footer">
        <p>Calculates straight-line distance via Haversine formula.</p>
        <p>Keep browser open & device volume on during your journey.</p>
      </footer>
    </div>
  );
}
