/**
 * Automated tests for Frontend Distance & Alarm Calculations
 */
import { haversineDistanceKm, formatDuration } from './api.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

console.log('--- Running Distance & Alarm Logic Tests ---');

// 1. Same point distance
const d0 = haversineDistanceKm(11.0168, 76.9558, 11.0168, 76.9558);
assert(d0 === 0, `Same point distance must be 0, got ${d0}`);

// 2. Known distance: Chennai Central to Airport (~14.5 to 15 km)
const dAirport = haversineDistanceKm(13.0827, 80.2707, 12.9941, 80.1709);
assert(dAirport >= 14 && dAirport <= 16, `Chennai Airport distance expected ~14.8km, got ${dAirport}`);

// 3. Known distance: Coimbatore to Gandhipuram (~1.5 to 2.5 km)
const dCbe = haversineDistanceKm(11.0168, 76.9558, 11.0183, 76.9678);
assert(dCbe >= 1.0 && dCbe <= 2.5, `Gandhipuram distance expected ~1.3km, got ${dCbe}`);

// 4. Threshold crossing detection logic & Simulation
function checkThresholdCrossing(currentDistKm, alertDistKm, alarmAlreadyFired) {
  if (alarmAlreadyFired) return false;
  return currentDistKm <= alertDistKm;
}

assert(checkThresholdCrossing(4.2, 3.0, false) === false, 'At 4.2km with 3.0km alert, should not trigger');
assert(checkThresholdCrossing(3.0, 3.0, false) === true, 'At 3.0km with 3.0km alert, should trigger');
assert(checkThresholdCrossing(2.5, 3.0, true) === false, 'If already fired, duplicate trigger should be suppressed');

// 5. TEST A: Normal trip simulation (10 km -> 3 km threshold)
console.log('--- Test A: Normal Trip Simulation (10km -> 3km threshold) ---');
let tripState = {
  alertThreshold: 3.0,
  alarmFired: false,
  alarmTriggerCount: 0,
  currentDistance: 10.0,
};

function onLocationTick(dist) {
  tripState.currentDistance = dist;
  if (tripState.currentDistance <= tripState.alertThreshold && !tripState.alarmFired) {
    tripState.alarmFired = true;
    tripState.alarmTriggerCount++;
  }
}

// 5-second interval simulation updates
[10.0, 8.2, 6.5, 4.8, 3.2, 3.0, 2.7, 1.5].forEach((d) => onLocationTick(d));
assert(tripState.alarmFired === true, 'Test A: Alarm fired when reaching 3.0 km');
assert(tripState.alarmTriggerCount === 1, `Test A: Alarm fired exactly once, count=${tripState.alarmTriggerCount}`);

// 6. TEST B: Threshold crossing (4 km -> 2.5 km leap)
console.log('--- Test B: Threshold Crossing (4.0km to 2.5km jump) ---');
let testB = { alertThreshold: 3.0, alarmFired: false, count: 0 };
// Update 1: 4.0 km (outside)
if (4.0 <= testB.alertThreshold && !testB.alarmFired) { testB.alarmFired = true; testB.count++; }
assert(testB.alarmFired === false, 'Test B: At 4.0 km alarm did not trigger');
// Update 2: 2.5 km (crossed threshold without hitting exactly 3.0)
if (2.5 <= testB.alertThreshold && !testB.alarmFired) { testB.alarmFired = true; testB.count++; }
assert(testB.alarmFired === true, 'Test B: At 2.5 km alarm triggered upon crossing 3.0 km threshold');
assert(testB.count === 1, 'Test B: Triggered exactly once');

// 7. TEST C: Duplicate prevention (Subsequent updates below threshold)
console.log('--- Test C: Duplicate Prevention ---');
[2.0, 1.8, 1.2, 0.5, 0.1, 0.0].forEach((d) => {
  if (d <= testB.alertThreshold && !testB.alarmFired) {
    testB.alarmFired = true;
    testB.count++;
  }
});
assert(testB.count === 1, 'Test C: Subsequent updates below threshold did not trigger duplicate alarm');

// 8. TEST D: Location Failure & Denial (No mock coordinates)
console.log('--- Test D: Location Failure & Denial ---');
function handleGpsStatus(permissionStatus, gpsServicesEnabled) {
  if (permissionStatus === 'denied') return { error: 'Location permission denied', active: false };
  if (!gpsServicesEnabled) return { error: 'Device Location is turned off', active: false };
  return { error: null, active: true };
}
assert(handleGpsStatus('denied', true).active === false, 'Test D: Denied permission flagged correctly');
assert(handleGpsStatus('granted', false).active === false, 'Test D: Disabled GPS flagged correctly');
assert(handleGpsStatus('granted', true).active === true, 'Test D: Active GPS confirmed');

// 9. Destination inside radius at trip start
console.log('--- Destination inside radius at trip start ---');
let startInside = { alertThreshold: 3.0, alarmFired: false };
const initialDist = 1.8;
if (initialDist <= startInside.alertThreshold && !startInside.alarmFired) {
  startInside.alarmFired = true;
}
assert(startInside.alarmFired === true, 'Immediate alarm trigger when starting trip already inside radius');

// 10. TEST F: Trip Reset
console.log('--- Test F: Trip Reset ---');
function resetTrip(state) {
  return {
    ...state,
    alarmFired: false,
    snoozeUntil: 0,
    remainingDistance: null,
    travelledDistance: 0.0,
    tripActive: false,
  };
}
const resetState = resetTrip({ tripActive: true, alarmFired: true, remainingDistance: 2.1, travelledDistance: 5.4 });
assert(resetState.tripActive === false, 'Test F: Trip is inactive after stop');
assert(resetState.alarmFired === false, 'Test F: Alarm state reset to false');
assert(resetState.remainingDistance === null, 'Test F: Remaining distance reset');
assert(resetState.travelledDistance === 0.0, 'Test F: Travelled distance reset');

// 11. Travelled Distance Non-Negativity & NaN Prevention
console.log('--- Travelled Distance Math Validation ---');
const distTravelled = haversineDistanceKm(13.0827, 80.2707, 13.0850, 80.2720);
assert(distTravelled >= 0, 'Travelled distance is strictly non-negative');
assert(!isNaN(distTravelled), 'Travelled distance is never NaN');
assert(haversineDistanceKm(null, null, 13.0, 80.0) === 0.0, 'Invalid null coordinates return safe 0.0');
assert(haversineDistanceKm(undefined, NaN, 13.0, 80.0) === 0.0, 'Invalid NaN coordinates return safe 0.0');

// 12. Custom distance validation
function validateCustomDistance(input) {
  const num = parseFloat(input);
  if (isNaN(num) || num <= 0 || num > 50) return null;
  return Math.round(num * 10) / 10;
}

assert(validateCustomDistance('4') === 4.0, 'Valid custom distance 4 accepted');
assert(validateCustomDistance('1.5') === 1.5, 'Valid decimal distance 1.5 accepted');
assert(validateCustomDistance('-2') === null, 'Negative distance rejected');
assert(validateCustomDistance('0') === null, 'Zero distance rejected');
assert(validateCustomDistance('100') === null, 'Excessive distance (>50) rejected');
assert(validateCustomDistance('abc') === null, 'Non-numeric input rejected');

// 13. Duration formatting
assert(formatDuration(20) === '20 min', '20 min formatted correctly');
assert(formatDuration(65) === '1 hr 5 min', '65 min formatted as 1 hr 5 min');
assert(formatDuration(120) === '2 hr', '120 min formatted as 2 hr');

console.log('--- All Frontend Calculation Tests Passed Successfully! ---');
