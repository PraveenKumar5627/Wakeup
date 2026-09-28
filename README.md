# 🚌 Travel Destination Alarm (Smart Transit Wakeup)

A full-stack, mobile-friendly web application designed for bus, train, and sleeper bus passengers. When traveling overnight or on long journeys, travelers often worry about falling asleep and missing their stop. 

With this application, you choose your destination and select an alert buffer (e.g. 1 km, 2 km, 3 km, or 5 km). The browser tracks your live GPS coordinates, while the Python FastAPI backend calculates your straight-line distance using the **Haversine formula**. Once you are within your alert radius, a loud repeating wake-up alarm chime and vibrating visual alert trigger to wake you up before your stop!

---

## 📁 Project Architecture

```
travel-alarm/
├── backend/
│   ├── main.py              # FastAPI server with Haversine formula & endpoints
│   ├── requirements.txt     # Python backend dependencies
│   └── test_backend.py      # Automated tests for Haversine & distance calculation
├── frontend/
│   ├── index.html           # Mobile-responsive HTML5 entry with viewport settings
│   ├── package.json         # React + Vite dependencies & scripts
│   ├── vite.config.js       # Vite development configuration
│   └── src/
│       ├── main.jsx         # React application bootstrap
│       ├── App.jsx          # Main state machine (GPS, backend sync, alerts)
│       ├── index.css        # Responsive dark "Night Bus Express" design system
│       ├── components/
│       │   ├── Header.jsx           # App branding & API connection badge
│       │   ├── DestinationSearch.jsx# Search input + transit presets + geocoding
│       │   ├── AlertDistance.jsx    # 1 km, 2 km, 3 km, 5 km radius buttons
│       │   ├── TripStatus.jsx       # Active trip dashboard (speed, distance, coordinates)
│       │   ├── AlarmModal.jsx       # Flashing wake-up screen with Stop Alarm button
│       │   └── SimulatorControl.jsx # Desktop trip simulator for testing
│       └── utils/
│           ├── audioAlarm.js        # Web Audio API alarm sound synthesizer
│           └── api.js               # REST client connecting to FastAPI
└── README.md                # Complete documentation & tutorial
```

---

## 🛠️ Prerequisites

Make sure you have the following installed on your machine:
- **Python 3.9+**: Check with `python --version`
- **Node.js (v18+) & npm**: Check with `node --version` and `npm --version`

---

## 🚀 Step-by-Step Setup and Execution Guide

### Step 1: Start the FastAPI Backend

1. Open a terminal in the project directory:
   ```bash
   cd p:\practices\Wakeup\backend
   ```

2. (Optional but recommended) Create and activate a Python virtual environment:
   ```bash
   # On Windows
   python -m venv venv
   venv\Scripts\activate
   ```

3. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the automated backend tests:
   ```bash
   python -m pytest test_backend.py -v
   ```
   *You should see all 9 tests pass successfully.*

5. Start the FastAPI development server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   *The backend will now be running at `http://localhost:8000`.*
   - Interactive Swagger API docs: `http://localhost:8000/docs`
   - Health check: `http://localhost:8000/health`

---

### Step 2: Start the React Frontend

1. Open a second terminal window and navigate to the frontend folder:
   ```bash
   cd p:\practices\Wakeup\frontend
   ```

2. Install the frontend dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```

4. Open the application in your browser:
   ```
   http://localhost:5173
   ```
   *(To test on your mobile phone on the same Wi-Fi, open the Network URL displayed in your Vite terminal, e.g. `http://192.168.x.x:5173`).*

---

## 🔬 How the Application Works

### 1. Haversine Distance Formula
The straight-line spherical distance between your current GPS coordinates $(lat_1, lon_1)$ and your destination $(lat_2, lon_2)$ is calculated using the Haversine formula:

$$\Delta\phi = \text{radians}(lat_2 - lat_1)$$
$$\Delta\lambda = \text{radians}(lon_2 - lon_1)$$
$$a = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\text{radians}(lat_1)) \cdot \cos(\text{radians}(lat_2)) \cdot \sin^2\left(\frac{\Delta\lambda}{2}\right)$$
$$c = 2 \cdot \text{atan2}(\sqrt{a}, \sqrt{1 - a})$$
$$d = R \cdot c \quad (\text{where } R = 6371 \text{ km})$$

