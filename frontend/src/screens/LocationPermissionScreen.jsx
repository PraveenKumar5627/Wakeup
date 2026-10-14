import React from 'react';
import StatusBar from '../components/StatusBar';
import {
  Navigation,
  MapPin,
  Route,
  Bell,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Settings as SettingsIcon,
  Loader2,
} from 'lucide-react';

export default function LocationPermissionScreen({
  permissionStatus = 'idle',
  errorMessage = null,
  isServicesOff = false,
  isPermanentlyDenied = false,
  onAllowLocation,
  onNotNow,
  onOpenSettings,
}) {
  const benefits = [
    {
      icon: MapPin,
      title: 'Track Current Position',
      desc: 'Real-time GPS coordinates verify your continuous journey progress.',
      color: '#1E6BFF',
    },
    {
      icon: Route,
      title: 'Calculate Remaining Distance',
      desc: 'Computes road driving distance and straight-line buffers as you approach.',
      color: '#10B981',
    },
    {
      icon: Bell,
      title: 'Trigger Wake-Up Alarm',
      desc: 'Loud siren chimes & vibration alert sound right as you cross your radius.',
      color: '#F59E0B',
    },
  ];

  return (
    <div className="screen-container screen-permission">
      <StatusBar theme="light" />

      <main className="permission-main-content">
        {/* Large Location Radar Illustration */}
        <div className="permission-radar-art">
          <div className="radar-ring ring-3"></div>
          <div className="radar-ring ring-2"></div>
          <div className="radar-ring ring-1"></div>
          <div className="radar-core-circle">
            <Navigation size={38} className="radar-nav-icon" />
          </div>
        </div>

        <h2 className="permission-heading">Enable Location Access</h2>
        <p className="permission-subheading">
          TravelAlarm needs your device GPS location to calculate your remaining
          distance and wake you up before your destination.
        </p>

        {/* Error / Denial Guidance Banner if encountered */}
        {errorMessage && (
          <div className="permission-warning-card">
            <AlertTriangle size={20} className="warning-icon text-amber-500 shrink-0" />
            <div className="warning-content">
              <h4 className="warning-title">
                {isServicesOff ? 'Device Location Disabled' : 'Permission Notice'}
              </h4>
              <p className="warning-text">{errorMessage}</p>
              {isPermanentlyDenied && (
                <button
                  type="button"
                  className="warning-action-btn"
                  onClick={onOpenSettings}
                >
                  <SettingsIcon size={14} className="mr-1 inline" /> Open Site / App Settings
                </button>
              )}
            </div>
          </div>
        )}

        {/* 3 Benefit Rows */}
        <div className="permission-benefits-list">
          {benefits.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="benefit-row-card">
                <div
                  className="benefit-icon-box"
                  style={{ backgroundColor: `${item.color}15`, color: item.color }}
                >
                  <Icon size={20} strokeWidth={2.2} />
                </div>
                <div className="benefit-info">
                  <h4 className="benefit-title">{item.title}</h4>
                  <p className="benefit-desc">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Action Buttons */}
      <footer className="permission-actions-footer">
        <button
          id="btn-allow-location"
          type="button"
          className="btn-primary-blue btn-allow-location"
          onClick={onAllowLocation}
          disabled={permissionStatus === 'requesting'}
        >
          {permissionStatus === 'requesting' ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Loader2 size={18} className="animate-spin" />
              <span>Accessing Location...</span>
            </span>
          ) : (
            'Allow Location'
          )}
        </button>

        <button
          id="btn-not-now-location"
          type="button"
          className="btn-secondary-plain"
          onClick={onNotNow}
        >
          Not Now
        </button>
      </footer>
    </div>
  );
}
