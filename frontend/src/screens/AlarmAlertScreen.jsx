import React from 'react';
import StatusBar from '../components/StatusBar';
import { Bell, MapPin, Volume2 } from 'lucide-react';

export default function AlarmAlertScreen({
  destination,
  remainingDistanceKm = 2.0,
  alertDistanceKm = 3.0,
  onSnooze,
  onStopAlarm,
}) {
  const destName = destination?.name || 'Coimbatore';
  const destCity = destination?.city || 'Tamil Nadu';
  const displayDist =
    remainingDistanceKm !== null ? remainingDistanceKm.toFixed(1) : '2';

  return (
    <div className="screen-container screen-alarm-alert">
      <StatusBar theme="dark" />

      <main className="alarm-alert-main">
        {/* Pulsing Glowing Golden Bell Circle */}
        <div className="alarm-glow-ring-outer">
          <div className="alarm-glow-ring-inner">
            <div className="alarm-bell-core">
              <Bell size={64} className="bell-ringing-svg" />
            </div>
          </div>
        </div>

        {/* Audio active indicator */}
        <div className="alarm-sound-indicator">
          <Volume2 size={16} className="text-amber-400 mr-1 animate-pulse" />
          <span>Wake-up Chime & Vibration Active</span>
        </div>

        {/* Heading */}
        <h1 className="alarm-main-heading">Almost There!</h1>
        <p className="alarm-sub-heading">
          You are {displayDist} km away from {destName}
        </p>

        {/* Destination Card */}
        <div className="alarm-destination-card">
          <div className="alarm-dest-left">
            <div className="alarm-dest-pin">
              <MapPin size={20} className="text-blue-400" />
            </div>
            <div className="alarm-dest-text">
              <h3 className="alarm-dest-title">{destName}</h3>
              <p className="alarm-dest-subtitle">{destCity}</p>
            </div>
          </div>
          <div className="alarm-dest-right">
            <span className="alarm-dest-km">{displayDist} km</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="alarm-actions-group">
          <button
            id="btn-snooze-alarm"
            type="button"
            className="btn-primary-blue btn-alarm-snooze"
            onClick={onSnooze}
          >
            Snooze (5 min)
          </button>

          <button
            id="btn-stop-alarm"
            type="button"
            className="btn-alarm-stop"
            onClick={onStopAlarm}
          >
            Stop Alarm
          </button>
        </div>
      </main>
    </div>
  );
}
