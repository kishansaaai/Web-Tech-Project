import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import App from './App'
import { getLocations, updateLocation, deleteLocation } from './services/api' // same path used in App.jsx

function Saved() {
  const [loading, setLoading] = useState(true)
  const [locations, setLocations] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        // Defensive: ensure function exists
        if (typeof getLocations !== 'function') {
          throw new Error('getLocations() not found — check import path (./services/api)')
        }
        const data = await getLocations()
        if (!alive) return
        // Some servers return { locations: [...] } — handle both
        const items = data?.locations ?? data ?? []
        setLocations(Array.isArray(items) ? items : [])
        console.log('Saved: loaded locations', items)
      } catch (e) {
        console.error('Saved: load error', e)
        setError(e?.response?.data?.error || e.message || 'Failed to load favorites')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [])

  const refresh = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getLocations()
      const items = data?.locations ?? data ?? []
      setLocations(Array.isArray(items) ? items : [])
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Failed to load favorites')
    } finally {
      setLoading(false)
    }
  }

  const onRename = async (loc) => {
    const current = loc.name || loc.city || ''
    const next = window.prompt('New name for this location:', current)
    if (!next || next === current) return
    try {
      setError('')
      await updateLocation(loc._id, { name: next })
      await refresh()
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Failed to update location')
    }
  }

  const onDelete = async (loc) => {
    if (!window.confirm('Delete this saved location?')) return
    try {
      setError('')
      await deleteLocation(loc._id)
      await refresh()
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Failed to delete location')
    }
  }

  return (
    <div className="container">
      <header>
        <h2>Saved Locations</h2>
        <nav style={{ marginBottom: 8 }}>
          <Link to="/">Home</Link>
        </nav>
      </header>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && locations.length === 0 && (
        <p className="muted">No saved locations yet.</p>
      )}

      <div className="grid" style={{ marginTop: 12 }}>
        {locations.map(loc => (
          <div key={loc._id || `${loc.latitude}-${loc.longitude}-${loc.name}`} className="card">
            <div><strong>{loc.name || loc.city || 'Unknown'}</strong></div>
            <div className="muted">Lat: {loc.latitude}, Lon: {loc.longitude}</div>
            {loc.createdAt && <div className="muted">Saved: {new Date(loc.createdAt).toLocaleString()}</div>}
            <div className="row" style={{ marginTop: 8, gap: 8 }}>
              <button type="button" onClick={() => onRename(loc)}>Rename</button>
              <button type="button" onClick={() => onDelete(loc)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 12 }}>
        <Link to="/">Back</Link>
      </p>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/saved" element={<Saved />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