> **Important Limitation**:
> The Haversine formula calculates straight-line (crow flies) distance, not road distance. In future updates, this can be integrated with route mapping services (like Google Maps Routes API or OSRM) for turn-by-turn road distance.

### 2. Browser Geolocation API
The frontend uses `navigator.geolocation.watchPosition` to continuously listen for live GPS coordinates from your device's built-in GPS sensor. The backend never attempts to access your phone's GPS directly; your browser sends coordinates to the backend via POST requests.

### 3. Alarm Trigger & Audio Synthesis
When the backend returns `alert: true` (because `distance_km <= alert_distance`):
- A fullscreen flashing alert modal appears.
- A dual-tone repeating wake-up chime (880 Hz / 784 Hz) is synthesized via the browser's **Web Audio API** (works without requiring audio file downloads).
- Mobile vibration (`navigator.vibrate`) triggers on supported devices.
- Pressing **"STOP ALARM"** silences the alarm immediately.

---

## 🧪 Testing the Application (10 Verification Steps)

### Step 1: Verify Backend is Online
Look at the header in the web app. It should display a green badge: `● BACKEND API CONNECTED`.

### Step 2: Test Destination Selection
Click any of the preset bus stations (e.g. **Chennai Central Station** or **Koyambedu CMBT**), or type a place in the search bar and click **Search**.

### Step 3: Choose Alert Distance
Click on **1 km**, **2 km**, **3 km**, or **5 km**. The selected button will glow blue.

### Step 4: Test Instant Alarm Sound
Click **"🔔 Instant Alarm Test"** under the Developer Simulator box.
- Verify the alarm chime sounds loudly.
- Verify the fullscreen modal appears saying *"WAKE UP! Your destination is approximately X km away"*.
- Click **"🔕 STOP ALARM"** and ensure sound stops immediately.

### Step 5: Test "Start Trip"
Click the green **"START TRIP"** button:
- Your browser will ask for location permission. Click **Allow**.
- The dashboard will switch to **Trip Active** mode showing real-time distance remaining.

### Step 6: Test Simulated Journey (Bus approaching stop)
If you are at a desktop computer and cannot ride a bus right now:
1. With the trip active, click **"⏩ Move Bus Closer (-2 km)"** in the simulator box.
2. Observe the remaining distance decreasing:
   - Example: `8.5 km` ➔ `6.5 km` ➔ `4.5 km` ➔ `2.5 km`.
3. When the distance drops below your alert threshold (e.g. $\le 3\text{ km}$):
   - The wake-up alarm automatically triggers!
   - The audio starts playing repeatedly.

### Step 7: Test Stopping the Alarm
Click **"🔕 STOP ALARM"**. The modal closes and the audio ceases, while trip tracking continues.

### Step 8: Test "Stop Trip"
Click **"🛑 STOP TRIP"**. Tracking is terminated and the setup screen is restored.

### Step 9: Test Error Cases
- **Denied GPS Permission**: Open browser settings, block location for the site, and reload. Observe that a friendly warning banner appears guiding you to enable location or use the simulator.
- **Backend Disconnected**: Stop the FastAPI server (`Ctrl + C` in backend terminal). Observe the header badge turning red and error notification appearing without crashing the UI.

### Step 10: Run Automated Backend Tests
Run in the backend terminal:
```bash
python -m pytest test_backend.py -v
```

---

## 📡 API Reference

### Calculate Distance Endpoint
- **URL**: `/calculate-distance`
- **Method**: `POST`
- **Content-Type**: `application/json`

#### Request Body
```json
{
  "current_latitude": 13.0827,
  "current_longitude": 80.2707,
  "destination_latitude": 13.0878,
  "destination_longitude": 80.2785,
  "alert_distance": 3.0
}
```

#### Response Body
```json
{
  "distance_km": 0.96,
  "alert": true,
  "message": "WAKE UP! Your destination is approximately 0.96 km away (alert threshold: 3.0 km). Get ready to get down!"
}
```
