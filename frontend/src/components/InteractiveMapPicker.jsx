import React, { useEffect, useRef, useState } from 'react';

/**
 * Interactive Leaflet Map Picker
 * Allows users to tap/click anywhere on the map to drop a pin and set their destination
 * with zero external dependencies (uses OpenStreetMap tiles).
 */
export default function InteractiveMapPicker({
  destination,
  onConfirmLocation,
  onClose,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const initialLat = destination?.lat || 11.0512;
  const initialLng = destination?.lng || 77.0376;

  const [selectedCoords, setSelectedCoords] = useState({
    lat: initialLat,
    lng: initialLng,
    name: destination?.name || 'Selected Map Location',
  });

  useEffect(() => {
    if (!window.L || !mapContainerRef.current) return;

    // Initialize Leaflet map
    const map = window.L.map(mapContainerRef.current).setView(
      [initialLat, initialLng],
      14
    );
    mapInstanceRef.current = map;

    // Add OpenStreetMap tile layer
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    // Custom marker icon
    const marker = window.L.marker([initialLat, initialLng], {
      draggable: true,
    }).addTo(map);
    markerRef.current = marker;

    marker.bindPopup(`<b>${selectedCoords.name}</b><br>${initialLat.toFixed(4)}, ${initialLng.toFixed(4)}`).openPopup();

    // On map click -> move marker to clicked spot
    map.on('click', async (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      
      const newCoords = {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        name: `Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      };
      
      setSelectedCoords(newCoords);
      marker.setPopupContent(`<b>${newCoords.name}</b><br>${newCoords.lat}, ${newCoords.lng}`).openPopup();

      // Try reverse geocoding place name in background
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await res.json();
        if (data && data.display_name) {
          const shortName = data.display_name.split(',')[0];
          setSelectedCoords(prev => ({ ...prev, name: shortName }));
          marker.setPopupContent(`<b>${shortName}</b><br>${newCoords.lat}, ${newCoords.lng}`);
        }
      } catch (err) {
        // Ignore reverse geocode error
      }
    });

    // On marker drag end
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      setSelectedCoords(prev => ({
        ...prev,
        lat: Number(pos.lat.toFixed(6)),
        lng: Number(pos.lng.toFixed(6)),
      }));
    });

    // Invalidate size after modal render to prevent gray tiles
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
    };
  }, []);

  const handleConfirm = () => {
    onConfirmLocation(selectedCoords);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(11, 15, 25, 0.88)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          padding: '1.25rem',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
              📍 Tap Map to Set Destination
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Click or tap anywhere on the map to drop your destination stop pin
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.4rem',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Map Canvas */}
        <div
          ref={mapContainerRef}
          style={{
            width: '100%',
            height: '320px',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            border: '1px solid var(--border-subtle)',
          }}
        />

        {/* Selected Info & Confirm Button */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.8)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>
              {selectedCoords.name}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-blue)' }}>
              {selectedCoords.lat.toFixed(4)}°, {selectedCoords.lng.toFixed(4)}°
            </div>
          </div>
          <button
            type="button"
            className="preset-chip"
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              fontWeight: 800,
              padding: '0.6rem 1.1rem',
              fontSize: '0.9rem',
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
            }}
            onClick={handleConfirm}
          >
            ✅ Confirm Destination
          </button>
        </div>
      </div>
    </div>
  );
}
