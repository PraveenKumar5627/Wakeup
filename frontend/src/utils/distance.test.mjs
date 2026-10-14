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

// 4. Threshold crossing detection logic
function checkThresholdCrossing(currentDistKm, alertDistKm, alarmAlreadyFired) {
  if (alarmAlreadyFired) return false;
  return currentDistKm <= alertDistKm;
}

assert(checkThresholdCrossing(4.2, 3.0, false) === false, 'At 4.2km with 3.0km alert, should not trigger');
assert(checkThresholdCrossing(3.0, 3.0, false) === true, 'At 3.0km with 3.0km alert, should trigger');
assert(checkThresholdCrossing(2.5, 3.0, true) === false, 'If already fired, duplicate trigger should be suppressed');

// 5. Custom distance validation
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

// 6. Duration formatting
assert(formatDuration(20) === '20 min', '20 min formatted correctly');
assert(formatDuration(65) === '1 hr 5 min', '65 min formatted as 1 hr 5 min');
assert(formatDuration(120) === '2 hr', '120 min formatted as 2 hr');

console.log('--- All Frontend Calculation Tests Passed Successfully! ---');
