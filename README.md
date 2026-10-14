# 🚌 TravelAlarm / Arrivo — Complete Application Documentation

A full-stack, mobile-first transit alarm application designed for bus, train, sleeper coach, and commuter passengers. Built to faithfully match the **10-screen Reference UI Showcase**, featuring warm cream backgrounds, electric blue action cards, emerald green tracking banners, glowing golden alarm accents, real-time GPS geolocation, and an accurate distance-based wake-up alarm engine.

---

## 📱 10 Screens Implemented From Reference UI

| # | Screen Name | Key Components & Capabilities |
|---|---|---|
| **1** | **Splash & Onboarding** | Deep navy/black background, stylized Arrivo sunrise emblem, 3-step onboarding carousel with "Smart Destination Alarms", "Interactive Route Tracking", and "Never Miss Your Stop" slides, persistent completion in localStorage. |
| **2** | **Home / Dashboard** | Status bar (9:41, WiFi, battery), "Good Morning, Praveen!" greeting, large vibrant blue "Set Destination" card, active trip progress banner, "Recent Trips" shortcut list with amber bells and "View All" action, and fixed 4-tab bottom navigation bar. |
| **3** | **Select Destination (Search)** | Back navigation, real-time destination search bar with suggestions (Coimbatore, Chennai, Madurai, Salem, Tiruchirappalli, transit stations), quick filter chips, and interactive map marker placement. |
| **4** | **Trip Setup (Alarm Before Arrival)** | Embedded route map from user coordinates to destination, confirmed destination card, radio distance selection (5 km, 3 km, 2 km, Custom distance input), and "Start Trip" action button. |
| **5** | **Location Permission** | Compass radar animation, 3 clear benefit rows (Track Current Position, Calculate Remaining Distance, Trigger Wake-Up Alarm), "Allow Location" (triggers browser geolocation or Capacitor native GPS), and error/disabled guidance. |
| **6** | **Active Trip (Tracking)** | Deep emerald green "Traveling to [City]" header card, dark mode route map with live user puck, red destination pin, remaining distance, ETA clock arrival, animated progress bar, "Alarm set for 3 km" pill, Stop Trip modal, and simulator toggle. |
| **7** | **Alarm Triggered** | Dark navy background, glowing golden-yellow pulsing bell circle with ringing vibration animation, "Almost There! You are X km away", destination address card, "Snooze (5 min)" button, "Stop Alarm" button, Web Audio siren chime, and phone vibration loops. |
| **8** | **Trip Ongoing / Summary** | Emerald checkmark circle, "Trip Ongoing / You'll be notified again", destination card with chevron, stats table (Distance at start, Alarm distance, Total travel time), "End Trip" button, and "Set Another Destination". |
| **9** | **Past Trips** | Filterable list of saved journeys (Coimbatore, Chennai, Madurai, Tiruchirappalli, Salem), timestamps, alarm thresholds, delete trip action with confirmation modal, and persistent local/cloud storage. |
| **10** | **Settings** | User profile card (Praveen), live Location Permission status badge, 4 alarm sound tones with audio preview (Transit Chime, Gentle Wakeup, Digital Siren, Classic Bell), Snooze duration selector (3/5/10 min), Haptic vibration toggle, Distance units (km/mi), Android background location guidelines, and privacy policy. |

---

## 📁 Project Architecture

