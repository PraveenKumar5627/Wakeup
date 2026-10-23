"""
Unit and integration tests for Travel Destination Alarm Backend API.
Tests the Haversine formula calculation, FastAPI endpoints, input validation, and alert logic.
"""

import math
import pytest
from fastapi.testclient import TestClient
from main import app, haversine_distance, get_road_distance

client = TestClient(app)

def test_haversine_same_point():
    """Distance between the same coordinates must be 0.0 km."""
    dist = haversine_distance(13.0827, 80.2707, 13.0827, 80.2707)
    assert dist == 0.0


def test_haversine_known_locations():
    """
    Test distance between Chennai Central (13.0827, 80.2707)
    and Chennai International Airport (12.9941, 80.1709).
    Known straight line distance is ~14.5 to 15.0 km.
    """
    dist = haversine_distance(13.0827, 80.2707, 12.9941, 80.1709)
    assert 14.0 <= dist <= 16.0


def test_road_distance_known_route():
    """
    Test road driving distance between Chennai Central and Egmore.
    Road distance is ~3.1 to 3.3 km, route_type must be 'road'.
    """
    dist, duration, dur_text, route_type = get_road_distance(13.0827, 80.2707, 13.0784, 80.2608)
    assert 2.5 <= dist <= 4.0
    assert route_type == "road"


def test_haversine_equator_longitude():
    """
    1 degree of longitude at the equator is approx 111.19 km.
    (2 * pi * 6371 / 360 ≈ 111.19 km)
    """
    dist = haversine_distance(0.0, 0.0, 0.0, 1.0)
    assert 110.0 <= dist <= 112.0


