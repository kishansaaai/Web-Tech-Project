import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, LayersControl } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { radarTileUrlTemplate, reverseGeocode, getStationsNearby } from '../services/api'

function ClickHandler({ onClick }){
  useMapEvents({
    click(e){
      onClick(e.latlng.lat, e.latlng.lng)
    }
  })
  return null
}

const defaultIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
})

export default function MapView({ center = [20, 0], zoom = 3, onSelect }){
  const [pos, setPos] = useState(null)
  const [city, setCity] = useState('')
  const [radar, setRadar] = useState(true)
  const [stations, setStations] = useState([])
  const tileUrl = useMemo(() => radarTileUrlTemplate(), [])
  const fetchingStations = useRef(false)

  const updatePlace = async (lat, lon) => {
    setPos([lat, lon])
    try {
      const { place } = await reverseGeocode(lat, lon)
      setCity(place?.name || '')
    } catch {
      setCity('')
    }
    if (fetchingStations.current) return
    fetchingStations.current = true
    try {
      const data = await getStationsNearby(lat, lon, 5)
      setStations(data?.stations || [])
    } catch {
      setStations([])
    } finally {
      fetchingStations.current = false
    }
  }

  const onMapPick = async (lat, lon) => {
    await updatePlace(lat, lon)
    if (typeof onSelect === 'function') onSelect(lat, lon)
  }

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((p) => {
        const { latitude, longitude } = p.coords
        updatePlace(latitude, longitude)
      }, () => {}, { timeout: 4000 })
    }
  }, [])

  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="row" style={{ padding: '0.5rem 0.75rem' }}>
        <div><strong>Map</strong>{city ? ` - ${city}` : ''}{pos ? ` (${pos[0].toFixed(3)}, ${pos[1].toFixed(3)})` : ''}</div>
        <label style={{ marginLeft: 'auto' }}>
          <input type="checkbox" checked={radar} onChange={e => setRadar(e.target.checked)} /> Radar
        </label>
      </div>
      <div style={{ height: 360, width: '100%' }}>
        <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="OSM">
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>
            {radar && (
              <LayersControl.Overlay checked name="Radar">
                <TileLayer
                  attribution='Radar &copy; RainViewer'
                  url={tileUrl}
                  opacity={0.6}
                />
              </LayersControl.Overlay>
            )}
          </LayersControl>

          {pos && (
            <Marker
              position={pos}
              draggable
              icon={defaultIcon}
              eventHandlers={{
                dragend: (e) => {
                  const m = e.target
                  const ll = m.getLatLng()
                  onMapPick(ll.lat, ll.lng)
                }
              }}
            />
          )}

          <ClickHandler onClick={(lat, lon) => onMapPick(lat, lon)} />
        </MapContainer>
      </div>

      <div style={{ padding: '0.5rem 0.75rem' }}>
        <strong>Nearby Stations</strong>
        {stations.length === 0 && <div className="muted">None or unavailable.</div>}
        {stations.length > 0 && (
          <div className="grid" style={{ marginTop: 8 }}>
            {stations.map(s => (
              <div key={s.id} className="card" style={{ padding: '0.5rem 0.75rem' }}>
                <div><strong>{s.name || s.id}</strong></div>
                <div className="muted">{s.country || ''} {s.region || ''}</div>
                <div className="muted">{(s.distance/1000).toFixed(1)} km</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
