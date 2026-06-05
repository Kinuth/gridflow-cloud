import React, { useState, useEffect } from 'react'
import { login, register, triggerManualSync, fetchDeviceAlerts } from './api'
import Sidebar from './components/layout/Sidebar'
import TopBar from './components/layout/TopBar'
import Dashboard from './views/Dashboard'
import NodeManagement from './views/NodeManagement'
import Tokenomics from './views/Tokenomics'
import IoTConfig from './views/IoTConfig'
import useLiveTelemetry from './hooks/useLiveTelemetry'
import Profile from './views/Profile'
import { CloudLightning, Check, AlertCircle, ArrowRight, Sun, ShieldCheck } from 'lucide-react'

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('apiToken') || '')
  const [currentView, setView] = useState('dashboard')
  const [authView, setAuthView] = useState('login') // login or register

  // Auth form states
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accountType, setAccountType] = useState('individual')
  const [orgName, setOrgName] = useState('')
  const [orgType, setOrgType] = useState('HOUSEHOLD')
  const [agreeTerms, setAgreeTerms] = useState(true)
  const [error, setError] = useState('')
  const [language, setLanguage] = useState('English')

  // Telemetry status
  const {
    devices,
    selectedDevice,
    setSelectedDevice,
    latestTelemetry,
    hourlyData,
    loading,
    error: apiError,
    isSeeding,
    isSimulated,
    seedDefaultDevices,
    refreshDevices,
    createDevice,
    deleteDevice
  } = useLiveTelemetry(token)

  const [alerts, setAlerts] = useState([])
  const [isSyncing, setIsSyncing] = useState(false)

  // Fetch alerts if a device is selected
  useEffect(() => {
    if (!token || !selectedDevice) return
    const loadAlerts = async () => {
      try {
        const rows = await fetchDeviceAlerts(token, selectedDevice.id)
        if (rows && !rows.detail) setAlerts(rows)
      } catch (err) {
        console.error('Failed to load alerts from Django:', err)
      }
    }
    loadAlerts()
  }, [token, selectedDevice, latestTelemetry])

  // Login handler
  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const apiToken = await login(username, password)
      setToken(apiToken)
      localStorage.setItem('apiToken', apiToken)
    } catch (err) {
      setError(err.message || 'Login credentials rejected.')
    }
  }

  // Register handler
  const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    if (!agreeTerms) {
      setError('You must agree to the Terms of Service.')
      return
    }
    setError('')
    try {
      const payload = { username, password, email }
      if (accountType === 'organization') {
        if (!orgName) throw new Error('Organization name required')
        payload.organization_name = orgName
        payload.org_type = orgType
      }
      const res = await register(payload)
      const apiToken = res.token
      setToken(apiToken)
      localStorage.setItem('apiToken', apiToken)
    } catch (err) {
      setError(err.message || 'Registration failed.')
    }
  }

  // Bypass auth for standalone test
  const handleDemoBypass = () => {
    const fakeToken = 'DEMO_BYPASS_TOKEN_4451'
    setToken(fakeToken)
    localStorage.setItem('apiToken', fakeToken)
  }

  const handleSignOut = () => {
    localStorage.removeItem('apiToken')
    setToken('')
    setView('dashboard')
  }

  // Handle hardware manual sync
  const handleManualSync = async (deviceId) => {
    setIsSyncing(true)
    try {
      await triggerManualSync(token, deviceId)
      await refreshDevices()
    } catch (err) {
      console.warn('Manual sync api error:', err)
      // Jitter trigger simulated locally anyway if backend cloud connection fails
      alert('Sync dispatched. Note: Since upstream solar servers require live credentials, visual data is being populated locally.')
    } finally {
      setIsSyncing(false)
    }
  }

  // Handle adding new device
  const handleCreateDevice = async (payload) => {
    try {
      await createDevice(payload)
    } catch (err) {
      console.error(err)
      alert('Failed to register node: ' + err.message)
    }
  }

  const handleDeleteDevice = async (deviceId) => {
    try {
      await deleteDevice(deviceId)
    } catch (err) {
      console.error(err)
      alert('Failed to delete node: ' + err.message)
    }
  }

  // Auth Gate
  if (!token) {
    return (
      <div className="min-h-screen bg-[#0B0F12] text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />

        <div className="w-full max-w-md bg-[#12181D]/80 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-md relative">
          
          {/* Logo Brand Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-4">
              <CloudLightning className="w-6 h-6 text-slate-900 stroke-[2.5]" />
            </div>
            <h1 className="text-xl font-bold text-slate-100">GridFlow Cloud</h1>
            <p className="text-xs text-slate-400 mt-1">Solar Microgrid Management Platform</p>
          </div>

          {/* Tab Selector */}
          <div className="flex border-b border-slate-800 pb-3 mb-6">
            <button
              onClick={() => { setAuthView('login'); setError(''); }}
              className={`flex-1 text-center pb-2 text-sm font-semibold border-b-2 transition-all ${
                authView === 'login' ? 'border-emerald-500 text-emerald-400 font-bold' : 'border-transparent text-slate-400'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setAuthView('register'); setError(''); }}
              className={`flex-1 text-center pb-2 text-sm font-semibold border-b-2 transition-all ${
                authView === 'register' ? 'border-emerald-500 text-emerald-400 font-bold' : 'border-transparent text-slate-400'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Form validation alert */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/35 text-rose-400 text-xs p-3 rounded-lg flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Language selector (Inspired by German/English dropdown in login wireframe) */}
          <div className="flex justify-end mb-4">
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="bg-[#12181D] text-slate-400 border border-slate-850 text-[10px] rounded px-2 py-0.5 cursor-pointer focus:outline-none"
            >
              <option value="English">English</option>
              <option value="German">German</option>
              <option value="Swahili">Swahili</option>
            </select>
          </div>

          {/* Form login views */}
          {authView === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">User Name</label>
                <input
                  type="text"
                  placeholder="operator_one"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-[#1E293B]/40 text-slate-200 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none placeholder-slate-650"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">Password</label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-[#1E293B]/40 text-slate-200 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none placeholder-slate-650"
                  required
                />
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-450">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={e => setAgreeTerms(e.target.checked)}
                    className="accent-emerald-500 rounded border-slate-850 bg-transparent cursor-pointer"
                  />
                  <span>Keep me logged in</span>
                </label>
                <a href="#" className="hover:text-emerald-450 hover:underline">Forgot password?</a>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-100 text-xs font-bold rounded-lg transition-all active:scale-95 shadow shadow-emerald-600/10 cursor-pointer"
              >
                Log In
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">Register account as</label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-1.5 text-xs text-slate-350 cursor-pointer">
                    <input
                      type="radio"
                      checked={accountType === 'individual'}
                      onChange={() => setAccountType('individual')}
                      className="accent-emerald-500"
                    />
                    <span>Individual Owner</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-350 cursor-pointer">
                    <input
                      type="radio"
                      checked={accountType === 'organization'}
                      onChange={() => setAccountType('organization')}
                      className="accent-emerald-500"
                    />
                    <span>Organization</span>
                  </label>
                </div>
              </div>

              {accountType === 'organization' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-900/30 border border-slate-850 rounded-xl">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Org Name</label>
                    <input
                      type="text"
                      placeholder="e.g. CleanGrid Ltd"
                      value={orgName}
                      onChange={e => setOrgName(e.target.value)}
                      className="w-full bg-[#1E293B]/40 text-slate-200 border border-slate-800 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none placeholder-slate-650"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Org Type</label>
                    <select
                      value={orgType}
                      onChange={e => setOrgType(e.target.value)}
                      className="w-full bg-[#12181D] text-slate-200 border border-slate-800 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                    >
                      <option value="HOUSEHOLD">Household</option>
                      <option value="SME">SME Cluster</option>
                      <option value="CI">Commercial / C&I</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">User Name</label>
                <input
                  type="text"
                  placeholder="e.g. operator_chama"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-[#1E293B]/40 text-slate-200 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none placeholder-slate-650"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">Email Address</label>
                <input
                  type="email"
                  placeholder="name@microgrid.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-[#1E293B]/40 text-slate-200 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none placeholder-slate-650"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">Password</label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-[#1E293B]/40 text-slate-200 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none placeholder-slate-650"
                  required
                />
              </div>

              <div className="flex items-center gap-1.5 text-[10px] text-slate-450 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={e => setAgreeTerms(e.target.checked)}
                  className="accent-emerald-500 rounded border-slate-850 bg-transparent cursor-pointer"
                />
                <span>I agree to PPA Terms & Privacy Policies</span>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-100 text-xs font-bold rounded-lg transition-all active:scale-95 shadow shadow-emerald-600/10 cursor-pointer"
              >
                Create Account
              </button>
            </form>
          )}

          {/* Bypass Auth button (Simulated Local Mode) */}
          <div className="border-t border-slate-850 mt-6 pt-5 text-center">
            <p className="text-[10px] text-slate-500 mb-2">No running Django backend server on localhost:8000?</p>
            <button
              onClick={handleDemoBypass}
              className="inline-flex items-center gap-2 hover:bg-slate-800 text-emerald-450 hover:text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/40 text-[10px] font-bold px-4 py-1.5 rounded-full transition-all cursor-pointer"
            >
              <span>Explore Offline Demo Mode</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

        </div>
      </div>
    )
  }

  // Signed In Dashboard View
  return (
    <div className="min-h-screen bg-[#0B0F12] text-slate-100 flex">
      {/* Fixed Left Navigation Sidebar */}
      <Sidebar
        currentView={currentView}
        setView={setView}
        activeNode={selectedDevice}
        onSignOut={handleSignOut}
      />

      {/* Main Container */}
      <div className="flex-1 pl-72 min-h-screen flex flex-col bg-[#0B0F12]">
        
        {/* Sticky Topbar */}
        <TopBar
          currentView={currentView}
          setView={setView}
          devices={devices}
          selectedDevice={selectedDevice}
          setSelectedDevice={setSelectedDevice}
          alerts={alerts}
          isSimulated={isSimulated}
        />

        {/* Content routing */}
        <main className="flex-1">
          {currentView === 'dashboard' && (
            <Dashboard
              token={token}
              latestTelemetry={latestTelemetry}
              hourlyData={hourlyData}
              selectedDevice={selectedDevice}
              isSimulated={isSimulated}
              onTriggerSync={handleManualSync}
              isSyncing={isSyncing}
            />
          )}

          {currentView === 'nodes' && (
            <NodeManagement
              token={token}
              devices={devices}
              selectedDevice={selectedDevice}
              setSelectedDevice={setSelectedDevice}
              latestTelemetry={latestTelemetry}
              onCreateDevice={handleCreateDevice}
              onDeleteDevice={handleDeleteDevice}
              onSeedDefault={seedDefaultDevices}
              isSeeding={isSeeding}
              refreshDevices={refreshDevices}
            />
          )}

          {currentView === 'tokenomics' && (
            <Tokenomics
              devices={devices}
            />
          )}

          {currentView === 'iot-config' && (
            <IoTConfig
              token={token}
              latestTelemetry={latestTelemetry}
              selectedDevice={selectedDevice}
            />
          )}

          {currentView === 'profile' && (
            <Profile
              token={token}
              username={username}
              email={email}
              accountType={accountType}
              orgName={orgName}
              orgType={orgType}
              onSignOut={handleSignOut}
            />
          )}
        </main>
      </div>
    </div>
  )
}
