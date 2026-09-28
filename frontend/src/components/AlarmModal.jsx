import React from 'react';
export default function AlarmModal({
  isOpen,
  distance,
  alertDistance,
  destinationName,
  onStopAlarm,
}) {
  if (!isOpen) return null;
  return (
    <div className="alarm-overlay">
      <div className="alarm-card">
        <div className="alarm-bell-icon">🔔</div>
        <h2 className="alarm-title">WAKE UP!</h2>
        <p className="alarm-desc">
          Your destination <strong>{destinationName || 'your stop'}</strong> is approximately{' '}
          <span className="alarm-distance-highlight">
            {distance !== null ? distance.toFixed(2) : alertDistance} km
          </span>{' '}
          away!
          <br />
          <span style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '0.4rem', display: 'inline-block' }}>
            Get ready to get down!
          </span>
        </p>

        <button
          type="button"
          className="btn-stop-alarm"
          onClick={onStopAlarm}
        >
          🔕 STOP ALARM
        </button>

        
      </div>
    </div>
  );
}
