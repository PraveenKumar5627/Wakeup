import React from 'react';
import { getGoogleMapsUrl } from './DestinationSearch';

export default function TripStatus({
  destination,
  alertDistance,
  currentLocation,
  remainingDistance,
  routeDetails,
  lastUpdated,
  onStopTrip,
  isSimulating,
}) {
  const isRoadRoute = routeDetails?.routeType === 'road';
  const durationText = routeDetails?.durationText;
  const straightLineKm = routeDetails?.straightLineKm;

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
        <span
          className="status-badge"
          style={{
            background: isRoadRoute ? 'rgba(56, 189, 248, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            border: isRoadRoute ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
            color: isRoadRoute ? '#38bdf8' : '#f59e0b',
          }}
          title={isRoadRoute ? 'Calculated along actual highways/roads via Google Maps routing' : 'Straight-line fallback'}
        >
          {isRoadRoute ? '🛣️ Road Driving Route' : '📏 Straight Line'}
        </span>
      </div>

      {/* Hero Distance Remaining */}
      <div className="distance-hero">
        <div className="distance-label">
          {isRoadRoute ? 'Road Distance Remaining (Driving Route)' : 'Distance Remaining'}
        </div>
        <div className="distance-value-large">
          {remainingDistance !== null ? remainingDistance.toFixed(2) : '--'}
          <span>km</span>
        </div>

        {durationText && (
          <div
            style={{
              marginTop: '0.45rem',
              fontSize: '0.88rem',
              color: '#38bdf8',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
            }}
          >
            <span>⏱️</span>
            <span>Est. Travel Time:</span>
            <span style={{ color: '#fff', fontWeight: 700 }}>~{durationText}</span>
          </div>
        )}

        <div className="target-threshold-text">
          Alert sounds at <strong>≤ {alertDistance >= 1000 ? `${(alertDistance / 1000).toFixed(1).replace(/\.0$/, '')} km` : `${alertDistance} m`}</strong>
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

      {/* Comparison with straight-line if different */}
      {isRoadRoute && straightLineKm && Math.abs(straightLineKm - (remainingDistance || 0)) > 1 && (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 'var(--radius-md)',
            padding: '0.5rem 0.75rem',
            fontSize: '0.76rem',
            color: 'var(--text-dim)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>🛣️ Actual road distance: <strong style={{ color: '#38bdf8' }}>{remainingDistance?.toFixed(1)} km</strong></span>
          <span>📏 Straight-line: {straightLineKm.toFixed(1)} km</span>
        </div>
      )}

      {/* Google Maps Live Driving Route Button */}
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
            const destParam =
              destination.name &&
              destination.name !== 'Google Maps Destination' &&
              destination.name !== 'Pinned Location' &&
              destination.name !== 'Selected Coordinates' &&
              !/^-?\d+(\.\d+)?[\s,]+-?\d+(\.\d+)?$/.test(destination.name)
                ? encodeURIComponent(destination.name)
                : `${destination.lat},${destination.lng}`;
            window.open(
              `https://www.google.com/maps/dir/?api=1&origin=${currentLocation.lat},${currentLocation.lng}&destination=${destParam}&travelmode=driving`,
              '_blank'
            );
          } else if (destination) {
            window.open(getGoogleMapsUrl(destination), '_blank');
          }
        }}
        title="View live driving route on Google Maps"
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
