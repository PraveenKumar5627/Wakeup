"""
Travel Destination Alarm - Backend API
FastAPI backend that calculates the straight-line distance between the user's
current GPS location and their destination using the Haversine formula, and
determines if the user has reached their chosen alert distance threshold.
"""

import concurrent.futures
import json
import logging
import math
import os
import sys
import time
from typing import Optional, Tuple
import urllib.parse
import urllib.request
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, AliasChoices

# Ensure backend directory is in python path for absolute imports regardless of invocation cwd
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

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
    allow_origins=["*"],
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# 3. Pydantic Models for Request and Response Validation
# -----------------------------------------------------------------------------
class DistanceRequest(BaseModel):
    """
    Input schema sent from the React frontend or mobile client.
    Accepts standard snake_case, camelCase, or short coordinate aliases.
    Validates latitude (-90 to 90) and longitude (-180 to 180).
    """
    current_latitude: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        validation_alias=AliasChoices(
            "current_latitude", "currentLat", "current_lat", "lat", "latitude"
        ),
        description="Current latitude of the user in degrees",
    )
    current_longitude: float = Field(
        ...,
        ge=-180.0,
        le=180.0,
        validation_alias=AliasChoices(
            "current_longitude", "currentLng", "current_lng", "current_lon", "lng", "lon", "longitude"
        ),
        description="Current longitude of the user in degrees",
    )
    destination_latitude: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        validation_alias=AliasChoices(
            "destination_latitude", "dest_lat", "destLat", "dest_latitude", "destination_lat"
        ),
        description="Destination latitude in degrees",
    )
    destination_longitude: float = Field(
        ...,
        ge=-180.0,
        le=180.0,
        validation_alias=AliasChoices(
            "destination_longitude", "dest_lng", "destLng", "dest_lon", "dest_longitude", "destination_lng"
        ),
        description="Destination longitude in degrees",
    )
    alert_distance: float = Field(
        default=3.0,
        gt=0.0,
        validation_alias=AliasChoices(
            "alert_distance", "alert_distance_km", "alertDistance", "alert_dist", "threshold"
        ),
        description="Alert trigger distance in kilometers (e.g., 1, 2, 3, 5)",
    )
    start_latitude: Optional[float] = Field(
        default=None,
        ge=-90.0,
        le=90.0,
        validation_alias=AliasChoices(
            "start_latitude", "start_lat", "startLat", "initial_latitude", "initial_lat"
        ),
        description="Trip start latitude (optional, for calculating travelled distance)",
    )
    start_longitude: Optional[float] = Field(
        default=None,
        ge=-180.0,
        le=180.0,
        validation_alias=AliasChoices(
            "start_longitude", "start_lng", "startLng", "initial_longitude", "initial_lng"
        ),
        description="Trip start longitude (optional, for calculating travelled distance)",
    )

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "current_latitude": 13.0827,
                "current_longitude": 80.2707,
                "destination_latitude": 13.0878,
                "destination_longitude": 80.2785,
                "alert_distance": 3.0,
                "start_latitude": 13.0500,
                "start_longitude": 80.2500,
            }
        },
    }


class DistanceResponse(BaseModel):
    """
    Output schema returned to the React frontend or mobile client.
    """
    distance_km: float = Field(..., description="Calculated road or straight-line distance in kilometers")
    alert: bool = Field(..., description="True if distance_km <= alert_distance, otherwise False")
    message: str = Field(..., description="Human-readable description of current trip status")
    route_type: str = Field(default="road", description="'road' for driving distance, 'straight_line' for fallback")
    duration_min: Optional[float] = Field(default=None, description="Estimated driving time in minutes")
    duration_text: Optional[str] = Field(default=None, description="Formatted driving time (e.g. '5 hr 1 min')")
    straight_line_km: Optional[float] = Field(default=None, description="Straight-line spherical distance for comparison")
    travelled_distance_km: float = Field(default=0.0, description="Distance travelled from start in km")
    initial_distance_km: Optional[float] = Field(default=None, description="Initial total distance in km")
    progress_percentage: float = Field(default=0.0, description="Percentage of trip completed (0-100%)")


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

    # If coordinates are identical or practically identical (< 5 meters apart)
    if abs(lat1 - lat2) < 0.00005 and abs(lon1 - lon2) < 0.00005:
        return 0.0

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

    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
    distance = EARTH_RADIUS_KM * c

    return round(max(0.0, distance), 2)


