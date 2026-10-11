/**
 * LocationPermissionDialog
 *
 * Shown automatically on first open (or when the user taps "Start Trip")
 * if location permission has not yet been granted.
 *
 * Handles all permission states:
 *   - prompt               → explain why + "Turn on Location" button
 *   - denied               → explain + retry button
 *   - denied_permanently   → explain how to open Android/browser Settings
 *   - services_off         → explain how to enable Location in device settings
 *   - unavailable          → browser does not support geolocation
 *
 * Never attempts to bypass system dialogs or silently access GPS.
 */

import React, { useState } from 'react';

export default function LocationPermissionDialog({
  isOpen,
  isRequesting      = false,
  locationError     = null,
  locationPermStatus = 'prompt',
  isPermanentlyDenied = false,
  isServicesOff     = false,
  isNative          = false,
  onTurnOnLocation,
  onNoThanks,
  onEnterDestinationManually,
}) {
  const [showGuide, setShowGuide] = useState(false);

  if (!isOpen) return null;

  // ── Decide heading and body copy based on state ──────────────────────────

  const heading = () => {
    if (isPermanentlyDenied)
      return 'Location Access Blocked';
    if (isServicesOff)
      return 'Device Location is Turned Off';
    return 'To continue, your device will need to use Location Accuracy';
  };

  const body = () => {
    if (isPermanentlyDenied) {
      return (
        <p className="android-loc-subtitle">
          You permanently denied location access. To enable it:
          {isNative ? (
            <ol style={{ marginTop: '0.5rem', paddingLeft: '1.2rem', lineHeight: 1.7 }}>
              <li>Open <strong>Android Settings</strong></li>
              <li>Tap <strong>Apps → Arrivo</strong></li>
              <li>Tap <strong>Permissions → Location</strong></li>
              <li>Select <strong>"Allow only while using the app"</strong></li>
              <li>Return here and tap <strong>Retry Location</strong></li>
            </ol>
          ) : (
            <ol style={{ marginTop: '0.5rem', paddingLeft: '1.2rem', lineHeight: 1.7 }}>
              <li>Tap the <strong>🔒 Lock icon</strong> in your browser address bar</li>
              <li>Tap <strong>Permissions</strong> or <strong>Site Settings</strong></li>
              <li>Set <strong>Location</strong> to <strong>Allow</strong></li>
              <li>Refresh the page</li>
            </ol>
          )}
        </p>
      );
    }

    if (isServicesOff) {
      return (
        <p className="android-loc-subtitle">
          Your device's Location toggle is off. To enable it:
          <ol style={{ marginTop: '0.5rem', paddingLeft: '1.2rem', lineHeight: 1.7 }}>
            <li>Swipe down from the top to open <strong>Quick Settings</strong></li>
            <li>Tap the <strong>Location</strong> icon to turn it <strong>ON</strong></li>
            <li>Return here and tap <strong>Retry Location</strong></li>
          </ol>
        </p>
      );
    }

    return (
      <p className="android-loc-subtitle">
        Smart Transit Wakeup needs your location to track your journey and
        trigger the destination alarm. The following settings should be on:
      </p>
    );
  };

  // ── Action button label ───────────────────────────────────────────────────

  const primaryBtnLabel = () => {
    if (isRequesting)
      return <><span className="android-btn-spinner" /><span>Finding location...</span></>;
    if (isPermanentlyDenied)
      return '⚙️ Open Settings';
    if (isServicesOff)
      return '📍 I turned on Location';
    if (locationPermStatus === 'denied')
      return '🔄 Retry Location';
    return 'Turn on location';
  };

  const handlePrimary = () => {
    if (isPermanentlyDenied && isNative) {
      // On native Capacitor, we can open the app settings screen
      try {
        if (window.Capacitor?.Plugins?.App?.openUrl) {
          window.Capacitor.Plugins.App.openUrl({ url: 'app-settings:' });
        }
      } catch {
        // Ignore — user sees instructions anyway
      }
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

        {/* Title */}
        <h2 id="loc-dialog-title" className="android-loc-title">
          {heading()}
        </h2>

        {/* Body */}
        {body()}

        {/* Setting rows — show only for the default "prompt" state */}
        {!isPermanentlyDenied && !isServicesOff && (
          <>
            <div className="android-loc-setting-row">
              <div className="android-loc-icon-wrapper" aria-hidden="true">
                <svg className="android-loc-svg-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              </div>
              <div className="android-loc-setting-text">
                <span className="android-loc-setting-name">Device location</span>
              </div>
            </div>

            <div className="android-loc-setting-row">
              <div className="android-loc-icon-wrapper" aria-hidden="true">
                <svg className="android-loc-svg-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
                </svg>
              </div>
              <div className="android-loc-setting-text">
                <p className="android-loc-setting-desc">
                  <strong>Location Accuracy</strong>, which provides more accurate
                  location for apps and services. To do this, Google periodically
                  processes information about device sensors and wireless signals
                  from your device to crowdsource wireless signal locations. These
                  are used without identifying you to improve location accuracy and
                  location-based services.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Inline error notice */}
        {locationError && !isPermanentlyDenied && !isServicesOff && (
          <div className="android-loc-error-banner" role="alert">
            <span className="android-loc-error-icon">⚠️</span>
            <div className="android-loc-error-text">
              {typeof locationError === 'string'
                ? locationError
                : locationError?.message || 'Unable to access device location.'}
            </div>
          </div>
        )}

        {/* Learn more / settings guide */}
        {!isPermanentlyDenied && !isServicesOff && (
          <>
            <p className="android-loc-footer-text">
              You can change this at any time in location settings.{' '}
              <button
                type="button"
                className="android-loc-link-btn"
                onClick={() => setShowGuide((v) => !v)}
              >
                {showGuide ? 'Hide guide' : 'Manage settings or learn more'}
              </button>
            </p>

            {showGuide && (
              <div className="android-loc-expandable-guide">
                {isNative ? (
                  <div className="android-loc-guide-section">
                    <strong>📱 Android Settings:</strong>
                    <ol>
                      <li>Go to <strong>Settings → Location</strong> and turn it ON.</li>
                      <li>Or swipe down the notification shade and tap the Location toggle.</li>
                      <li>For app permissions: <strong>Settings → Apps → Arrivo → Permissions → Location → Allow</strong>.</li>
                    </ol>
                  </div>
                ) : (
                  <div className="android-loc-guide-section">
                    <strong>🔒 Browser Site Permissions:</strong>
                    <ol>
                      <li>Tap the <strong>Lock icon 🔒</strong> in your browser address bar.</li>
                      <li>Tap <strong>Permissions</strong> or <strong>Site settings</strong>.</li>
                      <li>Set <strong>Location</strong> to <strong>Allow</strong>.</li>
                    </ol>
                  </div>
                )}

                {onEnterDestinationManually && (
                  <div style={{ marginTop: '0.6rem', textAlign: 'center' }}>
                    <button
                      type="button"
                      className="android-loc-manual-link"
                      onClick={onEnterDestinationManually}
                    >
                      ✏️ Enter destination manually or use simulator
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Fast mode pill */}
        {!isPermanentlyDenied && !isServicesOff && (
          <div className="android-loc-fast-pill">
            <span className="android-loc-fast-icon">⚡</span>
            <span>Fast Mode: Instant access via Wi-Fi, Mobile Network &amp; GPS</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="android-loc-actions">
          <button
            type="button"
            className="android-btn-no-thanks"
            onClick={onNoThanks}
            disabled={isRequesting}
          >
            {isPermanentlyDenied ? 'Close' : 'No, thanks'}
          </button>

          <button
            type="button"
            className="android-btn-turn-on"
            onClick={handlePrimary}
            disabled={isRequesting}
          >
            {primaryBtnLabel()}
          </button>
        </div>
      </div>
    </div>
  );
}
