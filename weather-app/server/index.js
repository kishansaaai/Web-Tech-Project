import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5174;

app.use(cors());
app.use(express.json());

// Simple in-memory TTL cache
const cache = new Map();
const TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  const { value, expiresAt } = entry;
  if (Date.now() > expiresAt) {
    cache.delete(key);
    return null;
  }
  return value;
}

function setCache(key, value, ttlMs = TTL_MS) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// Helper to cache binary (Buffer) responses separately
const binaryCache = new Map();
function getBinaryCache(key) {
  const entry = binaryCache.get(key);
  if (!entry) return null;
  const { value, contentType, expiresAt } = entry;
  if (Date.now() > expiresAt) {
    binaryCache.delete(key);
    return null;
  }
  return { value, contentType };
}
function setBinaryCache(key, value, contentType, ttlMs = 5 * 60 * 1000) {
  binaryCache.set(key, { value, contentType, expiresAt: Date.now() + ttlMs });
}

// Helper: map Open-Meteo weather codes to simple icon keywords
const weatherCodeMap = {
  0: 'clear',
  1: 'mainly_clear', 2: 'partly_cloudy', 3: 'overcast',
  45: 'fog', 48: 'depositing_rime_fog',
  51: 'drizzle_light', 53: 'drizzle_moderate', 55: 'drizzle_dense',
  56: 'freezing_drizzle_light', 57: 'freezing_drizzle_dense',
  61: 'rain_slight', 63: 'rain_moderate', 65: 'rain_heavy',
  66: 'freezing_rain_light', 67: 'freezing_rain_heavy',
  71: 'snow_fall_slight', 73: 'snow_fall_moderate', 75: 'snow_fall_heavy',
  77: 'snow_grains',
  80: 'rain_showers_slight', 81: 'rain_showers_moderate', 82: 'rain_showers_violent',
  85: 'snow_showers_slight', 86: 'snow_showers_heavy',
  95: 'thunderstorm_slight', 96: 'thunderstorm_hail_slight', 99: 'thunderstorm_hail_heavy'
};

// Geocoding via Open-Meteo
async function geocodeCity(city) {
  const key = `geo:${city.toLowerCase()}`;
  const cached = getCache(key);
  if (cached) return cached;
  const url = 'https://geocoding-api.open-meteo.com/v1/search';
  const { data } = await axios.get(url, {
    params: { name: city, count: 1, language: 'en', format: 'json' }
  });
  if (!data?.results?.length) {
    throw { status: 404, message: 'City not found' };
  }
  const place = data.results[0];
  const result = {
    name: place.name,
    country: place.country,
    latitude: place.latitude,
    longitude: place.longitude
  };
  setCache(key, result, 24 * 60 * 60 * 1000);
  return result;
}

// Reverse geocoding via Open-Meteo
async function reverseGeocode(lat, lon) {
  const key = `rev:${lat.toFixed(3)},${lon.toFixed(3)}`;
  const cached = getCache(key);
  if (cached) return cached;
  const url = 'https://geocoding-api.open-meteo.com/v1/reverse';
  const { data } = await axios.get(url, {
    params: { latitude: lat, longitude: lon, count: 1, language: 'en', format: 'json' }
  });
  if (!data?.results?.length) {
    const result = { name: null, country: null, latitude: lat, longitude: lon };
    setCache(key, result, 6 * 60 * 60 * 1000);
    return result;
  }
  const place = data.results[0];
  const result = {
    name: place.name,
    country: place.country,
    latitude: place.latitude,
    longitude: place.longitude
  };
  setCache(key, result, 24 * 60 * 60 * 1000);
  return result;
}

