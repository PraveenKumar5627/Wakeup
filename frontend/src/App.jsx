import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

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
  const [destination, setDestination] = useState({
    name: 'Chennai Central Station',
    lat: 13.0827,
    lng: 80.2707,
  });

  // Slider value is in meters; the backend expects kilometers.
  const [alertDistance, setAlertDistance] = useState(3000);

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

  // 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'cancelled'
  const [locationStatus, setLocationStatus] = useState('idle');
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);

  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const simOffsetRef = useRef(0.1);

  // Browser watch IDs are numbers; Capacitor watch IDs are strings.
  const watchIdRef = useRef(null);
  const lastLocationTimestampRef = useRef(0);

  const isNative = Capacitor.isNativePlatform();

  // Stop whichever location watcher was started (native or browser).
  const stopAllTracking = () => {
    const watchId = watchIdRef.current;
    if (watchId === null) return;

    watchIdRef.current = null;

    if (isNative) {
      Geolocation.clearWatch({ id: watchId }).catch((error) => {
        console.warn('Could not clear native location watch:', error);
      });
    } else if (navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
    }
  };

  /**
   * Get one location reading.
   * On Android/iOS, use Capacitor's native permission API.
   * In a normal browser, use navigator.geolocation.
   */
  const checkDeviceLocation = async (isUserAction = false) => {
    setIsRequestingLocation(true);
    setLocationStatus('requesting');
    setLocationError(null);
    setGpsError(null);

    try {
      if (isNative) {
        let permission = await Geolocation.checkPermissions();

        // Ask for permission only following a user action, not on page load.
        if (
          permission.location !== 'granted' &&
          isUserAction
        ) {
          permission = await Geolocation.requestPermissions();
        }

        if (permission.location !== 'granted') {
          setLocationStatus('denied');
          setLocationError(
            'Location permission is not allowed. Tap Check Location or START TRIP and allow location access.'
          );
          return null;
        }

        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000,
        });

        const { latitude, longitude } = position.coords;
        lastLocationTimestampRef.current = Date.now();
        setCurrentLocation({ lat: latitude, lng: longitude });
        setLastUpdated(new Date().toLocaleTimeString());
        setLocationStatus('granted');
        setIsLocationDialogOpen(false);
        setLocationError(null);
        setGpsError(null);
        return position;
      }

      // Web-browser fallback.
      if (
        typeof window === 'undefined' ||
        !('geolocation' in navigator)
      ) {
        setLocationStatus('unavailable');
        setLocationError('Geolocation is not supported by this browser.');
        return null;
      }

      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 30000,
        });
      });

      const { latitude, longitude } = position.coords;
      lastLocationTimestampRef.current = Date.now();
      setCurrentLocation({ lat: latitude, lng: longitude });
      setLastUpdated(new Date().toLocaleTimeString());
      setLocationStatus('granted');
      setIsLocationDialogOpen(false);
      setLocationError(null);
      setGpsError(null);
      return position;
    } catch (error) {
      console.warn('checkDeviceLocation error:', error);

      // Native and browser errors have different shapes. Use the browser
      // numeric codes when available and otherwise show a useful message.
      if (!isNative && error?.code === 1) {
        setLocationStatus('denied');
        setLocationError(
          'Browser location permission denied. Allow Location in your browser site settings.'
        );
      } else if (!isNative && error?.code === 2) {
        setLocationStatus('unavailable');
        setLocationError(
          'Unable to determine location. Turn on Location in your phone settings and try again.'
        );
      } else if (!isNative && error?.code === 3) {
        setLocationStatus('unavailable');
        setLocationError(
          'Location request timed out. Check that Location is on and try again.'
        );
      } else {
        setLocationStatus('unavailable');
        setLocationError(
          error?.message ||
            'Unable to get your location. Check app permissions and device Location settings.'
        );
      }

      return null;
    } finally {
      setIsRequestingLocation(false);
    }
  };

  // Check location on launch without triggering a permission prompt.
  useEffect(() => {
    checkDeviceLocation(false);

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

  // Periodically check backend health.
  useEffect(() => {
    let mounted = true;

    const pingBackend = async () => {
      try {
        const online = await checkBackendHealth();
        if (mounted) setIsBackendOnline(online);
      } catch (error) {
        if (mounted) setIsBackendOnline(false);
      }
    };

    pingBackend();
    const interval = setInterval(pingBackend, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Send the current and destination coordinates to the existing backend.
  const syncLocationWithBackend = async (lat, lng, dest, thresholdMeters) => {
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
          (result.duration_min
            ? `${Math.round(result.duration_min)} min`
            : ''),
        straightLineKm: result.straight_line_km || null,
      });
      setLastUpdated(new Date().toLocaleTimeString());

      if (result.alert && !isAlarmActive) {
        setIsAlarmActive(true);
        alarmAudio.startAlarm();
      }
    } catch (error) {
      console.error('Backend sync failed:', error);
      setBackendError(`Backend request failed: ${error.message}`);
    }
  };

  // Watch location continuously while a trip is active.
  const startLiveWatch = async () => {
    stopAllTracking();

    const onWatchSuccess = (position) => {
      if (!position) return;

      const { latitude, longitude } = position.coords;
      lastLocationTimestampRef.current = Date.now();
      setCurrentLocation({ lat: latitude, lng: longitude });
      setGpsError(null);
      syncLocationWithBackend(latitude, longitude, destination, alertDistance);
    };

    const onWatchError = (error) => {
      console.warn('Live tracking notice:', error);
      setGpsError(
        error?.message ||
          'Unable to update location. Check GPS and app permissions.'
      );
    };

    try {
      if (isNative) {
        watchIdRef.current = await Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 4000,
          },
          (position, error) => {
            if (error) {
              onWatchError(error);
            } else if (position) {
              onWatchSuccess(position);
            }
          }
        );
      } else {
        if (!navigator.geolocation) {
          setGpsError('Geolocation is not supported by this browser.');
          return;
        }

        watchIdRef.current = navigator.geolocation.watchPosition(
          onWatchSuccess,
          onWatchError,
          {
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 4000,
          }
        );
      }
    } catch (error) {
      console.error('Could not start location tracking:', error);
      setGpsError(error?.message || 'Could not start GPS tracking.');
    }
  };

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

    syncLocationWithBackend(latitude, longitude, destination, alertDistance);
    startLiveWatch();
  };

  const handleStartTrip = async () => {
    if (!destination) {
      alert('Please select or search for a destination first.');
      return;
    }

    if (isRequestingLocation) return;

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

    const position = await checkDeviceLocation(true);
    if (position) {
      onLocationSuccess(position);
    } else {
      setIsLocationDialogOpen(true);
    }
  };

  const handleTurnOnLocation = async () => {
    if (isRequestingLocation) return;

    const position = await checkDeviceLocation(true);
    if (position) {
      onLocationSuccess(position);
    }
  };

  const handleNoThanks = () => {
    setIsLocationDialogOpen(false);
    setIsRequestingLocation(false);
    setLocationStatus('cancelled');
    setIsTripActive(false);
    setGpsError(null);
    stopAllTracking();
  };

  const handleEnterDestinationManually = () => {
    handleNoThanks();

    const searchEl =
      document.querySelector('.search-input') ||
      document.querySelector('.destination-card');

    if (searchEl) {
      searchEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof searchEl.focus === 'function') searchEl.focus();
    }
  };

  const handleStopAlarm = () => {
    setIsAlarmActive(false);
    alarmAudio.stopAlarm();
  };

  const handleStopTrip = () => {
    stopAllTracking();
    setIsTripActive(false);
    setIsSimulating(false);
    setLocationStatus('idle');
    setGpsError(null);
    handleStopAlarm();
  };

  const handleSimulateStep = () => {
    if (!destination) return;
    setIsSimulating(true);

    simOffsetRef.current = Math.max(0.005, simOffsetRef.current - 0.02);

    const simLat = destination.lat + simOffsetRef.current;
    const simLng = destination.lng + simOffsetRef.current;

    setCurrentLocation({ lat: simLat, lng: simLng });
    syncLocationWithBackend(simLat, simLng, destination, alertDistance);
  };

  const handleTriggerAlarmDirectly = () => {
    setIsAlarmActive(true);
    alarmAudio.startAlarm();
  };

  const handleResetSimulation = () => {
    simOffsetRef.current = 0.1;
    const simLat = destination.lat + simOffsetRef.current;
    const simLng = destination.lng + simOffsetRef.current;

    setCurrentLocation({ lat: simLat, lng: simLng });
    syncLocationWithBackend(simLat, simLng, destination, alertDistance);
  };

  useEffect(() => {
    return () => {
      stopAllTracking();
      alarmAudio.stopAlarm();
    };
  }, []);

  return (
    <div className="app-container">
      <Header isBackendOnline={isBackendOnline} />

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

      <main className="responsive-layout">
        <section className="layout-col primary-col">
          {!isTripActive ? (
            <>
              <div
                className={`device-location-status-card ${
                  locationStatus === 'granted' && currentLocation
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
                          <span className="loc-status-badge badge-on">
                            🟢 LOCATION IS ON
                          </span>
                          {lastUpdated && (
                            <span className="loc-status-time">
                              Checked {lastUpdated}
                            </span>
                          )}
                        </>
                      ) : locationStatus === 'requesting' ? (
                        <span className="loc-status-badge badge-checking">
                          🔄 CHECKING LOCATION...
                        </span>
                      ) : (
                        <span className="loc-status-badge badge-off">
                          ⚠️ LOCATION NOT DETECTED
                        </span>
                      )}
                    </div>

                    <div className="loc-status-subtext">
                      {locationStatus === 'granted' && currentLocation ? (
                        <span className="loc-coords-text">
                          GPS: {currentLocation.lat.toFixed(4)}°,{' '}
                          {currentLocation.lng.toFixed(4)}° • Ready to track
                        </span>
                      ) : locationStatus === 'requesting' ? (
                        <span>Checking your phone's location...</span>
                      ) : locationStatus === 'denied' ? (
                        <span>
                          Location permission is blocked. Tap Check Location
                          and allow access.
                        </span>
                      ) : (
                        <span>
                          Turn on Location in phone settings and tap Check
                          Location.
                        </span>
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
                alertDistance={alertDistance}
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
                    <span
                      className="pulse-dot"
                      style={{ backgroundColor: '#fff' }}
                    />
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
              style={{
                marginBottom: '0.4rem',
                color: 'var(--accent-blue)',
              }}
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
            </ul>
          </div>
        </section>
      </main>

      <AlarmModal
        isOpen={isAlarmActive}
        distance={remainingDistance}
        alertDistance={alertDistance}
        destinationName={destination?.name}
        onStopAlarm={handleStopAlarm}
      />

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
        <p>Keep the app open and device volume on during your journey.</p>
      </footer>
    </div>
  );
}
