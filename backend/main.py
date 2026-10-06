"""
Travel Destination Alarm - Backend API
FastAPI backend that calculates the straight-line distance between the user's
current GPS location and their destination using the Haversine formula, and
determines if the user has reached their chosen alert distance threshold.
"""

import json
import logging
import math
import time
from typing import Optional, Tuple
import urllib.request
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# -----------------------------------------------------------------------------
# 1. Initialize FastAPI Application
# -----------------------------------------------------------------------------
app = FastAPI(
    title="Travel Destination Alarm API",
    description="Calculates distance between current GPS position and destination using the Haversine formula.",
    version="1.0.0",
)

# -----------------------------------------------------------------------------
# 2. Configure CORS (Cross-Origin Resource Sharing)
#    Allows the React frontend running on localhost:5173 (or any port) to call
#    this backend API without browser security blockage.
# -----------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://wakeup-ashy.vercel.app",   # Vercel production
        "http://localhost:5173",             # Vite local dev
        "http://localhost:3000",             # Alt local dev port
        "http://127.0.0.1:8000",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# 3. Pydantic Models for Request and Response Validation
# -----------------------------------------------------------------------------
class DistanceRequest(BaseModel):
    """
    Input schema sent from the React frontend.
    Validates that latitude is between -90 and 90,
    longitude is between -180 and 180, and alert distance is positive.
    """
    current_latitude: float = Field(
        ..., ge=-90.0, le=90.0, description="Current latitude of the user in degrees"
    )
    current_longitude: float = Field(
        ..., ge=-180.0, le=180.0, description="Current longitude of the user in degrees"
    )
    destination_latitude: float = Field(
        ..., ge=-90.0, le=90.0, description="Destination latitude in degrees"
    )
    destination_longitude: float = Field(
        ..., ge=-180.0, le=180.0, description="Destination longitude in degrees"
    )
    alert_distance: float = Field(
        ..., gt=0.0, description="Alert trigger distance in kilometers (e.g., 1, 2, 3, 5)"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "current_latitude": 13.0827,
                "current_longitude": 80.2707,
                "destination_latitude": 13.0878,
                "destination_longitude": 80.2785,
                "alert_distance": 3.0,
            }
        }
    }


class DistanceResponse(BaseModel):
    """
    Output schema returned to the React frontend.
    """
    distance_km: float = Field(..., description="Calculated road or straight-line distance in kilometers")
    alert: bool = Field(..., description="True if distance_km <= alert_distance, otherwise False")
    message: str = Field(..., description="Human-readable description of current trip status")
    route_type: str = Field(default="road", description="'road' for driving distance, 'straight_line' for fallback")
    duration_min: Optional[float] = Field(default=None, description="Estimated driving time in minutes")
    duration_text: Optional[str] = Field(default=None, description="Formatted driving time (e.g. '5 hr 1 min')")
    straight_line_km: Optional[float] = Field(default=None, description="Straight-line spherical distance for comparison")