# -----------------------------------------------------------------------------
# 5. Road Driving Distance Calculation (OSRM - Matches Google Maps Driving Route)
# -----------------------------------------------------------------------------
_ROUTING_CACHE = {}
_CACHE_TTL_SECONDS = 30.0
_MAX_CACHE_ENTRIES = 1000


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
    OpenStreetMap OSRM routing engines (matches Google Maps driving route).
    Uses primary and secondary routing servers, and falls back gracefully to
    straight-line spherical Haversine distance with estimated road duration
    if the routing engines are unreachable.

    Returns:
        (distance_km, duration_min, duration_text, route_type)
        where route_type is 'road' or 'straight_line'
    """
    # If points are virtually identical (< 10 meters apart), return 0.0
    if abs(lat1 - lat2) < 0.0001 and abs(lon1 - lon2) < 0.0001:
        return 0.0, 0.0, "0 min", "road"

    # Cache lookup by rounded coordinates (~11m precision for responsive travel tracking)
    cache_key = (round(lat1, 4), round(lon1, 4), round(lat2, 4), round(lon2, 4))
    now = time.time()
    if cache_key in _ROUTING_CACHE:
        cached_time, cached_dist, cached_dur, cached_text, cached_type = _ROUTING_CACHE[cache_key]
        if now - cached_time < _CACHE_TTL_SECONDS:
            return cached_dist, cached_dur, cached_text, cached_type

    # List of OSRM routing servers: Primary project-osrm, secondary openstreetmap.de mirror
    routing_urls = [
        f"https://router.project-osrm.org/route/v1/driving/{lon1:.6f},{lat1:.6f};{lon2:.6f},{lat2:.6f}?overview=false",
        f"https://routing.openstreetmap.de/routed-car/route/v1/driving/{lon1:.6f},{lat1:.6f};{lon2:.6f},{lat2:.6f}?overview=false",
    ]

    for url in routing_urls:
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "TravelDestinationAlarm/2.0 (FastAPI Backend; GPS Navigation)",
                    "Accept": "application/json",
                },
            )
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    if data.get("code") == "Ok" and data.get("routes"):
                        primary_route = data["routes"][0]
                        distance_meters = float(primary_route["distance"])
                        duration_seconds = float(primary_route.get("duration", 0.0))

                        distance_km = round(distance_meters / 1000.0, 2)
                        duration_min = round(duration_seconds / 60.0, 1)
                        duration_text = format_duration(duration_min)

                        # Store in cache (prune if exceeds max entries)
                        if len(_ROUTING_CACHE) >= _MAX_CACHE_ENTRIES:
                            cutoff = now - _CACHE_TTL_SECONDS
                            expired = [k for k, v in _ROUTING_CACHE.items() if v[0] < cutoff]
                            for k in expired:
                                _ROUTING_CACHE.pop(k, None)
                            if len(_ROUTING_CACHE) >= _MAX_CACHE_ENTRIES:
                                oldest = sorted(_ROUTING_CACHE.keys(), key=lambda k: _ROUTING_CACHE[k][0])
                                for k in oldest[: len(oldest) // 5]:
                                    _ROUTING_CACHE.pop(k, None)

                        _ROUTING_CACHE[cache_key] = (now, distance_km, duration_min, duration_text, "road")
                        return distance_km, duration_min, duration_text, "road"
        except Exception as exc:
            logging.debug("OSRM routing endpoint %s error: %s", url, exc)
            continue

    # Fallback to straight-line spherical distance with estimated driving duration
    straight_dist = haversine_distance(lat1, lon1, lat2, lon2)
    # Estimate driving road distance (~25% road curvature) and transit time (~40 km/h)
    est_road_km = round(straight_dist * 1.25, 2)
    est_duration_min = round(max(1.0, (est_road_km / 40.0) * 60.0), 1)
    est_duration_text = format_duration(est_duration_min)
    return straight_dist, est_duration_min, est_duration_text, "straight_line"


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
@app.post("/api/calculate-distance", response_model=DistanceResponse)
def calculate_distance(payload: DistanceRequest):
    """
    Main endpoint called by the React frontend while a trip is active.
    Receives current GPS coordinates, destination coordinates, and alert distance.
    Calculates actual road driving distance (matching Google Maps) and checks
    if an alert should trigger.
    Optionally calculates distance travelled from start coordinates.
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

        # Trigger alert strictly when the active route distance is within threshold.
        # This prevents premature triggers when straight-line distance ("as the crow flies")
        # is shorter than the actual road driving distance (e.g., 1.59 km straight vs 2.44 km road).
        is_alert = distance_km <= payload.alert_distance

        time_part = f" (~{duration_text})" if duration_text else ""
        route_label = "road driving distance" if route_type == "road" else "straight-line"

        # Calculate travelled distance if starting coordinates are provided
        travelled_km = 0.0
        initial_total_km = distance_km
        progress_pct = 0.0

        if payload.start_latitude is not None and payload.start_longitude is not None:
            travelled_km, _, _, _ = get_road_distance(
                payload.start_latitude,
                payload.start_longitude,
                payload.current_latitude,
                payload.current_longitude,
            )
            initial_total_km, _, _, _ = get_road_distance(
                payload.start_latitude,
                payload.start_longitude,
                payload.destination_latitude,
                payload.destination_longitude,
            )
            if initial_total_km > 0:
                progress_pct = round(
                    min(100.0, max(0.0, (travelled_km / initial_total_km) * 100.0)), 1
                )

        if is_alert:
            message = (
                f"WAKE UP! Your destination is approximately {distance_km} km away{time_part} "
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
            travelled_distance_km=travelled_km,
            initial_distance_km=initial_total_km,
            progress_percentage=progress_pct,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to calculate distance: {str(exc)}"
        )