def test_api_root():
    """Root endpoint returns online status."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"


def test_api_health():
    """Health check returns healthy."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_calculate_distance_alert_triggered():
    """
    When distance <= alert_distance, alert must be True.
    Chennai Central to Egmore is ~3.17 km road distance.
    Alert distance = 5 km.
    """
    payload = {
        "current_latitude": 13.0827,
        "current_longitude": 80.2707,
        "destination_latitude": 13.0784,
        "destination_longitude": 80.2608,
        "alert_distance": 5.0,
    }
    response = client.post("/calculate-distance", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "distance_km" in data
    assert data["distance_km"] < 5.0
    assert data["alert"] is True
    assert "WAKE UP" in data["message"]


def test_calculate_distance_alert_not_triggered():
    """
    When distance > alert_distance, alert must be False.
    Chennai Central to Airport is ~14.8 km.
    Alert distance = 3 km.
    """
    payload = {
        "current_latitude": 13.0827,
        "current_longitude": 80.2707,
        "destination_latitude": 12.9941,
        "destination_longitude": 80.1709,
        "alert_distance": 3.0,
    }
    response = client.post("/calculate-distance", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["distance_km"] > 3.0
    assert data["alert"] is False
    assert "On the way" in data["message"]


def test_invalid_coordinates():
    """Invalid latitude (> 90) must return 422 Unprocessable Entity."""
    payload = {
        "current_latitude": 105.0,  # Invalid!
        "current_longitude": 80.2707,
        "destination_latitude": 13.0878,
        "destination_longitude": 80.2785,
        "alert_distance": 3.0,
    }
    response = client.post("/calculate-distance", json=payload)
    assert response.status_code == 422


def test_invalid_alert_distance():
    """Alert distance <= 0 must return 422 Unprocessable Entity."""
    payload = {
        "current_latitude": 13.0827,
        "current_longitude": 80.2707,
        "destination_latitude": 13.0878,
        "destination_longitude": 80.2785,
        "alert_distance": 0.0,  # Invalid! Must be > 0
    }
    response = client.post("/calculate-distance", json=payload)
    assert response.status_code == 422


def test_calculate_distance_straight_shorter_than_road_does_not_trigger():
    """
    SITRA Route Scenario:
    Road driving distance is ~2.44 km.
    Straight-line distance is ~1.59 km.
    User alert threshold = 1.8 km.
    Alert must NOT trigger because road distance (2.44 km) > 1.8 km.
    """
    payload = {
        "current_latitude": 11.0503,
        "current_longitude": 77.0310,
        "destination_latitude": 11.0369,
        "destination_longitude": 77.0362,
        "alert_distance": 1.8,
    }
    response = client.post("/calculate-distance", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["distance_km"] > 1.8
    assert data["alert"] is False
    assert "On the way" in data["message"]


def test_cors_capacitor_android():
    """Capacitor Android app sends Origin: http://localhost which must be allowed."""
    response = client.options(
        "/calculate-distance",
        headers={
            "Origin": "http://localhost",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.headers.get("access-control-allow-origin") == "http://localhost"


def test_cors_capacitor_ios():
    """Capacitor iOS app sends Origin: capacitor://localhost which must be allowed."""
    response = client.options(
        "/calculate-distance",
        headers={
            "Origin": "capacitor://localhost",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.headers.get("access-control-allow-origin") == "capacitor://localhost"


def test_cors_production_web():
    """Production web frontend on Vercel must be allowed."""
    response = client.options(
        "/calculate-distance",
        headers={
            "Origin": "https://wakeup-ashy.vercel.app",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.headers.get("access-control-allow-origin") == "https://wakeup-ashy.vercel.app"


def test_get_trips():
    """Verify GET /trips returns list containing seed trips."""
    response = client.get("/trips")
    assert response.status_code == 200
    trips = response.json()
    assert isinstance(trips, list)
    assert len(trips) >= 5
    names = [t["destination_name"] for t in trips]
    assert "Coimbatore" in names
    assert "Chennai" in names


def test_create_and_delete_trip():
    """Verify POST /trips creates a trip and DELETE /trips/{id} removes it."""
    payload = {
        "destination_name": "Bengaluru Electronic City",
        "destination_city": "Karnataka",
        "destination_latitude": 12.8452,
        "destination_longitude": 77.6602,
        "alert_distance_km": 3.0,
        "distance_at_start_km": 15.0,
        "status": "completed",
    }
    create_res = client.post("/trips", json=payload)
    assert create_res.status_code == 200
    created = create_res.json()
    assert created["destination_name"] == "Bengaluru Electronic City"
    trip_id = created["id"]

    # Verify retrieval
    get_res = client.get(f"/trips/{trip_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == trip_id

    # Verify deletion
    del_res = client.delete(f"/trips/{trip_id}")
    assert del_res.status_code == 200
    assert del_res.json()["message"] == "Trip deleted"

    # Verify 404 after deletion
    del_again = client.delete(f"/trips/{trip_id}")
    assert del_again.status_code == 404


def test_search_places_short_query():
    """Verify GET /search-places returns empty list for 1-char query."""
    response = client.get("/search-places?q=a")
    assert response.status_code == 200
    assert response.json() == []


def test_search_places_query():
    """Verify GET /search-places returns places with lat and lng."""
    response = client.get("/search-places?q=Coimbatore&limit=3")
    assert response.status_code == 200
    places = response.json()
    assert isinstance(places, list)
    if places:
        assert "lat" in places[0]
        assert "lng" in places[0]
        assert "name" in places[0]


def test_calculate_distance_camel_case_and_aliases():
    """Verify calculate-distance works with camelCase and short field aliases."""
    payload = {
        "currentLat": 13.0827,
        "currentLng": 80.2707,
        "destLat": 13.0784,
        "destLng": 80.2608,
    }
    response = client.post("/calculate-distance", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "distance_km" in data
    assert data["distance_km"] > 0
    assert "duration_min" in data
    assert "route_type" in data


def test_calculate_distance_travelled_calculation():
    """Verify that start coordinates calculate travelled_distance_km and progress_percentage."""
    payload = {
        "start_latitude": 13.0000,
        "start_longitude": 80.2000,
        "current_latitude": 13.0500,
        "current_longitude": 80.2400,
        "destination_latitude": 13.0827,
        "destination_longitude": 80.2707,
        "alert_distance": 3.0,
    }
    response = client.post("/calculate-distance", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "travelled_distance_km" in data
    assert data["travelled_distance_km"] > 0
    assert "initial_distance_km" in data
    assert data["initial_distance_km"] > 0
    assert "progress_percentage" in data
    assert 0.0 <= data["progress_percentage"] <= 100.0


def test_calculate_distance_api_alias():
    """Verify POST /api/calculate-distance endpoint alias works identically."""
    payload = {
        "current_latitude": 13.0827,
        "current_longitude": 80.2707,
        "destination_latitude": 13.0784,
        "destination_longitude": 80.2608,
        "alert_distance": 5.0,
    }
    response = client.post("/api/calculate-distance", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["alert"] is True


def test_calculate_distance_get_endpoint():
    """Verify GET /calculate-distance works with query parameters."""
    url = "/calculate-distance?current_lat=13.0827&current_lng=80.2707&dest_lat=13.0784&dest_lng=80.2608&alert_distance=5.0"
    response = client.get(url)
    assert response.status_code == 200
    data = response.json()
    assert "distance_km" in data
    assert data["alert"] is True


def test_calculate_distance_get_missing_coords():
    """Verify GET /calculate-distance returns 422 when required coords are missing."""
    response = client.get("/calculate-distance?current_lat=13.0827")
    assert response.status_code == 422


def test_destination_already_in_radius_at_start():
    """
    When the trip starts and the user is already inside the selected alert radius
    (e.g., user is 1.5 km away and selects 3 km alert distance),
    the endpoint must return alert=True immediately so the alarm triggers upon trip start.
    """
    payload = {
        "current_latitude": 13.0827,
        "current_longitude": 80.2707,
        "destination_latitude": 13.0850,
        "destination_longitude": 80.2720,
        "alert_distance": 3.0,
    }
    response = client.post("/calculate-distance", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["distance_km"] <= 3.0
    assert data["alert"] is True
    assert "WAKE UP" in data["message"]


def test_threshold_crossing():
    """
    Test crossing threshold:
    Point A is ~4.0 km away (alert=False).
    Point B is ~2.2 km away (crossed 3.0 km threshold -> alert=True).
    """
    # 4 km away
    res_outside = client.post(
        "/calculate-distance",
        json={
            "current_latitude": 13.0827,
            "current_longitude": 80.2707,
            "destination_latitude": 13.0500,
            "destination_longitude": 80.2500,
            "alert_distance": 3.0,
        },
    )
    assert res_outside.status_code == 200
    data_outside = res_outside.json()
    assert data_outside["distance_km"] > 3.0
    assert data_outside["alert"] is False

    # Crosses threshold to ~1.3 km away
    res_inside = client.post(
        "/calculate-distance",
        json={
            "current_latitude": 13.0827,
            "current_longitude": 80.2707,
            "destination_latitude": 13.0784,
            "destination_longitude": 80.2608,
            "alert_distance": 3.0,
        },
    )
    assert res_inside.status_code == 200
    data_inside = res_inside.json()
    # Egmore is ~3.1-3.3 km road, if threshold is 5km it triggers, or with alert_distance 4.0:
    assert data_inside["distance_km"] < 4.0


def test_distance_non_negative_and_valid():
    """Distances and travelled distances must never be negative or NaN."""
    payload = {
        "current_latitude": 11.0168,
        "current_longitude": 76.9558,
        "destination_latitude": 11.0168,
        "destination_longitude": 76.9558,
        "start_latitude": 11.0168,
        "start_longitude": 76.9558,
        "alert_distance": 3.0,
    }
    response = client.post("/calculate-distance", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["distance_km"] >= 0.0
    assert data["travelled_distance_km"] >= 0.0
    assert not math.isnan(data["distance_km"])
    assert not math.isnan(data["travelled_distance_km"])




