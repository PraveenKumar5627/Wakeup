/**
 * useLocationPermission — Custom React hook
 *
 * Manages the browser & Capacitor location-permission lifecycle cleanly:
 *   1. On mount: silently checks permission status via Permissions API without
 *      triggering any popup or prompt.
 *   2. When user clicks "Start Trip" (or "Enable Location"): invokes
 *      `requestPermission()`, which calls `navigator.geolocation.getCurrentPosition()`
 *      on web to trigger the browser's native location permission dialog.
 *   3. Exposes real device latitude and longitude (never fake or hardcoded).
 *   4. Accurately identifies all states:
 *      - loading / requesting / checking
 *      - success (granted + valid fix)
 *      - permission-denied (denied / denied_permanently)
 *      - location-disabled (services_off - device GPS toggle is OFF)
 *      - timeout (timed out waiting for satellite fix)
 *      - location-unavailable (unsupported browser or insecure HTTP)
 *   5. Continuous movement tracking via `startWatch()` (`navigator.geolocation.watchPosition`).
 *   6. Clean tracking teardown via `stopWatch()` (`navigator.geolocation.clearWatch`).
 *   7. Re-checks permission status on tab visibility change or Permissions API change.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

const LocationEnabler = registerPlugin('LocationEnabler');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max age (ms) of a cached fix before we consider it stale (15s for live navigation accuracy). */
const FIX_STALE_MS = 15000;

/** Minimum distance (metres) between updates to suppress GPS jitter. */
const MIN_DISPLACEMENT_M = 15;

/** Haversine distance in metres between two lat/lng pairs. */
function haversineMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

// Clean up any stale or inaccurate cached coordinates from earlier versions
try {
  localStorage.removeItem('wakeup_last_known_location');
} catch (_) {}

export function useLocationPermission() {
  const isNative = Capacitor.isNativePlatform();

  // Perm status: 'idle' | 'checking' | 'requesting' | 'prompt' | 'granted' | 'denied' | 'denied_permanently' | 'services_off' | 'timeout' | 'unavailable' | 'error'
  const [locationPermStatus, setLocationPermStatus] = useState('idle');

  // Fix status: 'idle' | 'fetching' | 'ok' | 'denied' | 'services_off' | 'timeout' | 'unavailable' | 'error'
  const [locationFixStatus, setLocationFixStatus] = useState('idle');

  const [currentLocation, setCurrentLocation] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [locationError, setLocationError] = useState(null);

  const watchIdRef = useRef(null);
  const lastFixTimestampRef = useRef(0);
  const lastFixCoordsRef = useRef(null);
  const isFetchingRef = useRef(false);
  const activeFetchPromiseRef = useRef(null);
  const hasCheckedInitialRef = useRef(false);

  // ---- helpers ----

  const buildErrorMsg = useCallback((error, native) => {
    if (!error) return 'Unable to access location.';
    const msg = (error?.message || '').toLowerCase();

    // Permission denied
    if (msg.includes('denied') || msg.includes('permission') || error?.code === 1) {
      if (native) {
        return 'Location permission is blocked. Open Settings > Apps > Permissions > Location and select "Allow".';
      }
      return 'Location permission denied. Please allow location access in your browser site settings.';
    }

    // Location services / GPS turned off
    if (
      msg.includes('disabled') ||
      msg.includes('services') ||
      msg.includes('provider') ||
      msg.includes('position unavailable') ||
      error?.code === 2
    ) {
      return 'Device Location is turned off. Swipe down Quick Settings on your phone and turn ON Location.';
    }

    // Timeout
    if (msg.includes('timeout') || error?.code === 3) {
      return 'Location request timed out. Please ensure GPS is on and you have a clear view of the sky, then retry.';
    }

    return error.message || 'Unable to access device location.';
  }, []);

  const isMeaningfulFix = useCallback((lat, lng) => {
    const prev = lastFixCoordsRef.current;
    if (!prev) return true;
    return haversineMetres(prev.lat, prev.lng, lat, lng) >= MIN_DISPLACEMENT_M;
  }, []);

  /** Returns true if geolocation can potentially work (HTTPS or localhost). */
  const isSecureContextAvailable = useCallback(() => {
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      return false;
    }
    return true;
  }, []);

  // ---- check permission silently (no dialog, no prompt) ----

  const checkPermissionStatus = useCallback(async () => {
    setLocationPermStatus('checking');
    setLocationError(null);

    try {
      if (!isSecureContextAvailable()) {
        setLocationPermStatus('unavailable');
        setLocationFixStatus('unavailable');
        setLocationError(
          'Geolocation requires a secure connection (HTTPS). This site is not served over HTTPS.'
        );
        return 'unavailable';
      }

      if (isNative) {
        let isGpsOn = true;
        if (LocationEnabler) {
          try {
            const locCheck = await LocationEnabler.isLocationEnabled();
            isGpsOn = locCheck?.enabled ?? false;
          } catch (e) {
            console.warn('[useLocationPermission] isLocationEnabled error:', e);
          }
        }

        const result = await Geolocation.checkPermissions();
        const state = result?.location ?? result?.coarseLocation ?? 'prompt';

        if (!isGpsOn) {
          setLocationPermStatus('services_off');
          setLocationFixStatus('services_off');
          setLocationError('Device Location is turned off. Please turn ON Location.');
          return 'services_off';
        }

        if (state === 'granted') {
          setLocationPermStatus('granted');
          return 'granted';
        } else if (state === 'denied') {
          setLocationPermStatus('denied_permanently');
          setLocationFixStatus('denied');
          setLocationError(
            'Location permission denied. Go to Settings > Apps > Permissions > Location > Allow.'
          );
          return 'denied_permanently';
        } else {
          setLocationPermStatus('prompt');
          return 'prompt';
        }
      } else {
        // Web browser path
        if (!navigator?.geolocation) {
          setLocationPermStatus('unavailable');
          setLocationFixStatus('unavailable');
          setLocationError('Geolocation is not supported by this browser.');
          return 'unavailable';
        }

        if (navigator.permissions?.query) {
          try {
            const perm = await navigator.permissions.query({ name: 'geolocation' });
            if (perm.state === 'granted') {
              setLocationPermStatus('granted');
              return 'granted';
            } else if (perm.state === 'denied') {
              setLocationPermStatus('denied_permanently');
              setLocationFixStatus('denied');
              setLocationError(
                'Location access is blocked. Tap the 🔒 lock icon in your browser address bar and Allow Location.'
              );
              return 'denied_permanently';
            } else {
              setLocationPermStatus('prompt');
              return 'prompt';
            }
          } catch {
            // Permissions API query not supported for geolocation
            setLocationPermStatus('prompt');
            return 'prompt';
          }
        }

        setLocationPermStatus('prompt');
        return 'prompt';
      }
    } catch (err) {
      console.warn('[useLocationPermission] checkPermissionStatus error:', err);
      setLocationPermStatus('error');
      setLocationFixStatus('error');
      setLocationError(err?.message || 'Unexpected error checking location permission.');
      return 'error';
    }
  }, [isNative, isSecureContextAvailable]);

