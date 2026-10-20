/**
 * App.jsx — TravelAlarm / Arrivo
 * Complete End-to-End Implementation matching Reference UI
 * 
 * Features:
 * - 10 Screens: Splash & Onboarding, Home Dashboard, Select Destination,
 *   Trip Setup, Location Permission, Active Tracking, Alarm Alert,
 *   Trip Summary, Past Trips, Settings.
 * - Live GPS & Capacitor/Web Geolocation with Haversine & OSRM road routing.
 * - Threshold-crossing distance alarm engine with duplicate-trigger suppression.
 * - Web Audio API synthesized siren chimes + mobile vibration loops.
 * - Screen Wake Lock to prevent phone display sleep.
 * - Full offline-first trip persistence + FastAPI backend sync.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import StatusBar from './components/StatusBar';
import BottomNavBar from './components/BottomNavBar';
import SplashScreen from './screens/SplashScreen';
import HomeScreen from './screens/HomeScreen';
import SelectDestinationScreen from './screens/SelectDestinationScreen';
import LocationPermissionScreen from './screens/LocationPermissionScreen';
import ActiveTripScreen from './screens/ActiveTripScreen';
import AlarmAlertScreen from './screens/AlarmAlertScreen';
import TripSummaryScreen from './screens/TripSummaryScreen';
import PastTripsScreen from './screens/PastTripsScreen';
import SettingsScreen from './screens/SettingsScreen';

import { useLocationPermission } from './hooks/useLocationPermission';
import {
  calculateDistance,
  haversineDistanceKm,
  fetchTrips,
  saveTrip,
  deleteTrip,
  checkBackendHealth,
} from './utils/api';
import { alarmAudio } from './utils/audioAlarm';

export default function App() {
  // ── Navigation State ─────────────────────────────────────────────────────
  // 'splash' | 'home' | 'destination' | 'permission' | 'active_trip' | 'alarm' | 'summary' | 'trips' | 'settings'
  const [currentScreen, setCurrentScreen] = useState('splash');
  const [activeTab, setActiveTab] = useState('home');

  // ── User Profile ─────────────────────────────────────────────────────────
  const [userName, setUserName] = useState(
    () => localStorage.getItem('arrivo_user_name') || 'Praveen'
  );

  // ── Destination & Trip Parameters ────────────────────────────────────────
  const [destination, setDestination] = useState({
    name: 'Parikkal',
    city: 'Ulundurpettai, Kallakurichi, Tamil Nadu',
    lat: 11.785145,
    lng: 79.367063,
  });
  const [alertDistanceKm, setAlertDistanceKm] = useState(3.0);

  // ── Active Trip State ────────────────────────────────────────────────────
  const [isTripActive, setIsTripActive] = useState(false);
  const [tripStartTime, setTripStartTime] = useState(null);
  const [initialDistanceKm, setInitialDistanceKm] = useState(5.0);
  const [remainingDistanceKm, setRemainingDistanceKm] = useState(null);
  const [routeDetails, setRouteDetails] = useState({
    routeType: 'road',
    durationText: '~ 20 min',
    durationMin: 20,
    straightLineKm: null,
  });

  // ── Alarm State ──────────────────────────────────────────────────────────
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const alarmFiredRef = useRef(false);
  const snoozeUntilRef = useRef(0);

  // ── Past Trips ───────────────────────────────────────────────────────────
  const [pastTrips, setPastTrips] = useState([]);

  // ── Simulator (for desktop/demonstration testing) ─────────────────────────
  const [isSimulating, setIsSimulating] = useState(false);
  const simOffsetRef = useRef(0.04);
  const simTimerRef = useRef(null);
  const tripStartCoordsRef = useRef(null);

  // ── Screen Wake Lock ─────────────────────────────────────────────────────
  const wakeLockRef = useRef(null);
  const [gpsError, setGpsError] = useState(null);
  const [isBackendOnline, setIsBackendOnline] = useState(false);

  // ── Geolocation Hook ─────────────────────────────────────────────────────
  const {
    locationPermStatus,
    currentLocation,
    hasValidLocation,
    isServicesOff,
    isPermanentlyDenied,
    isFetchingLocation,
    isNative,
    checkPermissionStatus,
    requestPermission,
    getCurrentLocation,
    openLocationSettings,
    startWatch,
    stopWatch,
  } = useLocationPermission();

  // ── Load past trips on startup ───────────────────────────────────────────
  useEffect(() => {
    const loadTrips = async () => {
      const trips = await fetchTrips();
      setPastTrips(trips);
    };
    loadTrips();

    // Check backend health
    checkBackendHealth().then(setIsBackendOnline);

    // Initialize alarm audio tone and load custom song from IndexedDB if saved
    const savedTone = localStorage.getItem('arrivo_setting_tone') || 'transit';
    alarmAudio.setTone(savedTone);
    alarmAudio.loadCustomAudio();
  }, []);

  // ── Screen Wake Lock Management ──────────────────────────────────────────
  useEffect(() => {
    const acquireLock = async () => {
      if (isTripActive && 'wakeLock' in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        } catch (err) {
          console.warn('Wake Lock request notice:', err);
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
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [isTripActive]);

  // ── Core Distance Evaluation & Real Distance Alarm Engine ────────────────
  const evaluateDistance = useCallback(
    async (lat, lng, dest, thresholdKm) => {
      if (lat == null || lng == null || !dest?.lat || !dest?.lng) return;

      try {
        setGpsError(null);

        // Record trip starting location on first valid GPS fix if not already set
        if (!tripStartCoordsRef.current) {
          tripStartCoordsRef.current = { lat, lng };
        }

        // 1. INSTANT LOCAL HAVERSINE (0ms latency!)
        // Immediately show the actual distance with 0ms waiting!
        const straightDist = haversineDistanceKm(lat, lng, dest.lat, dest.lng);
        setRemainingDistanceKm((prev) => (prev === null ? straightDist : prev));

        // 2. FAST ROAD ROUTING (OSRM ~150ms / Backend)
        const result = await calculateDistance({
          currentLat: lat,
          currentLng: lng,
          destLat: dest.lat,
          destLng: dest.lng,
          alertDistance: thresholdKm,
          startLat: tripStartCoordsRef.current?.lat,
          startLng: tripStartCoordsRef.current?.lng,
        });

        const dist = result.distance_km;
        setRemainingDistanceKm(dist);

        // Keep initial journey distance accurate (never smaller than distance to destination at start)
        setInitialDistanceKm((prevInit) => {
          if (!prevInit || prevInit < dist) {
            return dist;
          }
          return prevInit;
        });

        setRouteDetails({
          routeType: result.route_type || 'road',
          durationText: result.duration_text || (result.duration_min ? `${Math.round(result.duration_min)} min` : ''),
          durationMin: result.duration_min || Math.round(dist * 2.2),
          straightLineKm: result.straight_line_km || straightDist,
        });

        // Detect threshold crossing:
        // When remaining distance <= selected threshold, trigger alarm ONCE.
        const isWithinThreshold = dist <= thresholdKm;
        const isSnoozed = Date.now() < snoozeUntilRef.current;

        if (isWithinThreshold && !isSnoozed && !alarmFiredRef.current) {
          alarmFiredRef.current = true;
          setIsAlarmActive(true);
          alarmAudio.startAlarm();
          setCurrentScreen('alarm');
        }
      } catch (err) {
        console.warn('Distance evaluation notice:', err);
      }
    },
    []
  );

  // ── Start Trip Action ────────────────────────────────────────────────────
  const handleStartTrip = async (dest, distKm) => {
    setDestination(dest);
    setAlertDistanceKm(distKm);

    // Check location permission
    if (locationPermStatus !== 'granted') {
      setCurrentScreen('permission');
      return;
    }

    // Permission is granted: proceed to launch active trip immediately
    await initiateActiveTracking(dest, distKm, currentLocation);
  };

  const initiateActiveTracking = async (dest, distKm, initialLoc = null) => {
    alarmFiredRef.current = false;
    snoozeUntilRef.current = 0;
    setIsTripActive(true);
    setTripStartTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

    // Instant location resolution without blocking
    const loc = initialLoc || currentLocation;
    if (loc?.lat && loc?.lng) {
      tripStartCoordsRef.current = { lat: loc.lat, lng: loc.lng };
    } else {
      tripStartCoordsRef.current = null;
    }
    const startLat = loc?.lat || dest.lat - 0.045;
    const startLng = loc?.lng || dest.lng - 0.045;

    // Instant local Haversine distance so screen transitions with 0ms delay!
    const instantKm = haversineDistanceKm(startLat, startLng, dest.lat, dest.lng);
    setRemainingDistanceKm(instantKm);
    setInitialDistanceKm(instantKm);

    // Transition to Active Trip screen IMMEDIATELY — ZERO delay!
    setCurrentScreen('active_trip');
    setActiveTab('map');

    // Run road driving calculation in background asynchronously without blocking UI
    evaluateDistance(startLat, startLng, dest, distKm).catch(() => {});

    // If exact location wasn't available yet, request high-accuracy position immediately!
    if (!loc) {
      getCurrentLocation({ force: true })
        .then((freshLoc) => {
          if (freshLoc) {
            evaluateDistance(freshLoc.lat, freshLoc.lng, dest, distKm);
          }
        })
        .catch(() => {});
    }

    // Start continuous live GPS watch
    startWatch(
      ({ lat, lng }) => {
        setGpsError(null);
        evaluateDistance(lat, lng, dest, distKm);
      },
      (msg) => {
        setGpsError(msg);
      }
    );
  };

  // ── Location Permission Screen Actions ───────────────────────────────────
  const handleAllowLocation = async () => {
    try {
      // Allow user reasonable time (up to 4.5s) to tap Allow on the OS dialog
      const loc = await Promise.race([
        requestPermission(),
        new Promise((resolve) => setTimeout(() => resolve(null), 4500)),
      ]);

      await initiateActiveTracking(destination, alertDistanceKm, loc);
    } catch (err) {
      console.warn('Location request fallback:', err);
      await initiateActiveTracking(destination, alertDistanceKm, null);
    }
  };

  const handleNotNowLocation = async () => {
    // Advance to active tracking with departure location
    await initiateActiveTracking(destination, alertDistanceKm, null);
  };

  // ── Alarm Screen Actions ─────────────────────────────────────────────────
  const handleSnooze = () => {
    alarmAudio.stopAlarm();
    setIsAlarmActive(false);
    // Snooze for 5 minutes (or configured snooze)
    const snoozeMins = Number(localStorage.getItem('arrivo_setting_snooze')) || 5;
    snoozeUntilRef.current = Date.now() + snoozeMins * 60 * 1000;
    alarmFiredRef.current = false;
    setCurrentScreen('active_trip');
  };

  const handleStopAlarm = () => {
    alarmAudio.stopAlarm();
    setIsAlarmActive(false);
    // Move to Trip Summary ("Trip Ongoing")
    setCurrentScreen('summary');
  };

  // ── Stop / End Trip & Save to History ────────────────────────────────────
  const handleStopTrip = async () => {
    stopWatch();
    alarmAudio.stopAlarm();
    setIsTripActive(false);
    setIsAlarmActive(false);
    setIsSimulating(false);
    if (simTimerRef.current) clearInterval(simTimerRef.current);
    tripStartCoordsRef.current = null;

    // Save trip to history
    const completedTrip = {
      id: `trip-${Date.now()}`,
      destination_name: destination.name,
      destination_city: destination.city || 'Tamil Nadu',
      destination_latitude: destination.lat,
      destination_longitude: destination.lng,
      alert_distance_km: alertDistanceKm,
      distance_at_start_km: initialDistanceKm || 5.0,
      status: 'completed',
      start_time: tripStartTime || 'Today, 10:00 AM',
      end_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      duration_text: routeDetails?.durationText || '~ 20 min',
      alarm_triggered: alarmFiredRef.current,
      created_at: `Today, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    };

    await saveTrip(completedTrip);
    const updated = await fetchTrips();
    setPastTrips(updated);

    setCurrentScreen('home');
    setActiveTab('home');
  };

  const handleSetAnotherDestination = () => {
    stopWatch();
    alarmAudio.stopAlarm();
    setIsTripActive(false);
    setIsAlarmActive(false);
    tripStartCoordsRef.current = null;
    setCurrentScreen('destination');
    setActiveTab('map');
  };

  // ── Simulator Mode (Desktop Demo) ────────────────────────────────────────
  const handleToggleSimulate = () => {
    if (isSimulating) {
      setIsSimulating(false);
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    } else {
      setIsSimulating(true);
      simOffsetRef.current = 0.035;

      simTimerRef.current = setInterval(() => {
        simOffsetRef.current = Math.max(0.002, simOffsetRef.current - 0.006);
        const simLat = destination.lat + simOffsetRef.current;
        const simLng = destination.lng + simOffsetRef.current;
        evaluateDistance(simLat, simLng, destination, alertDistanceKm);

        if (simOffsetRef.current <= 0.005) {
          clearInterval(simTimerRef.current);
          setIsSimulating(false);
        }
      }, 1500);
    }
  };

  // ── Tab Navigation ───────────────────────────────────────────────────────
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'home') {
      setCurrentScreen('home');
    } else if (tabId === 'trips') {
      setCurrentScreen('trips');
    } else if (tabId === 'map') {
      if (isTripActive) {
        setCurrentScreen('active_trip');
      } else {
        setCurrentScreen('destination');
      }
    } else if (tabId === 'settings') {
      setCurrentScreen('settings');
    }
  };

  // ── Delete Past Trip ─────────────────────────────────────────────────────
  const handleDeleteTrip = async (id) => {
    await deleteTrip(id);
    const updated = await fetchTrips();
    setPastTrips(updated);
  };

  // ── Select Past Trip to re-run ───────────────────────────────────────────
  const handleSelectRecentTrip = (trip) => {
    if (!currentLocation) {
      getCurrentLocation().catch(() => {});
    }
    setDestination({
      name: trip.destination_name,
      city: trip.destination_city || 'Tamil Nadu',
      lat: trip.destination_latitude || 11.0168,
      lng: trip.destination_longitude || 76.9558,
    });
    setAlertDistanceKm(trip.alert_distance_km || 3.0);
    setCurrentScreen('destination');
    setActiveTab('map');
  };

  // ── Render Active Screen ─────────────────────────────────────────────────
  const renderScreen = () => {
    switch (currentScreen) {
      case 'splash':
        return <SplashScreen onFinish={() => setCurrentScreen('home')} />;

      case 'home':
        return (
          <HomeScreen
            userName={userName}
            recentTrips={pastTrips}
            onSetDestination={() => {
              if (!currentLocation) {
                getCurrentLocation().catch(() => {});
              }
              setCurrentScreen('destination');
              setActiveTab('map');
            }}
            onSelectRecentTrip={handleSelectRecentTrip}
            onViewAllTrips={() => {
              setCurrentScreen('trips');
              setActiveTab('trips');
            }}
            onOpenSettings={() => {
              setCurrentScreen('settings');
              setActiveTab('settings');
            }}
            onTabChange={handleTabChange}
            isTripActive={isTripActive}
            activeDestination={destination}
            remainingDistance={remainingDistanceKm}
            onResumeTrip={() => setCurrentScreen('active_trip')}
          />
        );

      case 'destination':
        return (
          <SelectDestinationScreen
            initialDestination={destination}
            initialAlertDistanceKm={alertDistanceKm}
            currentLocation={currentLocation}
            isFetchingLocation={isFetchingLocation}
            locationPermStatus={locationPermStatus}
            onGetLocation={getCurrentLocation}
            onRequestPermission={requestPermission}
            onBack={() => setCurrentScreen('home')}
            onStartTrip={handleStartTrip}
          />
        );

      case 'permission':
        return (
          <LocationPermissionScreen
            permissionStatus={locationPermStatus}
            isServicesOff={isServicesOff}
            isPermanentlyDenied={isPermanentlyDenied}
            onAllowLocation={handleAllowLocation}
            onNotNow={handleNotNowLocation}
            onOpenSettings={openLocationSettings}
          />
        );

      case 'active_trip':
        return (
          <ActiveTripScreen
            destination={destination}
            alertDistanceKm={alertDistanceKm}
            currentLocation={currentLocation}
            remainingDistanceKm={remainingDistanceKm}
            initialDistanceKm={initialDistanceKm}
            routeDetails={routeDetails}
            gpsError={gpsError}
            isSimulating={isSimulating}
            onToggleSimulate={handleToggleSimulate}
            onStopTrip={handleStopTrip}
            onOpenSettings={() => {
              setCurrentScreen('settings');
              setActiveTab('settings');
            }}
            onSnooze={handleSnooze}
          />
        );

      case 'alarm':
        return (
          <AlarmAlertScreen
            destination={destination}
            remainingDistanceKm={remainingDistanceKm}
            alertDistanceKm={alertDistanceKm}
            onSnooze={handleSnooze}
            onStopAlarm={handleStopAlarm}
          />
        );

      case 'summary':
        return (
          <TripSummaryScreen
            destination={destination}
            startDistanceKm={initialDistanceKm}
            alertDistanceKm={alertDistanceKm}
            durationText={routeDetails?.durationText}
            onEndTrip={handleStopTrip}
            onSetAnotherDestination={handleSetAnotherDestination}
          />
        );

      case 'trips':
        return (
          <PastTripsScreen
            trips={pastTrips}
            onBack={() => setCurrentScreen('home')}
            onSelectTrip={handleSelectRecentTrip}
            onDeleteTrip={handleDeleteTrip}
            onStartNewTrip={() => {
              setCurrentScreen('destination');
              setActiveTab('map');
            }}
            onTabChange={handleTabChange}
            isTripActive={isTripActive}
            showBottomNav={true}
          />
        );

      case 'settings':
        return (
          <SettingsScreen
            userName={userName}
            onUpdateUserName={setUserName}
            locationPermStatus={locationPermStatus}
            onRequestPermission={requestPermission}
            onOpenLocationSettings={openLocationSettings}
            onTabChange={handleTabChange}
            isTripActive={isTripActive}
            showBottomNav={true}
            onBack={() => setCurrentScreen('home')}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="travel-alarm-viewport-wrapper">
      <div className="travel-alarm-phone-frame">
        {renderScreen()}
      </div>
    </div>
  );
}
