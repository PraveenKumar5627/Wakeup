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

  // Alert distance threshold (km): default 3 km
  const [alertDistance, setAlertDistance] = useState(3);

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
  const syncLocationWithBackend = async (lat, lng, dest, threshold) => {
    try {
      setBackendError(null);
      const result = await calculateDistance({
        currentLat: lat,
        currentLng: lng,
        destLat: dest.lat,
        destLng: dest.lng,
        alertDistance: threshold,
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
  const handleStartTrip = () => {
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

    // Callback on successful GPS position acquisition
    const onSuccess = (position) => {
      const { latitude, longitude } = position.coords;
      setCurrentLocation({ lat: latitude, lng: longitude });
      setGpsError(null); // Clear any previous timeout warning
      syncLocationWithBackend(latitude, longitude, destination, alertDistance);
    };

    // Callback on GPS permission denial or location acquisition failure
    const onError = (error) => {
      console.warn('Geolocation error:', error);
      switch (error.code) {
        case error.PERMISSION_DENIED:
          setGpsError('GPS permission was denied. Please allow location access in your browser settings, or use the Desktop Simulator below.');
          break;
        case error.POSITION_UNAVAILABLE:
          // Non-fatal: satellite signal temporarily lost, keep watching
          setGpsError('Searching for GPS signal... Please stay in an open area.');
          break;
        case error.TIMEOUT:
          // Non-fatal: GPS cold-start on mobile takes time — show a soft warning
          // watchPosition will keep retrying automatically with the options below
          setGpsError('Acquiring GPS fix... This can take up to 30 seconds on first use. Please wait.');
          break;
        default:
          setGpsError('Unable to retrieve your location. Please check GPS settings.');
      }
    };

    // Phase 1: Get a quick initial fix using network/cell-tower location (low accuracy, fast)
    // This gives instant feedback while the real GPS satellite warms up
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onSuccess(position);
        setGpsError(null);
      },
      () => {
        // Phase 1 failed (no network location) — that's fine, Phase 2 will handle it
        setGpsError('Acquiring GPS fix... Please wait.');
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );

    // Phase 2: High-accuracy continuous tracking (satellite GPS)
    // Large timeout + maximumAge so watchPosition retries gracefully on mobile
    const geoOptions = {
      enableHighAccuracy: true,
      maximumAge: 10000,   // Accept a cached position up to 10 seconds old
      timeout: 30000,      // Give GPS 30 seconds to get a satellite fix
    };

    // Begin active continuous watching
    watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, geoOptions);
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
