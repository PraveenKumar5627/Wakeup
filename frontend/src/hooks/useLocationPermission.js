/**
 * useLocationPermission — Custom React hook
 *
 * Manages the entire Capacitor / browser location-permission lifecycle:
 *   1. On mount: silently checks permission status and location-services state.
 *   2. Exposes `requestPermission()` so callers can trigger the native dialog
 *      in response to a deliberate user action (required by Android).
 *   3. Exposes `getCurrentLocation()` to fetch a single GPS fix after permission
 *      is confirmed.
 *   4. Exposes `startWatch()` / `stopWatch()` for continuous trip tracking.
 *   5. Handles returning from Android Settings via the Page-Visibility API.
 *
 * Permission states  (locationPermStatus):
 *   'idle'               - not yet checked
 *   'checking'           - running a permission / services check
 *   'prompt'             - permission not yet asked; safe to request via user gesture
 *   'granted'            - permission confirmed and a location fix is available
 *   'denied'             - denied once; can still ask again via requestPermission()
 *   'denied_permanently' - permanently denied; must open Settings
 *   'services_off'       - device Location toggle is off
 *   'unavailable'        - geolocation API entirely absent
 *   'error'              - unexpected error
 *
 * Location fix states (locationFixStatus):
 *   'idle'     - no fix attempted
 *   'fetching' - getCurrentPosition in progress
 *   'ok'       - valid fix received
 *   'timeout'  - fix took too long
 *   'error'    - GPS / network error
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max age (ms) of a cached fix before we consider it stale. */
const FIX_STALE_MS = 90000; // 90 s

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

