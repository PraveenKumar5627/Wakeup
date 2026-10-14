import React, { useState, useEffect } from 'react';
import { Wifi } from 'lucide-react';

/**
 * Native-style phone status bar (matching the reference image 9:41, wifi, battery)
 */
export default function StatusBar({ theme = 'light' }) {
  const [timeStr, setTimeStr] = useState('9:41');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const mins = now.getMinutes().toString().padStart(2, '0');
      // 12-hour format or standard phone display
      hours = hours % 12 || 12;
      setTimeStr(`${hours}:${mins}`);
    };

    updateTime();
    const timer = setInterval(updateTime, 30000);
    return () => clearInterval(timer);
  }, []);

  const isDark = theme === 'dark';

  return (
    <div
      className={`phone-status-bar ${isDark ? 'status-dark' : 'status-light'}`}
      role="presentation"
      aria-hidden="true"
    >
      <div className="status-bar-time">{timeStr}</div>

      <div className="status-bar-icons">
        {/* Cellular bars */}
        <div className="cellular-signal" title="Signal Strength">
          <span className="signal-bar bar-1"></span>
          <span className="signal-bar bar-2"></span>
          <span className="signal-bar bar-3"></span>
          <span className="signal-bar bar-4"></span>
        </div>

        {/* Wifi */}
        <Wifi size={13} strokeWidth={2.6} className="wifi-icon" />

        {/* Battery */}
        <div className="battery-indicator" title="Battery: 96%">
          <div className="battery-shell">
            <div className="battery-level"></div>
          </div>
          <div className="battery-cap"></div>
        </div>
      </div>
    </div>
  );
}
