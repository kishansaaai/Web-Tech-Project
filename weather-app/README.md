# Weather App (Open-Meteo, Free API)

Minimal full-stack weather app using a free, no-key API.

- Client: React + Vite
- Server: Node + Express proxy with simple TTL cache
- Weather Data: Open-Meteo (forecast) + Open-Meteo Geocoding

## Run locally

Open two terminals:

1) Server
```
cd weather-app/server
npm install
npm run dev
```
Server starts on http://localhost:5174

2) Client
```
cd weather-app/client
npm install
npm run dev
```
Client starts on http://localhost:5173

By default the client talks to `http://localhost:5174`. To change it, create a `.env` in `client/` with:
```
VITE_SERVER_URL=http://localhost:5174
```

## Endpoints
- GET `/api/weather?city=London`
- GET `/api/weather/coords?lat=51.5&lon=-0.12`
- GET `/api/locations` — list favorites (mock user)
- POST `/api/locations` — body: `{ name, latitude, longitude }` or `{ city }`

## Notes
- No API keys required. Data and geocoding by Open-Meteo.
- Favorites/DB intentionally omitted to keep this minimal. Can be added later.

## New features
- Hourly chart (next 24h) using Chart.js.
- Dark/Light theme toggle (persists in localStorage). CSS variables with `data-theme` attribute.
- Favorites (MongoDB via Mongoose). Simple demo user `demo`.

## MongoDB setup
You can use either local MongoDB or MongoDB Atlas.

### Option A: Local MongoDB
1. Install MongoDB Community Server: https://www.mongodb.com/try/download/community
2. Start the service (MongoDB runs on `mongodb://127.0.0.1:27017`).
3. Create a database and collection is not required in advance—Mongoose will create as needed.
4. Create a `.env` in `weather-app/server/`:
```
MONGODB_URI=mongodb://127.0.0.1:27017/weatherapp
```

### Option B: MongoDB Atlas (cloud)
1. Create a free cluster: https://www.mongodb.com/atlas
2. Create a database user and allow access from your IP.
3. Get the connection string and put it in `weather-app/server/.env`:
```
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority
```

### Run with DB
1) Server
```
cd weather-app/server
npm install
npm run dev
```
If `MONGODB_URI` is set, you will see `MongoDB connected` in the server logs.

2) Client
```
cd weather-app/client
npm install
npm run dev
```

### Favorites API quick test
```
POST http://localhost:5174/api/locations
Content-Type: application/json

{"city":"London"}
```
or
```
{"name":"My Place","latitude":51.5,"longitude":-0.12}
```
