const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

// Helper to make authenticated requests
async function request(endpoint, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) {
    headers['Authorization'] = `Token ${token}`
  }

  const config = {
    method,
    headers,
  }

  if (body) {
    config.body = JSON.stringify(body)
  }

  const res = await fetch(`${API_BASE}${endpoint}`, config)
  if (!res.ok) {
    let errText = ''
    try {
      const errJson = await res.json()
      errText = errJson.detail || errJson.message || JSON.stringify(errJson)
    } catch {
      errText = await res.text()
    }
    throw new Error(errText || `Request failed with status ${res.status}`)
  }

  // Handle 204 No Content or empty responses
  if (res.status === 204) return null
  try {
    return await res.json()
  } catch {
    return null
  }
}

// Auth APIs
export async function login(username, password) {
  const data = await request('/api/auth/token/', 'POST', { username, password })
  return data.token
}

export async function register(payload) {
  // payload can include username, email, password, organization_name, org_type
  return request('/api/auth/register/', 'POST', payload)
}

// Devices APIs
export async function fetchDevices(token) {
  return request('/api/devices/', 'GET', null, token)
}

export async function createDevice(token, payload) {
  return request('/api/devices/', 'POST', payload, token)
}

export async function deleteDevice(token, deviceId) {
  return request(`/api/devices/${deviceId}/`, 'DELETE', null, token)
}

export async function fetchDeviceDetails(token, deviceId) {
  return request(`/api/devices/${deviceId}/`, 'GET', null, token)
}

// Telemetry APIs
export async function fetchLatestTelemetry(token, deviceId) {
  return request(`/api/devices/${deviceId}/telemetry/latest/`, 'GET', null, token)
}

export async function fetchTelemetryRange(token, deviceId, startIso, endIso, limit = 500) {
  let url = `/api/devices/${deviceId}/telemetry/`
  const params = []
  if (startIso) params.push(`start=${encodeURIComponent(startIso)}`)
  if (endIso) params.push(`end=${encodeURIComponent(endIso)}`)
  if (limit) params.push(`limit=${limit}`)
  if (params.length) url += `?${params.join('&')}`
  
  return request(url, 'GET', null, token)
}

export async function triggerManualSync(token, deviceId) {
  return request(`/api/devices/${deviceId}/telemetry/sync/`, 'POST', null, token)
}

// Alerts APIs
export async function fetchDeviceAlerts(token, deviceId, active = null, severity = null) {
  let url = `/api/devices/${deviceId}/alerts/`
  const params = []
  if (active !== null) params.push(`active=${active}`)
  if (severity) params.push(`severity=${severity}`)
  if (params.length) url += `?${params.join('&')}`
  
  return request(url, 'GET', null, token)
}

// Dashboard APIs
export async function fetchDashboardSummary(token) {
  return request('/api/dashboard/summary/', 'GET', null, token)
}

// Integration Credentials APIs
export async function fetchCredentials(token) {
  return request('/api/integrations/credentials/', 'GET', null, token)
}

export async function createCredential(token, payload) {
  return request('/api/integrations/credentials/', 'POST', payload, token)
}

export async function deleteCredential(token, id) {
  return request(`/api/integrations/credentials/${id}/`, 'DELETE', null, token)
}

// Discover APIs
export async function discoverStations(token, provider) {
  return request('/api/integrations/discover/stations/', 'POST', { provider }, token)
}

export async function discoverDevices(token, provider, stationId = null) {
  const body = { provider }
  if (stationId) body.station_id = stationId
  return request('/api/integrations/discover/devices/', 'POST', body, token)
}

// Background Task Sync
export async function triggerBackgroundSync(token, deviceId) {
  return request(`/api/integrations/sync/${deviceId}/`, 'POST', null, token)
}

export async function triggerBackfill(token, deviceId, payload) {
  // payload: start_date (YYYY-MM-DD), end_date (YYYY-MM-DD), granularity (1-4)
  return request(`/api/integrations/backfill/${deviceId}/`, 'POST', payload, token)
}

export async function fetchSyncLogs(token) {
  return request('/api/integrations/logs/', 'GET', null, token)
}
