import React from 'react';
import StatusBar from '../components/StatusBar';
import { Check, MapPin, ChevronRight, Clock, Route, Compass } from 'lucide-react';

export default function TripSummaryScreen({
  destination,
  startDistanceKm = 5.0,
  alertDistanceKm = 3.0,
  durationText = '~ 20 min',
  onEndTrip,
  onSetAnotherDestination,
}) {
  const destName = destination?.name || 'Coimbatore';
  const destCity = destination?.city || 'Tamil Nadu';

  return (
    <div className="screen-container screen-trip-summary">
      <StatusBar theme="light" />

      <main className="summary-main-content">
        {/* Green Circle with White Checkmark */}
        <div className="summary-check-circle">
          <Check size={36} className="text-white" strokeWidth={3} />
        </div>

        <h1 className="summary-title">Trip Ongoing</h1>
        <p className="summary-subtitle">
          You'll be notified again if you set another destination.
        </p>

        {/* Destination Card with Chevron */}
        <div
          className="summary-dest-card"
          onClick={onSetAnotherDestination}
          role="button"
          tabIndex={0}
        >
          <div className="summary-dest-left">
            <div className="summary-dest-pin">
              <MapPin size={20} className="text-blue-600" />
            </div>
            <div className="summary-dest-text">
              <h3 className="summary-dest-name">{destName}</h3>
              <p className="summary-dest-city">{destCity}</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-slate-400" />
        </div>

        {/* Stats Table / Card */}
        <div className="summary-metrics-card">
          <div className="summary-metric-row">
            <span className="metric-label">Distance at start</span>
            <span className="metric-value">
              {startDistanceKm !== null ? `${Number(startDistanceKm).toFixed(1)} km` : '5.0 km'}
            </span>
          </div>

          <div className="summary-metric-divider" />

          <div className="summary-metric-row">
            <span className="metric-label">Alarm distance</span>
            <span className="metric-value">
              {alertDistanceKm !== null ? `${Number(alertDistanceKm).toFixed(1)} km` : '3.0 km'}
            </span>
          </div>

          <div className="summary-metric-divider" />

          <div className="summary-metric-row">
            <span className="metric-label">Total travel time</span>
            <span className="metric-value">{durationText || '~ 20 min'}</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="summary-actions-footer">
          <button
            id="btn-end-trip"
            type="button"
            className="btn-primary-blue btn-end-trip"
            onClick={onEndTrip}
          >
            End Trip
          </button>

          <button
            id="btn-set-another"
            type="button"
            className="btn-set-another"
            onClick={onSetAnotherDestination}
          >
            Set Another Destination
          </button>
        </div>
      </main>
    </div>
  );
}
