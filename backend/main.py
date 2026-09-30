"""
Travel Destination Alarm - Backend API
FastAPI backend that calculates the straight-line distance between the user's
current GPS location and their destination using the Haversine formula, and
determines if the user has reached their chosen alert distance threshold.
"""

import math
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
        "http://127.0.0.1:5173",
    ],
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
    distance_km: float = Field(..., description="Calculated straight-line distance in kilometers")
    alert: bool = Field(..., description="True if distance_km <= alert_distance, otherwise False")
    message: str = Field(..., description="Human-readable description of current trip status")


# -----------------------------------------------------------------------------
# 4. Haversine Distance Calculation Formula
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

    Note: This computes straight-line spherical distance, not driving/road distance.
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
# 5. API Endpoints
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
    Calculates the Haversine distance and checks if an alert should trigger.
    """
    try:
        # Calculate distance in kilometers
        distance_km = haversine_distance(
            payload.current_latitude,
            payload.current_longitude,
            payload.destination_latitude,
            payload.destination_longitude,
        )

        # Check if the user is at or within the alert distance
        is_alert = distance_km <= payload.alert_distance

        if is_alert:
            message = (
                f"WAKE UP! Your destination is approximately {distance_km} km away "
                f"(alert threshold: {payload.alert_distance} km). Get ready to get down!"
            )
        else:
            message = (
                f"On the way. You are {distance_km} km from destination. "
                f"Alarm will trigger at {payload.alert_distance} km."
            )

        return DistanceResponse(
            distance_km=distance_km,
            alert=is_alert,
            message=message,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to calculate distance: {str(exc)}"
        )
