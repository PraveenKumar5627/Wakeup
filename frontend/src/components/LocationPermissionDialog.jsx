import React, { useState } from 'react';

/**
 * LocationPermissionDialog
 *
 * User-friendly dialog explaining location access requirements, handling
 * permission rejection, device location settings (Android Location Accuracy),
 * and browser permissions without repeated prompts.
 */
export default function LocationPermissionDialog({
  isOpen,
  status, // 'denied' | 'unavailable' | 'cancelled' | 'requesting'
  errorCode, // 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | null
  errorMessage,
  onTryAgain,
  onEnterDestinationManually,
  onCancel,
}) {
  const [activeTab, setActiveTab] = useState(
    errorCode === 'PERMISSION_DENIED' ? 'browser' : 'android'
  );

  if (!isOpen) return null;

  return (
    <div className="location-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="loc-dialog-title">
      <div className="location-dialog-card">
        {/* Header with Location Icon */}
        <div className="location-dialog-header">
          <div className="location-dialog-icon-wrapper">
            <span className="location-dialog-icon">📍</span>
            <span className="location-dialog-pulse" />
          </div>
          <div>
            <h2 id="loc-dialog-title" className="location-dialog-title">
              Location Access Required
            </h2>
            <span className="location-status-pill">
              {errorCode === 'PERMISSION_DENIED' && '🔒 Browser Permission Blocked'}
              {errorCode === 'POSITION_UNAVAILABLE' && '📱 Device Location / Accuracy Off'}
              {errorCode === 'TIMEOUT' && '⏱️ GPS Connection Timed Out'}
              {!errorCode && '⚠️ Location Unavailable'}
            </span>
          </div>
        </div>

        {/* Primary Required Explanation */}
        <p className="location-dialog-primary-msg">
          Location access is required to start your trip and calculate the distance to your destination.
          Please enable location services and allow location access in your browser settings.
        </p>

        {/* Dynamic Context Notice */}
        {errorMessage && (
          <div className="location-dialog-error-hint">
            <span className="hint-icon">ℹ️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Settings Help Tabs */}
        <div className="location-help-container">
          <div className="location-help-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'android'}
              className={`location-tab-btn ${activeTab === 'android' ? 'active' : ''}`}
              onClick={() => setActiveTab('android')}
            >
              📱 Android / Device Settings
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'browser'}
              className={`location-tab-btn ${activeTab === 'browser' ? 'active' : ''}`}
              onClick={() => setActiveTab('browser')}
            >
              🔒 Browser Site Permissions
            </button>
          </div>

          <div className="location-help-content">
            {activeTab === 'android' ? (
              <div className="help-step-list">
                <div className="android-notice-callout">
                  <strong>ℹ️ Android System Notice:</strong>
                  <p>
                    The <em>"Location Accuracy"</em> dialog is managed directly by Android and Google Play Services.
                    Websites cannot turn on device location automatically.
                  </p>
                </div>
                <ol className="steps-ordered">
                  <li>
                    <strong>Turn on Device Location:</strong> Swipe down from the top of your phone screen to open Quick Settings, then tap the <strong>Location</strong> icon to turn it ON.
                  </li>
                  <li>
                    <strong>Enable Google Location Accuracy:</strong> Go to phone <strong>Settings → Location → Location Services → Google Location Accuracy</strong> and toggle it <strong>ON</strong>.
                  </li>
                  <li>
                    When the Android dialog appears, tap <strong>"Turn on"</strong> instead of <em>"No, thanks"</em>.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="help-step-list">
                <ol className="steps-ordered">
                  <li>
                    Tap the <strong>🔒 Lock icon</strong> (or tune settings icon) on the left side of your browser address bar.
                  </li>
                  <li>
                    Tap <strong>Permissions</strong> or <strong>Site settings</strong>.
                  </li>
                  <li>
                    Find <strong>Location</strong> and change it to <strong>Allow</strong>.
                  </li>
                  <li>
                    Return to this page and tap <strong>Try Again</strong> below.
                  </li>
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="location-dialog-actions">
          <button
            type="button"
            className="btn-dialog-retry"
            onClick={onTryAgain}
            title="Retry detecting location"
          >
            <span>🔄</span>
            <span>Try Again</span>
          </button>

          <button
            type="button"
            className="btn-dialog-manual"
            onClick={onEnterDestinationManually}
            title="Select or edit destination manually / use simulator"
          >
            <span>✏️</span>
            <span>Enter Destination Manually</span>
          </button>

          <button
            type="button"
            className="btn-dialog-cancel"
            onClick={onCancel}
            title="Cancel and close this dialog"
          >
            <span>✕ Cancel</span>
          </button>
        </div>
      </div>
    </div>
  );
}
