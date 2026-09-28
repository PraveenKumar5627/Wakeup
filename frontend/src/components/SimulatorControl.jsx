import React from 'react';

export default function SimulatorControl({
  isTripActive,
  onSimulateStep,
  onTriggerAlarmDirectly,
  onResetSimulation,
  isSimulating,
}) {
  return (
    <div className="simulator-box">
      <div className="simulator-header">
        <span>🧪 Developer & Desktop Test Simulator</span>
        {isSimulating && (
          <span style={{ color: 'var(--accent-emerald)', fontSize: '0.72rem' }}>
            ● Simulation Mode
          </span>
        )}
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
        No need to ride a real bus to test! Use these controls to simulate your vehicle approaching the destination:
      </p>
      <div className="simulator-buttons">
        <button
          type="button"
          className="sim-btn"
          onClick={onSimulateStep}
          disabled={!isTripActive}
          title="Move vehicle 2 km closer to the destination"
        >
          ⏩ Move Bus Closer (-2 km)
        </button>

        <button
          type="button"
          className="sim-btn"
          style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#fca5a5' }}
          onClick={onTriggerAlarmDirectly}
          title="Directly trigger alarm sound and popup to test audio & visuals"
        >
          🔔 Instant Alarm Test
        </button>

        {isSimulating && (
          <button
            type="button"
            className="sim-btn"
            style={{ borderColor: 'rgba(148, 163, 184, 0.4)', color: 'var(--text-muted)' }}
            onClick={onResetSimulation}
          >
            🔄 Reset
          </button>
        )}
      </div>
    </div>
  );
}
