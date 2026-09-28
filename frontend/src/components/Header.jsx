import React from 'react';

export default function Header({ isBackendOnline }) {
  return (
    <header className="app-header">
      <div className="logo-row">
        <span className="bus-icon">🚌</span>
        <span className="brand-title">Smart Transit Wakeup</span>
      </div>
      <h1 className="main-heading">Travel Destination Alarm</h1>
      <p className="sub-heading">
        Sleep peacefully on your bus journey — we'll wake you up before your stop
      </p>
      <div style={{ marginTop: '0.6rem' }}>
        <span
          className="status-badge"
          style={{
            background: isBackendOnline
              ? 'rgba(16, 185, 129, 0.12)'
              : 'rgba(239, 68, 68, 0.12)',
            color: isBackendOnline ? '#34d399' : '#f87171',
            border: `1px solid ${isBackendOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            fontSize: '0.72rem',
          }}
        >
          <span className="pulse-dot" style={{ backgroundColor: isBackendOnline ? '#10b981' : '#ef4444' }} />
          {isBackendOnline ? 'Backend API Connected' : 'Connecting to FastAPI...'}
        </span>
      </div>
    </header>
  );
}
