import React from 'react';
import StatusBar from '../components/StatusBar';
import BottomNavBar from '../components/BottomNavBar';
import { Settings, MapPin, Bell, ChevronRight, Navigation, Compass } from 'lucide-react';

export default function HomeScreen({
  userName = 'Praveen',
  recentTrips = [],
  onSetDestination,
  onSelectRecentTrip,
  onViewAllTrips,
  onOpenSettings,
  onTabChange,
  isTripActive = false,
  activeDestination = null,
  remainingDistance = null,
  onResumeTrip,
}) {
  // Determine smart time-of-day greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning,';
    if (hour < 17) return 'Good Afternoon,';
    return 'Good Evening,';
  };

  // Limit recent trips display to top 3 or 4 for dashboard
  const displayTrips = recentTrips && recentTrips.length > 0
    ? recentTrips.slice(0, 4)
    : [
        {
          id: 'def-1',
          destination_name: 'Coimbatore',
          created_at: 'Today, 10:15 AM',
          alert_distance_km: 3,
        },
        {
          id: 'def-2',
          destination_name: 'Chennai',
          created_at: 'Yesterday, 6:45 PM',
          alert_distance_km: 2,
        },
        {
          id: 'def-3',
          destination_name: 'Madurai',
          created_at: '12 Oct 2025, 2:30 PM',
          alert_distance_km: 3,
        },
      ];

  return (
    <div className="screen-container screen-home">
      <StatusBar theme="light" />

      {/* Top Header */}
      <header className="home-top-header">
        <h1 className="home-brand-title">Travel Destination Alarm...</h1>
        <button
          type="button"
          className="header-icon-btn"
          onClick={onOpenSettings}
          title="App Settings"
          aria-label="Settings"
        >
          <Settings size={20} className="text-slate-700" />
        </button>
      </header>

      {/* Main Scrollable Content */}
      <main className="home-content">
        {/* User Greeting */}
        <section className="home-greeting-section">
          <h2 className="greeting-heading">
            {getGreeting()}
            <br />
            <span className="greeting-name">{userName}!</span>
          </h2>
          <p className="greeting-sub">Plan your trip, stay on track.</p>
        </section>

        {/* Active Trip Banner if running */}
        {isTripActive && activeDestination && (
          <section className="active-trip-banner" onClick={onResumeTrip}>
            <div className="active-trip-pulse">
              <Navigation size={18} className="animate-spin-slow text-emerald-400" />
            </div>
            <div className="active-trip-info">
              <span className="active-badge">ACTIVE TRIP</span>
              <h4 className="active-dest-name">{activeDestination.name}</h4>
              <p className="active-dist-sub">
                {remainingDistance !== null
                  ? `${remainingDistance} km remaining`
                  : 'Tracking live GPS location...'}
              </p>
            </div>
            <button type="button" className="active-resume-btn">
              Resume
            </button>
          </section>
        )}

        {/* Hero Card: Set Destination (Vibrant Royal Blue) */}
        <section
          id="btn-set-destination"
          className="hero-destination-card"
          onClick={onSetDestination}
          role="button"
          tabIndex={0}
        >
          <div className="hero-card-left">
            <div className="hero-pin-circle">
              <MapPin size={24} className="hero-pin-icon" strokeWidth={2.4} />
            </div>
            <div className="hero-text-content">
              <h3 className="hero-title">Set Destination</h3>
              <p className="hero-subtitle">Choose from map or search</p>
            </div>
          </div>
          <ChevronRight size={22} className="hero-arrow-icon" />
        </section>

        {/* Recent Trips Section */}
        <section className="recent-trips-section">
          <div className="section-header-row">
            <h3 className="section-title">Recent Trips</h3>
            <button
              type="button"
              className="section-link-btn"
              onClick={onViewAllTrips}
            >
              View All
            </button>
          </div>

          <div className="recent-trips-list">
            {displayTrips.map((trip) => (
              <div
                key={trip.id}
                className="recent-trip-card"
                onClick={() => onSelectRecentTrip(trip)}
                role="button"
                tabIndex={0}
              >
                <div className="recent-trip-left">
                  <div className="recent-trip-pin">
                    <MapPin size={18} className="text-blue-600" />
                  </div>
                  <div className="recent-trip-info">
                    <h4 className="recent-trip-dest">{trip.destination_name}</h4>
                    <p className="recent-trip-time">
                      {trip.created_at || trip.start_time || 'Recent'}
                    </p>
                  </div>
                </div>
                <div className="recent-trip-bell" title={`Alarm set for ${trip.alert_distance_km} km`}>
                  <Bell size={18} className="bell-icon-amber" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Bottom Navigation Bar */}
      <BottomNavBar
        activeTab="home"
        onTabChange={onTabChange}
        isTripActive={isTripActive}
      />
    </div>
  );
}
