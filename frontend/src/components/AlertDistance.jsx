import React from 'react';

const MIN_METERS = 100;
const MAX_METERS = 5000;
const STEP_METERS = 100;

function formatDistance(meters) {
  if (meters < 1000) return `${meters} m`;
  const km = meters / 1000;
  return Number.isInteger(km) ? `${km} km` : `${km.toFixed(1)} km`;
}

export default function AlertDistance({
  alertDistance,
  setAlertDistance,
  disabled,
}) {
  // Support legacy km values (1–5) — convert to meters if needed
  const meters =
    alertDistance < 10 ? alertDistance * 1000 : Number(alertDistance);

  const handleChange = (e) => {
    setAlertDistance(Number(e.target.value));
  };

  const percent = ((meters - MIN_METERS) / (MAX_METERS - MIN_METERS)) * 100;

  return (
    <div className="glass-card">
      <div className="section-label">
        <span>⏰</span>
        <span>Alert me before destination</span>
      </div>

      <div className="range-wrapper">
        <div className="range-value-display">
          <span className="range-value-number">{formatDistance(meters)}</span>
        </div>

        <input
          type="range"
          className="distance-range"
          min={MIN_METERS}
          max={MAX_METERS}
          step={STEP_METERS}
          value={meters}
          onChange={handleChange}
          disabled={disabled}
          style={{ '--fill-percent': `${percent}%` }}
        />

        <div className="range-labels">
          <span>100 m</span>
          <span>5 km</span>
        </div>
      </div>

      <p
        style={{
          fontSize: '0.78rem',
          color: 'var(--text-dim)',
          marginTop: '0.75rem',
          textAlign: 'center',
        }}
      >
        Alarm will sound when you are within{' '}
        <strong>{formatDistance(meters)}</strong> of your destination.
      </p>
    </div>
  );
}