# -----------------------------------------------------------------------------
# 4. Haversine Distance Calculation Formula (Spherical Fallback)
# -----------------------------------------------------------------------------
def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points on the Earth's surface
    using the Haversine formula.

    Earth radius (R) = 6371.0 km

    Formula:
      a = sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)
      c = 2 * atan2(√a, √(1−a))
      d = R * c

    Note: Computes straight-line spherical distance ("as the crow flies").
    """
    EARTH_RADIUS_KM = 6371.0

    # Convert decimal degrees to radians
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    # Haversine central angle calculation
    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2)
    )

    # Handle potential floating point imprecision edge case where a > 1.0
    a = min(1.0, max(0.0, a))

    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    distance = EARTH_RADIUS_KM * c

    return round(distance, 2)


# -----------------------------------------------------------------------------
# 5. Road Driving Distance Calculation (OSRM - Matches Google Maps Driving Route)
# -----------------------------------------------------------------------------
_ROUTING_CACHE = {}
_CACHE_TTL_SECONDS = 30.0


def format_duration(duration_minutes: float) -> str:
    """Format minutes into human-readable duration (e.g. '5 hr 1 min' or '45 min')."""
    total_mins = int(round(duration_minutes))
    if total_mins < 60:
        return f"{total_mins} min"
    hours = total_mins // 60
    mins = total_mins % 60
    if mins == 0:
        return f"{hours} hr"
    return f"{hours} hr {mins} min"


def get_road_distance(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> Tuple[float, Optional[float], Optional[str], str]:
    """
    Calculate actual driving/road distance between two points using
    the OpenStreetMap OSRM routing engine (matches Google Maps driving route).
    Falls back gracefully to straight-line Haversine distance if the routing
    engine is unreachable or if no road connects the points.

    Returns:
        (distance_km, duration_min, duration_text, route_type)
        where route_type is 'road' or 'straight_line'
    """
    # If points are virtually identical (< 10 meters apart), return 0.0
    if abs(lat1 - lat2) < 0.0001 and abs(lon1 - lon2) < 0.0001:
        return 0.0, 0.0, "0 min", "road"

    # Cache lookup by rounded coordinates (~100m precision)
    cache_key = (round(lat1, 3), round(lon1, 3), round(lat2, 3), round(lon2, 3))
    now = time.time()
    if cache_key in _ROUTING_CACHE:
        cached_time, cached_dist, cached_dur, cached_text = _ROUTING_CACHE[cache_key]
        if now - cached_time < _CACHE_TTL_SECONDS:
            return cached_dist, cached_dur, cached_text, "road"

    # Try OSRM driving route API
    # Format: lon,lat;lon,lat
    url = (
        f"https://router.project-osrm.org/route/v1/driving/"
        f"{lon1:.6f},{lat1:.6f};{lon2:.6f},{lat2:.6f}"
        f"?overview=false"
    )

    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "TravelDestinationAlarm/2.0 (FastAPI Backend; GPS Navigation)",
                "Accept": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=4.0) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("code") == "Ok" and data.get("routes"):
                    primary_route = data["routes"][0]
                    distance_meters = float(primary_route["distance"])
                    duration_seconds = float(primary_route.get("duration", 0.0))

                    distance_km = round(distance_meters / 1000.0, 2)
                    duration_min = round(duration_seconds / 60.0, 1)
                    duration_text = format_duration(duration_min)

                    # Store in cache
                    _ROUTING_CACHE[cache_key] = (now, distance_km, duration_min, duration_text)
                    return distance_km, duration_min, duration_text, "road"
    except Exception as exc:
        logging.warning("OSRM road routing unavailable, falling back to Haversine: %s", exc)

    # Fallback to straight-line spherical distance
    straight_dist = haversine_distance(lat1, lon1, lat2, lon2)
    return straight_dist, None, None, "straight_line"


# -----------------------------------------------------------------------------
# 6. API Endpoints
# -----------------------------------------------------------------------------
@app.get("/")
def read_root():
    """
    Root endpoint to confirm the Travel Alarm backend is running.
    """
    return {
        "service": "Travel Destination Alarm Backend",
        "status": "online",
        "endpoints": {
            "calculate_distance": "POST /calculate-distance",
            "health": "GET /health",
            "docs": "/docs",
        },
    }


@app.get("/health")
def health_check():
    """
    Health check endpoint for monitoring service status.
    """
    return {"status": "healthy"}


@app.post("/calculate-distance", response_model=DistanceResponse)
def calculate_distance(payload: DistanceRequest):
    """
    Main endpoint called by the React frontend while a trip is active.
    Receives current GPS coordinates, destination coordinates, and alert distance.
    Calculates actual road driving distance (matching Google Maps) and checks
    if an alert should trigger.
    """
    try:
        straight_km = haversine_distance(
            payload.current_latitude,
            payload.current_longitude,
            payload.destination_latitude,
            payload.destination_longitude,
        )

        distance_km, duration_min, duration_text, route_type = get_road_distance(
            payload.current_latitude,
            payload.current_longitude,
            payload.destination_latitude,
            payload.destination_longitude,
        )

        # Trigger alert if either road distance or straight-line distance is within threshold
        is_alert = (distance_km <= payload.alert_distance) or (straight_km <= payload.alert_distance)

        time_part = f" (~{duration_text})" if duration_text else ""
        route_label = "road driving distance" if route_type == "road" else "straight-line"

        if is_alert:
            message = (
                f"WAKE UP! Your destination is approximately {distance_km} km away {time_part} "
                f"(alert threshold: {payload.alert_distance} km). Get ready to get down!"
            )
        else:
            message = (
                f"On the way. You are {distance_km} km ({route_label}){time_part} from destination. "
                f"Alarm will trigger at {payload.alert_distance} km."
            )

        return DistanceResponse(
            distance_km=distance_km,
            alert=is_alert,
            message=message,
            route_type=route_type,
            duration_min=duration_min,
            duration_text=duration_text,
            straight_line_km=straight_km,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to calculate distance: {str(exc)}"
        )
