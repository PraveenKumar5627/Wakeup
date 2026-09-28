import React from 'react';

export default function TripStatus({
  destination,
  alertDistance,
  currentLocation,
  remainingDistance,
  lastUpdated,
  onStopTrip,
  isSimulating,
}) {
  return (
    <div className="glass-card trip-active-panel">
      {/* Status Bar */}
      <div className="trip-status-header">
        <span className="status-badge active">
          <span className="pulse-dot" />
          🟢 Trip Active
        </span>
        <span className="status-badge tracking">
          <span className="pulse-dot" />
          {isSimulating ? '🎮 Simulated GPS' : '📍 GPS Tracking'}
        </span>
      </div>

      {/* Hero Distance Remaining */}
      <div className="distance-hero">
        <div className="distance-label">Distance Remaining</div>
        <div className="distance-value-large">
          {remainingDistance !== null ? remainingDistance.toFixed(2) : '--'}
          <span>km</span>
        </div>
        <div className="target-threshold-text">
          Alert sounds at <strong>≤ {alertDistance} km</strong>
        </div>
      </div>

      {/* Metadata Coordinates */}
      <div className="meta-grid">
        <div className="meta-box">
          <div className="meta-box-label">Destination</div>
          <div className="meta-box-val" title={destination?.name}>
            {destination?.name || 'Unknown'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
            {destination?.lat.toFixed(4)}°, {destination?.lng.toFixed(4)}°
          </div>
        </div>

        <div className="meta-box">
          <div className="meta-box-label">Your Current GPS</div>
          <div className="meta-box-val">
            {currentLocation
              ? `${currentLocation.lat.toFixed(4)}°, ${currentLocation.lng.toFixed(4)}°`
              : 'Acquiring GPS...'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
            {lastUpdated ? `Updated ${lastUpdated}` : 'Waiting for signal...'}
          </div>
        </div>
      </div>

      {/* Google Maps Live Route Button */}
      <button
        type="button"
        className="preset-chip"
        style={{
          width: '100%',
          justifyContent: 'center',
          background: 'rgba(56, 189, 248, 0.12)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          color: 'var(--accent-blue)',
          padding: '0.65rem',
          fontSize: '0.85rem',
          fontWeight: 700,
        }}
        onClick={() => {
          if (currentLocation && destination) {
            window.open(
              `https://www.google.com/maps/dir/?api=1&origin=${currentLocation.lat},${currentLocation.lng}&destination=${destination.lat},${destination.lng}&travelmode=transit`,
              '_blank'
            );
          } else if (destination) {
            window.open(`https://www.google.com/maps?q=${destination.lat},${destination.lng}`, '_blank');
          }
        }}
        title="View live transit route on Google Maps"
      >
        <span>🗺️</span>
        <span>View Route on Google Maps ↗</span>
      </button>

      {/* Stop Trip Button */}
      <button
        type="button"
        className="btn-danger"
        onClick={onStopTrip}
      >
        <span>🛑</span>
        <span>STOP TRIP</span>
      </button>
    </div>
  );
}