export function useLocationPermission() {
  const isNative = Capacitor.isNativePlatform();

  const [locationPermStatus, setLocationPermStatus] = useState('idle');
  const [locationFixStatus, setLocationFixStatus]   = useState('idle');
  const [currentLocation, setCurrentLocation]       = useState(null);
  const [lastUpdated, setLastUpdated]               = useState('');
  const [locationError, setLocationError]           = useState(null);

  const watchIdRef          = useRef(null);
  const lastFixTimestampRef = useRef(0);
  const lastFixCoordsRef    = useRef(null);
  const isFetchingRef       = useRef(false);

  // ---- helpers ----

  const buildErrorMsg = useCallback((error, native) => {
    if (!error) return 'Unable to access location.';
    if (native) {
      const msg = (error?.message || '').toLowerCase();
      if (msg.includes('denied') || msg.includes('permission'))
        return 'Location permission is blocked. Tap "Retry Location" and grant access.';
      if (msg.includes('position unavailable') || msg.includes('timeout'))
        return 'Could not get a GPS fix. Move to an open area and try again.';
      return error.message || 'Location error.';
    }
    switch (error?.code) {
      case 1:
        return 'Location permission denied. Allow Location in browser Site Settings.';
      case 2:
        return 'Could not determine your location. Turn on Location in device settings.';
      case 3:
        return 'Location request timed out. Ensure GPS is on and try again.';
      default:
        return error?.message || 'Unable to access location.';
    }
  }, []);

  const isMeaningfulFix = useCallback((lat, lng) => {
    const prev = lastFixCoordsRef.current;
    if (!prev) return true;
    return haversineMetres(prev.lat, prev.lng, lat, lng) >= MIN_DISPLACEMENT_M;
  }, []);

  // ---- check permission (no dialog) ----

  const checkPermissionStatus = useCallback(async () => {
    setLocationPermStatus('checking');
    setLocationError(null);

    try {
      if (isNative) {
        const result = await Geolocation.checkPermissions();
        const state  = result?.location ?? result?.coarseLocation ?? 'prompt';

        if (state === 'granted') {
          setLocationPermStatus('granted');
          return 'granted';
        } else if (state === 'denied') {
          setLocationPermStatus('denied');
          setLocationError(
            'Location permission denied. Tap "Retry Location" or go to Settings > Apps > Arrivo > Permissions > Location.'
          );
          return 'denied';
        } else {
          setLocationPermStatus('prompt');
          return 'prompt';
        }
      } else {
        if (!navigator?.geolocation) {
          setLocationPermStatus('unavailable');
          setLocationError('Geolocation is not supported by this browser.');
          return 'unavailable';
        }

        if (navigator.permissions?.query) {
          const perm = await navigator.permissions.query({ name: 'geolocation' });
          if (perm.state === 'granted') {
            setLocationPermStatus('granted');
            return 'granted';
          } else if (perm.state === 'denied') {
            setLocationPermStatus('denied_permanently');
            setLocationError(
              'Location is blocked. Click the lock icon in your browser address bar and Allow Location.'
            );
            return 'denied_permanently';
          } else {
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
      setLocationError(err?.message || 'Unexpected error checking location permission.');
      return 'error';
    }
  }, [isNative]);

  // ---- request permission (must be called from user gesture) ----

  const requestPermission = useCallback(async () => {
    setLocationPermStatus('checking');
    setLocationError(null);

    try {
      if (isNative) {
        const result = await Geolocation.requestPermissions({ permissions: ['location'] });
        const state  = result?.location ?? result?.coarseLocation ?? 'denied';

        if (state === 'granted') {
          setLocationPermStatus('granted');
          return 'granted';
        } else {
          setLocationPermStatus('denied');
          setLocationError(
            'Permission denied. Go to Settings > Apps > Arrivo > Permissions > Location > Allow.'
          );
          return 'denied';
        }
      } else {
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude: lat, longitude: lng } = position.coords;
              const ts = Date.now();
              lastFixTimestampRef.current = ts;
              lastFixCoordsRef.current    = { lat, lng };
              setCurrentLocation({ lat, lng });
              setLastUpdated(new Date(ts).toLocaleTimeString());
              setLocationPermStatus('granted');
              setLocationFixStatus('ok');
              setLocationError(null);
              resolve('granted');
            },
            (error) => {
              const msg = buildErrorMsg(error, false);
              setLocationPermStatus(error?.code === 1 ? 'denied_permanently' : 'denied');
              setLocationError(msg);
              resolve('denied');
            },
            { enableHighAccuracy: false, timeout: 12000, maximumAge: 30000 }
          );
        });
      }
    } catch (err) {
      console.warn('[useLocationPermission] requestPermission error:', err);
      setLocationPermStatus('error');
      setLocationError(err?.message || 'Unexpected error requesting permission.');
      return 'error';
    }
  }, [isNative, buildErrorMsg]);

  // ---- get single current position fix ----

  const getCurrentLocation = useCallback(async (opts) => {
    const force = opts && opts.force;

    if (isFetchingRef.current) return null;

    const age = Date.now() - lastFixTimestampRef.current;
    if (!force && lastFixCoordsRef.current && age < FIX_STALE_MS) {
      return { lat: lastFixCoordsRef.current.lat, lng: lastFixCoordsRef.current.lng };
    }

    isFetchingRef.current = true;
    setLocationFixStatus('fetching');
    setLocationError(null);

    try {
      let position;

      if (isNative) {
        position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000,
        });
      } else {
        position = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 30000,
          })
        );
      }

      const { latitude: lat, longitude: lng } = position.coords;
      const ts = Date.now();

      lastFixTimestampRef.current = ts;
      lastFixCoordsRef.current    = { lat, lng };

      setCurrentLocation({ lat, lng });
      setLastUpdated(new Date(ts).toLocaleTimeString());
      setLocationFixStatus('ok');
      setLocationPermStatus('granted');
      setLocationError(null);

      return { lat, lng };
    } catch (err) {
      console.warn('[useLocationPermission] getCurrentLocation error:', err);
      const msg = buildErrorMsg(err, isNative);
      if (!isNative && err?.code === 1) setLocationPermStatus('denied_permanently');
      setLocationFixStatus('error');
      setLocationError(msg);
      return null;
    } finally {
      isFetchingRef.current = false;
    }
  }, [isNative, buildErrorMsg]);

  // ---- start continuous watch ----

  const startWatch = useCallback((onLocationUpdate, onWatchError) => {
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
      lastFixCoordsRef.current    = { lat, lng };

      setCurrentLocation({ lat, lng });
      setLastUpdated(new Date(ts).toLocaleTimeString());
      setLocationFixStatus('ok');
      setLocationError(null);

      onLocationUpdate && onLocationUpdate({ lat, lng });
    };

    const handleError = (error) => {
      const msg = buildErrorMsg(error, isNative);
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

  // Silent check on mount
  useEffect(() => {
    checkPermissionStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Recheck when returning from Android Settings
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkPermissionStatus().then((status) => {
          if (status === 'granted' && !lastFixCoordsRef.current) {
            getCurrentLocation();
          }
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [checkPermissionStatus, getCurrentLocation]);

  // Auto-fetch fix once permission confirmed (first time only)
  useEffect(() => {
    if (locationPermStatus === 'granted' && !lastFixCoordsRef.current) {
      getCurrentLocation();
    }
  }, [locationPermStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup watcher on unmount
  useEffect(() => {
    return () => stopWatch();
  }, [stopWatch]);

  // ---- derived values ----

  const hasValidLocation =
    !!currentLocation &&
    Date.now() - lastFixTimestampRef.current < FIX_STALE_MS;

  const needsPermission = ['prompt', 'denied', 'idle'].includes(locationPermStatus);
  const isPermanentlyDenied = locationPermStatus === 'denied_permanently';
  const isServicesOff = locationPermStatus === 'services_off';
  const isFetchingLocation = locationFixStatus === 'fetching' || locationPermStatus === 'checking';

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
    isFetchingLocation,
    isNative,
    checkPermissionStatus,
    requestPermission,
    getCurrentLocation,
    startWatch,
    stopWatch,
    lastFixTimestampRef,
  };
}