@app.get("/calculate-distance", response_model=DistanceResponse)
@app.get("/api/calculate-distance", response_model=DistanceResponse)
def calculate_distance_get(
    current_lat: Optional[float] = None,
    current_lng: Optional[float] = None,
    dest_lat: Optional[float] = None,
    dest_lng: Optional[float] = None,
    current_latitude: Optional[float] = None,
    current_longitude: Optional[float] = None,
    destination_latitude: Optional[float] = None,
    destination_longitude: Optional[float] = None,
    alert_distance: float = 3.0,
    start_lat: Optional[float] = None,
    start_lng: Optional[float] = None,
    start_latitude: Optional[float] = None,
    start_longitude: Optional[float] = None,
):
    """
    GET endpoint to calculate user location to destination distance via query parameters.
    Supports current_latitude / current_lat, destination_latitude / dest_lat, etc.
    """
    c_lat = current_latitude if current_latitude is not None else current_lat
    c_lng = current_longitude if current_longitude is not None else current_lng
    d_lat = destination_latitude if destination_latitude is not None else dest_lat
    d_lng = destination_longitude if destination_longitude is not None else dest_lng
    s_lat = start_latitude if start_latitude is not None else start_lat
    s_lng = start_longitude if start_longitude is not None else start_lng

    if c_lat is None or c_lng is None or d_lat is None or d_lng is None:
        raise HTTPException(
            status_code=422,
            detail="Missing required coordinates: current_latitude, current_longitude, destination_latitude, destination_longitude",
        )

    payload = DistanceRequest(
        current_latitude=c_lat,
        current_longitude=c_lng,
        destination_latitude=d_lat,
        destination_longitude=d_lng,
        alert_distance=alert_distance,
        start_latitude=s_lat,
        start_longitude=s_lng,
    )
    return calculate_distance(payload)


