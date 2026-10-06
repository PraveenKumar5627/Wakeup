"""
Unit and integration tests for Travel Destination Alarm Backend API.
Tests the Haversine formula calculation, FastAPI endpoints, input validation, and alert logic.
"""

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