async function fetchForecast(lat, lon) {
  const key = `wx:${lat.toFixed(3)},${lon.toFixed(3)}`;
  const cached = getCache(key);
  if (cached) return cached;
  const url = 'https://api.open-meteo.com/v1/forecast';
  const params = {
    latitude: lat,
    longitude: lon,
    current: ['temperature_2m','relative_humidity_2m','wind_speed_10m','weather_code'].join(','),
    hourly: ['temperature_2m'].join(','),
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
      'weather_code',
      'wind_speed_10m_max'
    ].join(','),
    timezone: 'auto',
    forecast_days: 7
  };
  const { data } = await axios.get(url, { params });
  // Normalize response
  const normalized = {
    latitude: data.latitude,
    longitude: data.longitude,
    timezone: data.timezone,
    current: {
      temperature: data.current?.temperature_2m,
      humidity: data.current?.relative_humidity_2m,
      windSpeed: data.current?.wind_speed_10m,
      weatherCode: data.current?.weather_code,
      icon: weatherCodeMap[data.current?.weather_code] || 'na'
    },
    hourly: {
      time: (data.hourly?.time || []).slice(0, 24),
      temperature: (data.hourly?.temperature_2m || []).slice(0, 24)
    },
    daily: (data.daily?.time || []).map((date, i) => ({
      date,
      tMax: data.daily?.temperature_2m_max?.[i],
      tMin: data.daily?.temperature_2m_min?.[i],
      precipProb: data.daily?.precipitation_probability_max?.[i],
      windMax: data.daily?.wind_speed_10m_max?.[i],
      weatherCode: data.daily?.weather_code?.[i],
      icon: weatherCodeMap[data.daily?.weather_code?.[i]] || 'na'
    }))
  };
  setCache(key, normalized);
  return normalized;
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/weather', async (req, res) => {
  try {
    const { city } = req.query;
    if (!city) return res.status(400).json({ error: 'city is required' });
    const place = await geocodeCity(city);
    const forecast = await fetchForecast(place.latitude, place.longitude);
    res.json({ place, forecast });
  } catch (err) {
    const status = err?.status || 500;
    res.status(status).json({ error: err?.message || 'Failed to fetch weather' });
  }
});

app.get('/api/geocode', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'q is required' });
    const place = await geocodeCity(q);
    res.json({ place });
  } catch (err) {
    const status = err?.status || 500;
    res.status(status).json({ error: err?.message || 'Failed to geocode' });
  }
});

// Reverse geocode lat/lon -> place
app.get('/api/reverse-geocode', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return res.status(400).json({ error: 'lat and lon are required numbers' });
    }
    const place = await reverseGeocode(lat, lon);
    res.json({ place });
  } catch (err) {
    const status = err?.status || 500;
    res.status(status).json({ error: err?.message || 'Failed to reverse geocode' });
  }
});

app.get('/api/weather/coords', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return res.status(400).json({ error: 'lat and lon are required numbers' });
    }
    const forecast = await fetchForecast(lat, lon);
    // Optional reverse-lookup for display convenience
    let place = null;
    try { place = await reverseGeocode(lat, lon); } catch {}
    res.json({ place, forecast });
  } catch (err) {
    const status = err?.status || 500;
    res.status(status).json({ error: err?.message || 'Failed to fetch weather' });
  }
});

// --- Radar tile proxy (RainViewer) ---
// Example upstream: https://tilecache.rainviewer.com/v2/radar/nowcast_0/256/{z}/{x}/{y}/1/1_1.png
// We proxy to avoid CORS and add short-term caching.
app.get('/api/tiles/radar/:z/:x/:y.png', async (req, res) => {
  try {
    const { z, x, y } = req.params;
    const upstream = `https://tilecache.rainviewer.com/v2/radar/nowcast_0/256/${z}/${x}/${y}/1/1_1.png`;
    const cacheKey = `tile:${z}:${x}:${y}`;
    const cached = getBinaryCache(cacheKey);
    if (cached) {
      res.set('Content-Type', cached.contentType || 'image/png');
      res.set('Cache-Control', 'public, max-age=120');
      return res.send(cached.value);
    }
    const response = await axios.get(upstream, { responseType: 'arraybuffer', timeout: 8000 });
    const buf = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || 'image/png';
    setBinaryCache(cacheKey, buf, contentType, 2 * 60 * 1000);
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=120');
    res.send(buf);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch radar tile' });
  }
});