# -----------------------------------------------------------------------------
# 7. Trip Persistence (CRUD Endpoints)
# -----------------------------------------------------------------------------
import os
import uuid

DATA_FILE = os.path.join(os.path.dirname(__file__), "trips_data.json")

class TripItem(BaseModel):
    id: Optional[str] = Field(default=None, description="Unique trip identifier")
    destination_name: str = Field(..., description="Destination location name")
    destination_city: Optional[str] = Field(default="", description="State / City or address")
    destination_latitude: float = Field(..., description="Destination latitude")
    destination_longitude: float = Field(..., description="Destination longitude")
    start_latitude: Optional[float] = Field(default=None, description="Trip start latitude")
    start_longitude: Optional[float] = Field(default=None, description="Trip start longitude")
    alert_distance_km: float = Field(..., description="Alert threshold in kilometers")
    distance_at_start_km: Optional[float] = Field(default=None, description="Initial total distance")
    status: str = Field(default="completed", description="Trip status: 'active', 'completed', 'cancelled'")
    start_time: Optional[str] = Field(default=None, description="Trip start timestamp")
    end_time: Optional[str] = Field(default=None, description="Trip end timestamp")
    duration_text: Optional[str] = Field(default="~ 20 min", description="Trip duration text")
    alarm_triggered: bool = Field(default=True, description="Whether alert was triggered during trip")
    created_at: Optional[str] = Field(default=None, description="Creation timestamp")


def _get_seed_trips():
    return [
        {
            "id": "trip-cbe-1",
            "destination_name": "Coimbatore",
            "destination_city": "Tamil Nadu",
            "destination_latitude": 11.0168,
            "destination_longitude": 76.9558,
            "start_latitude": 11.0503,
            "start_longitude": 77.0310,
            "alert_distance_km": 3.0,
            "distance_at_start_km": 5.0,
            "status": "completed",
            "start_time": "Today, 09:55 AM",
            "end_time": "Today, 10:15 AM",
            "duration_text": "~ 20 min",
            "alarm_triggered": True,
            "created_at": "Today, 10:15 AM",
        },
        {
            "id": "trip-chn-2",
            "destination_name": "Chennai",
            "destination_city": "Tamil Nadu",
            "destination_latitude": 13.0827,
            "destination_longitude": 80.2707,
            "start_latitude": 13.0067,
            "start_longitude": 80.2206,
            "alert_distance_km": 2.0,
            "distance_at_start_km": 14.5,
            "status": "completed",
            "start_time": "Yesterday, 06:10 PM",
            "end_time": "Yesterday, 06:45 PM",
            "duration_text": "~ 35 min",
            "alarm_triggered": True,
            "created_at": "Yesterday, 6:45 PM",
        },
        {
            "id": "trip-mdu-3",
            "destination_name": "Madurai",
            "destination_city": "Tamil Nadu",
            "destination_latitude": 9.9252,
            "destination_longitude": 78.1198,
            "start_latitude": 9.9800,
            "start_longitude": 78.1500,
            "alert_distance_km": 3.0,
            "distance_at_start_km": 8.4,
            "status": "completed",
            "start_time": "12 Oct 2025, 02:00 PM",
            "end_time": "12 Oct 2025, 02:30 PM",
            "duration_text": "~ 30 min",
            "alarm_triggered": True,
            "created_at": "12 Oct 2025, 2:30 PM",
        },
        {
            "id": "trip-try-4",
            "destination_name": "Tiruchirappalli",
            "destination_city": "Tamil Nadu",
            "destination_latitude": 10.7905,
            "destination_longitude": 78.7047,
            "start_latitude": 10.8500,
            "start_longitude": 78.7200,
            "alert_distance_km": 5.0,
            "distance_at_start_km": 12.0,
            "status": "completed",
            "start_time": "5 Oct 2025, 10:40 AM",
            "end_time": "5 Oct 2025, 11:20 AM",
            "duration_text": "~ 40 min",
            "alarm_triggered": True,
            "created_at": "5 Oct 2025, 11:20 AM",
        },
        {
            "id": "trip-slm-5",
            "destination_name": "Salem",
            "destination_city": "Tamil Nadu",
            "destination_latitude": 11.6643,
            "destination_longitude": 78.1460,
            "start_latitude": 11.7000,
            "start_longitude": 78.1800,
            "alert_distance_km": 2.0,
            "distance_at_start_km": 6.2,
            "status": "completed",
            "start_time": "2 Oct 2025, 04:45 PM",
            "end_time": "2 Oct 2025, 05:10 PM",
            "duration_text": "~ 25 min",
            "alarm_triggered": True,
            "created_at": "2 Oct 2025, 5:10 PM",
        },
    ]