/**
 * Authentic Device GPS Acquisition:
 * Direct request to hardware GPS / Google Play Services Fused Location
 * with High Accuracy enabled and fresh live position (maximumAge: 0).
 * Never uses approximate IP geolocation.
 */
function fetchRealGpsPosition(isNative) {
  if (isNative) {
    return new Promise((resolve, reject) => {
      // 1. Live high-accuracy GPS fix from device sensors
      Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      })
        .then((pos) => {
          if (pos?.coords) {
            resolve(pos);
          } else {
            reject(new Error('GPS signal not found'));
          }
        })
        .catch((err) => {
          // If first GPS attempt times out, retry once with a 5s fresh cache window
          Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 5000,
          })
            .then((retryPos) => {
              if (retryPos?.coords) resolve(retryPos);
              else reject(err || new Error('GPS fix unavailable'));
            })
            .catch(() => reject(err || new Error('GPS fix unavailable')));
        });
    });
  }

  // Web Browser: use native HTML5 Geolocation with high accuracy GPS
  return new Promise((resolve, reject) => {
    if (!navigator?.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      (err) => {
        // Retry with 5s max age if immediate cold fix timed out
        navigator.geolocation.getCurrentPosition(
          (retryPos) => resolve(retryPos),
          (retryErr) => reject(retryErr || err),
          {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 5000,
          }
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  });
}

  // ---- get single current position fix ----

  const getCurrentLocation = useCallback(async (opts) => {
    const force = opts && opts.force;
    const enableServices = opts && opts.enableServices;

    // Check if an active request is already resolving — share the in-flight promise!
    if (isFetchingRef.current && activeFetchPromiseRef.current) {
      return activeFetchPromiseRef.current;
    }

    const age = Date.now() - lastFixTimestampRef.current;
    if (!force && lastFixCoordsRef.current && age < FIX_STALE_MS) {
      return { lat: lastFixCoordsRef.current.lat, lng: lastFixCoordsRef.current.lng };
    }

    isFetchingRef.current = true;
    setLocationFixStatus('fetching');
    setLocationError(null);

    const promise = (async () => {
      try {
        if (isNative) {
          // Trigger Google Play Services resolution dialog if device location is turned off
          if (LocationEnabler) {
            try {
              const locCheck = await LocationEnabler.isLocationEnabled();
              if (!locCheck?.enabled) {
                await LocationEnabler.enableLocation();
              }
            } catch (e) {
              console.warn('[useLocationPermission] LocationEnabler notice:', e);
            }
          }

          // Request permissions if in prompt state
          try {
            const perm = await Geolocation.checkPermissions();
            const state = perm?.location ?? perm?.coarseLocation ?? 'prompt';
            if (state === 'prompt' || enableServices) {
              const reqResult = await Geolocation.requestPermissions({ permissions: ['location'] });
              if (reqResult?.location !== 'granted' && reqResult?.coarseLocation !== 'granted') {
                throw new Error('Location permission denied');
              }
            }
          } catch (e) {
            console.warn('[useLocationPermission] checkPermissions notice:', e);
          }
        }

        const position = await fetchRealGpsPosition(isNative);

        const { latitude: lat, longitude: lng, accuracy } = position.coords;
        const ts = Date.now();

        lastFixTimestampRef.current = ts;
        lastFixCoordsRef.current = { lat, lng, accuracy };

        setCurrentLocation({ lat, lng, accuracy });
        setLastUpdated(new Date(ts).toLocaleTimeString());
        setLocationFixStatus('ok');
        setLocationPermStatus('granted');
        setLocationError(null);

        return { lat, lng, accuracy };
      } catch (err) {
        console.warn('[useLocationPermission] getCurrentLocation error:', err);
        const msg = buildErrorMsg(err, isNative);
        const rawMsg = (err?.message || '').toLowerCase();

        if (err?.code === 1 || rawMsg.includes('denied') || rawMsg.includes('permission')) {
          setLocationPermStatus('denied_permanently');
          setLocationFixStatus('denied');
        } else if (
          err?.code === 2 ||
          rawMsg.includes('location services are not enabled') ||
          rawMsg.includes('disabled') ||
          rawMsg.includes('services') ||
          rawMsg.includes('provider')
        ) {
          setLocationPermStatus('services_off');
          setLocationFixStatus('services_off');
        } else if (err?.code === 3 || rawMsg.includes('timeout')) {
          setLocationPermStatus('timeout');
          setLocationFixStatus('timeout');
        } else {
          setLocationFixStatus('error');
        }

        setLocationError(msg);
        return null;
      } finally {
        isFetchingRef.current = false;
        activeFetchPromiseRef.current = null;
      }
    })();

    activeFetchPromiseRef.current = promise;
    return promise;
  }, [isNative, buildErrorMsg]);

  // ---- request permission (triggered when user clicks "Start Trip" or "Enable Location") ----

  const requestPermission = useCallback(async () => {
    setLocationPermStatus('requesting');
    return await getCurrentLocation({ force: true, enableServices: true });
  }, [getCurrentLocation]);

  // ---- start continuous watch ----

  const startWatch = useCallback((onLocationUpdate, onWatchError) => {
    // Clear any existing watcher first
    if (watchIdRef.current !== null) {
      if (isNative) {
        Geolocation.clearWatch({ id: watchIdRef.current }).catch(() => {});
      } else if (navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = null;
    }

    const handleSuccess = (position) => {
      if (!position?.coords) return;
      const { latitude: lat, longitude: lng } = position.coords;
      if (!isMeaningfulFix(lat, lng)) return;

      const ts = Date.now();
      lastFixTimestampRef.current = ts;
      lastFixCoordsRef.current = { lat, lng };
      persistLocation(lat, lng);

      setCurrentLocation({ lat, lng });
      setLastUpdated(new Date(ts).toLocaleTimeString());
      setLocationFixStatus('ok');
      setLocationPermStatus('granted');
      setLocationError(null);

      onLocationUpdate && onLocationUpdate({ lat, lng });
    };

    const handleError = (error) => {
      const msg = buildErrorMsg(error, isNative);
      const rawMsg = (error?.message || '').toLowerCase();

      if (error?.code === 1 || rawMsg.includes('denied') || rawMsg.includes('permission')) {
        setLocationPermStatus('denied_permanently');
        setLocationFixStatus('denied');
      } else if (
        error?.code === 2 ||
        rawMsg.includes('location services are not enabled') ||
        rawMsg.includes('disabled') ||
        rawMsg.includes('services') ||
        rawMsg.includes('provider')
      ) {
        setLocationPermStatus('services_off');
        setLocationFixStatus('services_off');
      } else if (error?.code === 3 || rawMsg.includes('timeout')) {
        setLocationPermStatus('timeout');
        setLocationFixStatus('timeout');
      }
      setLocationError(msg);
      onWatchError && onWatchError(msg);
    };

    if (isNative) {
      Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 },
        (pos, err) => {
          if (err) handleError(err);
          else handleSuccess(pos);
        }
      ).then((id) => {
        watchIdRef.current = id;
      }).catch((err) => {
        setLocationError(err?.message || 'Could not start GPS tracking.');
      });
    } else if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
      );
    } else {
      setLocationError('Geolocation is not supported by this browser.');
    }
  }, [isNative, isMeaningfulFix, buildErrorMsg]);

  // ---- stop continuous watch ----

  const stopWatch = useCallback(() => {
    const id = watchIdRef.current;
    if (id === null) return;
    watchIdRef.current = null;

    if (isNative) {
      Geolocation.clearWatch({ id }).catch(() => {});
    } else if (navigator.geolocation) {
      navigator.geolocation.clearWatch(id);
    }
  }, [isNative]);

  // ---- lifecycle effects ----

  // EFFECT 1: Silent permission check on mount
  // Does NOT request location if status is 'prompt' — waits until user clicks Start Trip.
  // If permission was already granted previously, fetches real location silently.
  useEffect(() => {
    if (hasCheckedInitialRef.current) return;
    hasCheckedInitialRef.current = true;

    let cancelled = false;

    const init = async () => {
      const status = await checkPermissionStatus();
      if (cancelled) return;

      if (status === 'granted') {
        // Permission was already granted in a previous visit — silently fetch fix
        getCurrentLocation();
      }
      // If status is 'prompt' or other, do NOT trigger any prompt or popup.
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [checkPermissionStatus, getCurrentLocation]);

  // EFFECT 2: Listen for permission state changes via the Permissions API
  useEffect(() => {
    if (isNative) return;
    if (!navigator?.permissions?.query) return;

    let permStatus = null;

    const setupListener = async () => {
      try {
        permStatus = await navigator.permissions.query({ name: 'geolocation' });

        const handleChange = () => {
          if (permStatus.state === 'granted') {
            setLocationPermStatus('granted');
            setLocationError(null);
            if (!lastFixCoordsRef.current) {
              getCurrentLocation();
            }
          } else if (permStatus.state === 'denied') {
            setLocationPermStatus('denied_permanently');
            setLocationFixStatus('denied');
            setLocationError(
              'Location access is blocked. Click the lock icon in your browser address bar and Allow Location.'
            );
          } else {
            setLocationPermStatus('prompt');
          }
        };

        permStatus.addEventListener('change', handleChange);
      } catch {
        // Permissions API not available for geolocation
      }
    };

    setupListener();

    return () => {
      if (permStatus) {
        try {
          permStatus.removeEventListener('change', () => {});
        } catch {}
      }
    };
  }, [isNative, getCurrentLocation]);

  // EFFECT 3: Recheck when returning from Android Settings / browser tab refocus
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkPermissionStatus().then((status) => {
          if (status === 'granted') {
            const age = Date.now() - lastFixTimestampRef.current;
            if (!lastFixCoordsRef.current || age > FIX_STALE_MS) {
              getCurrentLocation({ force: true });
            }
          }
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [checkPermissionStatus, getCurrentLocation]);

  // EFFECT 4: Cleanup watcher on unmount
  useEffect(() => {
    return () => stopWatch();
  }, [stopWatch]);

  // ---- derived values ----

  const hasValidLocation =
    !!currentLocation &&
    Date.now() - lastFixTimestampRef.current < FIX_STALE_MS;

  const needsPermission = ['prompt', 'denied', 'idle'].includes(locationPermStatus);
  const isPermanentlyDenied = locationPermStatus === 'denied_permanently' || locationFixStatus === 'denied';
  const isServicesOff = locationPermStatus === 'services_off' || locationFixStatus === 'services_off';
  const isTimeout = locationPermStatus === 'timeout' || locationFixStatus === 'timeout';
  const isUnavailable = locationPermStatus === 'unavailable' || locationFixStatus === 'unavailable';
  const isFetchingLocation =
    locationFixStatus === 'fetching' ||
    locationPermStatus === 'checking' ||
    locationPermStatus === 'requesting';

  const enableDeviceLocation = useCallback(async () => {
    if (isNative && LocationEnabler) {
      try {
        const res = await LocationEnabler.enableLocation();
        return res?.enabled ?? false;
      } catch (e) {
        console.warn('[useLocationPermission] enableDeviceLocation error:', e);
        return false;
      }
    }
    return true;
  }, [isNative]);

  const openLocationSettings = useCallback(async () => {
    if (isNative && LocationEnabler) {
      try {
        await LocationEnabler.openLocationSettings();
      } catch (e) {
        console.warn('[useLocationPermission] openLocationSettings error:', e);
      }
    }
  }, [isNative]);

  return {
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
    enableDeviceLocation,
    openLocationSettings,
    startWatch,
    stopWatch,
    lastFixTimestampRef,
  };
}
