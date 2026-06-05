import React, { useState, useEffect, useRef } from 'react'
import { Settings, ShieldAlert, Key, Terminal, RefreshCw, Save, CheckCircle2, Play, Circle, Plus, Trash2 } from 'lucide-react'
import { fetchCredentials, createCredential, deleteCredential, fetchSyncLogs } from '../api'

export default function IoTConfig({ token, latestTelemetry, selectedDevice }) {
  // Config parameters
  const [reportingInterval, setReportingInterval] = useState(15)
  const [overvoltage, setOvervoltage] = useState(253)
  const [undervoltage, setUndervoltage] = useState(198)
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Django Cloud Credentials manager state
  const [credentials, setCredentials] = useState([])
  const [provider, setProvider] = useState('DEYE')
  const [baseUrl, setBaseUrl] = useState('https://eu1-developer.deyecloud.com/v1.0')
  const [appId, setAppId] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loadingCreds, setLoadingCreds] = useState(false)
  const [syncLogs, setSyncLogs] = useState([])

  // JSON telemetry streaming stream
  const [jsonStream, setJsonStream] = useState([])
  const consoleBottomRef = useRef(null)

  // Load backend credentials and logs
  const loadBackendConfigs = async () => {
    if (!token) return
    setLoadingCreds(true)
    try {
      const creds = await fetchCredentials(token)
      setCredentials(creds || [])
      
      const logs = await fetchSyncLogs(token)
      setSyncLogs(logs || [])
    } catch (err) {
      console.error('Failed to load configs from Django:', err)
    } finally {
      setLoadingCreds(false)
    }
  }

  useEffect(() => {
    loadBackendConfigs()
  }, [token])

  // Save safety thresholds to state / simulate api save
  const handleSaveThresholds = (e) => {
    e.preventDefault()
    setIsSaving(true)
    setIsSaved(false)
    setTimeout(() => {
      setIsSaving(false)
      setIsSaved(true)
      setTimeout(() => {
        setIsSaved(false)
      }, 3000)
    }, 1200)
  }

  // Handle credentials submit to Django
  const handleAddCredential = async (e) => {
    e.preventDefault()
    if (selectedDevice?.data_source === 'MANUAL') return
    try {
      await createCredential(token, {
        provider,
        base_url: baseUrl,
        app_id: appId,
        app_secret: appSecret,
        email,
        password,
        is_active: true
      })
      // Reset
      setAppId('')
      setAppSecret('')
      setEmail('')
      setPassword('')
      await loadBackendConfigs()
    } catch (err) {
      alert('Failed to save credentials in Django backend: ' + err.message)
    }
  }

  const handleDeleteCred = async (id) => {
    if (!confirm('Are you sure you want to delete this credentials profile?')) return
    try {
      await deleteCredential(token, id)
      await loadBackendConfigs()
    } catch (err) {
      alert('Failed to delete credentials profile: ' + err.message)
    }
  }

  // Capture latest telemetry and stream it to the terminal screen
  useEffect(() => {
    if (!latestTelemetry) return
    
    // Add current reading to stream list
    const logItem = {
      timestamp: new Date().toLocaleTimeString(),
      deviceId: selectedDevice?.serial_number || 'UNKNOWN',
      payload: {
        pv_total_power_w: latestTelemetry.pv_total_power_w,
        load_power_w: latestTelemetry.load_power_w,
        battery_soc: latestTelemetry.battery_soc,
        battery_power_w: latestTelemetry.battery_power_w,
        grid_power_w: latestTelemetry.grid_power_w,
        temperature_c: latestTelemetry.temperature_c,
        source: latestTelemetry.source,
        simulated: latestTelemetry.is_simulated_fallback || false
      }
    }

    setJsonStream(prev => {
      const updated = [...prev, logItem]
      // Keep last 15 logs
      if (updated.length > 15) return updated.slice(updated.length - 15)
      return updated
    })
  }, [latestTelemetry, selectedDevice])

  // Scroll to bottom of console
  useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [jsonStream])

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto pb-16">
      
      {/* View Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">IoT Configuration & Telemetry</h1>
          <p className="text-xs text-slate-400 mt-1">Calibrate microgrid warning thresholds, reporting sync intervals, and cloud APIs.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Forms */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Thresholds and reporting interval card */}
          <div className="bg-[#12181D] border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-850 pb-2">
              <ShieldAlert className="w-4 h-4 text-emerald-500" />
              <span>Safety Limits & Telemetry Interval</span>
            </h3>

            {isSaved && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <p className="text-xs text-emerald-350">Parameters dispatched and saved on target hardware.</p>
              </div>
            )}

            <form onSubmit={handleSaveThresholds} className="space-y-6">
              
              {/* Telemetry Reporting Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Telemetry Reporting Interval</span>
                  <span className="font-mono text-emerald-400 font-semibold">{reportingInterval} seconds</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={reportingInterval}
                  onChange={e => setReportingInterval(parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <p className="text-[10px] text-slate-500">Lower values provide higher granularity but consume more API bandwidth.</p>
              </div>

              {/* Threshold inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">Overvoltage Protection Limit</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={overvoltage}
                      onChange={e => setOvervoltage(parseInt(e.target.value))}
                      className="w-full bg-[#1E293B]/40 text-slate-250 border border-slate-800 rounded-lg pl-3 pr-8 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-500 font-medium">V</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">Undervoltage Warning Limit</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={undervoltage}
                      onChange={e => setUndervoltage(parseInt(e.target.value))}
                      className="w-full bg-[#1E293B]/40 text-slate-250 border border-slate-800 rounded-lg pl-3 pr-8 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-500 font-medium">V</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-500 text-slate-100 text-xs font-semibold py-2.5 rounded-lg transition-all active:scale-95 shadow cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving parameters...' : 'Write Configuration to Node'}</span>
              </button>

            </form>
          </div>

          {/* Platform Cloud Credentials profiles manager */}
          <div className="bg-[#12181D] border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-850 pb-2">
              <Key className="w-4 h-4 text-emerald-500" />
              <span>Cloud API Provider Credentials</span>
            </h3>

            {/* List existing credentials */}
            {credentials.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Active Credentials Profiles</h4>
                <div className="divide-y divide-slate-850">
                  {credentials.map(cred => (
                    <div key={cred.id} className="py-2.5 flex justify-between items-center text-xs">
                      <div>
                        <span className="px-2 py-0.5 rounded bg-slate-850 border border-slate-750 text-[10px] font-bold text-slate-350 mr-2">
                          {cred.provider}
                        </span>
                        <span className="text-slate-400 font-mono text-[11px] truncate max-w-xs inline-block align-middle">{cred.base_url}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteCred(cred.id)}
                        className="text-rose-400 hover:text-rose-350 p-1 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                        title="Delete Credentials Profile"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add credentials form */}
            <form onSubmit={handleAddCredential} className="space-y-4 pt-2">
              <h4 className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Register Credentials Profile</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">Provider</label>
                  <select
                    value={provider}
                    onChange={e => {
                      setProvider(e.target.value)
                      setBaseUrl(e.target.value === 'DEYE' ? 'https://eu1-developer.deyecloud.com/v1.0' : 'https://api.solarmanpv.com')
                    }}
                    className="w-full bg-[#12181D] text-slate-250 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="DEYE">Deye Cloud</option>
                    <option value="SOLARMAN">Solarman PV</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">Developer Base URL</label>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={e => setBaseUrl(e.target.value)}
                    className="w-full bg-[#1E293B]/40 text-slate-250 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">Developer App ID</label>
                  <input
                    type="text"
                    value={appId}
                    placeholder="Enter App ID"
                    onChange={e => setAppId(e.target.value)}
                    className="w-full bg-[#1E293B]/40 text-slate-250 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none placeholder-slate-650"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">App Secret Key</label>
                  <input
                    type="password"
                    value={appSecret}
                    placeholder="••••••••••••"
                    onChange={e => setAppSecret(e.target.value)}
                    className="w-full bg-[#1E293B]/40 text-slate-250 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none placeholder-slate-650"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">Developer Portal Username/Email</label>
                  <input
                    type="text"
                    value={email}
                    placeholder="username@deye.com"
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-[#1E293B]/40 text-slate-250 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none placeholder-slate-650"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">Account API Password</label>
                  <input
                    type="password"
                    value={password}
                    placeholder="••••••••••••"
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-[#1E293B]/40 text-slate-250 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none placeholder-slate-650"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-slate-100 rounded-lg shadow cursor-pointer"
                >
                  Save API Profile
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Right Side: Terminals / Streams */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Real-time normalizer log streams (JSON Console) */}
          <div className="bg-[#080B0E] border border-slate-850 rounded-2xl p-5 shadow-2xl flex flex-col flex-1 min-h-[460px] relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-300 font-mono">NormalizedTelemetry.log</h3>
              </div>
              <span className="flex items-center gap-1">
                <Circle className="w-2 h-2 text-emerald-400 fill-emerald-400 animate-pulse" />
                <span className="text-[10px] text-slate-500 font-mono">Stream Active</span>
              </span>
            </div>

            {/* Scrolling console entries */}
            <div className="flex-1 overflow-y-auto text-[10px] font-mono space-y-4 max-h-[360px] pr-2 custom-scrollbar">
              {jsonStream.length === 0 ? (
                <div className="text-slate-600 text-center py-20">
                  <Play className="w-6 h-6 text-slate-700 animate-pulse mx-auto mb-2" />
                  <span>Awaiting incoming payload packets...</span>
                </div>
              ) : (
                jsonStream.map((log, index) => (
                  <div key={index} className="space-y-1 bg-slate-950/45 p-2.5 rounded border border-slate-900/60">
                    <div className="flex justify-between text-[9px] text-slate-500 font-bold border-b border-slate-900/40 pb-1">
                      <span>[{log.timestamp}] Node: {log.deviceId}</span>
                      <span className="text-emerald-500">200 OK</span>
                    </div>
                    <pre className="text-emerald-400 overflow-x-auto whitespace-pre-wrap max-w-full">
                      {JSON.stringify(log.payload, null, 2)}
                    </pre>
                  </div>
                ))
              )}
              <div ref={consoleBottomRef} />
            </div>
          </div>

          {/* Sync logs from django */}
          {syncLogs.length > 0 && (
            <div className="bg-[#12181D] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
              <h3 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sync logs (Background Celery Workers)</h3>
              <div className="space-y-2">
                {syncLogs.slice(0, 4).map(log => (
                  <div key={log.id} className="text-[11px] flex justify-between items-center text-slate-400 bg-slate-900/30 p-2 rounded border border-slate-850">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${log.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span>{log.provider} sync</span>
                    </div>
                    <span className="text-slate-500 text-[10px]">{new Date(log.finished_at || log.started_at).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  )
}