def _read_trips():
    if not os.path.exists(DATA_FILE):
        seeds = _get_seed_trips()
        _write_trips(seeds)
        return seeds
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return _get_seed_trips()


def _write_trips(trips_list):
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(trips_list, f, indent=2)
    except Exception as exc:
        logging.error("Failed to write trips to disk: %s", exc)


@app.get("/trips")
@app.get("/api/trips")
def get_trips():
    """Retrieve all saved past trips."""
    return _read_trips()


@app.get("/trips/{trip_id}")
@app.get("/api/trips/{trip_id}")
def get_trip(trip_id: str):
    """Retrieve a single trip by ID."""
    trips = _read_trips()
    for t in trips:
        if t.get("id") == trip_id:
            return t
    raise HTTPException(status_code=404, detail="Trip not found")


@app.post("/trips")
@app.post("/api/trips")
def create_trip(trip: TripItem):
    """Save a new trip or summary."""
    trips = _read_trips()
    trip_dict = trip.model_dump()
    if not trip_dict.get("id"):
        trip_dict["id"] = f"trip-{uuid.uuid4().hex[:8]}"
    if not trip_dict.get("created_at"):
        trip_dict["created_at"] = time.strftime("%d %b %Y, %I:%M %p")
    # Prepend newest trip to list
    trips.insert(0, trip_dict)
    _write_trips(trips)
    return trip_dict


@app.delete("/trips/{trip_id}")
@app.delete("/api/trips/{trip_id}")
def delete_trip(trip_id: str):
    """Delete a trip by ID."""
    trips = _read_trips()
    new_trips = [t for t in trips if t.get("id") != trip_id]
    if len(new_trips) == len(trips):
        raise HTTPException(status_code=404, detail="Trip not found")
    _write_trips(new_trips)
    return {"message": "Trip deleted", "id": trip_id}


# -----------------------------------------------------------------------------
# 8. Place Search & Geocoding (Google Maps-like multi-source search)
# -----------------------------------------------------------------------------
from destinations_data import search_curated_places, normalize_query

_GEOCODE_CACHE = {}
_GEOCODE_CACHE_TTL = 300.0  # 5 minutes


class PlaceSearchResult(BaseModel):
    name: str = Field(..., description="Place or landmark name")
    city: str = Field(default="", description="City, locality, and state description")
    lat: float = Field(..., description="Latitude coordinate")
    lng: float = Field(..., description="Longitude coordinate")
    country: Optional[str] = Field(default="India", description="Country name")
    source: str = Field(default="geocoder", description="Source provider")
    type: Optional[str] = Field(default="landmark", description="Place category: city, bus_stand, station, etc.")
    district: Optional[str] = Field(default=None, description="Parent district or area")
    is_related: bool = Field(default=False, description="Whether place is related to destination")


