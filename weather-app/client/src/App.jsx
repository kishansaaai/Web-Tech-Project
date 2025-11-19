// src/App.jsx
import React, { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { getByCity, getByCoords, saveLocation, geocode } from './services/api'
import HourlyChart from './components/HourlyChart'

/* -------------------------
   SearchBar with autosuggest
   ------------------------- */
function SearchBar({ onSearch, loading }) {
  const [q, setQ] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [pending, setPending] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef(null)
  const debounceTimer = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('click', onClickOutside)
    return () => document.removeEventListener('click', onClickOutside)
  }, [])

  useEffect(() => {
    setSuggestions([])
    setOpen(false)
    setActiveIndex(-1)

    if (!q || q.trim().length < 2) {
      setPending(false)
      clearTimeout(debounceTimer.current)
      return
    }

    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(async () => {
      try {
        setPending(true)
        const { place } = await geocode(q.trim())
        if (!place) {
          setSuggestions([])
          setOpen(false)
          return
        }

        // normalize to array (server returns single place in minimal build)
        const list = Array.isArray(place) ? place : [place]
        const mapped = list.map(p => ({
          label: `${p.name}${p.country ? ', ' + p.country : ''}`,
          value: p.name,
          latitude: p.latitude,
          longitude: p.longitude
        }))

        setSuggestions(mapped)
        setOpen(mapped.length > 0)
        setActiveIndex(-1)
      } catch (err) {
        console.error('geocode error', err)
        setSuggestions([])
        setOpen(false)
      } finally {
        setPending(false)
      }
    }, 300)

    return () => clearTimeout(debounceTimer.current)
  }, [q])

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      setActiveIndex(i => Math.min(suggestions.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(-1, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && activeIndex >= 0 && suggestions[activeIndex]) {
        const sel = suggestions[activeIndex]
        setQ(sel.value)
        setOpen(false)
        onSearch(sel.value)
      } else {
        setOpen(false)
        onSearch(q)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  const onSuggestionClick = (item) => {
    setQ(item.value)
    setOpen(false)
    setActiveIndex(-1)
    onSearch(item.value)
  }

  const clearInput = () => {
    setQ('')
    setSuggestions([])
    setOpen(false)
    setActiveIndex(-1)
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSearch(q) }}
      style={{ display: 'flex', gap: 8, alignItems: 'center' }}
      ref={containerRef}
    >
      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', minWidth: 280 }}>
        <input
          placeholder="Search city…"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          style={{ paddingRight: 34 }}
        />

        <div style={{ position: 'absolute', right: 8, top: 8 }}>
          {pending ? (
            <small className="muted">…</small>
          ) : q ? (
            <button type="button" onClick={clearInput} style={{ padding: '2px 6px' }}>✕</button>
          ) : null}
        </div>

        {open && suggestions.length > 0 && (
          <ul role="listbox" style={{
            listStyle: 'none',
            margin: 6,
            padding: 0,
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--card)',
            maxHeight: 220,
            overflowY: 'auto',
            zIndex: 30
          }}>
            {suggestions.map((s, idx) => (
              <li
                key={s.label + idx}
                role="option"
                aria-selected={idx === activeIndex}
                onMouseDown={(ev) => { ev.preventDefault(); onSuggestionClick(s) }}
                onMouseEnter={() => setActiveIndex(idx)}
                style={{
                  padding: '0.55rem 0.75rem',
                  cursor: 'pointer',
                  background: idx === activeIndex ? 'var(--border)' : 'transparent'
                }}
              >
                <strong>{s.label}</strong>
                <div className="muted" style={{ fontSize: '.85rem' }}>
                  {typeof s.latitude === 'number' ? `${s.latitude.toFixed(3)}, ${s.longitude.toFixed(3)}` : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button disabled={loading || !q.trim()} type="submit">Search</button>
    </form>
  )
}

/* -------------------------
   Small UI helpers
   ------------------------- */
function weatherIcon(name) {
  const map = {
    clear: '☀️',
    mainly_clear: '🌤️',
    partly_cloudy: '⛅',
    overcast: '☁️',
    fog: '🌫️',
    rain_slight: '🌦️',
    rain_moderate: '🌧️',
    rain_heavy: '🌧️',
    snow_fall_slight: '🌨️',
    snow_fall_moderate: '🌨️',
    snow_fall_heavy: '❄️',
    thunderstorm_slight: '⛈️',
    thunderstorm_hail_slight: '⛈️',
    thunderstorm_hail_heavy: '⛈️',
  }
  return map[name] || '🌡️'
}

function CurrentWeatherCard({ place, current }) {
  if (!current) return null
  const icon = weatherIcon(current.icon)
  return (
    <div className="card">
      <h3>Current Weather {place?.name ? `- ${place.name}` : ''}</h3>
      <div className="row">
        <div>Temp: <strong>{current.temperature}°C</strong></div>
        <div>Humidity: <strong>{current.humidity}%</strong></div>
        <div>Wind: <strong>{current.windSpeed} m/s</strong></div>
      </div>
      <div className="muted">{icon} ({current.icon})</div>
    </div>
  )
}

function ForecastList({ daily }) {
  if (!daily?.length) return null
  return (
    <div className="card">
      <h3>7-day Forecast</h3>
      <div className="grid">
        {daily.map(d => (
          <div key={d.date} className="card" style={{ padding: '0.75rem' }}>
            <strong>{d.date}</strong>
            <div className="muted">{weatherIcon(d.icon)} ({d.icon})</div>
            <div>Max: {d.tMax}°C</div>
            <div>Min: {d.tMin}°C</div>
            <div>Wind Max: {d.windMax} m/s</div>
            <div>Rain prob: {d.precipProb ?? '—'}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* -------------------------
   Main App
   ------------------------- */
export default function App() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [place, setPlace] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system')

  useEffect(() => {
    // try geolocation on load (non-blocking)
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        setLoading(true)
        setError('')
        const { latitude, longitude } = pos.coords
        const data = await getByCoords(latitude, longitude)
        setPlace(data.place || null)
        setForecast(data.forecast)
      } catch (e) {
        setError(e.message || 'Failed to load geolocation weather')
      } finally {
        setLoading(false)
      }
    }, () => {}, { timeout: 5000 })
  }, [])

  const onSearch = async (city) => {
    try {
      setLoading(true)
      setError('')
      const data = await getByCity(city)
      setPlace(data.place)
      setForecast(data.forecast)
    } catch (e) {
      setError(e.message || 'Failed to fetch')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  // handler to save favorite (used inline as well)
  const handleSaveFavorite = async () => {
    try {
      setError('')
      if (!forecast) return alert('No forecast to save')
      const name = place?.name || 'Saved Location'
      await saveLocation({ name, latitude: forecast.latitude, longitude: forecast.longitude })
      alert('Saved (if DB configured)')
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Failed to save')
    }
  }

  return (
    <div className="container">
      <header>
        <h1>Weather Forecasting</h1>
        <nav className="row">
          <Link to="/">Home</Link>
          <Link to="/saved">Saved</Link>
        </nav>
      </header>

      {/* All controls in one row with equal spacing */}
      <div className="row" style={{ marginTop: 12 }}>
        <SearchBar onSearch={onSearch} loading={loading} />

        <button disabled={!forecast} onClick={handleSaveFavorite}>Save favorite</button>

        <button onClick={() => {
          if (!navigator.geolocation) return setError('Geolocation not supported')
          navigator.geolocation.getCurrentPosition(async pos => {
            try {
              setError('')
              setLoading(true)
              const data = await getByCoords(pos.coords.latitude, pos.coords.longitude)
              setPlace(data.place || null)
              setForecast(data.forecast)
            } catch (e) {
              setError(e.message || 'Failed to fetch')
            } finally {
              setLoading(false)
            }
          })
        }}>Use my location</button>

        <button onClick={() =>
          setTheme(t => t === 'light' ? 'dark' : t === 'dark' ? 'system' : 'light')
        }>
          Theme: {theme}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <CurrentWeatherCard place={place} current={forecast?.current} />
      <HourlyChart labels={forecast?.hourly?.time || []} temps={forecast?.hourly?.temperature || []} />
      <ForecastList daily={forecast?.daily} />
    </div>
  )
}
