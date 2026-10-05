import React, { useState } from 'react';

/**
 * LocationPermissionDialog
 *
 * Designed to resemble the native Android Location Accuracy prompt
 * ("To continue, your device will need to use Location Accuracy")
 * with "No, thanks" and "Turn on location" buttons.
 *
 * Compliant with web standards: does not claim a website can directly toggle
 * OS settings, but uses browser Geolocation API and guides the user when needed.
 */
export default function LocationPermissionDialog({
  isOpen,
  isRequesting = false,
  locationError = null,
  onTurnOnLocation,
  onNoThanks,
  onEnterDestinationManually,
}) {
  const [showSettingsHelp, setShowSettingsHelp] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      className="android-loc-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="android-loc-title"
    >
      <div className="android-loc-dialog-card">
        {/* Main Title matching Android system dialog */}
        <h2 id="android-loc-title" className="android-loc-title">
          To continue, your device will need to use Location Accuracy
        </h2>

        {/* Subtitle */}
        <p className="android-loc-subtitle">
          The following settings should be on:
        </p>

        {/* Setting 1: Device location */}
        <div className="android-loc-setting-row">
          <div className="android-loc-icon-wrapper" aria-hidden="true">
            <svg
              className="android-loc-svg-icon"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
          </div>
          <div className="android-loc-setting-text">
            <span className="android-loc-setting-name">Device location</span>
          </div>
        </div>

        {/* Setting 2: Location Accuracy with Google description */}
        <div className="android-loc-setting-row">
          <div className="android-loc-icon-wrapper" aria-hidden="true">
            <svg
              className="android-loc-svg-icon"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
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
              location-based services and to improve, provide and maintain
              Google's services based on Google's and third parties' legitimate
              interests to serve users' needs.
            </p>
          </div>
        </div>

        {/* Inline error notice if permission was denied or device location off */}
        {locationError && (
          <div className="android-loc-error-banner" role="alert">
            <span className="android-loc-error-icon">⚠️</span>
            <div className="android-loc-error-text">
              {typeof locationError === 'string'
                ? locationError
                : locationError.message || 'Unable to access device location.'}
            </div>
          </div>
        )}

        {/* Footer info link */}
        <p className="android-loc-footer-text">
          You can change this at any time in location settings.{' '}
          <button
            type="button"
            className="android-loc-link-btn"
            onClick={() => setShowSettingsHelp((prev) => !prev)}
          >
            {showSettingsHelp ? 'Hide guide' : 'Manage settings or learn more'}
          </button>
        </p>

        {/* Expandable settings guide */}
        {showSettingsHelp && (
          <div className="android-loc-expandable-guide">
            <div className="android-loc-guide-section">
              <strong>📱 Android Device Settings:</strong>
              <ol>
                <li>Swipe down from the top of your screen to open Quick Settings.</li>
                <li>Tap the <strong>Location</strong> icon to turn it ON.</li>
                <li>
                  Go to <strong>Settings → Location → Location Services → Google Location Accuracy</strong> and toggle it ON.
                </li>
              </ol>
            </div>
            <div className="android-loc-guide-section">
              <strong>🔒 Browser Site Permissions:</strong>
              <ol>
                <li>Tap the <strong>Lock icon (🔒)</strong> in your browser address bar.</li>
                <li>Tap <strong>Permissions</strong> or <strong>Site settings</strong>.</li>
                <li>Set <strong>Location</strong> to <strong>Allow</strong>.</li>
              </ol>
            </div>
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

        {/* Fast connection speed guarantee */}
        <div className="android-loc-fast-pill">
          <span className="android-loc-fast-icon">⚡</span>
          <span>Fast Mode: Instant access via Wi-Fi, Mobile Network & GPS</span>
        </div>

        {/* Bottom Actions: No, thanks & Turn on location */}
        <div className="android-loc-actions">
          <button
            type="button"
            className="android-btn-no-thanks"
            onClick={onNoThanks}
            disabled={isRequesting}
          >
            No, thanks
          </button>

          <button
            type="button"
            className="android-btn-turn-on"
            onClick={onTurnOnLocation}
            disabled={isRequesting}
          >
            {isRequesting ? (
              <>
                <span className="android-btn-spinner" />
                <span>Finding location...</span>
              </>
            ) : (
              'Turn on location'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
