import axios from 'axios'

export const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5174'

export async function getByCity(city){
  const { data } = await axios.get(`${SERVER_URL}/api/weather`, { params: { city } })
  return data
}

export async function getByCoords(lat, lon){
  const { data } = await axios.get(`${SERVER_URL}/api/weather/coords`, { params: { lat, lon } })
  return data
}

export async function geocode(q){
  const { data } = await axios.get(`${SERVER_URL}/api/geocode`, { params: { q } })
  return data
}

export async function saveLocation({ name, latitude, longitude, city }){
  const { data } = await axios.post(`${SERVER_URL}/api/locations`, { name, latitude, longitude, city })
  return data
}

export async function getLocations(){
  const { data } = await axios.get(`${SERVER_URL}/api/locations`)
  return data
}

export async function updateLocation(id, fields){
  const { data } = await axios.put(`${SERVER_URL}/api/locations/${id}`, fields)
  return data
}

export async function deleteLocation(id){
  const { data } = await axios.delete(`${SERVER_URL}/api/locations/${id}`)
  return data
}
