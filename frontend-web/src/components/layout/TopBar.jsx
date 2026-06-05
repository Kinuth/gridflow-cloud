import React, { useState } from 'react'
import { Bell, Search, AlertTriangle, MonitorPlay, X, CheckCircle, AlertOctagon } from 'lucide-react'

export default function TopBar({
  currentView,
  setView,
  devices,
  selectedDevice,
  setSelectedDevice,
  alerts,
  isSimulated
}) {
  const [showAlerts, setShowAlerts] = useState(false)

  const getViewTitle = () => {
    switch (currentView) {
      case 'dashboard':
        return 'Executive Overview'
      case 'nodes':
        return 'Hardware Network'
      case 'tokenomics':
        return 'Shared Ledger & Tokenomics'
      case 'iot-config':
        return 'System Configuration'
      case 'profile':
        return 'User Account Settings'
      default:
        return 'Solar Microgrid Management'
    }
  }

  const activeAlertsList = alerts.filter(a => a.is_active)
  const activeAlertsCount = activeAlertsList.length

  return (
    <header className="h-16 border-b border-slate-800 bg-[#0B0F12]/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between px-8">
      {/* View Title */}
      <div>
        <h2 className="text-xl font-bold text-slate-100">{getViewTitle()}</h2>
      </div>

      {/* Center - Site Switcher Dropdown */}
      <div className="flex items-center gap-4">
        {devices.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Select Microgrid:</span>
            <select
              value={selectedDevice ? selectedDevice.id : ''}
              onChange={(e) => {
                const dev = devices.find(d => d.id === parseInt(e.target.value))
                if (dev) setSelectedDevice(dev)
              }}
              className="bg-[#12181D] text-slate-200 border border-slate-800 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              {devices.map(d => (
                <option key={d.id} value={d.id}>
                  {d.site_name || d.serial_number} ({d.serial_number})
                </option>
              ))}
            </select>
          </div>
        )}

        {isSimulated && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-amber-400 font-medium uppercase tracking-wider">Demo Mode</span>
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Alerts Badge */}
        <div className="relative">
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className="p-2 rounded-lg bg-slate-800/40 border border-slate-850 hover:bg-slate-800 transition-colors relative cursor-pointer focus:outline-none"
          >
            <Bell className="w-4.5 h-4.5 text-slate-300" />
            {activeAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center animate-bounce">
                {activeAlertsCount}
              </span>
            )}
          </button>

          {/* Alerts Dropdown Card */}
          {showAlerts && (
            <div className="absolute right-0 mt-3 w-80 bg-[#12181D]/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl p-4 z-50 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Active Alerts</span>
                <button
                  onClick={() => setShowAlerts(false)}
                  className="text-slate-400 hover:text-slate-200 text-xs"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {activeAlertsList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-slate-500 text-center space-y-2">
                    <CheckCircle className="w-8 h-8 text-emerald-500 stroke-[1.5]" />
                    <div className="text-xs">
                      <p className="font-semibold text-slate-350">System Clear</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">No active notifications or warning events.</p>
                    </div>
                  </div>
                ) : (
                  activeAlertsList.map(alert => (
                    <div
                      key={alert.id}
                      className={`p-2.5 rounded-lg border text-xs flex gap-2.5 items-start ${
                        alert.severity === 'CRITICAL'
                          ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                          : alert.severity === 'WARNING'
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                          : 'bg-slate-800/40 border-slate-750 text-slate-300'
                      }`}
                    >
                      <AlertOctagon className={`w-4 h-4 shrink-0 mt-0.5 ${
                        alert.severity === 'CRITICAL' ? 'text-rose-450' : 'text-amber-450'
                      }`} />
                      <div>
                        <div className="font-semibold">{alert.alert_name || alert.alert_code}</div>
                        <div className="text-[10px] opacity-75 mt-0.5">{new Date(alert.occurred_at).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Info / Profile Link */}
        <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
          <button
            onClick={() => setView('profile')}
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all cursor-pointer border focus:outline-none hover:scale-105 active:scale-95 ${
              currentView === 'profile'
                ? 'bg-emerald-500 text-slate-900 border-emerald-400 shadow-md shadow-emerald-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
            }`}
            title="View Account Profile"
          >
            GF
          </button>
        </div>
      </div>
    </header>
  )
}
