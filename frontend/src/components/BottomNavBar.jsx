import React from 'react';
import { Home, Briefcase, Map, Settings } from 'lucide-react';

/**
 * Bottom Navigation Bar matching reference UI:
 * Tabs: Home, Trip, Map, Settings
 */
export default function BottomNavBar({
  activeTab = 'home',
  onTabChange,
  isTripActive = false,
}) {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'trips', label: 'Trip', icon: Briefcase, badge: isTripActive },
    { id: 'map', label: 'Map', icon: Map },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="bottom-nav-bar" aria-label="Bottom Navigation">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            id={`nav-tab-${tab.id}`}
            type="button"
            className={`nav-tab-item ${isActive ? 'nav-tab-active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            aria-selected={isActive}
            role="tab"
          >
            <div className="nav-icon-wrapper">
              <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
              {tab.badge && <span className="nav-pulse-badge" />}
            </div>
            <span className="nav-tab-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