// --- Nearby stations via Meteostat (optional API key) ---
// Set METEOSTAT_API_KEY in .env to enable.
async function fetchNearbyStations(lat, lon, limit = 5) {
  const key = `stations:${lat.toFixed(2)},${lon.toFixed(2)}:${limit}`;
  const cached = getCache(key);
  if (cached) return cached;
  const apiKey = process.env.METEOSTAT_API_KEY;
  if (!apiKey) {
    throw { status: 503, message: 'Stations API not configured' };
  }
  const base = 'https://api.meteostat.net/v2/stations/nearby';
  const { data } = await axios.get(base, {
    params: { lat, lon, limit },
    headers: { 'x-api-key': apiKey }
  });
  const stations = (data?.data || []).map(s => ({
    id: s.id,
    name: s.name,
    country: s.country,
    region: s.region,
    distance: s.distance,
    latitude: s.latitude,
    longitude: s.longitude,
    elevation: s.elevation
  }));
  setCache(key, stations, 60 * 60 * 1000);
  return stations;
}

async function fetchLatestForStation(id) {
  const key = `station:${id}:latest`;
  const cached = getCache(key);
  if (cached) return cached;
  const apiKey = process.env.METEOSTAT_API_KEY;
  if (!apiKey) {
    throw { status: 503, message: 'Stations API not configured' };
  }
  const url = 'https://api.meteostat.net/v2/stations/hourly';
  const today = new Date().toISOString().slice(0, 13) + ':00';
  const { data } = await axios.get(url, {
    params: { station: id, start: today, end: today, tz: 'UTC' },
    headers: { 'x-api-key': apiKey }
  });
  const latest = data?.data?.[0] || null;
  setCache(key, latest, 15 * 60 * 1000);
  return latest;
}

app.get('/api/stations/nearby', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const limit = Math.min(parseInt(req.query.limit || '5', 10), 10);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return res.status(400).json({ error: 'lat and lon are required numbers' });
    }
    const stations = await fetchNearbyStations(lat, lon, limit);
    res.json({ stations });
  } catch (err) {
    const status = err?.status || 500;
    res.status(status).json({ error: err?.message || 'Failed to fetch stations' });
  }
});

app.get('/api/stations/:id/latest', async (req, res) => {
  try {
    const id = req.params.id;
    const latest = await fetchLatestForStation(id);
    res.json({ latest });
  } catch (err) {
    const status = err?.status || 500;
    res.status(status).json({ error: err?.message || 'Failed to fetch station latest' });
  }
});

// --- MongoDB (Favorites) ---
let dbReady = false;
const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI) {
  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      dbReady = true;
      console.log('MongoDB connected');
    })
    .catch((e) => console.error('MongoDB connection error:', e.message));
}

const favoriteSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  { timestamps: true }
);

const Favorite = mongoose.models.Favorite || mongoose.model('Favorite', favoriteSchema);

app.get('/api/locations', async (req, res) => {
  try {
    if (!dbReady) return res.status(503).json({ error: 'Database not configured' });
    const userId = 'demo';
    const items = await Favorite.find({ userId }).sort({ createdAt: -1 }).lean();
    res.json({ locations: items });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

app.post('/api/locations', async (req, res) => {
  try {
    if (!dbReady) return res.status(503).json({ error: 'Database not configured' });
    const userId = 'demo';
    let { name, latitude, longitude } = req.body || {};
    if (!name && (latitude == null || longitude == null) && req.body?.city) {
      const place = await geocodeCity(req.body.city);
      name = place.name;
      latitude = place.latitude;
      longitude = place.longitude;
    }
    if (!name || latitude == null || longitude == null) {
      return res.status(400).json({ error: 'name, latitude, longitude are required' });
    }
    const doc = await Favorite.create({ userId, name, latitude, longitude });
    res.status(201).json({ location: doc });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save location' });
  }
});

app.use((err, req, res, next) => {
  console.error('Unexpected error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Weather server listening on http://localhost:${PORT}`);
});
