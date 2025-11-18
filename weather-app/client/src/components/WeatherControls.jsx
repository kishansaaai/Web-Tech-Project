import React, { useState, useEffect, useRef, useContext } from 'react';
import axios from 'axios';
import { AppContext } from '../context/AppContext.jsx';

export default function WeatherControls() {
  const { dispatch } = useContext(AppContext);
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!city.trim()) return setError('Enter a valid city');
    setLoading(true);
    try {
      const { data } = await axios.get('/api/weather', { params: { city } });
      dispatch({ type: 'ADD_SEARCH_RESULT', payload: { city, result: data } });
      setError('');
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return setError('Geolocation not supported');
    setLoading(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const { data } = await axios.get('/api/weather', { params: { lat, lon } });
        dispatch({ type: 'ADD_SEARCH_RESULT', payload: { city: data.place.name, result: data } });
      } catch (err) {
        setError('Failed to get location');
      } finally {
        setLoading(false);
      }
    });
  };

  return (
    <div className="card">
      <form onSubmit={handleSubmit}>
        <label className="muted">Enter city</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            ref={inputRef}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Mumbai"
            required
          />
          <button type="submit" disabled={loading}>Search</button>
          <button type="button" onClick={useMyLocation}>📍</button>
        </div>
        {loading && <progress max="100">Loading...</progress>}
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