```
travel-alarm/
├── backend/
│   ├── main.py              # FastAPI server: Haversine, OSRM road routing, Trips persistence CRUD
│   ├── requirements.txt     # Python backend dependencies
│   ├── trips_data.json      # JSON persistence store for past trips
│   └── test_backend.py      # Automated tests for distance, alert thresholds, and trips CRUD
├── frontend/
│   ├── android/             # Capacitor Android project files
│   │   ├── app/src/main/
│   │   │   ├── AndroidManifest.xml   # Fine location, vibration, background sensor permissions
│   │   │   └── java/com/Praveen/Arrivo/
│   │   │       ├── MainActivity.java
│   │   │       └── LocationEnablerPlugin.java
│   ├── index.html           # Viewport configuration & Leaflet CDN
│   ├── package.json         # React 18, Vite 5, Capacitor 8, Lucide React
│   ├── .env.example         # Configuration placeholders
│   ├── src/
│   │   ├── main.jsx         # React DOM bootstrap
│   │   ├── App.jsx          # State machine, screen router, real distance alarm engine
│   │   ├── travel_alarm.css # Pixel-perfect CSS design system matching reference UI
│   │   ├── index.css        # Responsive base styles
│   │   ├── components/
│   │   │   ├── StatusBar.jsx         # Phone status bar (9:41, cellular, WiFi, battery)
│   │   │   └── BottomNavBar.jsx      # Fixed 4-tab navigation (Home, Trip, Map, Settings)
│   │   ├── screens/
│   │   │   ├── SplashScreen.jsx               # Screen 1: Splash & Onboarding
│   │   │   ├── HomeScreen.jsx                 # Screen 2: Home Dashboard
│   │   │   ├── SelectDestinationScreen.jsx    # Screen 3 & 4: Select Destination & Setup
│   │   │   ├── LocationPermissionScreen.jsx   # Screen 5: Location Permission
│   │   │   ├── ActiveTripScreen.jsx           # Screen 6: Active Trip Tracking
│   │   │   ├── AlarmAlertScreen.jsx           # Screen 7: Alarm Triggered Screen
│   │   │   ├── TripSummaryScreen.jsx          # Screen 8: Trip Ongoing / Summary
│   │   │   ├── PastTripsScreen.jsx            # Screen 9: Past Trips History
│   │   │   └── SettingsScreen.jsx             # Screen 10: Application Settings
│   │   ├── hooks/
│   │   │   └── useLocationPermission.js       # Live geolocation, watch, jitter suppression
│   │   └── utils/
│   │       ├── api.js                         # API client, OSRM routing, offline trips storage
│   │       ├── audioAlarm.js                  # Web Audio API multi-tone synthesized alarm
│   │       └── distance.test.mjs              # Unit tests for distance & threshold calculations
└── README.md
```

---

## 🛠️ Prerequisites

- **Node.js (v18+) & npm**
- **Python 3.9+**
- (Optional for Android APK build) **Android Studio & Java JDK 17+**

---

## 🚀 Execution Guide

### 1. Start the FastAPI Backend

```bash
cd p:\practices\Wakeup\backend

# Install dependencies
pip install -r requirements.txt

# Run backend test suite (16 tests)
python -m pytest test_backend.py -v

# Start FastAPI dev server
uvicorn main:app --reload --port 8000
```
- API Docs: `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`
- Trips API: `http://localhost:8000/trips`

---

### 2. Start the React Frontend

```bash
cd p:\practices\Wakeup\frontend

# Install dependencies
npm install

# Run frontend calculation tests (15 tests)
npm test

# Build production bundle
npm run build

# Start local dev server
npm run dev
```
Open `http://localhost:5173` in your browser.

---

### 3. Android Capacitor Build & Sync

Web assets are compiled to `frontend/dist` and synchronized to the Android project:

```bash
cd p:\practices\Wakeup\frontend

# 1. Build web bundle
npm run build

# 2. Sync web assets into Android project
npx cap sync android

# 3. Open in Android Studio
npx cap open android
```

In Android Studio:
1. Connect an Android phone with **USB Debugging** enabled (or start an Android Emulator).
2. Click **Run 'app'** to install and run the application on your device.
3. To generate an APK: Click **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

---

## 🔋 Android Background Location & Battery Optimization

On Android devices, manufacturers (Xiaomi, Samsung, OnePlus, Oppo, Vivo) aggressively put background apps to sleep. To ensure the arrival alarm reliably sounds:

1. **Disable Battery Optimization for Arrivo**:
   - Go to **Settings > Apps > Arrivo > Battery > Unrestricted**.
2. **Enable Location "Allow all the time"**:
   - Go to **Settings > Apps > Arrivo > Permissions > Location > Allow all the time**.
3. **Screen Wake Lock**:
   - During an active trip, Arrivo automatically requests a Screen Wake Lock via the HTML5 Screen Wake Lock API to prevent the display from locking while in transit.

---

## 🧪 Testing Verification Summary

- **Backend Pytest**: 16/16 tests passing (`test_backend.py`)
  - Haversine spherical distance calculation
  - Known real-world routes (Chennai Central to Airport, Coimbatore routes)
  - Road driving distance vs. straight-line fallback
  - Threshold crossing detection
  - Coordinate & distance input validation (422 response)
  - CORS policies for Capacitor Android WebView (`http://localhost`) & web
  - Full Trip CRUD (`GET /trips`, `POST /trips`, `DELETE /trips/{id}`)
- **Frontend Calculation Tests**: 15/15 tests passing (`src/utils/distance.test.mjs`)
  - Same-point distance calculation
  - Threshold crossing trigger (triggers once, suppresses duplicate triggers)
  - Custom distance validation (rejects negative, 0, >50, or NaN)
  - Duration formatting (minutes and hours)
- **Vite Production Build**: 0 errors, optimized bundle compiled cleanly in 4.98s.
- **Capacitor Sync**: 0 errors, synced to `android/app/src/main/assets/public`.