@app.get("/search-places", response_model=list[PlaceSearchResult])
def search_places(
    q: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    limit: int = 12,
):
    """
    Search places, bus stands, railway stations, colleges, and landmarks
    with instant 0ms curated results, typo normalization (e.g. kallakuruchi -> kallakurichi),
    Google Maps-like related places expansion, and fast parallel online search.
    """
    trimmed = q.strip()
    if len(trimmed) < 2:
        return []

    cache_key = (trimmed.lower(), round(lat or 0.0, 2), round(lng or 0.0, 2), limit)
    now = time.time()
    if cache_key in _GEOCODE_CACHE:
        cached_time, cached_res = _GEOCODE_CACHE[cache_key]
        if now - cached_time < _GEOCODE_CACHE_TTL:
            return cached_res

    results = []
    seen_coords = []

    def is_unique(dest_lat: float, dest_lng: float, dest_name: str = "") -> bool:
        for s_lat, s_lng, s_name in seen_coords:
            # If same name or coordinates closer than 50 meters
            if dest_name and s_name and dest_name.lower().strip() == s_name.lower().strip():
                return False
            if abs(dest_lat - s_lat) < 0.0006 and abs(dest_lng - s_lng) < 0.0006:
                return False
        return True

    # 1. Instant Curated Places (0ms response, handles typos and related places like Google Maps)
    curated_matches = search_curated_places(trimmed, limit=limit)
    if curated_matches:
        for item in curated_matches:
            d_lat = float(item["lat"])
            d_lng = float(item["lng"])
            d_name = item["name"]
            if is_unique(d_lat, d_lng, d_name):
                seen_coords.append((d_lat, d_lng, d_name))
                results.append(
                    PlaceSearchResult(
                        name=d_name,
                        city=item.get("city", "Tamil Nadu"),
                        lat=d_lat,
                        lng=d_lng,
                        country="India",
                        source="curated",
                        type=item.get("type", "landmark"),
                        district=item.get("district"),
                        is_related=item.get("is_related", False),
                    )
                )

    # If curated places provide matches, return immediately (0.001s instant latency!)
    if len(results) >= 3:
        _GEOCODE_CACHE[cache_key] = (now, results[:limit])
        return results[:limit]

    # 2. Fast Parallel Online Geocoding via Photon (Fuzzy & Typo-tolerant) and Nominatim
    norm_query = normalize_query(trimmed)

    def fetch_photon(query_str: str):
        try:
            p_lat = lat if lat is not None else 11.0168
            p_lng = lng if lng is not None else 76.9558
            photon_url = (
                f"https://photon.komoot.io/api/?q={urllib.parse.quote(query_str)}"
                f"&limit=10&lang=en&lat={p_lat}&lon={p_lng}&bbox=68.7,8.4,97.25,37.6"
            )
            req = urllib.request.Request(
                photon_url,
                headers={"User-Agent": "TravelAlarmApp/2.0 (FastAPI GPS Engine)", "Accept": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=2.2) as resp:
                if resp.status == 200:
                    p_data = json.loads(resp.read().decode("utf-8"))
                    features = p_data.get("features", [])
                    p_items = []
                    for f in features:
                        props = f.get("properties", {})
                        coords = f.get("geometry", {}).get("coordinates", [])
                        if len(coords) >= 2:
                            f_lat = float(coords[1])
                            f_lng = float(coords[0])
                            f_name = props.get("name") or props.get("street") or props.get("city") or query_str
                            addr_parts = [
                                props.get("street"),
                                props.get("locality"),
                                props.get("district") or props.get("suburb"),
                                props.get("city") or props.get("town") or props.get("village"),
                                props.get("state"),
                            ]
                            clean_addr = ", ".join([p for p in addr_parts if p])
                            osm_val = (props.get("osm_value") or props.get("type") or "").lower()
                            c_type = "landmark"
                            if "bus" in osm_val or "bus" in f_name.lower():
                                c_type = "bus_stand"
                            elif "station" in osm_val or "station" in f_name.lower() or "railway" in f_name.lower():
                                c_type = "station"
                            elif osm_val in ["city", "town", "village", "administrative", "suburb", "district"]:
                                c_type = "city"
                            elif "college" in osm_val or "college" in f_name.lower():
                                c_type = "college"
                            elif "hospital" in osm_val or "hospital" in f_name.lower():
                                c_type = "hospital"
                            p_items.append({
                                "name": f_name,
                                "city": clean_addr or "Tamil Nadu, India",
                                "lat": f_lat,
                                "lng": f_lng,
                                "type": c_type,
                            })
                    return p_items
        except Exception as exc:
            logging.debug("Photon geocoding error: %s", exc)
        return []

    # First attempt fuzzy Photon lookup
    photon_matches = fetch_photon(trimmed)
    if not photon_matches and norm_query != trimmed:
        photon_matches = fetch_photon(norm_query)

    for p in photon_matches:
        if is_unique(p["lat"], p["lng"], p["name"]):
            seen_coords.append((p["lat"], p["lng"], p["name"]))
            results.append(
                PlaceSearchResult(
                    name=p["name"],
                    city=p["city"],
                    lat=p["lat"],
                    lng=p["lng"],
                    country="India",
                    source="photon",
                    type=p["type"],
                    is_related=False,
                )
            )

    if len(results) >= 6:
        _GEOCODE_CACHE[cache_key] = (now, results[:limit])
        return results[:limit]

    search_queries = [norm_query]
    if "bus" not in norm_query.lower() and "station" not in norm_query.lower():
        search_queries.append(f"{norm_query} bus stand")

    def fetch_nominatim(query_str: str):
        try:
            nom_url = (
                f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(query_str)}"
                f"&format=json&addressdetails=1&countrycodes=in&limit=6"
            )
            req = urllib.request.Request(
                nom_url,
                headers={"User-Agent": "TravelAlarmApp/2.0 (FastAPI GPS Engine)"},
            )
            with urllib.request.urlopen(req, timeout=2.0) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    return data if isinstance(data, list) else []
        except Exception:
            return []
        return []

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            future_to_query = {executor.submit(fetch_nominatim, sq): sq for sq in search_queries}
            for future in concurrent.futures.as_completed(future_to_query, timeout=2.2):
                data = future.result()
                for item in data:
                    try:
                        d_lat = float(item["lat"])
                        d_lng = float(item["lon"])
                        if is_unique(d_lat, d_lng):
                            seen_coords.append((d_lat, d_lng))
                            parts = item.get("display_name", "").split(",")
                            short_name = parts[0].strip() if parts else trimmed
                            city_str = ", ".join([p.strip() for p in parts[1:4]]) if len(parts) > 1 else "India"
                            
                            p_type = item.get("type", "")
                            classified_type = "landmark"
                            if "bus" in p_type or "bus" in short_name.lower():
                                classified_type = "bus_stand"
                            elif "station" in p_type or "station" in short_name.lower() or "railway" in short_name.lower():
                                classified_type = "station"
                            elif p_type in ["city", "town", "administrative", "village"]:
                                classified_type = "city"

                            results.append(
                                PlaceSearchResult(
                                    name=short_name,
                                    city=city_str,
                                    lat=d_lat,
                                    lng=d_lng,
                                    country="India",
                                    source="nominatim",
                                    type=classified_type,
                                    is_related=False,
                                )
                            )
                    except (KeyError, ValueError):
                        continue
    except Exception as exc:
        logging.debug("Parallel Nominatim search completed: %s", exc)

    _GEOCODE_CACHE[cache_key] = (now, results[:limit])
    return results[:limit]


@app.get("/api/health")
def api_health():
    """Alias for /health check."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


