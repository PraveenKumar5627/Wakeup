/**
 * LocationPermissionDialog
 *
 * Clean and informative dialog displayed when location access cannot be obtained,
 * explaining why location is required and how the user can enable it.
 *
 * Supports all distinct states:
 *   - services_off         → Device Location (GPS) toggle is OFF in Quick Settings
 *   - denied_permanently   → Permission blocked in browser settings (lock icon)
 *   - timeout              → GPS satellite acquisition timed out
 *   - unavailable          → Insecure context (HTTP) or unsupported browser
 *   - prompt               → Informational prompt before requesting
 *
 * Note: Does NOT pretend to be Android's system dialog. Respects platform security
 * and clearly instructs the user how to configure their browser and device.
 */

import React, { useState } from 'react';

export default function LocationPermissionDialog({
  isOpen,
  isRequesting = false,
  locationError = null,
  locationPermStatus = 'prompt',
  locationFixStatus = 'idle',
  isPermanentlyDenied = false,
  isServicesOff = false,
  isTimeout = false,
  isUnavailable = false,
  isNative = false,
  onTurnOnLocation,
  onNoThanks,
  onEnterDestinationManually,
}) {
  const [showDetailedGuide, setShowDetailedGuide] = useState(false);

  if (!isOpen) return null;

  // ── Heading ──────────────────────────────────────────────────────────────
  const getHeading = () => {
    if (isServicesOff) return 'Device Location is Turned Off';
    if (isPermanentlyDenied) return 'Location Access Blocked';
    if (isTimeout) return 'Location Request Timed Out';
    if (isUnavailable) return 'Geolocation Unavailable';
    return 'Location Access Required for Alarm';
  };

  // ── Icon ─────────────────────────────────────────────────────────────────
  const getHeaderIcon = () => {
    if (isServicesOff) return '📵';
    if (isPermanentlyDenied) return '🔒';
    if (isTimeout) return '⏱️';
    if (isUnavailable) return '❌';
    return '📍';
  };

  // ── Subtitle / Explanatory Body ──────────────────────────────────────────
  const renderBody = () => {
    if (isServicesOff) {
      return (
        <div className="android-loc-body-content">
          <p className="android-loc-subtitle">
            Your phone's <strong>Location / GPS</strong> toggle is currently turned off.
          </p>
          <div className="android-loc-info-box">
            <span style={{ fontSize: '1.1rem' }}>ℹ️</span>
            <span>
              Web browsers cannot turn on your device's GPS automatically. Please enable it in your phone settings:
            </span>
          </div>
          <ol className="android-loc-step-list">
            <li>Swipe down from the top of your phone screen to open <strong>Android Quick Settings</strong>.</li>
            <li>Find and tap the <strong>Location</strong> (GPS) tile to turn it <strong>ON</strong>.</li>
            <li>Return to this page and tap <strong>Retry Location</strong> below.</li>
          </ol>
        </div>
      );
    }

    if (isPermanentlyDenied) {
      return (
        <div className="android-loc-body-content">
          <p className="android-loc-subtitle">
            Location permission was denied for this app. To track your journey and trigger the wake-up alarm, please grant access:
          </p>
          {isNative ? (
            <ol className="android-loc-step-list">
              <li>Open your device <strong>Settings</strong>.</li>
              <li>Go to <strong>Apps → Wakeup</strong> (or Travel Alarm).</li>
              <li>Tap <strong>Permissions → Location</strong>.</li>
              <li>Select <strong>"Allow only while using the app"</strong>.</li>
              <li>Return here and tap <strong>Retry Location</strong>.</li>
            </ol>
          ) : (
            <ol className="android-loc-step-list">
              <li>Tap the <strong>🔒 Lock icon</strong> (or tune icon) in your browser address bar.</li>
              <li>Tap <strong>Permissions</strong> or <strong>Site settings</strong>.</li>
              <li>Change <strong>Location</strong> from Blocked to <strong>Allow</strong>.</li>
              <li>Return here and tap <strong>Retry Location</strong> (or refresh the page).</li>
            </ol>
          )}
        </div>
      );
    }

    if (isTimeout) {
      return (
        <div className="android-loc-body-content">
          <p className="android-loc-subtitle">
            The GPS request timed out before receiving a satellite position fix.
          </p>
          <div className="android-loc-info-box">
            <span>📡</span>
            <span>
              GPS satellites need an unobstructed line of sight. Being indoors, underground, or in heavy shielding can cause timeouts.
            </span>
          </div>
          <ol className="android-loc-step-list">
            <li>Ensure Wi-Fi or mobile data is connected to assist GPS triangulation.</li>
            <li>Move near a window or outdoors.</li>
            <li>Tap <strong>Retry Location</strong> below.</li>
          </ol>
        </div>
      );
    }

    if (isUnavailable) {
      return (
        <div className="android-loc-body-content">
          <p className="android-loc-subtitle">
            Geolocation is unavailable on this device or network connection.
          </p>
          <div className="android-loc-info-box">
            <span>🔒</span>
            <span>
              Modern mobile browsers strictly require a secure connection (<strong>HTTPS</strong>) to access GPS.
            </span>
          </div>
        </div>
      );
    }

    // Default 'prompt' state
    return (
      <div className="android-loc-body-content">
        <p className="android-loc-subtitle">
          Smart Transit Wakeup requires access to your current GPS location to:
        </p>
        <ul className="android-loc-step-list" style={{ listStyleType: 'disc', paddingLeft: '1.3rem' }}>
          <li>Continuously calculate real driving road distance to your destination.</li>
          <li>Sound the wake-up alarm before you arrive at your stop.</li>
        </ul>
        <div className="android-loc-info-box" style={{ marginTop: '0.6rem' }}>
          <span>🔔</span>
          <span>
            When you tap <strong>Allow Location &amp; Start</strong>, your browser will display its native permission prompt. Please choose <strong>Allow</strong>.
          </span>
        </div>
      </div>
    );
  };

  // ── Primary Action Button Label ──────────────────────────────────────────
  const getPrimaryButtonLabel = () => {
    if (isRequesting) {
      return (
        <>
          <span className="android-btn-spinner" />
          <span>Detecting location...</span>
        </>
      );
    }
    if (isServicesOff) return '🔄 Retry Location';
    if (isPermanentlyDenied) return '🔄 Retry Location';
    if (isTimeout) return '🔄 Retry Location';
    if (isUnavailable) return 'Close';
    return '📍 Allow Location & Start';
  };

  const handlePrimaryClick = () => {
    if (isUnavailable) {
      onNoThanks && onNoThanks();
      return;
    }
    onTurnOnLocation && onTurnOnLocation();
  };

  return (
    <div
      className="android-loc-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="loc-dialog-title"
    >
      <div className="android-loc-dialog-card">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ fontSize: '1.6rem' }}>{getHeaderIcon()}</span>
          <h2 id="loc-dialog-title" className="android-loc-title">
            {getHeading()}
          </h2>
        </div>

        {/* Body */}
        {renderBody()}

        {/* Inline Error Notice if present */}
        {locationError && (
          <div className="android-loc-error-banner" role="alert">
            <span className="android-loc-error-icon">⚠️</span>
            <div className="android-loc-error-text">
              {typeof locationError === 'string'
                ? locationError
                : locationError?.message || 'Unable to access device location.'}
            </div>
          </div>
        )}

        {/* Collapsible detailed guide toggle */}
        <div style={{ marginTop: '0.2rem' }}>
          <button
            type="button"
            className="android-loc-link-btn"
            onClick={() => setShowDetailedGuide((v) => !v)}
          >
            {showDetailedGuide ? '▲ Hide detailed troubleshooting' : '▼ Need help with permissions or GPS?'}
          </button>

          {showDetailedGuide && (
            <div className="android-loc-expandable-guide" style={{ marginTop: '0.5rem' }}>
              <div className="android-loc-guide-section">
                <strong>📱 Android Phone Users:</strong>
                <ol>
                  <li>Swipe down the status bar twice to open Quick Settings and confirm <strong>Location</strong> is highlighted ON.</li>
                  <li>In Chrome, tap the <strong>🔒 icon</strong> left of the URL → <strong>Permissions</strong> → <strong>Location: Allow</strong>.</li>
                  <li>Ensure Chrome has system location permission in <strong>Android Settings → Apps → Chrome → Permissions → Location</strong>.</li>
                </ol>
              </div>
              <div className="android-loc-guide-section" style={{ marginTop: '0.4rem' }}>
                <strong>🌐 Web Security Rule:</strong>
                <p style={{ margin: 0 }}>
                  Browsers strictly restrict GPS to <code>https://</code> domains or <code>localhost</code> for privacy.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Alternative: Enter destination manually or use simulator */}
        {onEnterDestinationManually && (
          <div style={{ textAlign: 'center', marginTop: '0.2rem' }}>
            <button
              type="button"
              className="android-loc-manual-link"
              onClick={onEnterDestinationManually}
            >
              ✏️ Search destination manually or use GPS simulator
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="android-loc-actions">
          <button
            type="button"
            className="android-btn-no-thanks"
            onClick={onNoThanks}
            disabled={isRequesting}
          >
            {isPermanentlyDenied || isServicesOff || isUnavailable ? 'Cancel' : 'No, thanks'}
          </button>

          <button
            type="button"
            className="android-btn-turn-on"
            onClick={handlePrimaryClick}
            disabled={isRequesting}
          >
            {getPrimaryButtonLabel()}
          </button>
        </div>
      </div>
    </div>
  );
}
