import React, { useState } from 'react';
import StatusBar from '../components/StatusBar';
import BottomNavBar from '../components/BottomNavBar';
import {
  ArrowLeft,
  MapPin,
  ChevronRight,
  Search,
  Trash2,
  Calendar,
  Bell,
  Plus,
} from 'lucide-react';

export default function PastTripsScreen({
  trips = [],
  onBack,
  onSelectTrip,
  onDeleteTrip,
  onStartNewTrip,
  onTabChange,
  isTripActive = false,
  showBottomNav = true,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tripToDelete, setTripToDelete] = useState(null);

  const filteredTrips = trips.filter((t) => {
    const q = searchQuery.toLowerCase();
    return (
      t.destination_name.toLowerCase().includes(q) ||
      (t.destination_city && t.destination_city.toLowerCase().includes(q)) ||
      (t.created_at && t.created_at.toLowerCase().includes(q))
    );
  });

  return (
    <div className="screen-container screen-past-trips">
      <StatusBar theme="light" />

      {/* Top Header */}
      <header className="screen-header">
        {onBack && (
          <button
            type="button"
            className="header-back-btn"
            onClick={onBack}
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <h2 className="header-title">Past Trips</h2>
      </header>

      {/* Search Filter */}
      <div className="past-trips-search-bar">
        <Search size={18} className="text-slate-400 mr-2" />
        <input
          id="input-filter-trips"
          type="text"
          placeholder="Filter past journeys..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="past-trips-input"
        />
      </div>

      {/* Trips List */}
      <main className="past-trips-list-container">
        {filteredTrips.length === 0 ? (
          <div className="empty-trips-card">
            <div className="empty-icon-circle">
              <Calendar size={32} className="text-slate-400" />
            </div>
            <h3 className="empty-title">No Trips Found</h3>
            <p className="empty-desc">
              {searchQuery
                ? 'No past trips matched your search filter.'
                : 'You have not recorded any travel alarm journeys yet.'}
            </p>
            <button
              type="button"
              className="btn-primary-blue mt-4"
              onClick={onStartNewTrip}
            >
              <Plus size={16} className="mr-1 inline" /> Set Destination
            </button>
          </div>
        ) : (
          <div className="past-trips-card-stack">
            {filteredTrips.map((trip) => (
              <div
                key={trip.id}
                className="past-trip-card"
                onClick={() => onSelectTrip(trip)}
                role="button"
                tabIndex={0}
              >
                <div className="past-trip-left">
                  <div className="past-trip-pin-icon">
                    <MapPin size={20} className="text-blue-600" />
                  </div>
                  <div className="past-trip-details">
                    <h3 className="past-trip-title">{trip.destination_name}</h3>
                    <p className="past-trip-date">
                      {trip.created_at || trip.start_time || '10 Oct 2025, 10:15 AM'}
                    </p>
                    <div className="past-trip-alarm-tag">
                      <Bell size={12} className="text-amber-500 mr-1" />
                      <span>Alarm: {trip.alert_distance_km || 3} km</span>
                    </div>
                  </div>
                </div>

                <div className="past-trip-right">
                  <button
                    type="button"
                    className="trip-delete-btn"
                    title="Delete trip"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTripToDelete(trip);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                  <ChevronRight size={20} className="text-slate-400 ml-1" />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {tripToDelete && (
        <div className="modal-overlay">
          <div className="modal-dialog-card">
            <h3 className="modal-title">Delete Trip Record?</h3>
            <p className="modal-desc">
              Are you sure you want to remove the trip record for{' '}
              <strong>{tripToDelete.destination_name}</strong>?
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary-plain"
                onClick={() => setTripToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger-confirm"
                onClick={() => {
                  onDeleteTrip(tripToDelete.id);
                  setTripToDelete(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showBottomNav && (
        <BottomNavBar
          activeTab="trips"
          onTabChange={onTabChange}
          isTripActive={isTripActive}
        />
      )}
    </div>
  );
}
