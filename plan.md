Build a full-stack mobile-friendly Travel Destination Alarm application.

PROJECT IDEA:
The user is travelling by bus, especially a sleeper bus, and may fall asleep during the journey. The user selects their destination and chooses an alert distance such as 3 km or 5 km. The application continuously gets the user's current GPS location and calculates the distance between the current location and the selected destination. When the user reaches the selected alert distance, the application triggers an alarm/notification so the user wakes up before reaching the destination.

TECHNOLOGY:
Frontend:

- React
- JavaScript
- HTML/CSS
- Browser Geolocation API for GPS location
- React Hooks such as useState and useEffect

Backend:

- Python
- FastAPI
- REST API
- Haversine formula for calculating distance

IMPORTANT:
The GPS location must come from the user's device/browser. The Python backend should not try to obtain the phone's GPS directly.

MAIN USER FLOW:

1. Open the application.

2. Show a destination input/search field.

3. Allow the user to select or enter a destination.

4. Obtain the destination's latitude and longitude.

5. Provide an alert-distance selection:
   
   - 1 km
   - 2 km
   - 3 km
   - 5 km

6. User clicks "Start Trip".

7. Ask for location permission.

8. Start obtaining the user's current GPS latitude and longitude.

9. Send the current GPS coordinates and destination coordinates to the Python FastAPI backend.

10. Backend calculates the distance using the Haversine formula.

11. Return the calculated distance to the React frontend.

12. React displays something like:

Destination: Chennai Central
Distance remaining: 4.7 km
Alert distance: 3 km
Trip Status: Tracking...

13. Continue updating the user's GPS location while the trip is active.

14. When the calculated distance becomes less than or equal to the selected alert distance, trigger an alarm/notification.

Example:

Current distance = 8 km
→ Continue tracking

Current distance = 5 km
→ Continue tracking

Current distance = 3 km
→ Trigger alert

Display:

"Your destination is approximately 3 km away. Get ready to get down!"

15. Stop the alarm when the user presses "Stop Alarm".

16. Provide a "Stop Trip" button to stop GPS tracking.

BACKEND API:

Create a FastAPI backend with endpoints such as:

POST /calculate-distance

Request:

{
"current_latitude": 13.0827,
"current_longitude": 80.2707,
"destination_latitude": 13.0878,
"destination_longitude": 80.2785,
"alert_distance": 3
}

Response:

{
"distance_km": 2.8,
"alert": true,
"message": "Destination is within alert distance"
}

HAVERSINE FORMULA:

Implement the Haversine formula in Python.

Use Earth's radius as approximately 6371 km.

The backend should calculate:

distance between current GPS coordinates and destination GPS coordinates.

If:

distance <= alert_distance

return:

alert: true

Otherwise:

alert: false

FRONTEND UI:

Create a clean and simple interface with:

- Application title: "Travel Alarm"
- Destination search/input
- Selected destination
- Alert distance dropdown/buttons
- Start Trip button
- Stop Trip button
- Current location status
- Current distance
- Trip status
- Alarm screen/notification

Example:

---

    🚌 Travel Alarm

Destination
[ Search destination... ]

Alert me before destination

[ 1 km ] [ 2 km ] [ 3 km ] [ 5 km ]

    [ START TRIP ]

---

While tracking:

Destination: Chennai Central
Current distance: 4.2 km
Alert distance: 3 km

🟢 Trip is active
📍 GPS tracking active

    [ STOP TRIP ]

---

When distance reaches 3 km:

🔔 WAKE UP!

Your destination is approximately
3 km away.

    [ STOP ALARM ]

IMPORTANT TECHNICAL REQUIREMENTS:

- Use React functional components.
- Use useState and useEffect.
- Handle GPS permission errors.
- Handle GPS unavailable errors.
- Handle backend connection errors.
- Show loading status while obtaining location.
- Do not crash if GPS coordinates are unavailable.
- Do not send requests if there is no valid GPS location.
- Validate latitude and longitude.
- Keep the code beginner-friendly and well commented.
- Separate frontend and backend into different folders.
- Provide complete installation and running instructions.
- Provide all required npm and pip commands.
- Provide the complete FastAPI backend code.
- Provide the complete React frontend code.
- Provide the API request/response structure.
- Explain each major part of the code.

IMPORTANT DISTANCE LIMITATION:

The Haversine formula calculates straight-line distance, not actual road distance. Mention this clearly in the application documentation.

For the first version, use Haversine distance.

For a future version, allow integration with a routing service such as Google Maps Routes API to calculate actual road distance.

PROJECT STRUCTURE:

travel-alarm/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── App.jsx
│   │   └── ...
│   ├── package.json
│   └── ...
│
└── backend/
├── main.py
├── requirements.txt
└── ...

Finally, provide step-by-step instructions to:

1. Create the React project.
2. Install dependencies.
3. Create the FastAPI backend.
4. Start the Python server.
5. Start the React application.
6. Connect React to FastAPI.
7. Test GPS location.
8. Test the Haversine distance calculation.
9. Test the 3 km alarm.
10. Test error cases.

Do not skip any setup step. Assume the developer is a beginner with React and Python FastAPI.