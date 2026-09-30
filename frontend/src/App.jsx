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

  // Watch position reference for cleanup
  const watchIdRef = useRef(null);

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
    setIsSimulating(false);

    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported by your browser. Please use the simulator below.');
      return;
    }

    // Check current permission state before requesting GPS
    if (navigator.permissions) {
      try {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        if (perm.state === 'denied') {
          setGpsError('❌ Location blocked. Fix: tap the 🔒 icon in your browser address bar → Site settings → Location → Allow. Then try again.');
          setIsTripActive(false);
          return;
        }
        if (perm.state === 'prompt') {
          setGpsError('📍 Tap "Allow" on the popup to share your location.');
        } else {
          setGpsError('📡 Acquiring your GPS location...');
        }
      } catch {
        setGpsError('📍 Please allow location access if prompted.');
      }
    } else {
      setGpsError('📍 Please allow location access if prompted.');
    }

    // Callback on successful GPS position acquisition
    const onSuccess = (position) => {
      const { latitude, longitude } = position.coords;
      setCurrentLocation({ lat: latitude, lng: longitude });
      setGpsError(null); // Clear any previous loading message
      syncLocationWithBackend(latitude, longitude, destination, alertDistance);
    };

    // Callback on GPS permission denial or location acquisition failure
    const onError = (error) => {
      console.warn('Geolocation error:', error);
      switch (error.code) {
        case error.PERMISSION_DENIED:
          setGpsError('GPS permission was denied. Please allow location access in your browser settings.');
          break;
        case error.POSITION_UNAVAILABLE:
          setGpsError('Searching for GPS signal... Please stay in an open area.');
          break;
        case error.TIMEOUT:
          // Ignore timeout errors silently so watchPosition keeps retrying
          // without displaying a scary error message to the user.
          break;
        default:
          setGpsError('Unable to retrieve your location. Please check GPS settings.');
      }
    };

    // Phase 1: Fast initial fix using network/cell-tower location (low accuracy)
    // This triggers the permission dialog and gets a location in 1-2 seconds.

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onSuccess(position);
        
        // Phase 2: Switch to continuous high-accuracy satellite GPS tracking
        watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
          enableHighAccuracy: true,
          maximumAge: 15000,
          timeout: 20000,
        });
      },
      (error) => {
        // If permission was denied, stop trip entirely
        if (error.code === error.PERMISSION_DENIED) {
          onError(error);
          setIsTripActive(false);
          return;
        }
        
        // Timed out — user may have just tapped "Turn On" in the Android system dialog.
        // Retry once automatically with high-accuracy GPS.
        setGpsError('📡 Getting your location... almost there!');
        navigator.geolocation.getCurrentPosition(
          (retryPos) => {
            onSuccess(retryPos);
            watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
              enableHighAccuracy: true,
              maximumAge: 15000,
              timeout: 20000,
            });
          },
          (retryError) => {
            onError(retryError);
            // Still start watching in background in case GPS wakes up
            watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
              enableHighAccuracy: true,
              maximumAge: 15000,
              timeout: 20000,
            });
          },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        );
      },
    { enableHighAccuracy: false, timeout: 30000, maximumAge: Infinity }
    );
  };


  // 4. Stop Trip
  const handleStopTrip = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTripActive(false);
    setIsSimulating(false);
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
